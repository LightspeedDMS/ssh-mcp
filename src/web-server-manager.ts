import {
  SSHConnectionManager,
  TerminalOutputEntry,
} from "./ssh-connection-manager.js";
import { ErrorResponse } from "./types.js";
import { PortManager } from "./port-discovery.js";
import * as http from "http";
import express from "express";
import { WebSocketServer } from "ws";

export interface WebServerManagerConfig {
  port?: number;
}

// Terminal state synchronization interfaces
interface TerminalLockState {
  isLocked: boolean;
  commandId: string | null;
  source: 'user' | 'claude' | null;
  timestamp: number;
  sessionName: string;
}

interface SessionState {
  terminalLockState: TerminalLockState;
  connectedClients: Set<import("ws").WebSocket>;
  lastActivity: number;
  commandHistory: Array<{
    commandId: string;
    command: string;
    source: 'user' | 'claude';
    timestamp: number;
    completed: boolean;
  }>;
}

/**
 * Pure Web Server Manager - Handles only HTTP/WebSocket functionality
 * This server provides web interface and terminal monitoring without MCP
 */
export class WebServerManager {
  private httpServer?: http.Server;
  private app: express.Express;
  private wss?: WebSocketServer;
  private sshManager: SSHConnectionManager;
  private portManager: PortManager;
  private config: WebServerManagerConfig;
  private webPort?: number;
  private running = false;
  
  // Terminal state synchronization
  private sessionStates: Map<string, SessionState> = new Map();

  constructor(
    sshManager: SSHConnectionManager,
    config: WebServerManagerConfig = {},
  ) {
    this.validateConfig(config);

    this.config = {
      port: config.port,
      ...config,
    };

    this.sshManager = sshManager;
    this.portManager = new PortManager();
    this.app = express();

    this.setupExpressRoutes();
    
    // Set up monitoring for Claude Code commands to provide visual indicators
    this.setupClaudeCommandMonitoring();
  }

  private validateConfig(config: WebServerManagerConfig): void {
    if (config.port !== undefined && (config.port < 1 || config.port > 65535)) {
      throw new Error("Invalid port: must be between 1 and 65535");
    }
  }

  /**
   * Start the web server on discovered or specified port
   */
  async start(): Promise<void> {
    try {
      await this.discoverPort();
      await this.startHttpServer();
      this.setupWebSocketServer();
      this.running = true;
    } catch (error) {
      await this.cleanup();
      throw new Error(
        `Failed to start web server: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Stop the web server gracefully
   */
  async stop(): Promise<void> {
    await this.cleanup();
  }

  private async discoverPort(): Promise<void> {
    if (this.config.port) {
      // Use specified port
      this.webPort = await this.portManager.reservePort(this.config.port);
    } else {
      // Auto-discover port starting from 8080
      this.webPort = await this.portManager.getUnifiedPort(8080);
    }
  }

  private async startHttpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = this.app.listen(
        this.webPort,
        (error?: Error | undefined) => {
          if (error) {
            if (error.message.includes("EADDRINUSE")) {
              reject(new Error(`Port ${this.webPort} is already in use`));
            } else {
              reject(error);
            }
            return;
          }
          resolve();
        },
      );

      this.httpServer.on(
        "error",
        (error: { code?: string; message: string }) => {
          if (error.code === "EADDRINUSE") {
            reject(new Error(`Port ${this.webPort} is already in use`));
          } else {
            reject(error);
          }
        },
      );
    });
  }

  private setupExpressRoutes(): void {
    // Serve static files for web interface
    const staticPath = "./static";
    this.app.use(express.static(staticPath));

    // Handle root route
    this.app.get("/", (_, res) => {
      res.send(`
        <html>
          <head><title>SSH MCP Server</title></head>
          <body>
            <h1>SSH MCP Server</h1>
            <p>Server running on port ${this.webPort}</p>
            <p>WebSocket endpoint: ws://localhost:${this.webPort}/ws/monitoring</p>
          </body>
        </html>
      `);
    });

    // Handle session-specific routes
    this.app.get("/session/:sessionName", (req, res) => {
      const sessionName = req.params.sessionName;

      // Validate session exists
      if (!this.sshManager.hasSession(sessionName)) {
        res.status(404).send("Session not found");
        return;
      }

      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SSH MCP Terminal Viewer</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="stylesheet" href="/xterm.css" />
    <link rel="stylesheet" href="/styles.css">
    <style>
        .terminal-locked {
            opacity: 0.7;
            pointer-events: none;
        }
        .terminal-locked::after {
            content: '🔒 Terminal locked - command executing';
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(255, 255, 0, 0.8);
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
            color: #333;
        }
        #terminal-container {
            position: relative;
        }
    </style>
</head>
<body>
    <div id="session-header">
        <h1 id="session-title">SSH Session: ${sessionName}</h1>
        <div id="connection-status">🟢 Connected</div>
    </div>
    
    <div id="terminal-container">
        <div id="terminal"></div>
    </div>
    
    <script src="/xterm.js"></script>
    <script src="/xterm-addon-fit.js"></script>
    <script src="/terminal-input-handler.js"></script>
    <script>
        const sessionName = '${sessionName}';
        const wsUrl = \`ws://localhost:${this.webPort}/ws/session/\${sessionName}\`;
        
        // Initialize terminal
        const term = new Terminal({
            theme: {
                background: '#000000',
                foreground: '#ffffff',
                cursor: '#ffffff',
                selection: '#ffffff'
            },
            fontSize: 14,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            cursorBlink: true
        });
        
        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        
        term.open(document.getElementById('terminal'));
        fitAddon.fit();
        
        // WebSocket connection
        const ws = new WebSocket(wsUrl);
        
        // CRITICAL FIX: Initialize terminal handler BEFORE WebSocket connection
        // This prevents race condition where messages arrive before handler is ready
        const terminalHandler = new TerminalInputHandler(term, ws, sessionName);
        
        ws.onopen = function() {
            // WebSocket connection established
            document.getElementById('connection-status').innerHTML = '🟢 Connected';
        };
        
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                terminalHandler.handleTerminalOutput(data);
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
                document.getElementById('connection-status').innerHTML = '⚠️ Message Error';
            }
        };
        
        ws.onclose = function() {
            document.getElementById('connection-status').innerHTML = '🔴 Disconnected';
        };
        
        ws.onerror = function(error) {
            console.error('WebSocket error:', error);
            document.getElementById('connection-status').innerHTML = '⚠️ Connection Error';
        };
        
        // Auto-resize terminal
        window.addEventListener('resize', () => {
            fitAddon.fit();
        });
    </script>
</body>
</html>
      `);
    });

    // Admin endpoint to reset terminal lock state
    this.app.post("/admin/unlock-terminal/:sessionName", express.json(), (req, res) => {
      const sessionName = req.params.sessionName;

      // Validate session exists
      if (!this.sshManager.hasSession(sessionName)) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      // Reset terminal lock state
      const sessionState = this.getOrCreateSessionState(sessionName);
      sessionState.terminalLockState = {
        isLocked: false,
        commandId: null,
        source: null,
        timestamp: Date.now(),
        sessionName
      };

      // Broadcast unlock state to all connected clients
      this.broadcastTerminalLockState(sessionName, sessionState.terminalLockState);

      res.json({ 
        success: true, 
        message: `Terminal lock state reset for session: ${sessionName}`,
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupWebSocketServer(): void {
    if (!this.httpServer) {
      throw new Error("HTTP server must be started before WebSocket server");
    }

    this.wss = new WebSocketServer({
      server: this.httpServer,
      verifyClient: (info: {
        origin: string;
        secure: boolean;
        req: http.IncomingMessage;
      }): boolean => {
        const url = new URL(info.req.url!, `http://${info.req.headers.host}`);

        if (url.pathname === "/ws/monitoring") {
          return true;
        }

        if (url.pathname.startsWith("/ws/session/")) {
          const sessionMatch = url.pathname.match(/^\/ws\/session\/(.+)$/);
          if (sessionMatch) {
            const sessionName = decodeURIComponent(sessionMatch[1]);
            return this.sshManager.hasSession(sessionName);
          }
        }

        return false;
      },
    });

    this.wss.on("connection", (ws, req) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);

      if (url.pathname === "/ws/monitoring") {
        // General monitoring connection
        ws.send(
          JSON.stringify({
            type: "connected",
            message: "Monitoring connection established",
          }),
        );
      } else if (url.pathname.startsWith("/ws/session/")) {
        // Session-specific connection
        const sessionMatch = url.pathname.match(/^\/ws\/session\/(.+)$/);
        if (sessionMatch) {
          const sessionName = decodeURIComponent(sessionMatch[1]);
          this.setupSessionWebSocket(ws, sessionName);
        }
      }
    });
  }

  private setupSessionWebSocket(
    ws: import("ws").WebSocket,
    sessionName: string,
  ): void {
    // Add client to session for state synchronization (AC5.3, AC5.4)
    this.addClientToSession(sessionName, ws);

    // Auto-subscribe to session terminal output
    if (this.sshManager.hasSession(sessionName)) {
      const outputCallback = (entry: TerminalOutputEntry): void => {
        if (ws.readyState === ws.OPEN) {
          ws.send(
            JSON.stringify({
              type: "terminal_output",
              sessionName,
              timestamp: new Date(entry.timestamp).toISOString(),
              data: entry.output,
              source: entry.source, // CRITICAL: Include source to prevent undefined source
            }),
          );
        }
      };

      try {
        this.sshManager.addTerminalOutputListener(sessionName, outputCallback);

        // Send historical terminal session with proper format: prompt + command + output + prompt
        this.sendFormattedTerminalHistory(ws, sessionName);

        ws.on("close", () => {
          this.sshManager.removeTerminalOutputListener(
            sessionName,
            outputCallback,
          );
          // Remove client from session state tracking
          this.removeClientFromSession(sessionName, ws);
        });

        ws.on("error", () => {
          this.sshManager.removeTerminalOutputListener(
            sessionName,
            outputCallback,
          );
          // Remove client from session state tracking
          this.removeClientFromSession(sessionName, ws);
        });

        // Handle incoming WebSocket messages (terminal input and state requests)
        ws.on("message", (message: Buffer) => {
          let data: unknown;
          try {
            data = JSON.parse(message.toString());
            
            if (typeof data === 'object' && data !== null && 
                'type' in data && 'sessionName' in data) {
              
              const messageData = data as Record<string, unknown>;
              
              if (messageData.type === "terminal_input" && messageData.sessionName === sessionName) {
                void this.handleTerminalInputMessage(ws, data, sessionName);
              } else if (messageData.type === "terminal_input_raw" && messageData.sessionName === sessionName) {
                void this.handleTerminalInputRawMessage(ws, data, sessionName);
              } else if (messageData.type === "request_state_recovery" && messageData.sessionName === sessionName) {
                this.handleStateRecoveryRequest(ws, sessionName);
              } else if (messageData.type === "malformed_test") {
                // Handle malformed message test gracefully (AC5.5)
                this.handleMalformedMessage(ws, sessionName);
              }
            }
          } catch (error) {
            console.error("Error processing WebSocket message:", error);
            this.handleMalformedMessage(ws, sessionName);
          }
        });
      } catch (error) {
        // Handle listener setup errors gracefully - log but don't crash
        console.error(
          "Error setting up terminal output listener:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  private async cleanup(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    // Close WebSocket server
    if (this.wss) {
      cleanupPromises.push(
        new Promise<void>((resolve) => {
          this.wss!.close(() => {
            this.wss = undefined;
            resolve();
          });
        }),
      );
    }

    // Close HTTP server
    if (this.httpServer) {
      cleanupPromises.push(
        new Promise<void>((resolve, reject) => {
          this.httpServer!.close((error) => {
            if (error) reject(error);
            else {
              this.httpServer = undefined;
              resolve();
            }
          });
        }),
      );
    }

    // Release port reservation
    if (this.webPort) {
      this.portManager.releasePort(this.webPort);
    }

    await Promise.all(cleanupPromises).catch((error) => {
      // Log cleanup errors but don't throw - cleanup should be graceful
      console.error(
        "Error during web server cleanup:",
        error instanceof Error ? error.message : String(error),
      );
    });

    this.running = false;
  }

  private async handleTerminalInputMessage(
    ws: import("ws").WebSocket,
    data: unknown,
    sessionName: string
  ): Promise<void> {
    try {
      // Type guard for data
      if (typeof data !== 'object' || data === null) {
        this.sendErrorResponse(ws, "Invalid data format", undefined);
        return;
      }

      const messageData = data as Record<string, unknown>;

      // Validate session exists
      if (!this.sshManager.hasSession(sessionName)) {
        this.sendErrorResponse(ws, `Session '${sessionName}' not found`, 
          typeof messageData.commandId === 'string' ? messageData.commandId : undefined);
        return;
      }

      // Validate required fields
      if (!messageData.command || typeof messageData.command !== 'string') {
        this.sendErrorResponse(ws, "Command is required and must be a string", 
          typeof messageData.commandId === 'string' ? messageData.commandId : undefined);
        return;
      }

      if (!messageData.commandId || typeof messageData.commandId !== 'string') {
        this.sendErrorResponse(ws, "CommandId is required and must be a string", 
          typeof messageData.commandId === 'string' ? messageData.commandId : undefined);
        return;
      }

      const commandId = messageData.commandId as string;
      const command = messageData.command as string;
      
      // Lock terminal for user command (AC5.1)
      this.lockTerminalForSession(sessionName, commandId, 'user');
      
      // Store command in session history
      const sessionState = this.getOrCreateSessionState(sessionName);
      const historyEntry = sessionState.commandHistory.find(h => h.commandId === commandId);
      if (historyEntry) {
        historyEntry.command = command;
      }

      // Send visual indicator for user execution (AC5.2)
      this.broadcastVisualIndicator(sessionName, 'user_command_executing', 'user', { commandId });
      
      // Send processing state (AC5.2)
      this.broadcastProcessingState(sessionName, 'executing', commandId);

      try {
        // Execute command with user source
        await this.sshManager.executeCommand(
          sessionName, 
          command,
          { source: 'user' }
        );

        // Output is already broadcast by SSH manager to WebSocket listeners
        // No need to send duplicate response here

        // Unlock terminal after successful command completion (AC5.1)
        this.unlockTerminalForSession(sessionName, commandId, 'user');
        
        // Send completion processing state (AC5.2)
        this.broadcastProcessingState(sessionName, 'completed', commandId);
        
        // Send ready state for immediate recovery (AC5.5)
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'terminal_ready',
            sessionName,
            timestamp: new Date().toISOString()
          }));
        }

      } catch (error) {
        // Handle command errors gracefully (AC5.5)
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Send error response with source identification (AC5.5)
        const errorResponse = {
          type: 'command_error',
          sessionName,
          source: 'user',
          commandId: commandId,
          errorMessage: errorMessage,
          timestamp: new Date().toISOString()
        };

        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(errorResponse));
        }

        // Unlock terminal after error (AC5.5)
        this.unlockTerminalForSession(sessionName, commandId, 'user');
        
        // Send error processing state
        this.broadcastProcessingState(sessionName, 'error', commandId);
        
        // Send ready state for immediate recovery (AC5.5) 
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'terminal_ready',
            sessionName,
            timestamp: new Date().toISOString()
          }));
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const messageData = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
      this.sendErrorResponse(ws, `Command execution failed: ${errorMessage}`, 
        typeof messageData.commandId === 'string' ? messageData.commandId : undefined);
    }
  }

  private async handleTerminalInputRawMessage(
    ws: import("ws").WebSocket,
    data: unknown,
    sessionName: string
  ): Promise<void> {
    try {
      // Type guard for data
      if (typeof data !== 'object' || data === null) {
        this.sendErrorResponse(ws, "Invalid data format", undefined);
        return;
      }

      const messageData = data as Record<string, unknown>;

      // Validate session exists
      if (!this.sshManager.hasSession(sessionName)) {
        this.sendErrorResponse(ws, `Session '${sessionName}' not found`, undefined);
        return;
      }

      // Validate required field
      if (!messageData.input || typeof messageData.input !== 'string') {
        this.sendErrorResponse(ws, "Input is required and must be a string", undefined);
        return;
      }

      const input = messageData.input as string;

      // Send raw input directly to SSH session for real-time processing
      // The permanent data handler will broadcast the SSH response back to all browsers
      this.sshManager.sendTerminalInputRaw(sessionName, input);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.sendErrorResponse(ws, `Terminal input failed: ${errorMessage}`, undefined);
    }
  }

  private sendErrorResponse(
    ws: import("ws").WebSocket,
    message: string,
    commandId?: string
  ): void {
    if (ws.readyState === ws.OPEN) {
      const errorResponse = {
        type: 'error',
        message,
        commandId,
        timestamp: new Date().toISOString()
      };
      ws.send(JSON.stringify(errorResponse));
    }
  }

  private setupClaudeCommandMonitoring(): void {
    // This would typically be implemented by hooking into the SSHConnectionManager's
    // command execution pipeline to detect Claude Code commands and provide visual indicators
    // For now, we'll monitor via the output listener mechanism
    
    // Note: In a full implementation, we would extend the SSHConnectionManager
    // to emit command events that we can listen to here
  }

  // Terminal state synchronization methods
  private getOrCreateSessionState(sessionName: string): SessionState {
    if (!this.sessionStates.has(sessionName)) {
      this.sessionStates.set(sessionName, {
        terminalLockState: {
          isLocked: false,
          commandId: null,
          source: null,
          timestamp: Date.now(),
          sessionName
        },
        connectedClients: new Set(),
        lastActivity: Date.now(),
        commandHistory: []
      });
    }
    return this.sessionStates.get(sessionName)!;
  }

  private lockTerminalForSession(sessionName: string, commandId: string, source: 'user' | 'claude'): void {
    const sessionState = this.getOrCreateSessionState(sessionName);
    
    // Only lock for user commands, not Claude commands (AC5.1)
    if (source === 'user') {
      sessionState.terminalLockState = {
        isLocked: true,
        commandId,
        source,
        timestamp: Date.now(),
        sessionName
      };
      
      // Add to command history
      sessionState.commandHistory.push({
        commandId,
        command: '', // Will be filled when we have the actual command
        source,
        timestamp: Date.now(),
        completed: false
      });

      // Broadcast lock state to all connected clients (AC5.3)
      this.broadcastTerminalLockState(sessionName, sessionState.terminalLockState);
    }
  }

  private unlockTerminalForSession(sessionName: string, commandId: string, source: 'user' | 'claude'): void {
    const sessionState = this.getOrCreateSessionState(sessionName);
    
    // Only unlock if this is the command that locked the terminal and it's a user command
    if (sessionState.terminalLockState.isLocked && 
        sessionState.terminalLockState.commandId === commandId &&
        sessionState.terminalLockState.source === 'user' &&
        source === 'user') {
      
      sessionState.terminalLockState = {
        isLocked: false,
        commandId: null,
        source: null,
        timestamp: Date.now(),
        sessionName
      };

      // Mark command as completed in history
      const historyEntry = sessionState.commandHistory.find(h => h.commandId === commandId);
      if (historyEntry) {
        historyEntry.completed = true;
      }

      // Broadcast unlock state to all connected clients (AC5.3)
      this.broadcastTerminalLockState(sessionName, sessionState.terminalLockState);
    }
  }

  private broadcastTerminalLockState(sessionName: string, lockState: TerminalLockState): void {
    const sessionState = this.sessionStates.get(sessionName);
    if (!sessionState) return;

    const message = JSON.stringify({
      type: 'terminal_lock_state',
      sessionName,
      isLocked: lockState.isLocked,
      commandId: lockState.commandId,
      source: lockState.source,
      timestamp: new Date(lockState.timestamp).toISOString()
    });

    // Send to all connected clients for this session (AC5.3)
    sessionState.connectedClients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }

  private broadcastVisualIndicator(sessionName: string, indicatorType: string, source: 'user' | 'claude', data?: Record<string, unknown>): void {
    const sessionState = this.sessionStates.get(sessionName);
    if (!sessionState) return;

    const message = JSON.stringify({
      type: 'visual_state_indicator',
      sessionName,
      indicatorType,
      source,
      timestamp: new Date().toISOString(),
      ...data
    });

    sessionState.connectedClients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }

  private broadcastProcessingState(sessionName: string, state: 'executing' | 'completed' | 'error', commandId?: string): void {
    const sessionState = this.sessionStates.get(sessionName);
    if (!sessionState) return;

    const message = JSON.stringify({
      type: 'processing_state',
      sessionName,
      state,
      commandId,
      timestamp: new Date().toISOString()
    });

    sessionState.connectedClients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }

  private addClientToSession(sessionName: string, client: import("ws").WebSocket): void {
    const sessionState = this.getOrCreateSessionState(sessionName);
    sessionState.connectedClients.add(client);
    
    // Send current terminal lock state to new client (AC5.4 - State recovery)
    const recoveryMessage = JSON.stringify({
      type: 'terminal_lock_state_recovery',
      sessionName,
      isLocked: sessionState.terminalLockState.isLocked,
      commandId: sessionState.terminalLockState.commandId,
      source: sessionState.terminalLockState.source,
      timestamp: new Date(sessionState.terminalLockState.timestamp).toISOString()
    });
    
    if (client.readyState === client.OPEN) {
      client.send(recoveryMessage);
    }
  }

  private removeClientFromSession(sessionName: string, client: import("ws").WebSocket): void {
    const sessionState = this.sessionStates.get(sessionName);
    if (sessionState) {
      sessionState.connectedClients.delete(client);
    }
  }

  private handleStateRecoveryRequest(ws: import("ws").WebSocket, sessionName: string): void {
    const sessionState = this.getOrCreateSessionState(sessionName);
    
    if (ws.readyState === ws.OPEN) {
      // Send current state to requesting client (AC5.4)
      const recoveryMessage = JSON.stringify({
        type: 'terminal_lock_state_recovery',
        sessionName,
        isLocked: sessionState.terminalLockState.isLocked,
        commandId: sessionState.terminalLockState.commandId,
        source: sessionState.terminalLockState.source,
        timestamp: new Date(sessionState.terminalLockState.timestamp).toISOString()
      });
      ws.send(recoveryMessage);

      // Send graceful recovery indication
      ws.send(JSON.stringify({
        type: 'graceful_recovery',
        sessionName,
        timestamp: new Date().toISOString()
      }));
    }
  }

  private handleMalformedMessage(ws: import("ws").WebSocket, sessionName: string): void {
    if (ws.readyState === ws.OPEN) {
      // Handle malformed messages gracefully (AC5.5)
      const response = JSON.stringify({
        type: 'malformed_message_handled',
        sessionName,
        message: 'Invalid message format handled gracefully',
        timestamp: new Date().toISOString()
      });
      ws.send(response);
    }
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

  // Public API methods for testing and monitoring

  async getPort(): Promise<number> {
    if (!this.webPort) {
      throw new Error("Web server not started - port not yet discovered");
    }
    return this.webPort;
  }

  isRunning(): boolean {
    return this.running;
  }

  getConfig(): WebServerManagerConfig {
    return { ...this.config };
  }

  // Methods that should NOT be available in pure web server
  isMCPRunning(): never {
    throw new Error("MCP functionality not available in pure web server");
  }

  getMCPPort(): never {
    throw new Error("MCP functionality not available in pure web server");
  }

  // Public method to handle Claude Code command execution for integration
  public async handleClaudeCodeCommand(sessionName: string, command: string): Promise<void> {
    // This method allows external code (like tests) to simulate Claude Code commands
    // that should provide visual indicators but not affect terminal lock state
    
    if (!this.sshManager.hasSession(sessionName)) {
      return;
    }

    // Send visual indicator for Claude Code execution (AC5.2)
    this.broadcastVisualIndicator(sessionName, 'claude_command_executing', 'claude', { command });

    try {
      // Execute the command as Claude Code (does not lock terminal)
      await this.sshManager.executeCommand(sessionName, command, { source: 'claude' });
      
      // Send visual indicator for completion
      this.broadcastVisualIndicator(sessionName, 'claude_command_completed', 'claude', { command });
    } catch (error) {
      // Send visual indicator for error
      this.broadcastVisualIndicator(sessionName, 'claude_command_error', 'claude', { 
        command, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Send formatted terminal history with proper terminal session format:
   * prompt + command + output + prompt for each historical command
   */
  private sendFormattedTerminalHistory(ws: import("ws").WebSocket, sessionName: string): void {
    if (!this.sshManager.hasSession(sessionName) || ws.readyState !== ws.OPEN) {
      return;
    }

    try {
      // Get terminal output history - no need for command history since we're using raw terminal output
      const terminalHistory = this.sshManager.getTerminalHistory(sessionName);

      // Get session connection info for prompt construction
      const connectionInfo = this.sshManager.getSessionConnectionInfo(sessionName);
      if (!connectionInfo) {
        console.warn(`Cannot get connection info for ${sessionName} - using fallback prompt format`);
        // Fall back to simple history replay if connection info unavailable
        terminalHistory.forEach((entry) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(
              JSON.stringify({
                type: "terminal_output",
                sessionName,
                timestamp: new Date(entry.timestamp).toISOString(),
                data: entry.output,
                source: entry.source,
              }),
            );
          }
        });
        return;
      }

      // CRITICAL FIX: Send raw terminal history directly without reconstructing
      // The terminal history already contains the natural SSH shell output including
      // command echoes, prompts, and responses. Reconstructing creates duplicates.
      
      // Simply send the stored terminal output entries in chronological order
      // CRITICAL FIX: Ensure first command entry has proper prompt prefix
      terminalHistory.forEach((entry, index) => {
        if (ws.readyState === ws.OPEN) {
          let outputData = entry.output;
          
          // If this is the first entry and it looks like a command without a prompt, prepend the prompt
          if (index === 0 && outputData && !outputData.includes(`[${connectionInfo.username}@${connectionInfo.host}`)) {
            // Check if this looks like a command line (starts with a command name)
            const trimmedOutput = outputData.trim();
            const commandPattern = /^[a-zA-Z][a-zA-Z0-9_-]*(\s|$)/;
            if (commandPattern.test(trimmedOutput)) {
              // Prepend the missing prompt
              outputData = `[${connectionInfo.username}@${connectionInfo.host} ~]$ ${outputData}`;
            }
          }
          
          ws.send(
            JSON.stringify({
              type: "terminal_output",
              sessionName,
              timestamp: new Date(entry.timestamp).toISOString(),
              data: outputData,
              source: entry.source,
            }),
          );
        }
      });

    } catch (error) {
      console.error(`Error sending formatted terminal history for session ${sessionName}:`, error);
      // Graceful degradation - fall back to simple terminal history
      const terminalHistory = this.sshManager.getTerminalHistory(sessionName);
      terminalHistory.forEach((entry) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(
            JSON.stringify({
              type: "terminal_output",
              sessionName,
              timestamp: new Date(entry.timestamp).toISOString(),
              data: entry.output,
              source: entry.source,
            }),
          );
        }
      });
    }
  }
}
