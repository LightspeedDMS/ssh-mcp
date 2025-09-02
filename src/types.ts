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

export interface CommandOptions {
  pty?: boolean;
  timeout?: number;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

export interface SessionSelectionMessage extends WebSocketMessage {
  type: "select_session";
  sessionName: string;
}

export interface CommandHistoryEntry {
  command: string;
  timestamp: number;
  duration: number;
  exitCode: number;
  status: "success" | "failure";
  sessionName: string;
}
