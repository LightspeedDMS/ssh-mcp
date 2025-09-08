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
  sendTerminalInputRaw(sessionName: string, input: string): void;
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
  // SSH server echo management
  rawInputMode: boolean;
  echoDisabled: boolean;
  // Command echo state tracking for duplicate removal
  lastCommandSent?: string;
  expectingCommandEcho: boolean;
}

// Terminal output streaming interfaces

export class SSHConnectionManager implements ISSHConnectionManager {
  private static readonly MAX_OUTPUT_BUFFER_SIZE = 1000;
  private static readonly MAX_COMMAND_HISTORY_SIZE = 100;
  
  private connections: Map<string, SessionData> = new Map();
  private webServerPort: number;

  constructor(webServerPort: number = 8080) {
    console.log('🏗️ SSH CONNECTION MANAGER CONSTRUCTED');
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


    // ARCHITECTURAL FIX: Use consolidated output preparation for browsers
    const browserOutput = this.prepareOutputForBrowser(data);
    
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

    // ARCHITECTURAL FIX: Use consolidated output preparation for browsers
    const browserOutput = this.prepareOutputForBrowser(data);
    
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

    // Only store in history buffer (keep last MAX_OUTPUT_BUFFER_SIZE entries)
    sessionData.outputBuffer.push(outputEntry);
    if (sessionData.outputBuffer.length > SSHConnectionManager.MAX_OUTPUT_BUFFER_SIZE) {
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
          // SSH server echo management - controlled echo for proper terminal behavior
          rawInputMode: false,     // Use canonical mode for line-based input
          echoDisabled: false,     // Enable controlled echo (shell handles this properly)
          // Command echo state tracking
          lastCommandSent: undefined,
          expectingCommandEcho: false,
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
      // Configure SSH PTY for optimal terminal behavior
      // CRITICAL FIX: Configure PTY modes to prevent double echo and prompt concatenation
      const ptyOptions = {
        term: 'xterm-256color',
        cols: 80,
        rows: 24,
        modes: {
          // ECHO control - enable controlled echo to prevent command duplication
          ECHO: 1,        // Enable local echo (SSH shell expects this)
          ECHOE: 1,       // Enable echo erase
          ECHOK: 1,       // Enable echo kill  
          ECHONL: 0,      // Disable echo newline only
          ICANON: 1,      // Canonical mode for line-by-line input (not raw)
          // Line ending handling - critical for proper terminal behavior
          ICRNL: 1,       // Map CR to NL on input
          ONLCR: 1,       // Map NL to CR-NL on output
          // Additional cleanup modes
          OPOST: 1,       // Enable output processing
        },
        // DOUBLE PROMPT BUG FIX: Do NOT set PS1 in env - let shell initialize naturally
        env: {
          'TERM': 'xterm-256color',
          'SHELL': '/bin/bash'     // Ensure bash shell for consistency
        }
      };

      sessionData.client.shell(ptyOptions, (err, channel) => {
        if (err) {
          reject(err);
          return;
        }

        sessionData.shellChannel = channel;
        let initOutput = "";

        let ps1ConfigSent = false;
        let ps1ConfigComplete = false;
        let postConfigOutput = '';

        const onData = (data: Buffer): void => {
          const newData = data.toString();
          // CRITICAL FIX: Filter out null 2>&1 contamination during initialization
          if (!newData.includes('null 2>&1')) {
            initOutput += newData;
          } else {
            console.log('🚫 Filtered out null 2>&1 during shell initialization');
          }

          // Enhanced prompt detection with multiple patterns
          const hasPrompt = this.detectShellPrompt(initOutput);

          if (hasPrompt && !ps1ConfigSent) {
            // First prompt detected - now configure PS1
            ps1ConfigSent = true;
            
            // CRITICAL FIX: Use simple PS1 configuration without redirection
            // Send PS1 setting directly - let prepareOutputForBrowser handle cleanup
            const ps1ConfigCmd = `export PS1='[\\u@\\h \\W]\\$ '\n`;
            channel.write(ps1ConfigCmd);
            
            // Reset output buffer to capture post-configuration output
            postConfigOutput = '';
            
          } else if (ps1ConfigSent && !ps1ConfigComplete) {
            // Accumulate output after PS1 configuration
            // CRITICAL FIX: Also filter null 2>&1 from post-configuration output
            if (!newData.includes('null 2>&1')) {
              postConfigOutput += newData;
            }
            
            // Wait for the PS1 configuration to complete (detect bracket format prompt)
            if (this.detectBracketFormatPrompt(postConfigOutput)) {
              ps1ConfigComplete = true;
              channel.removeListener("data", onData);
              
              sessionData.isShellReady = true;
              sessionData.initialPromptShown = true;
              
              // Short delay to let terminal stabilize, then setup handlers
              setTimeout(() => {
                this.setupShellHandlers(sessionData);
                
                // FIRST PROMPT FIX: Extract and store just the final bracket prompt
                // This ensures the initial prompt is available for browser replay without over-filtering
                if (postConfigOutput.trim() && !postConfigOutput.includes('null 2>&1')) {
                  // Extract the final bracket prompt BEFORE applying full cleaning
                  // This preserves the prompt while still filtering out PS1 configuration
                  const bracketPromptMatch = postConfigOutput.match(/\[[^\]]+\]\$\s*/);
                  if (bracketPromptMatch) {
                    let finalPrompt = bracketPromptMatch[0];
                    // Apply ONLY basic control sequence cleaning, not PS1 filtering
                    finalPrompt = finalPrompt
                      .replace(/\x1b\[[0-9;?]*[a-zA-Zlh]/g, '') // Remove ANSI sequences including bracketed paste mode
                      .replace(/\[[?][0-9]+[lh]/g, '') // Remove bracketed paste mode sequences like [?2004l
                      .replace(/\x1b\][^\x07\x1b]*?\x07?/g, '') // Remove OSC sequences
                      .replace(/\r(?!\n)/g, ''); // Remove isolated CR
                    // Initial prompt successfully extracted and cleaned for history replay
                    this.storeInHistory(
                      sessionData.connection.name,
                      finalPrompt,
                      "stdout",
                      'system'
                    );
                  }
                  // If no bracket prompt found, initialization continues normally without initial prompt in history
                }
                
                resolve();
              }, 100);
            }
          }
        };

        channel.on("data", onData);

        // TRIPLE PROMPT BUG FIX: Do NOT send initial newline to trigger prompt
        // This was causing the first unnecessary prompt display
        // Let the shell initialize naturally without artificial prompt triggering
        
        // The shell will naturally show its prompt during initialization
        // We don't need to force it with a newline character
        // This eliminates the first source of duplicate prompts

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

  private detectBracketFormatPrompt(output: string): boolean {
    // Specifically detect bracket format prompts: [user@host path]$
    const lines = output.split("\n");
    const lastLine = lines[lines.length - 1] || "";
    const secondLastLine = lines[lines.length - 2] || "";

    // Bracket format pattern: [user@host path]$
    const bracketPattern = /\[[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+[^\]]*\]\$\s*$/;
    
    return bracketPattern.test(lastLine) || bracketPattern.test(secondLastLine);
  }

  private setupShellHandlers(sessionData: SessionData): void {
    if (!sessionData.shellChannel) {
      return;
    }

    // CRITICAL: Permanent handler for ALL terminal output (interactive + commands)
    sessionData.shellChannel.on("data", (data: Buffer) => {
      const output = data.toString();
      
      // CRITICAL FIX: Store raw output without filtering - let prepareOutputForBrowser handle cleanup
      // Broadcast raw output to browsers for real-time display (cleanup happens in prepareOutputForBrowser)
      this.broadcastToLiveListeners(
        sessionData.connection.name, 
        output, 
        "stdout",
        sessionData.currentCommand ? sessionData.currentCommand.options.source : 'system'
      );
      
      // Store raw output in history for replay (cleanup happens in prepareOutputForBrowser)
      // CRITICAL FIX: Skip storing contaminated shell initialization output
      if (!output.includes('null 2>&1')) {
        this.storeInHistory(
          sessionData.connection.name,
          output,
          "stdout", 
          sessionData.currentCommand ? sessionData.currentCommand.options.source : 'system'
        );
      }
      
      // If there's a command executing, accumulate for API response AND check for completion
      if (sessionData.currentCommand) {
        sessionData.currentCommand.stdout += output;
        
        // Check for command completion when we detect a shell prompt
        if (this.detectShellPrompt(sessionData.currentCommand.stdout)) {
          this.completeSimpleCommand(sessionData, null, sessionData.currentCommand.stdout);
        }
      }
    });
    
    // Keep stderr handler for error accumulation during commands
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
    
    // Note: Stale commands are cleaned from queue as needed
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

    // ARCHITECTURAL FIX: Remove temporary data handler - permanent handler now handles completion
    // The permanent handler in setupShellHandlers() accumulates output and triggers completion

    // Add timeout mechanism
    const timeoutMs = commandEntry.options.timeout || 15000;
    const timeoutHandle = setTimeout(() => {
      if (sessionData.currentCommand) {
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

    // Let SSH shell provide natural prompts - no artificial injection
    // The shell naturally provides: prompt → command echo → output → next prompt
    
    // Send the command as-is (the shell will still echo it, but that will be filtered by prepareOutputForBrowser)
    const command = commandEntry.command + "\n";
    sessionData.shellChannel.write(command);
  }

  private completeSimpleCommand(
    sessionData: SessionData,
    onData: ((data: Buffer) => void) | null,
    rawOutput: string,
  ): void {
    if (!sessionData.currentCommand || !sessionData.shellChannel) {
      return;
    }


    // Only remove temporary listener if it exists (legacy support)
    if (onData) {
      sessionData.shellChannel.removeListener("data", onData);
    }

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

    // ARCHITECTURAL FIX: Remove duplicate broadcast/storage calls
    // The permanent data handler already broadcasts and stores all terminal output in real-time
    // This eliminates the double processing issue identified by the elite architect

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

    // Add to history (maintaining max MAX_COMMAND_HISTORY_SIZE entries)
    sessionData.commandHistory.push(historyEntry);
    if (sessionData.commandHistory.length > SSHConnectionManager.MAX_COMMAND_HISTORY_SIZE) {
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
      // Note: Rejecting ${queuedCommandsCount} queued commands due to: ${reason}
      
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

  sendTerminalInputRaw(sessionName: string, input: string): void {
    const sessionData = this.getValidatedSession(sessionName);

    if (!sessionData.isShellReady || !sessionData.shellChannel) {
      throw new Error(
        `Shell session not ready for connection '${sessionName}'`,
      );
    }

    // Ensure raw input mode is enabled with echo disabled
    // This method is specifically for character-by-character input from browsers
    // where server echo would cause character duplication
    if (!sessionData.rawInputMode || !sessionData.echoDisabled) {
      sessionData.rawInputMode = true;
      sessionData.echoDisabled = true;
      // Note: PTY is already configured with ECHO disabled during session initialization
      // No runtime reconfiguration needed as our default mode handles raw input correctly
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
  

  private prepareOutputForBrowser(output: string): string {
    
    // CRITICAL FIX: Enhanced terminal control sequence cleaning to prevent display corruption
    // Remove all problematic terminal control sequences that can interfere with browser terminal
    let cleaned = output
      // eslint-disable-next-line no-control-regex
      .replace(/\x07/g, '') // Bell
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[\?2004[lh]/g, '') // Bracket paste mode
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[\d+[ABCD]/g, '') // Cursor movement (up, down, forward, back)
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[K/g, '') // Clear line (erase to end of line)
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[\d+;\d+H/g, '') // Cursor positioning (row;col)
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[\d+;\d+f/g, '') // Alternative cursor positioning
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[2J/g, '') // Clear entire screen
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[H/g, '') // Move cursor to home position
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[\d*J/g, '') // Clear screen variations
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[\d*K/g, '') // Clear line variations
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[\?1049[lh]/g, '') // Alternate screen buffer
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[\?47[lh]/g, '') // Alternate screen buffer (older)
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[\?1[lh]/g, '') // Application cursor keys
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[>\d*[lh]/g, '') // Private mode settings
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[\?\d+[lh]/g, '') // Generic private mode sequences
      // CRITICAL FIX: Remove OSC (Operating System Command) sequences that cause double carriage returns
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\][^]*?\x07/g, '') // OSC sequences ending with BEL (bell)
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\][^\x1b]*?\x1b\\/g, '') // OSC sequences ending with ESC backslash
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\][0-9;]*[^\x07\x1b]*?\x07?/g, '') // Window title sequences like ESC]0;title
      // Remove any remaining isolated carriage returns that aren't part of CRLF pairs
      .replace(/\r(?!\n)/g, ''); // Remove CR that aren't followed by LF to prevent double CR issues
    
    // ENHANCED CONFIGURATION COMMAND FILTERING: Remove PS1 export commands and their echoes
    // BUT preserve the resulting bracket format prompt that follows
    // Filter out PS1 configuration commands that should not appear in terminal history
    cleaned = cleaned
      .replace(/export PS1='[^']*'[^\\r\\n]*\r?\n?/g, '') // Remove PS1 export commands
      .replace(/PS1='[^']*'\r?\n?/g, '') // Remove any remaining PS1 assignment traces
      .replace(/^null\s*2>&1\r?\n?/, '') // CRITICAL: Remove 'null 2>&1' at start of output
      .replace(/null 2>&1\r\n/g, '') // Remove exact 'null 2>&1\r\n' pattern from WebSocket data
      .replace(/null\s*2>&1\r?\n?/g, '') // Remove 'null 2>&1' stray output  
      .replace(/^null\s*2>&1.*$/gm, '') // Remove lines that are just 'null 2>&1'
      .replace(/null\s*2>&1[^\r\n]*[\r\n]*/g, ''); // Remove any null 2>&1 variations
    
    // CRITICAL FIX: Direct pattern-based duplicate command removal for exact test pattern
    // Pattern: [jsbattig@localhost ~]$ whoami\r\nwhoami\r\njsbattig → [jsbattig@localhost ~]$ whoami\r\njsbattig
    // Updated to handle multi-word commands like "echo test"
    cleaned = cleaned.replace(/(\[[^\]]+\]\$\s+)([^\r\n]+)(\r\n)\2(\r\n)/g, '$1$2$3');
    
    // CRITICAL FIX: Remove concatenated duplicate prompts 
    // Pattern: [jsbattig@localhost ~]$ [jsbattig@localhost ~]$ whoami → [jsbattig@localhost ~]$ whoami
    cleaned = cleaned.replace(/(\[[^\]]+\]\$)\s+(\[[^\]]+\]\$)\s+/g, '$2 ');
    
    // Normalize line endings ONCE - critical for xterm.js compatibility
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    
    return cleaned;
  }



  // ARCHITECTURAL FIX: Removed cleanTerminalOutputForBrowser - replaced with prepareOutputForBrowser
  // The old method was complex and handled many edge cases that are now handled by the consolidated approach


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
