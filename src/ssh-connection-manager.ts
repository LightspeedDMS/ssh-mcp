import { Client, ClientChannel } from "ssh2";
import {
  SSHConnection,
  SSHConnectionConfig,
  ConnectionStatus,
  CommandResult,
  CommandOptions,
  CommandHistoryEntry,
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
  ): void {
    const sessionData = this.connections.get(sessionName);
    if (!sessionData) return;

    const outputEntry: TerminalOutputEntry = {
      timestamp: Date.now(),
      output: data,
      stream,
      rawOutput: data,
      preserveFormatting: true,
      vt100Compatible: true,
      encoding: "utf8",
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
  ): void {
    const sessionData = this.connections.get(sessionName);
    if (!sessionData) return;

    const outputEntry: TerminalOutputEntry = {
      timestamp: Date.now(),
      output: data,
      stream,
      rawOutput: data,
      preserveFormatting: true,
      vt100Compatible: true,
      encoding: "utf8",
    };

    // Only store in history buffer (keep last 1000 entries)
    sessionData.outputBuffer.push(outputEntry);
    if (sessionData.outputBuffer.length > 1000) {
      sessionData.outputBuffer.shift();
    }
  }

  private broadcastTerminalOutput(
    sessionName: string,
    data: string,
    stream: "stdout" | "stderr" = "stdout",
  ): void {
    // Legacy method - now just calls the live broadcast
    this.broadcastToLiveListeners(sessionName, data, stream);
  }

  async createConnection(config: SSHConnectionConfig): Promise<SSHConnection> {
    // Validate session name
    this.validateSessionName(config.name);

    // Check for unique session name
    if (this.connections.has(config.name)) {
      throw new Error(`Session name '${config.name}' already exists`);
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
      } = {
        host: config.host,
        username: config.username,
      };

      if (config.password) {
        connectConfig.password = config.password;
      } else if (config.privateKey) {
        connectConfig.privateKey = config.privateKey;
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
            this.setupShellHandlers(sessionData);

            // Shell is ready - no need to broadcast initial prompt
            // The prompt will be shown when commands are executed

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

    // Note: SSH2 shell channels combine stdout and stderr streams
    // This is different from exec channels which separate them
    sessionData.shellChannel.on("data", (data: Buffer) => {
      const output = data.toString();

      // Skip real-time streaming during command execution to avoid duplication
      if (!sessionData.currentCommand) {
        this.streamTerminalOutput(sessionData, output, "stdout");
      }

      if (sessionData.currentCommand) {
        sessionData.currentCommand.stdout += output;
      }
    });

    // Shell channels don't have separate stderr stream in SSH2
    // All error output comes through the main data stream
    sessionData.shellChannel.stderr?.on("data", (data: Buffer) => {
      const output = data.toString();

      // Stream real-time terminal output
      this.streamTerminalOutput(sessionData, output, "stderr");

      if (sessionData.currentCommand) {
        // This event rarely fires for shell channels - combined output is the norm
        sessionData.currentCommand.stderr += output;
      }
    });
  }

  async executeCommand(
    connectionName: string,
    command: string,
    options: CommandOptions = {},
  ): Promise<CommandResult> {
    const sessionData = this.getValidatedSession(connectionName);

    // Require shell session to be ready for session state persistence
    if (!sessionData.isShellReady || !sessionData.shellChannel) {
      throw new Error(
        `Shell session not ready for connection '${connectionName}'. Cannot maintain session state without active shell.`,
      );
    }

    return new Promise((resolve, reject) => {
      const commandEntry = {
        command,
        resolve,
        reject,
        options,
      };

      // Execute command directly - simplified approach
      this.executeCommandInShell(sessionData, commandEntry);
    });
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

      // Skip lines that are just prompts
      if (
        /^[\]a-zA-Z0-9_.[[-]+@[\]a-zA-Z0-9_.[[-]+.*[$#>]\s*$/.test(trimmed) ||
        /^[$#>]\s*$/.test(trimmed)
      ) {
        continue;
      }

      // Remove prompt prefix if it appears at the beginning of output
      trimmed = trimmed.replace(
        /^[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+\s*[~\w/.[\]-]*[$#>]\$?\s*/,
        "",
      );

      // Remove prompt suffix if it appears at the end of actual output
      trimmed = trimmed.replace(
        /\s*[\]a-zA-Z0-9_@.[[#>-]+\s+[~\w/.-]*[\]$#>]\s*$/,
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

    // For live terminal view - broadcast the RAW output with proper formatting
    // This preserves line breaks and formatting that xterm.js needs
    this.broadcastToLiveListeners(sessionData.connection.name, rawOutput);

    // Store the raw output in history for new connections
    this.storeInHistory(sessionData.connection.name, rawOutput);

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

    // Update session tracking
    sessionData.connection.lastActivity = new Date();
  }

  private getValidatedSession(sessionName: string): SessionData {
    const sessionData = this.connections.get(sessionName);
    if (!sessionData) {
      throw new Error(`Session '${sessionName}' not found`);
    }
    return sessionData;
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

    // Broadcast disconnection event
    this.broadcastTerminalOutput(
      name,
      `Connection to ${sessionData.connection.host} closed`,
    );

    this.cleanupSession(sessionData);

    // Remove from connections map
    this.connections.delete(name);
  }

  // Terminal output streaming methods
  private streamTerminalOutput(
    sessionData: SessionData,
    output: string,
    stream: "stdout" | "stderr",
  ): void {
    const timestamp = Date.now();

    // Broadcast to terminal listeners in real-time
    this.broadcastTerminalOutput(sessionData.connection.name, output, stream);

    // Create terminal output entry with formatting preservation and VT100 compatibility
    const outputEntry: TerminalOutputEntry = {
      timestamp,
      output,
      stream,
      rawOutput: output,
      preserveFormatting: this.containsFormatting(output),
      vt100Compatible: this.containsVT100Sequences(output),
      encoding: "utf-8",
    };

    // Add to output buffer (keep last 1000 entries for historical display)
    sessionData.outputBuffer.push(outputEntry);
    if (sessionData.outputBuffer.length > 1000) {
      sessionData.outputBuffer.shift();
    }

    // Notify all listeners
    sessionData.outputListeners.forEach((listener) => {
      try {
        listener.callback(outputEntry);
      } catch (error) {
        // Silent error handling - don't crash on listener errors
      }
    });
  }

  private containsFormatting(output: string): boolean {
    // Check for ANSI escape sequences and formatting codes
    /* eslint-disable no-control-regex -- ANSI escape sequences require control characters for terminal formatting */
    const ansiPatterns = [
      /\x1b\[[0-9;]*[a-zA-Z]/, // Standard ANSI sequences like \x1b[31m
      /\x1b\[\?[0-9]+[hl]/, // Mode set/reset sequences like \x1b[?2004h
      /\x1b\[[0-9]+;[0-9]+[a-zA-Z]/, // Position sequences like \x1b[1;1H
      /\x1b\[[A-Z]/, // Simple escape sequences like \x1b[H
    ];
    /* eslint-enable no-control-regex */
    return ansiPatterns.some((pattern) => pattern.test(output));
  }

  private containsVT100Sequences(output: string): boolean {
    // Check for VT100 specific sequences like cursor movement, screen manipulation
    /* eslint-disable no-control-regex -- VT100 sequences require control characters for terminal control */
    const vt100Patterns = [
      /\x1b\[2J/, // Clear screen
      /\x1b\[H/, // Home cursor
      /\x1b\[[0-9]+;[0-9]+H/, // Cursor position
      /\x1b\[[0-9]*[ABCD]/, // Cursor movement
    ];
    /* eslint-enable no-control-regex */
    return vt100Patterns.some((pattern) => pattern.test(output));
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
}
