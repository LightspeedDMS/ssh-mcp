#!/usr/bin/env node

import { MCPSSHServer, MCPSSHServerConfig } from './mcp-ssh-server.js';
import { WebServerManager, WebServerManagerConfig } from './web-server-manager.js';
import { SSHConnectionManager } from './ssh-connection-manager.js';
import { PortManager } from './port-discovery.js';
import * as fs from 'fs';
import * as path from 'path';

export interface MCPServerConfig {
  webPort?: number;
  sshTimeout?: number;
  maxSessions?: number;
  logLevel?: string;
}

/**
 * Main Server Orchestrator - Manages separate MCP and Web servers
 * This resolves the protocol conflict by running MCP (stdio) and HTTP servers separately
 */
export class MCPServer {
  private mcpServer: MCPSSHServer;
  private webServer: WebServerManager;
  private sshManager: SSHConnectionManager;
  private portManager: PortManager;
  private config: MCPServerConfig;
  private webPort?: number;

  constructor(config: MCPServerConfig = {}) {
    this.validateConfig(config);
    
    this.config = {
      webPort: config.webPort,
      sshTimeout: config.sshTimeout || 30000,
      maxSessions: config.maxSessions || 10,
      logLevel: config.logLevel || 'info',
      ...config
    };

    this.portManager = new PortManager();
    
    // Initialize shared SSH connection manager
    this.sshManager = new SSHConnectionManager(8080); // Will be updated with actual port
    
    // Initialize separate servers
    const mcpConfig: MCPSSHServerConfig = {
      sshTimeout: this.config.sshTimeout,
      maxSessions: this.config.maxSessions,
      logLevel: this.config.logLevel
    };
    this.mcpServer = new MCPSSHServer(mcpConfig);

    const webConfig: WebServerManagerConfig = {
      port: this.config.webPort
    };
    this.webServer = new WebServerManager(this.sshManager, webConfig);
  }

  private validateConfig(config: MCPServerConfig): void {
    if (config.webPort !== undefined && (config.webPort < 1 || config.webPort > 65535)) {
      throw new Error('Invalid port: must be between 1 and 65535');
    }
    if (config.sshTimeout !== undefined && config.sshTimeout < 0) {
      throw new Error('Invalid ssh timeout: must be positive');
    }
    if (config.maxSessions !== undefined && config.maxSessions < 1) {
      throw new Error('Invalid max sessions: must be at least 1');
    }
  }

  /**
   * Start both MCP and Web servers in coordinated fashion
   */
  async start(): Promise<void> {
    try {
      // Discover web server port first
      await this.discoverWebPort();
      
      // Coordinate port information between servers
      this.mcpServer.setWebServerPort(this.webPort!);
      this.sshManager.updateWebServerPort(this.webPort!);
      
      // Start both servers - web server first to establish HTTP endpoint
      await this.webServer.start();
      
      // Start MCP server with stdio transport (non-blocking)
      // Note: MCP server with stdio will block, so we start it last
      await this.mcpServer.start();
      
      // Write port file for Claude Code MCP connection
      await this.writePortToFile(this.webPort!);
      
      console.log(`MCP SSH Server started - MCP: stdio, Web: ${this.webPort}`);
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  private async discoverWebPort(): Promise<void> {
    if (this.config.webPort) {
      // Use specified port
      this.webPort = await this.portManager.reservePort(this.config.webPort);
    } else {
      // Auto-discover port starting from 8080
      this.webPort = await this.portManager.getUnifiedPort(8080);
    }
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

  /**
   * Stop both servers gracefully
   */
  async stop(): Promise<void> {
    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    const cleanupPromises: Promise<any>[] = [];

    // Stop MCP server
    if (this.mcpServer) {
      cleanupPromises.push(this.mcpServer.stop().catch(() => {})); // Ignore errors
    }

    // Stop web server
    if (this.webServer) {
      cleanupPromises.push(this.webServer.stop().catch(() => {})); // Ignore errors
    }

    // Release port reservation
    if (this.webPort) {
      this.portManager.releasePort(this.webPort);
    }

    // Remove port file
    cleanupPromises.push(this.removePortFile());

    await Promise.all(cleanupPromises);
  }

  // Public API methods for testing and coordination

  async getWebPort(): Promise<number> {
    if (!this.webPort) {
      throw new Error('Server not started - port not yet discovered');
    }
    return this.webPort;
  }

  getMCPPort(): number {
    return 0; // MCP uses stdio, no port
  }

  isMCPRunning(): boolean {
    return this.mcpServer.isMCPRunning();
  }

  isWebServerRunning(): boolean {
    return this.webServer.isRunning();
  }

  getActiveServerCount(): number {
    let count = 0;
    if (this.isMCPRunning()) count++;
    if (this.isWebServerRunning()) count++;
    return count;
  }

  getSSHConnectionManager(): SSHConnectionManager {
    return this.sshManager;
  }

  async listTools(): Promise<string[]> {
    return await this.mcpServer.listTools();
  }

  async callTool(name: string, args: any): Promise<any> {
    return await this.mcpServer.callTool(name, args);
  }

  getConfig(): MCPServerConfig {
    return { ...this.config };
  }
}

// Main execution when run directly
async function main(): Promise<void> {
  const config: MCPServerConfig = {
    webPort: process.env.WEB_PORT ? parseInt(process.env.WEB_PORT) : undefined, // Let it auto-discover
    sshTimeout: process.env.SSH_TIMEOUT ? parseInt(process.env.SSH_TIMEOUT) * 1000 : 30000,
    maxSessions: process.env.MAX_SESSIONS ? parseInt(process.env.MAX_SESSIONS) : 10,
    logLevel: process.env.LOG_LEVEL || 'info'
  };

  // Use the new separate servers architecture
  const mcpServer = new MCPServer(config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await mcpServer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await mcpServer.stop();
    process.exit(0);
  });

  try {
    await mcpServer.start();
  } catch (error) {
    console.error('Failed to start MCP server:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}