import { SSHConnectionManager } from './ssh-connection-manager.js';
import { PortManager } from './port-discovery.js';
import * as http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';

export interface WebServerManagerConfig {
  port?: number;
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

  constructor(sshManager: SSHConnectionManager, config: WebServerManagerConfig = {}) {
    this.validateConfig(config);
    
    this.config = {
      port: config.port,
      ...config
    };

    this.sshManager = sshManager;
    this.portManager = new PortManager();
    this.app = express();
    
    this.setupExpressRoutes();
  }

  private validateConfig(config: WebServerManagerConfig): void {
    if (config.port !== undefined && (config.port < 1 || config.port > 65535)) {
      throw new Error('Invalid port: must be between 1 and 65535');
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
      throw new Error(`Failed to start web server: ${error instanceof Error ? error.message : String(error)}`);
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
      this.httpServer = this.app.listen(this.webPort, (error?: Error | undefined) => {
        if (error) {
          if (error.message.includes('EADDRINUSE')) {
            reject(new Error(`Port ${this.webPort} is already in use`));
          } else {
            reject(error);
          }
          return;
        }
        resolve();
      });

      this.httpServer.on('error', (error: { code?: string; message: string }) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.webPort} is already in use`));
        } else {
          reject(error);
        }
      });
    });
  }

  private setupExpressRoutes(): void {
    // Serve static files for web interface
    const staticPath = './static';
    this.app.use(express.static(staticPath));
    
    // Handle root route
    this.app.get('/', (_, res) => {
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
    this.app.get('/session/:sessionName', (req, res) => {
      const sessionName = req.params.sessionName;
      
      // Validate session exists
      if (!this.sshManager.hasSession(sessionName)) {
        res.status(404).send('Session not found');
        return;
      }
      
      res.send(`
        <html>
          <head><title>SSH Session: ${sessionName}</title></head>
          <body>
            <h1>SSH Session: ${sessionName}</h1>
            <p>WebSocket endpoint: ws://localhost:${this.webPort}/ws/session/${sessionName}</p>
          </body>
        </html>
      `);
    });
  }

  private setupWebSocketServer(): void {
    if (!this.httpServer) {
      throw new Error('HTTP server must be started before WebSocket server');
    }

    this.wss = new WebSocketServer({ 
      server: this.httpServer,
      verifyClient: (info: { origin: string; secure: boolean; req: http.IncomingMessage }) => {
        const url = new URL(info.req.url!, `http://${info.req.headers.host}`);
        
        if (url.pathname === '/ws/monitoring') {
          return true;
        }
        
        if (url.pathname.startsWith('/ws/session/')) {
          const sessionMatch = url.pathname.match(/^\/ws\/session\/(.+)$/);
          if (sessionMatch) {
            const sessionName = decodeURIComponent(sessionMatch[1]);
            return this.sshManager.hasSession(sessionName);
          }
        }
        
        return false;
      }
    });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      
      if (url.pathname === '/ws/monitoring') {
        // General monitoring connection
        ws.send(JSON.stringify({ type: 'connected', message: 'Monitoring connection established' }));
      } else if (url.pathname.startsWith('/ws/session/')) {
        // Session-specific connection
        const sessionMatch = url.pathname.match(/^\/ws\/session\/(.+)$/);
        if (sessionMatch) {
          const sessionName = decodeURIComponent(sessionMatch[1]);
          this.setupSessionWebSocket(ws, sessionName);
        }
      }
    });
  }

  private setupSessionWebSocket(ws: import('ws').WebSocket, sessionName: string): void {
    // Auto-subscribe to session terminal output
    if (this.sshManager.hasSession(sessionName)) {
      const outputCallback = (entry: any) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'terminal_output',
            sessionName,
            timestamp: new Date(entry.timestamp).toISOString(),
            data: entry.output
          }));
        }
      };

      try {
        this.sshManager.addTerminalOutputListener(sessionName, outputCallback);

        ws.on('close', () => {
          this.sshManager.removeTerminalOutputListener(sessionName, outputCallback);
        });

        ws.on('error', () => {
          this.sshManager.removeTerminalOutputListener(sessionName, outputCallback);
        });
      } catch (error) {
        // Handle listener setup errors gracefully - log but don't crash
        console.error('Error setting up terminal output listener:', error instanceof Error ? error.message : String(error));
      }
    }
  }

  private async cleanup(): Promise<void> {
    const cleanupPromises: Promise<any>[] = [];

    // Close WebSocket server
    if (this.wss) {
      cleanupPromises.push(new Promise<void>((resolve) => {
        this.wss!.close(() => {
          this.wss = undefined;
          resolve();
        });
      }));
    }

    // Close HTTP server
    if (this.httpServer) {
      cleanupPromises.push(new Promise<void>((resolve, reject) => {
        this.httpServer!.close((error) => {
          if (error) reject(error);
          else {
            this.httpServer = undefined;
            resolve();
          }
        });
      }));
    }

    // Release port reservation
    if (this.webPort) {
      this.portManager.releasePort(this.webPort);
    }

    await Promise.all(cleanupPromises).catch((error) => {
      // Log cleanup errors but don't throw - cleanup should be graceful
      console.error('Error during web server cleanup:', error instanceof Error ? error.message : String(error));
    });

    this.running = false;
  }

  // Public API methods for testing and monitoring

  async getPort(): Promise<number> {
    if (!this.webPort) {
      throw new Error('Web server not started - port not yet discovered');
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
    throw new Error('MCP functionality not available in pure web server');
  }

  getMCPPort(): never {
    throw new Error('MCP functionality not available in pure web server');
  }
}