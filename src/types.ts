export enum ConnectionStatus {
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  DISCONNECTED = "disconnected",
  ERROR = "error",
}

export interface SSHConnectionConfig {
  name: string;
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  keyFilePath?: string;
  passphrase?: string;
}

export interface SSHConnection {
  name: string;
  host: string;
  username: string;
  status: ConnectionStatus;
  lastActivity: Date;
  errorDetails?: string;
  errorTimestamp?: Date;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandSource = "user" | "claude" | "system";

export interface CommandOptions {
  pty?: boolean;
  timeout?: number;
  source?: CommandSource;
  asyncTimeout?: number; // Optional timeout for async mode transition
}

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

export interface SessionSelectionMessage extends WebSocketMessage {
  type: "select_session";
  sessionName: string;
}

export interface TerminalInputMessage extends WebSocketMessage {
  type: "terminal_input";
  sessionName: string;
  command: string;
  commandId: string;
}

export interface TerminalOutputMessage extends WebSocketMessage {
  type: "terminal_output";
  sessionName: string;
  data: string;
  commandId: string;
  source: CommandSource;
  "user-initiated": boolean;
}

export interface CommandHistoryEntry {
  command: string;
  timestamp: number;
  duration: number;
  exitCode: number;
  status: "success" | "failure";
  sessionName: string;
  source: CommandSource;
}

export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: number;
  code: string;
  commandId?: string;
}

export interface QueuedCommand {
  command: string;
  options: CommandOptions;
  resolve: (result: CommandResult) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

// Queue management constants for production robustness
export const QUEUE_CONSTANTS = {
  // Maximum number of commands that can be queued per session to prevent DoS
  MAX_QUEUE_SIZE: 100,

  // Default timeout for queued commands if not specified
  DEFAULT_COMMAND_TIMEOUT_MS: 15000,
} as const;

// SSH Connection Config for internal SSH client
export interface SSHConnectConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  keepaliveInterval?: number;
  keepaliveCountMax?: number;
}

// Browser Command Entry for tracking browser-initiated commands with results
export interface BrowserCommandEntry {
  command: string;
  commandId: string;
  timestamp: number;
  source: 'user' | 'claude';
  result: CommandResult;
}

// MCP Command Interception - Browser Command Gating Error
export interface CommandGatingError {
  success: false;
  error: 'BROWSER_COMMANDS_EXECUTED';
  message: string;
  browserCommands: BrowserCommandEntry[];
  retryAllowed: true;
}

// Task state tracking for background execution
export enum TaskState {
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

// Background task tracking interface
export interface BackgroundTask {
  taskId: string;
  command: string;
  state: TaskState;
  startTime: number;
  endTime?: number;
  result?: CommandResult;
  error?: string;
  source: CommandSource;
  promise: Promise<CommandResult>;
}

// Task polling response interface
export interface TaskPollResponse {
  success: boolean;
  taskId: string;
  state: TaskState;
  result?: CommandResult;
  error?: string;
  message?: string;
}

