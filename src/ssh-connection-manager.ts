import { Client, ClientChannel } from "ssh2";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as os from "os";
import * as path from "path";
import {
  SSHConnection,
  SSHConnectionConfig,
  ConnectionStatus,
  CommandResult,
  CommandOptions,
  CommandHistoryEntry,
  ErrorResponse,
  QueuedCommand,
  QUEUE_CONSTANTS,
} from "./types.js";

export interface ISSHConnectionManager {
  getTerminalHistory(sessionName: string): TerminalOutputEntry[];
  addTerminalOutputListener(
    sessionName: string,
    callback: (entry: TerminalOutputEntry) => void,
  ): void;
  removeTerminalOutputListener(
    sessionName: string,
    callback: (entry: TerminalOutputEntry) => void,
  ): void;
  hasSession(name: string): boolean;
  sendTerminalInput(sessionName: string, input: string): void;
  sendTerminalSignal(sessionName: string, signal: string): void;
  resizeTerminal(sessionName: string, cols: number, rows: number): void;
  getCommandHistory(sessionName: string): CommandHistoryEntry[];
  addCommandHistoryListener(
    sessionName: string,
    callback: (entry: CommandHistoryEntry) => void,
  ): void;
  removeCommandHistoryListener(
    sessionName: string,
    callback: (entry: CommandHistoryEntry) => void,
  ): void;
}

export interface TerminalOutputEntry {
  timestamp: number;
  output: string;
  stream: "stdout" | "stderr";
  rawOutput: string;
  preserveFormatting: boolean;
  vt100Compatible: boolean;
  encoding: string;
  source?: import("./types.js").CommandSource;
}

interface TerminalOutputListener {
  callback: (entry: TerminalOutputEntry) => void;
  sessionName: string;
}

interface CommandHistoryListener {
  callback: (entry: CommandHistoryEntry) => void;
  sessionName: string;
}

interface SessionData {
  connection: SSHConnection;
  client: Client;
  config: SSHConnectionConfig;
  shellChannel?: ClientChannel;
  isShellReady: boolean;
  initialPromptShown: boolean;
  outputBuffer: TerminalOutputEntry[];
  outputListeners: TerminalOutputListener[];
  commandHistory: CommandHistoryEntry[];
  commandHistoryListeners: CommandHistoryListener[];
  currentCommand?: {
    command: string;
    resolve: (result: CommandResult) => void;
    reject: (error: Error) => void;
    options: CommandOptions;
    stdout: string;
    stderr: string;
    startTime: number;
    timeoutHandle?: ReturnType<typeof setTimeout>;
  };
  // Command queue for handling concurrent commands
  commandQueue: QueuedCommand[];
  isCommandExecuting: boolean;
}

// Terminal output streaming interfaces

export class SSHConnectionManager implements ISSHConnectionManager {
  private connections: Map<string, SessionData> = new Map();
  private webServerPort: number;

  constructor(webServerPort: number = 8080) {
    this.webServerPort = webServerPort;
  }

  updateWebServerPort(port: number): void {
    this.webServerPort = port;
  }

  getWebServerPort(): number {
    return this.webServerPort;
  }

  // Terminal output streaming methods

  addTerminalOutputListener(
    sessionName: string,
    callback: (entry: TerminalOutputEntry) => void,
  ): void {
    const sessionData = this.connections.get(sessionName);
    if (sessionData) {
      sessionData.outputListeners.push({ callback, sessionName });
    }
  }

  removeTerminalOutputListener(
    sessionName: string,
    callback: (entry: TerminalOutputEntry) => void,
  ): void {
    const sessionData = this.connections.get(sessionName);
    if (sessionData) {
      sessionData.outputListeners = sessionData.outputListeners.filter(
        (listener) => listener.callback !== callback,
      );
    }
  }

  getTerminalHistory(sessionName: string): TerminalOutputEntry[] {
    const sessionData = this.connections.get(sessionName);
    return sessionData ? [...sessionData.outputBuffer] : [];
  }

  // Send live updates to connected browsers without storing in history
  private broadcastToLiveListeners(
    sessionName: string,
    data: string,
    stream: "stdout" | "stderr" = "stdout",
    source?: import("./types.js").CommandSource,
  ): void {
    const sessionData = this.connections.get(sessionName);
    if (!sessionData) return;

    console.log('📡 broadcastToLiveListeners called:', {
      sessionName,
      dataLength: data.length,
      data: JSON.stringify(data),
      source,
      stream,
      callStack: new Error().stack?.split('\n').slice(1, 3).join(' -> ')
    });

    // CRITICAL FIX: Data already has CRLF from completeSimpleCommand - don't convert again!
    // This prevents the triple CRLF conversion bug (\r\r\r\n)
    const browserOutput = data; // Use data as-is, already properly converted
    
    const outputEntry: TerminalOutputEntry = {
      timestamp: Date.now(),
      output: browserOutput,
      stream,
      rawOutput: data,
      preserveFormatting: true,
      vt100Compatible: true,
      encoding: "utf8",
      source,
    };

    // Only notify live listeners - don't store in history
    sessionData.outputListeners.forEach((listener) => {
      try {
        listener.callback(outputEntry);
      } catch (error) {
        console.warn(
          `Failed to notify terminal listener for session ${sessionName}:`,
          error,
        );
      }
    });
  }

  // Store complete terminal interaction in history for new connections
  private storeInHistory(
    sessionName: string,
    data: string,
    stream: "stdout" | "stderr" = "stdout",
    source?: import("./types.js").CommandSource,
  ): void {
    const sessionData = this.connections.get(sessionName);
    if (!sessionData) return;

    // CRITICAL FIX: Data already has CRLF from completeSimpleCommand - don't convert again!
    // This prevents the triple CRLF conversion bug (\r\r\r\n)
    const browserOutput = data; // Use data as-is, already properly converted
    
    const outputEntry: TerminalOutputEntry = {
      timestamp: Date.now(),
      output: browserOutput,
      stream,
      rawOutput: data,
      preserveFormatting: true,
      vt100Compatible: true,
      encoding: "utf8",
      source,
    };

    // Only store in history buffer (keep last 1000 entries)
    sessionData.outputBuffer.push(outputEntry);
    if (sessionData.outputBuffer.length > 1000) {
      sessionData.outputBuffer.shift();
    }
  }


  async createConnection(config: SSHConnectionConfig): Promise<SSHConnection> {
    // Validate session name
    this.validateSessionName(config.name);

    // Check for unique session name
    if (this.connections.has(config.name)) {
      throw new Error(`Session name '${config.name}' already exists`);
    }

    // Process authentication credentials with priority: privateKey > keyFilePath > password
    let resolvedPrivateKey: string | undefined;
    
    if (config.privateKey) {
      // Priority 1: Use privateKey directly if provided
      resolvedPrivateKey = config.privateKey;
    } else if (config.keyFilePath !== undefined) {
      // Priority 2: Read key from file if keyFilePath is provided
      try {
        resolvedPrivateKey = await this.readPrivateKeyFromFile(config.keyFilePath, config.passphrase);
      } catch (error) {
        // Sanitize error message to avoid leaking sensitive path information
        const sanitizedError = this.sanitizeKeyFileError(error as Error);
        throw new Error(`Failed to read key file: ${sanitizedError}`);
      }
    }

    const client = new Client();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.destroy();
        reject(new Error("Connection timeout after 10 seconds"));
      }, 10000);

      client.on("ready", () => {
        clearTimeout(timeout);

        // Connection established - shell initialization will handle the initial prompt

        const connection: SSHConnection = {
          name: config.name,
          host: config.host,
          username: config.username,
          status: ConnectionStatus.CONNECTED,
          lastActivity: new Date(),
        };

        const sessionData: SessionData = {
          connection,
          client,
          config,
          isShellReady: false,
          initialPromptShown: false,
          outputBuffer: [],
          outputListeners: [],
          commandHistory: [],
          commandHistoryListeners: [],
          commandQueue: [],
          isCommandExecuting: false,
        };

        this.connections.set(config.name, sessionData);

        // Initialize persistent shell session
        this.initializeShellSession(sessionData)
          .then(() => {
            resolve(connection);
          })
          .catch((error) => {
            client.destroy();
            this.connections.delete(config.name);
            reject(error);
          });
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        client.destroy();
        reject(err);
      });

      // Establish connection
      const connectConfig: {
        host: string;
        username: string;
        password?: string;
        privateKey?: string;
        passphrase?: string;
      } = {
        host: config.host,
        username: config.username,
      };

      if (resolvedPrivateKey) {
        connectConfig.privateKey = resolvedPrivateKey;
        // Always pass passphrase if provided - let ssh2 library handle encryption detection
        // The ssh2 library is much better at detecting encrypted keys than our heuristics
        if (config.passphrase) {
          connectConfig.passphrase = config.passphrase;
        }
      } else if (config.password) {
        connectConfig.password = config.password;
      }

      client.connect(connectConfig);
    });
  }

  private async initializeShellSession(
    sessionData: SessionData,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      sessionData.client.shell((err, channel) => {
        if (err) {
          reject(err);
          return;
        }

        sessionData.shellChannel = channel;
        let initOutput = "";

        const onData = (data: Buffer): void => {
          initOutput += data.toString();

          // Enhanced prompt detection with multiple patterns
          const hasPrompt = this.detectShellPrompt(initOutput);

          if (hasPrompt) {
            channel.removeListener("data", onData);
            sessionData.isShellReady = true;
            sessionData.initialPromptShown = true;
            this.setupShellHandlers(sessionData);

            // MISSING INITIAL PROMPT FIX: Broadcast initial prompt so browser terminals can display it
            // Convert line endings to CRLF for xterm.js compatibility
            const initialPromptOutput = initOutput.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
            this.broadcastToLiveListeners(sessionData.connection.name, initialPromptOutput, "stdout", 'system');
            this.storeInHistory(sessionData.connection.name, initialPromptOutput, "stdout", 'system');

            resolve();
          }
        };

        channel.on("data", onData);

        // Send initial newline to trigger prompt display
        // This ensures the shell displays its prompt without relying on timeouts
        channel.write("\n");

        channel.on("close", () => {
          sessionData.isShellReady = false;
          sessionData.shellChannel = undefined;
        });
      });
    });
  }

  private detectShellPrompt(output: string): boolean {
    // Enhanced shell prompt detection
    const lines = output.split("\n");
    const lastLine = lines[lines.length - 1] || "";
    const secondLastLine = lines[lines.length - 2] || "";

    // Check multiple prompt patterns
    const promptPatterns = [
      /\$\s*$/, // $ at end of line
      /#\s*$/, // # at end of line
      />\s*$/, // > at end of line
      /[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+.*[$#>]\s*$/, // user@host...$ pattern
      /\[[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+.*\][$#>]\s*$/, // [user@host...]$ pattern
    ];

    // Check if any line ends with a prompt pattern
    for (const pattern of promptPatterns) {
      if (pattern.test(lastLine) || pattern.test(secondLastLine)) {
        return true;
      }
    }

    // Also check for simple prompt indicators
    return (
      output.includes("$ ") || output.includes("# ") || output.includes("> ")
    );
  }

  private setupShellHandlers(sessionData: SessionData): void {
    if (!sessionData.shellChannel) {
      return;
    }

    // ARCHITECTURAL FIX: Remove permanent data handler entirely
    // The permanent handler was competing with temporary command handlers,
    // causing duplicate processing of the same shell output data.
    // Now only temporary handlers (added per command) will process output.
    
    // Keep minimal stderr handler only for error accumulation during commands
    sessionData.shellChannel.stderr?.on("data", (data: Buffer) => {
      const output = data.toString();
      
      // Only accumulate stderr during command execution
      if (sessionData.currentCommand) {
        sessionData.currentCommand.stderr += output;
      }
    });
  }

  async executeCommand(
    connectionName: string,
    command: string,
    options: CommandOptions = {},
  ): Promise<CommandResult> {
    // Validate command source FIRST for security - must be the very first action
    if (options.source !== undefined) {
      this.validateCommandSource(options.source);
    }
    
    const sessionData = this.getValidatedSession(connectionName);

    // Require shell session to be ready for session state persistence
    if (!sessionData.isShellReady || !sessionData.shellChannel) {
      throw new Error(
        `Shell session not ready for connection '${connectionName}'. Cannot maintain session state without active shell.`,
      );
    }

    return new Promise((resolve, reject) => {
      // SECURITY FIX: Check queue size limit to prevent DoS attacks
      if (sessionData.commandQueue.length >= QUEUE_CONSTANTS.MAX_QUEUE_SIZE) {
        reject(new Error(
          `Command queue is full. Maximum ${QUEUE_CONSTANTS.MAX_QUEUE_SIZE} commands allowed per session.`
        ));
        return;
      }

      const queuedCommand: QueuedCommand = {
        command,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Add command to queue
      sessionData.commandQueue.push(queuedCommand);

      // Process queue (will execute immediately if no command is running)
      this.processCommandQueue(sessionData);
    });
  }

  private processCommandQueue(sessionData: SessionData): void {
    // RACE CONDITION FIX: Make queue processing atomic
    // Check execution state and queue length atomically to prevent race conditions
    if (sessionData.isCommandExecuting || sessionData.commandQueue.length === 0) {
      return;
    }

    // Clean stale commands before processing (optional robustness feature)
    this.cleanStaleCommands(sessionData);

    // After cleaning, re-check if queue is empty
    if (sessionData.commandQueue.length === 0) {
      return;
    }

    // Atomically get the next command and mark execution as started
    const queuedCommand = sessionData.commandQueue.shift();
    if (!queuedCommand) {
      return;
    }

    // Mark that we're now executing a command IMMEDIATELY after getting command
    // This prevents race conditions where multiple threads see isCommandExecuting as false
    sessionData.isCommandExecuting = true;

    // Convert queued command to the format expected by executeCommandInShell
    const commandEntry = {
      command: queuedCommand.command,
      resolve: queuedCommand.resolve,
      reject: queuedCommand.reject,
      options: queuedCommand.options,
    };

    // Execute the command
    this.executeCommandInShell(sessionData, commandEntry);
  }

  /**
   * Clean stale commands from queue to prevent memory leaks and improve responsiveness
   * Commands older than MAX_COMMAND_AGE_MS are rejected with appropriate error
   */
  private cleanStaleCommands(sessionData: SessionData): void {
    const currentTime = Date.now();
    const initialQueueLength = sessionData.commandQueue.length;
    
    // Filter out stale commands and reject them
    sessionData.commandQueue = sessionData.commandQueue.filter((queuedCommand) => {
      const commandAge = currentTime - queuedCommand.timestamp;
      
      if (commandAge > QUEUE_CONSTANTS.MAX_COMMAND_AGE_MS) {
        // Reject stale command with appropriate error
        queuedCommand.reject(new Error(
          `Command expired after ${Math.round(commandAge / 1000)}s in queue. ` +
          `Maximum age is ${Math.round(QUEUE_CONSTANTS.MAX_COMMAND_AGE_MS / 1000)}s.`
        ));
        return false; // Remove from queue
      }
      
      return true; // Keep in queue
    });
    
    const cleanedCount = initialQueueLength - sessionData.commandQueue.length;
    if (cleanedCount > 0) {
      console.log(`Cleaned ${cleanedCount} stale commands from queue for session ${sessionData.connection.name}`);
    }
  }

  private executeCommandInShell(
    sessionData: SessionData,
    commandEntry: {
      command: string;
      resolve: (result: CommandResult) => void;
      reject: (error: Error) => void;
      options: CommandOptions;
    },
  ): void {
    if (!sessionData.shellChannel) {
      commandEntry.reject(new Error("Shell channel not available"));
      // Clear execution flag and process next command
      sessionData.isCommandExecuting = false;
      this.processCommandQueue(sessionData);
      return;
    }

    // Prevent shell-terminating commands
    const trimmedCommand = commandEntry.command.trim();
    if (trimmedCommand === "exit" || trimmedCommand.startsWith("exit ")) {
      commandEntry.reject(
        new Error(
          `Command '${trimmedCommand}' would terminate the shell session`,
        ),
      );
      // Clear execution flag and process next command
      sessionData.isCommandExecuting = false;
      this.processCommandQueue(sessionData);
      return;
    }

    const executionStartTime = Date.now();
    sessionData.currentCommand = {
      command: commandEntry.command,
      resolve: commandEntry.resolve,
      reject: commandEntry.reject,
      options: commandEntry.options,
      stdout: "",
      stderr: "",
      startTime: executionStartTime,
    };

    let outputBuffer = "";
    let hasPrompt = false;

    // Set up data collection
    const onData = (data: Buffer): void => {
      const output = data.toString();
      outputBuffer += output;

      // Wait for shell prompt after the command completes
      if (this.detectShellPrompt(outputBuffer)) {
        hasPrompt = true;
        if (sessionData.currentCommand) {
          this.completeSimpleCommand(sessionData, onData, outputBuffer);
        }
      }
    };

    sessionData.shellChannel.on("data", onData);

    // Add timeout mechanism
    const timeoutMs = commandEntry.options.timeout || 15000;
    const timeoutHandle = setTimeout(() => {
      if (
        sessionData.currentCommand &&
        !hasPrompt &&
        sessionData.shellChannel
      ) {
        sessionData.shellChannel.removeListener("data", onData);
        commandEntry.reject(
          new Error(
            `Command '${commandEntry.command}' timed out after ${timeoutMs}ms`,
          ),
        );
        sessionData.currentCommand = undefined;
        // Clear execution flag and process next command
        sessionData.isCommandExecuting = false;
        this.processCommandQueue(sessionData);
      }
    }, timeoutMs);

    // Store timeout handle in current command
    if (sessionData.currentCommand) {
      sessionData.currentCommand.timeoutHandle = timeoutHandle;
    }

    // Let the shell handle command echoing naturally

    // Send the command as-is without exit code capture
    const command = commandEntry.command + "\n";
    sessionData.shellChannel.write(command);
  }

  private completeSimpleCommand(
    sessionData: SessionData,
    onData: (data: Buffer) => void,
    rawOutput: string,
  ): void {
    if (!sessionData.currentCommand || !sessionData.shellChannel) {
      return;
    }

    console.log('🔍 completeSimpleCommand called with rawOutput:', JSON.stringify(rawOutput));
    console.log('🔍 completeSimpleCommand call stack:', new Error().stack?.split('\n').slice(1, 4).join('\n'));

    sessionData.shellChannel.removeListener("data", onData);

    // Clear timeout
    if (sessionData.currentCommand.timeoutHandle) {
      clearTimeout(sessionData.currentCommand.timeoutHandle);
    }

    const { resolve } = sessionData.currentCommand;

    // For MCP API response - clean output by removing shell control sequences and prompts
    let cleanOutput = rawOutput
      .replace(/\r/g, "") // Remove carriage returns
      .replace(/\[?\?\d+[lh]/g, "") // Remove terminal control sequences like [?2004l and [?2004h
      // eslint-disable-next-line no-control-regex
      .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "") // Remove ANSI escape sequences
      // eslint-disable-next-line no-control-regex
      .replace(/\u001b/g, "") // Remove standalone ESC characters
      // eslint-disable-next-line no-control-regex
      .replace(/\u0007/g, ""); // Remove bell character

    const lines = cleanOutput.split("\n");
    const resultLines: string[] = [];
    let exitCode = 0;

    for (const line of lines) {
      let trimmed = line.trim();

      if (!trimmed) continue;

      // Skip command echo
      const originalCommand = sessionData.currentCommand.command.trim();
      if (trimmed === originalCommand) {
        continue;
      }

      // Skip lines that are just prompts (both old and bracket formats from SSH server)
      if (
        /^[\]a-zA-Z0-9_.-]+@[\]a-zA-Z0-9_.-]+.*[$#>]\s*$/.test(trimmed) ||
        /^[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+:[^$]*$\s*$/.test(trimmed) ||
        /^\[[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+\s+[^\]]+\]\$\s*$/.test(trimmed) ||
        /^[$#>]\s*$/.test(trimmed)
      ) {
        continue;
      }

      // Remove prompt prefix if it appears at the beginning of output (both old and bracket formats)
      trimmed = trimmed.replace(
        /^[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+:[~\w/.[\]-]*[$#>]\$?\s*/,
        "",
      );
      trimmed = trimmed.replace(
        /^\[[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+\s+[^\]]+\]\$\s*/,
        "",
      );

      // Remove prompt suffix if it appears at the end of actual output (both old and bracket formats)
      trimmed = trimmed.replace(
        /\s*[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+:[~\w/.[\]-]*[$#>]\s*$/,
        "",
      );
      trimmed = trimmed.replace(
        /\s*\[[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+\s+[^\]]+\]\$\s*$/,
        "",
      );

      if (trimmed) {
        resultLines.push(trimmed);
      }
    }

    const commandOutput = resultLines.join("\n").trim();

    const result: CommandResult = {
      stdout: commandOutput,
      stderr: "", // Shell sessions combine stdout/stderr - all output is in stdout
      exitCode,
    };

    // ARCHITECTURAL FIX: Store complete raw terminal output instead of parsing and reconstructing
    // The SSH shell naturally provides the complete terminal session including echoes and prompts.
    // Instead of artificially creating command echoes, we should store and replay the natural terminal flow.
    const commandSource = sessionData.currentCommand.options.source || "claude";
    
    // CRITICAL FIX: Store and broadcast the RAW terminal output with proper CRLF
    // This preserves the natural SSH shell behavior and prevents double echoing
    // XTERM.JS TERMINAL CRITICAL RULE: Normalize line endings to CRLF for proper browser display
    // First normalize all line endings to LF, then convert to CRLF to prevent double/triple conversion
    const rawTerminalOutput = rawOutput.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    
    this.broadcastToLiveListeners(sessionData.connection.name, rawTerminalOutput, "stdout", commandSource);
    this.storeInHistory(sessionData.connection.name, rawTerminalOutput, "stdout", commandSource);

    // Record command in history
    const executionEndTime = Date.now();
    const duration = executionEndTime - sessionData.currentCommand.startTime;
    const historyEntry: CommandHistoryEntry = {
      command: sessionData.currentCommand.command,
      timestamp: sessionData.currentCommand.startTime,
      duration,
      exitCode,
      status: exitCode === 0 ? "success" : "failure",
      sessionName: sessionData.connection.name,
      source: sessionData.currentCommand.options.source || "claude",
    };

    // Add to history (maintaining max 100 entries)
    sessionData.commandHistory.push(historyEntry);
    if (sessionData.commandHistory.length > 100) {
      sessionData.commandHistory.shift(); // Remove oldest entry
    }

    // Broadcast command execution to listeners
    sessionData.commandHistoryListeners.forEach((listener) => {
      try {
        listener.callback(historyEntry);
      } catch (error) {
        // Silent error handling - don't crash on listener errors
      }
    });

    resolve(result);
    sessionData.currentCommand = undefined;

    // Mark command execution as complete
    sessionData.isCommandExecuting = false;

    // Update session tracking
    sessionData.connection.lastActivity = new Date();

    // Process next command in queue if any
    this.processCommandQueue(sessionData);
  }

  private getValidatedSession(sessionName: string): SessionData {
    const sessionData = this.connections.get(sessionName);
    if (!sessionData) {
      throw new Error(`Session '${sessionName}' not found`);
    }
    return sessionData;
  }

  private validateCommandSource(source: unknown): void {
    if (typeof source !== 'string') {
      throw new Error('Command source must be a string');
    }
    
    if (source !== 'user' && source !== 'claude') {
      throw new Error('Invalid command source: must be "user" or "claude"');
    }
  }

  cleanup(): void {
    for (const sessionData of this.connections.values()) {
      this.cleanupSession(sessionData);
    }
    this.connections.clear();
  }

  private cleanupSession(sessionData: SessionData): void {
    if (sessionData.shellChannel) {
      sessionData.shellChannel.end();
    }
    sessionData.client.destroy();
  }

  getConnection(name: string): SSHConnection | undefined {
    const sessionData = this.connections.get(name);
    return sessionData?.connection;
  }

  hasSession(name: string): boolean {
    return this.connections.has(name);
  }

  private validateSessionName(name: string): void {
    if (!name || typeof name !== "string" || name.trim() === "") {
      throw new Error("Invalid session name: name cannot be empty");
    }

    if (name.includes(" ")) {
      throw new Error("Invalid session name: name cannot contain spaces");
    }

    if (name.includes("@")) {
      throw new Error("Invalid session name: name cannot contain @ character");
    }
  }

  /**
   * Comprehensive CommandId validation with format and length checks
   * Prevents injection attacks and ensures proper command tracking
   */
  public validateCommandId(commandId: string): { valid: boolean; reason?: string } {
    // Check if empty
    if (!commandId || typeof commandId !== 'string' || commandId.trim() === '') {
      return { valid: false, reason: 'empty' };
    }

    // Check length limits (reasonable maximum for command tracking)
    if (commandId.length > 128) {
      return { valid: false, reason: 'too_long' };
    }

    // Check for invalid characters that could cause security issues
    const invalidCharsPattern = /[<>;"'&|`$(){}[\]\\]/;
    if (invalidCharsPattern.test(commandId)) {
      return { valid: false, reason: 'invalid_chars' };
    }

    // Ensure it doesn't start or end with whitespace
    if (commandId !== commandId.trim()) {
      return { valid: false, reason: 'whitespace_padding' };
    }

    // Valid CommandId format: alphanumeric, dashes, underscores, dots
    const validPattern = /^[a-zA-Z0-9_.-]+$/;
    if (!validPattern.test(commandId)) {
      return { valid: false, reason: 'invalid_format' };
    }

    return { valid: true };
  }

  /**
   * Creates a standardized error response with consistent structure
   * Used throughout the application for uniform error handling
   */
  public createStandardizedErrorResponse(error: Error, commandId?: string): ErrorResponse {
    return {
      error: error.name || 'Error',
      message: error.message,
      timestamp: Date.now(),
      code: error.name?.toUpperCase().replace(/ERROR$/, '') || 'UNKNOWN',
      ...(commandId && { commandId })
    };
  }

  listSessions(): SSHConnection[] {
    const sessions: SSHConnection[] = [];
    for (const sessionData of this.connections.values()) {
      sessions.push(sessionData.connection);
    }
    return sessions;
  }

  getMonitoringUrl(sessionName: string): string {
    // Validate session name using existing validation logic
    this.validateSessionName(sessionName);

    // Check if session exists
    this.getValidatedSession(sessionName);

    // Generate URL in the format http://localhost:port/session/{session-name}
    return `http://localhost:${this.webServerPort}/session/${sessionName}`;
  }

  async disconnectSession(name: string): Promise<void> {
    const sessionData = this.getValidatedSession(name);

    // QUEUE CLEANUP FIX: Reject all pending queued commands to prevent promise leaks
    this.rejectAllQueuedCommands(sessionData, `Session '${name}' disconnected`);

    // Broadcast disconnection event
    this.broadcastToLiveListeners(
      name,
      `Connection to ${sessionData.connection.host} closed`,
      "stdout",
      "system"
    );

    this.cleanupSession(sessionData);

    // Remove from connections map
    this.connections.delete(name);
  }

  /**
   * Reject all queued commands when session is disconnected to prevent promise leaks
   * This ensures clean shutdown and proper error handling for pending operations
   */
  private rejectAllQueuedCommands(sessionData: SessionData, reason: string): void {
    const queuedCommandsCount = sessionData.commandQueue.length;
    
    if (queuedCommandsCount > 0) {
      console.log(`Rejecting ${queuedCommandsCount} queued commands due to: ${reason}`);
      
      // Reject all queued commands with appropriate error
      sessionData.commandQueue.forEach((queuedCommand) => {
        queuedCommand.reject(new Error(
          `Command cancelled - ${reason}`
        ));
      });
      
      // Clear the queue
      sessionData.commandQueue.length = 0;
    }
    
    // Also reject the currently executing command if any
    if (sessionData.currentCommand) {
      sessionData.currentCommand.reject(new Error(
        `Command interrupted - ${reason}`
      ));
      sessionData.currentCommand = undefined;
      sessionData.isCommandExecuting = false;
    }
  }



  // Terminal interaction methods for Story 5
  sendTerminalInput(sessionName: string, input: string): void {
    const sessionData = this.getValidatedSession(sessionName);

    if (!sessionData.isShellReady || !sessionData.shellChannel) {
      throw new Error(
        `Shell session not ready for connection '${sessionName}'`,
      );
    }

    // Send input directly to the shell channel
    sessionData.shellChannel.write(input);

    // Update last activity
    sessionData.connection.lastActivity = new Date();
  }

  sendTerminalSignal(sessionName: string, signal: string): void {
    const sessionData = this.getValidatedSession(sessionName);

    if (!sessionData.isShellReady || !sessionData.shellChannel) {
      throw new Error(
        `Shell session not ready for connection '${sessionName}'`,
      );
    }

    // Map signal names to control characters
    let controlChar: string;
    switch (signal.toUpperCase()) {
      case "SIGINT":
        controlChar = "\x03"; // Ctrl+C
        break;
      case "SIGTERM":
      case "SIGQUIT":
        controlChar = "\x04"; // Ctrl+D (EOF)
        break;
      case "SIGTSTP":
        controlChar = "\x1A"; // Ctrl+Z
        break;
      default:
        throw new Error(`Unsupported signal: ${signal}`);
    }

    // Send the control character
    sessionData.shellChannel.write(controlChar);

    // Update last activity
    sessionData.connection.lastActivity = new Date();
  }

  resizeTerminal(sessionName: string, cols: number, rows: number): void {
    const sessionData = this.getValidatedSession(sessionName);

    if (!sessionData.isShellReady || !sessionData.shellChannel) {
      throw new Error(
        `Shell session not ready for connection '${sessionName}'`,
      );
    }

    // Validate dimensions
    if (cols < 1 || cols > 1000 || rows < 1 || rows > 1000) {
      throw new Error(
        "Invalid terminal dimensions: cols and rows must be between 1 and 1000",
      );
    }

    // Send terminal resize signal using SSH2's setWindow method
    try {
      sessionData.shellChannel.setWindow(rows, cols, 0, 0);
    } catch (error) {
      throw new Error(`Failed to resize terminal: ${(error as Error).message}`);
    }

    // Update last activity
    sessionData.connection.lastActivity = new Date();
  }

  getCommandHistory(sessionName: string): CommandHistoryEntry[] {
    const sessionData = this.getValidatedSession(sessionName);

    return [...sessionData.commandHistory]; // Return copy
  }

  /**
   * Get session connection information for terminal prompt construction
   */
  getSessionConnectionInfo(sessionName: string): { username: string; host: string } | null {
    const sessionData = this.connections.get(sessionName);
    if (!sessionData) {
      return null;
    }

    return {
      username: sessionData.connection.username,
      host: sessionData.connection.host
    };
  }

  addCommandHistoryListener(
    sessionName: string,
    callback: (entry: CommandHistoryEntry) => void,
  ): void {
    const sessionData = this.getValidatedSession(sessionName);

    sessionData.commandHistoryListeners.push({
      callback,
      sessionName,
    });
  }

  removeCommandHistoryListener(
    sessionName: string,
    callback: (entry: CommandHistoryEntry) => void,
  ): void {
    const sessionData = this.connections.get(sessionName);
    if (!sessionData) {
      return; // Session might have been disconnected
    }

    sessionData.commandHistoryListeners =
      sessionData.commandHistoryListeners.filter(
        (listener) => listener.callback !== callback,
      );
  }

  /**
   * Read private key from file with path expansion and optional decryption
   * @param keyFilePath - Path to the private key file (supports tilde expansion)
   * @param passphrase - Optional passphrase for encrypted keys
   * @returns Promise<string> - The private key content
   * @throws Error - If file cannot be read or key cannot be decrypted
   */
  private async readPrivateKeyFromFile(keyFilePath: string, passphrase?: string): Promise<string> {
    // Validate input parameters
    this.validateKeyFilePath(keyFilePath);
    
    // Expand tilde path to full home directory path with security checks
    const expandedPath = this.expandTildePath(keyFilePath);
    
    // Validate the expanded path for security
    this.validateExpandedPath(expandedPath);
    
    // Check if file exists using async operations
    try {
      await fs.access(expandedPath, fsSync.constants.R_OK);
    } catch (error) {
      throw new Error('Key file not accessible');
    }

    // Read the key file content asynchronously
    let keyContent: string;
    try {
      keyContent = await fs.readFile(expandedPath, 'utf8');
    } catch (error) {
      throw new Error('Cannot read key file');
    }

    // Check if key is encrypted
    if (this.isKeyEncrypted(keyContent)) {
      if (!passphrase) {
        throw new Error('Key is encrypted but no passphrase provided');
      }
      
      // Return encrypted key content - SSH2 will handle decryption with passphrase
      return keyContent;
    }

    return keyContent;
  }

  /**
   * Expand tilde (~) in file paths to full home directory path with security checks
   * @param filePath - File path that may contain tilde
   * @returns Expanded absolute path
   * @throws Error - If path contains dangerous traversal patterns
   */
  private expandTildePath(filePath: string): string {
    // Normalize path separators and resolve any relative components
    const normalizedPath = path.normalize(filePath);
    
    // Check for path traversal attempts
    if (normalizedPath.includes('..')) {
      throw new Error('Invalid path: path traversal attempts are not allowed');
    }
    
    if (normalizedPath.startsWith('~')) {
      const homeDir = os.homedir();
      const expandedPath = path.join(homeDir, normalizedPath.slice(1));
      
      // Ensure expanded path is still within or relative to home directory for tilde expansion
      const resolvedPath = path.resolve(expandedPath);
      const resolvedHome = path.resolve(homeDir);
      
      // Allow paths in home directory or relative paths that don't escape upward
      if (!resolvedPath.startsWith(resolvedHome) && normalizedPath.includes('..')) {
        throw new Error('Invalid path: cannot access paths outside home directory with tilde expansion');
      }
      
      return resolvedPath;
    }
    
    // For non-tilde paths, resolve but check for suspicious patterns
    return path.resolve(normalizedPath);
  }

  /**
   * Validate keyFilePath input parameter
   * @param keyFilePath - The key file path to validate
   * @throws Error - If path is invalid
   */
  private validateKeyFilePath(keyFilePath: string): void {
    if (!keyFilePath || typeof keyFilePath !== 'string') {
      throw new Error('Invalid keyFilePath: must be a non-empty string');
    }
    
    const trimmed = keyFilePath.trim();
    if (trimmed === '') {
      throw new Error('Invalid keyFilePath: cannot be empty or whitespace-only');
    }
    
    // Check for reasonable path length (prevent potential DoS)
    if (trimmed.length > 4096) {
      throw new Error('Invalid keyFilePath: path too long');
    }
  }
  
  /**
   * Validate the expanded file path for security concerns
   * @param expandedPath - The resolved absolute path
   * @throws Error - If path is potentially dangerous
   */
  private validateExpandedPath(expandedPath: string): void {
    // Block access to sensitive system directories
    const dangerousPaths = [
      '/etc/',
      '/proc/',
      '/sys/',
      '/dev/',
      '/boot/',
      '/root/'
    ];
    
    for (const dangerousPath of dangerousPaths) {
      if (expandedPath.startsWith(dangerousPath)) {
        throw new Error('Invalid path: access to system directories is not allowed');
      }
    }
    
    // Check for symlink attacks by ensuring we can resolve the path safely
    try {
      // Check if the file itself is a symlink
      const stats = fsSync.lstatSync(expandedPath);
      if (stats.isSymbolicLink()) {
        const realTarget = fsSync.readlinkSync(expandedPath);
        const resolvedTarget = path.resolve(path.dirname(expandedPath), realTarget);
        
        // Check if symlink points to dangerous locations
        for (const dangerousPath of dangerousPaths) {
          if (resolvedTarget.startsWith(dangerousPath)) {
            throw new Error('Invalid path: symlink points to restricted location');
          }
        }
      }
      
      // Also check the directory path for symlinks
      const realPath = fsSync.realpathSync(path.dirname(expandedPath));
      const resolvedFilePath = path.join(realPath, path.basename(expandedPath));
      
      // Re-check dangerous paths after full resolution
      for (const dangerousPath of dangerousPaths) {
        if (resolvedFilePath.startsWith(dangerousPath)) {
          throw new Error('Invalid path: resolved path points to restricted location');
        }
      }
    } catch (error) {
      // If it's our security error, re-throw it
      if (error instanceof Error && error.message.includes('Invalid path')) {
        throw error;
      }
      // Directory doesn't exist or is inaccessible - this is handled elsewhere
      // We only care about blocking access to existing dangerous paths
    }
  }
  
  /**
   * Sanitize key file error messages to prevent path information leakage
   * @param error - The original error
   * @returns Sanitized error message
   */
  private sanitizeKeyFileError(error: Error): string {
    const message = error.message;
    
    // Remove any absolute paths from error messages
    const pathPattern = /\/[\w\-._/]+/g;
    let sanitizedMessage = message.replace(pathPattern, '<path>');
    
    // Remove home directory references
    const homeDir = os.homedir();
    if (homeDir) {
      sanitizedMessage = sanitizedMessage.replace(new RegExp(homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '<home>');
    }
    
    // Provide generic messages for common error types
    if (message.includes('ENOENT') || message.includes('not found')) {
      return 'Key file not accessible';
    }
    
    if (message.includes('EACCES') || message.includes('permission denied')) {
      return 'Permission denied accessing key file';
    }
    
    if (message.includes('Invalid path')) {
      return sanitizedMessage; // Keep security validation messages
    }
    
    // For other errors, return a generic message
    return sanitizedMessage || 'Key file error';
  }
  
  /**
   * Check if a private key is encrypted
   * @param keyContent - The private key content
   * @returns boolean - True if key is encrypted
   */
  private isKeyEncrypted(keyContent: string): boolean {
    // Check for traditional encrypted key formats
    const hasTraditionalEncryption = (
      keyContent.includes('Proc-Type: 4,ENCRYPTED') ||
      keyContent.includes('DEK-Info:') ||
      keyContent.match(/-----BEGIN ENCRYPTED PRIVATE KEY-----/) !== null ||
      keyContent.match(/-----BEGIN [\w\s]+ PRIVATE KEY-----[\s\S]*?Proc-Type: 4,ENCRYPTED/) !== null
    );
    
    if (hasTraditionalEncryption) {
      return true;
    }
    
    // Check for OpenSSH new format encrypted keys
    if (keyContent.includes('-----BEGIN OPENSSH PRIVATE KEY-----')) {
      try {
        // Extract the base64 content between the headers
        const lines = keyContent.split('\n');
        const base64Lines = lines.filter(line => 
          line.trim() && 
          !line.includes('-----BEGIN') && 
          !line.includes('-----END')
        );
        const base64Content = base64Lines.join('');
        
        // Decode the base64 content to check for encryption indicators
        const binaryData = Buffer.from(base64Content, 'base64');
        const headerString = binaryData.toString('ascii', 0, Math.min(200, binaryData.length));
        
        // OpenSSH new format encrypted keys contain these patterns in the decoded data:
        // - openssh-key-v1 header
        // - encryption cipher names (aes128-ctr, aes192-ctr, aes256-ctr, aes128-gcm, aes256-gcm, etc.)
        // - key derivation functions (bcrypt)
        const hasOpenSSHEncryption = (
          headerString.includes('openssh-key-v1') && (
            headerString.includes('aes128-ctr') ||
            headerString.includes('aes192-ctr') ||
            headerString.includes('aes256-ctr') ||
            headerString.includes('aes128-gcm') ||
            headerString.includes('aes256-gcm') ||
            headerString.includes('chacha20-poly1305') ||
            headerString.includes('bcrypt')
          )
        );
        
        return hasOpenSSHEncryption;
      } catch (error) {
        // If we can't decode the key content, assume it might be encrypted for safety
        // Better to ask for a passphrase when not needed than to fail silently
        return true;
      }
    }
    
    return false;
  }

}
