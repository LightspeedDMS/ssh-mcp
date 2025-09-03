export enum ConnectionStatus {
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  DISCONNECTED = "disconnected",
  ERROR = "error",
}

export interface SSHConnectionConfig {
  name: string;
  host: string;
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
  
  // Maximum age for queued commands in milliseconds (5 minutes)
  MAX_COMMAND_AGE_MS: 5 * 60 * 1000,
  
  // Default timeout for queued commands if not specified
  DEFAULT_COMMAND_TIMEOUT_MS: 15000,
} as const;
