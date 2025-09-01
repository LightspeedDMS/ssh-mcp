#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SSHConnectionManager } from './ssh-connection-manager.js';
import { PortManager } from './port-discovery.js';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import { WebSocketServer } from 'ws';

export interface UnifiedMCPServerConfig {
  webPort?: number;
  sshTimeout?: number;
  maxSessions?: number;
  logLevel?: string;
}

/**
 * Unified MCP Server that integrates MCP Protocol, HTTP Server, and WebSocket Server
 * on a single port to eliminate the dual-server architecture issues.
 */
export class UnifiedMCPServer {
  private mcpServer: Server;
  private httpServer?: http.Server;
  private app: express.Express;
  private wss?: WebSocketServer;
  private sshManager: SSHConnectionManager;
  private portManager: PortManager;
  private config: UnifiedMCPServerConfig;
  private unifiedPort?: number;
  private mcpRunning = false;
  private webServerRunning = false;

  constructor(config: UnifiedMCPServerConfig = {}) {
    this.validateConfig(config);
    
    this.config = {
      webPort: config.webPort,
      sshTimeout: config.sshTimeout || 30000,
      maxSessions: config.maxSessions || 10,
      logLevel: config.logLevel || 'info',
      ...config
    };

    this.portManager = new PortManager();
    this.app = express();
    
    // Initialize MCP server
    this.mcpServer = new Server(
      {
        name: 'ssh-mcp-unified-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // SSH manager will be initialized when port is discovered
    this.sshManager = new SSHConnectionManager(this.config.webPort || 8080);
    
    this.setupMCPToolHandlers();
  }

  private validateConfig(config: UnifiedMCPServerConfig): void {
    if (config.webPort !== undefined && (config.webPort < 1 || config.webPort > 65535)) {
      throw new Error('Invalid port: must be between 1 and 65535');
    }
  }

  /**
   * Start the unified server (MCP + HTTP + WebSocket on same port)
   */
  async start(): Promise<void> {
    try {
      // Discover port for unified server
      await this.discoverUnifiedPort();
      
      // Start all components together
      await Promise.all([
        this.startMCPServer(),
        this.startWebServer()
      ]);

      this.mcpRunning = true;
      this.webServerRunning = true;
      
      console.log(`Unified SSH MCP Server started on port: ${this.unifiedPort}`);
    } catch (error) {
      await this.cleanup();
      throw new Error(`Failed to start unified server: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async discoverUnifiedPort(): Promise<void> {
    if (this.config.webPort) {
      // Use specified port
      this.unifiedPort = await this.portManager.reservePort(this.config.webPort);
    } else {
      // Auto-discover port starting from 8080
      this.unifiedPort = await this.portManager.getUnifiedPort(8080);
    }

    // Update SSH manager with discovered port
    this.sshManager.updateWebServerPort(this.unifiedPort);
    
    // Write discovered port to file for Claude Code MCP connection
    await this.writePortToFile(this.unifiedPort);
  }

  private async writePortToFile(port: number): Promise<void> {
    const portFilePath = path.join(process.cwd(), '.ssh-mcp-server.port');
    try {
      await fs.promises.writeFile(portFilePath, port.toString(), 'utf8');
    } catch (error) {
      console.warn(`Warning: Could not write port to file ${portFilePath}:`, error instanceof Error ? error.message : String(error));
    }
  }

  private async removePortFile(): Promise<void> {
    const portFilePath = path.join(process.cwd(), '.ssh-mcp-server.port');
    try {
      await fs.promises.unlink(portFilePath);
    } catch (error) {
      // Ignore error if file doesn't exist
    }
  }

  private async startMCPServer(): Promise<void> {
    // MCP Server uses stdio transport, doesn't need HTTP port
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
  }

  private async startWebServer(): Promise<void> {
    this.setupExpressRoutes();
    
    return new Promise((resolve, reject) => {
      this.httpServer = this.app.listen(this.unifiedPort, (error?: Error | undefined) => {
        if (error) {
          if (error.message.includes('EADDRINUSE')) {
            reject(new Error(`Port ${this.unifiedPort} is already in use`));
          } else {
            reject(error);
          }
          return;
        }

        this.setupWebSocketServer();
        resolve();
      });

      this.httpServer.on('error', (error: { code?: string; message: string }) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.unifiedPort} is already in use`));
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
            <p>Server running on port ${this.unifiedPort}</p>
            <p>WebSocket endpoint: ws://localhost:${this.unifiedPort}/ws/monitoring</p>
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
            <p>WebSocket endpoint: ws://localhost:${this.unifiedPort}/ws/session/${sessionName}</p>
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

      this.sshManager.addTerminalOutputListener(sessionName, outputCallback);

      ws.on('close', () => {
        this.sshManager.removeTerminalOutputListener(sessionName, outputCallback);
      });

      ws.on('error', () => {
        this.sshManager.removeTerminalOutputListener(sessionName, outputCallback);
      });
    }
  }

  private setupMCPToolHandlers(): void {
    // List available tools
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'ssh_connect',
            description: 'Establish SSH connection to a remote server',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Unique name for the SSH session' },
                host: { type: 'string', description: 'Hostname or IP address' },
                username: { type: 'string', description: 'Username for authentication' },
                password: { type: 'string', description: 'Password (optional if using key)' },
                privateKey: { type: 'string', description: 'Private key (optional if using password)' }
              },
              required: ['name', 'host', 'username']
            }
          },
          {
            name: 'ssh_exec',
            description: 'Execute command on remote server via SSH',
            inputSchema: {
              type: 'object',
              properties: {
                sessionName: { type: 'string', description: 'Name of the SSH session' },
                command: { type: 'string', description: 'Command to execute' },
                timeout: { type: 'number', description: 'Timeout in milliseconds (optional)' }
              },
              required: ['sessionName', 'command']
            }
          },
          {
            name: 'ssh_list_sessions',
            description: 'List all active SSH sessions',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false }
          },
          {
            name: 'ssh_disconnect',
            description: 'Disconnect an SSH session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionName: { type: 'string', description: 'Name of session to disconnect' }
              },
              required: ['sessionName']
            }
          },
          {
            name: 'ssh_get_monitoring_url',
            description: 'Get the monitoring URL for an SSH session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionName: { type: 'string', description: 'Name of session to monitor' }
              },
              required: ['sessionName']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'ssh_connect':
            return await this.handleSSHConnect(args);
          case 'ssh_exec':
            return await this.handleSSHExec(args);
          case 'ssh_list_sessions':
            return await this.handleSSHListSessions();
          case 'ssh_disconnect':
            return await this.handleSSHDisconnect(args);
          case 'ssh_get_monitoring_url':
            return await this.handleSSHGetMonitoringUrl(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: errorMessage }, null, 2) }],
          isError: true
        };
      }
    });
  }

  private async handleSSHConnect(args: any): Promise<any> {
    const { name: sessionName, host, username, password, privateKey } = args;
    
    if (!sessionName || !host || !username) {
      throw new Error('Missing required parameters: name, host, and username are required');
    }

    if (!password && !privateKey) {
      throw new Error('Either password or privateKey must be provided');
    }

    const connection = await this.sshManager.createConnection({
      name: sessionName,
      host,
      username,
      password,
      privateKey
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          connection: {
            name: connection.name,
            host: connection.host,
            username: connection.username,
            status: connection.status,
            lastActivity: connection.lastActivity
          }
        }, null, 2)
      }]
    };
  }

  private async handleSSHExec(args: any): Promise<any> {
    const { sessionName, command, timeout } = args;
    
    if (!sessionName || !command) {
      throw new Error('Missing required parameters: sessionName and command are required');
    }

    const result = await this.sshManager.executeCommand(sessionName, command, { timeout });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          result: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode
          }
        }, null, 2)
      }]
    };
  }

  private async handleSSHListSessions(): Promise<any> {
    const sessions = this.sshManager.listSessions();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          sessions: sessions.map(session => ({
            name: session.name,
            host: session.host,
            username: session.username,
            status: session.status,
            lastActivity: session.lastActivity
          }))
        }, null, 2)
      }]
    };
  }

  private async handleSSHDisconnect(args: any): Promise<any> {
    const { sessionName } = args;
    
    if (!sessionName) {
      throw new Error('Missing required parameter: sessionName');
    }

    await this.sshManager.disconnectSession(sessionName);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Session '${sessionName}' disconnected successfully`
        }, null, 2)
      }]
    };
  }

  private async handleSSHGetMonitoringUrl(args: any): Promise<any> {
    const { sessionName } = args;
    
    if (!sessionName) {
      throw new Error('Missing required parameter: sessionName');
    }

    // Validate session exists first
    if (!this.sshManager.hasSession(sessionName)) {
      throw new Error(`Session '${sessionName}' not found`);
    }

    // Critical fix: Use existing unified server, don't start new server
    if (!this.webServerRunning) {
      throw new Error('Web server not running');
    }

    // Return URL of existing unified server
    const monitoringUrl = `http://localhost:${this.unifiedPort}/session/${sessionName}`;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          sessionName: sessionName,
          monitoringUrl: monitoringUrl
        }, null, 2)
      }]
    };
  }

  /**
   * Stop the unified server gracefully
   */
  async stop(): Promise<void> {
    await this.cleanup();
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

    // Close MCP server
    if (this.mcpRunning) {
      cleanupPromises.push(this.mcpServer.close().catch(() => {})); // Ignore errors
    }

    // Cleanup SSH connections
    this.sshManager.cleanup();

    // Release port reservation
    if (this.unifiedPort) {
      this.portManager.releasePort(this.unifiedPort);
    }

    // Remove port file
    await this.removePortFile();

    await Promise.all(cleanupPromises);

    this.mcpRunning = false;
    this.webServerRunning = false;
  }

  // Public API methods for testing and monitoring

  async getPort(): Promise<number> {
    if (!this.unifiedPort) {
      throw new Error('Server not started - port not yet discovered');
    }
    return this.unifiedPort;
  }

  getMCPPort(): number {
    return this.unifiedPort || 0;
  }

  getWebPort(): number {
    return this.unifiedPort || 0;
  }

  isMCPRunning(): boolean {
    return this.mcpRunning;
  }

  isWebServerRunning(): boolean {
    return this.webServerRunning;
  }

  getActiveServerCount(): number {
    // In unified architecture, we always have exactly 1 server
    return (this.mcpRunning && this.webServerRunning) ? 1 : 0;
  }

  getSSHConnectionManager(): SSHConnectionManager {
    return this.sshManager;
  }

  async listTools(): Promise<string[]> {
    // Return available tool names directly from our schema
    return [
      'ssh_connect',
      'ssh_exec', 
      'ssh_list_sessions',
      'ssh_disconnect',
      'ssh_get_monitoring_url'
    ];
  }

  async callTool(name: string, args: any): Promise<any> {
    try {
      switch (name) {
        case 'ssh_connect':
          const connectResult = await this.handleSSHConnect(args);
          return JSON.parse(connectResult.content[0].text);
        case 'ssh_exec':
          const execResult = await this.handleSSHExec(args);
          return JSON.parse(execResult.content[0].text);
        case 'ssh_list_sessions':
          const listResult = await this.handleSSHListSessions();
          return JSON.parse(listResult.content[0].text);
        case 'ssh_disconnect':
          const disconnectResult = await this.handleSSHDisconnect(args);
          return JSON.parse(disconnectResult.content[0].text);
        case 'ssh_get_monitoring_url':
          const urlResult = await this.handleSSHGetMonitoringUrl(args);
          return JSON.parse(urlResult.content[0].text);
        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  getConfig(): UnifiedMCPServerConfig {
    return { ...this.config };
  }
}