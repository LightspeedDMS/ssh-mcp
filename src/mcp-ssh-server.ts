#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SSHConnectionManager } from "./ssh-connection-manager.js";

export interface MCPSSHServerConfig {
  sshTimeout?: number;
  maxSessions?: number;
  logLevel?: string;
}

// MCP Tool parameter interfaces (for internal type safety)
interface SSHConnectArgs {
  name: string;
  host: string;
  username: string;
  password?: string;
  privateKey?: string;
}

interface SSHExecArgs {
  sessionName: string;
  command: string;
  timeout?: number;
}

interface SSHDisconnectArgs {
  sessionName: string;
}

interface SSHGetMonitoringUrlArgs {
  sessionName: string;
}

/**
 * Pure MCP SSH Server - Uses stdio transport only, no HTTP functionality
 * This server provides SSH tools via MCP protocol without any web interface
 */
export class MCPSSHServer {
  private mcpServer: Server;
  private sshManager: SSHConnectionManager;
  private config: MCPSSHServerConfig;
  private mcpRunning = false;
  private webServerPort?: number;

  constructor(
    config: MCPSSHServerConfig = {},
    sshManager?: SSHConnectionManager,
  ) {
    this.validateConfig(config);

    this.config = {
      sshTimeout: config.sshTimeout || 30000,
      maxSessions: config.maxSessions || 10,
      logLevel: config.logLevel || "info",
      ...config,
    };

    // Initialize MCP server
    this.mcpServer = new Server(
      {
        name: "ssh-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // SSH manager - use shared instance or create new one
    this.sshManager = sshManager || new SSHConnectionManager(8080);

    this.setupMCPToolHandlers();
  }

  private validateConfig(config: MCPSSHServerConfig): void {
    if (config.sshTimeout !== undefined && config.sshTimeout < 0) {
      throw new Error("Invalid ssh timeout: must be positive");
    }
    if (config.maxSessions !== undefined && config.maxSessions < 1) {
      throw new Error("Invalid max sessions: must be at least 1");
    }
  }

  /**
   * Start the MCP server with stdio transport
   */
  async start(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.mcpServer.connect(transport);
      this.mcpRunning = true;

      if (this.config.logLevel === "debug") {
        console.error("MCP SSH Server started with stdio transport");
      }
    } catch (error) {
      throw new Error(
        `Failed to start MCP SSH server: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Stop the MCP server gracefully
   */
  async stop(): Promise<void> {
    try {
      if (this.mcpRunning) {
        await this.mcpServer.close();
        this.mcpRunning = false;
      }

      // Cleanup SSH connections
      this.sshManager.cleanup();

      if (this.config.logLevel === "debug") {
        console.error("MCP SSH Server stopped");
      }
    } catch (error) {
      // Log error but don't throw - cleanup should be graceful
      if (this.config.logLevel !== "silent") {
        console.error(
          "Error during MCP SSH server cleanup:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  /**
   * Set the web server port for monitoring URL coordination
   */
  setWebServerPort(port: number): void {
    this.webServerPort = port;
    this.sshManager.updateWebServerPort(port);
  }

  /**
   * Get the coordinated web server port
   */
  getWebServerPort(): number {
    if (!this.webServerPort) {
      throw new Error("Web server port not set by orchestrator");
    }
    return this.webServerPort;
  }

  private setupMCPToolHandlers(): void {
    // List available tools
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "ssh_connect",
            description: "Establish SSH connection to a remote server",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Unique name for the SSH session",
                },
                host: { type: "string", description: "Hostname or IP address" },
                username: {
                  type: "string",
                  description: "Username for authentication",
                },
                password: {
                  type: "string",
                  description: "Password (optional if using key)",
                },
                privateKey: {
                  type: "string",
                  description: "Private key (optional if using password)",
                },
              },
              required: ["name", "host", "username"],
            },
          },
          {
            name: "ssh_exec",
            description: "Execute command on remote server via SSH",
            inputSchema: {
              type: "object",
              properties: {
                sessionName: {
                  type: "string",
                  description: "Name of the SSH session",
                },
                command: { type: "string", description: "Command to execute" },
                timeout: {
                  type: "number",
                  description: "Timeout in milliseconds (optional)",
                },
              },
              required: ["sessionName", "command"],
            },
          },
          {
            name: "ssh_list_sessions",
            description: "List all active SSH sessions",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: "ssh_disconnect",
            description: "Disconnect an SSH session",
            inputSchema: {
              type: "object",
              properties: {
                sessionName: {
                  type: "string",
                  description: "Name of session to disconnect",
                },
              },
              required: ["sessionName"],
            },
          },
          {
            name: "ssh_get_monitoring_url",
            description: "Get the monitoring URL for an SSH session",
            inputSchema: {
              type: "object",
              properties: {
                sessionName: {
                  type: "string",
                  description: "Name of session to monitor",
                },
              },
              required: ["sessionName"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "ssh_connect":
            return await this.handleSSHConnect(
              args as unknown as SSHConnectArgs,
            );
          case "ssh_exec":
            return await this.handleSSHExec(args as unknown as SSHExecArgs);
          case "ssh_list_sessions":
            return await this.handleSSHListSessions();
          case "ssh_disconnect":
            return await this.handleSSHDisconnect(
              args as unknown as SSHDisconnectArgs,
            );
          case "ssh_get_monitoring_url":
            return await this.handleSSHGetMonitoringUrl(
              args as unknown as SSHGetMonitoringUrlArgs,
            );
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { success: false, error: errorMessage },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleSSHConnect(
    args: SSHConnectArgs,
  ): Promise<{ content: { type: string; text: string }[] }> {
    const { name: sessionName, host, username, password, privateKey } = args;

    if (!sessionName || !host || !username) {
      throw new Error(
        "Missing required parameters: name, host, and username are required",
      );
    }

    if (!password && !privateKey) {
      throw new Error("Either password or privateKey must be provided");
    }

    const connection = await this.sshManager.createConnection({
      name: sessionName,
      host,
      username,
      password,
      privateKey,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              connection: {
                name: connection.name,
                host: connection.host,
                username: connection.username,
                status: connection.status,
                lastActivity: connection.lastActivity,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleSSHExec(
    args: SSHExecArgs,
  ): Promise<{ content: { type: string; text: string }[] }> {
    const { sessionName, command, timeout } = args;

    if (!sessionName || !command) {
      throw new Error(
        "Missing required parameters: sessionName and command are required",
      );
    }

    const result = await this.sshManager.executeCommand(sessionName, command, {
      timeout,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              result: {
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleSSHListSessions(): Promise<{
    content: { type: string; text: string }[];
  }> {
    const sessions = this.sshManager.listSessions();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              sessions: sessions.map((session) => ({
                name: session.name,
                host: session.host,
                username: session.username,
                status: session.status,
                lastActivity: session.lastActivity,
              })),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleSSHDisconnect(
    args: SSHDisconnectArgs,
  ): Promise<{ content: { type: string; text: string }[] }> {
    const { sessionName } = args;

    if (!sessionName) {
      throw new Error("Missing required parameter: sessionName");
    }

    await this.sshManager.disconnectSession(sessionName);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `Session '${sessionName}' disconnected successfully`,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleSSHGetMonitoringUrl(
    args: SSHGetMonitoringUrlArgs,
  ): Promise<{ content: { type: string; text: string }[] }> {
    const { sessionName } = args;

    if (!sessionName) {
      throw new Error("Missing required parameter: sessionName");
    }

    // Validate session exists first
    if (!this.sshManager.hasSession(sessionName)) {
      throw new Error(`Session '${sessionName}' not found`);
    }

    // Check if web server port is available
    if (!this.webServerPort) {
      throw new Error("Web server not available for monitoring URLs");
    }

    // Return URL of coordinated web server
    const monitoringUrl = `http://localhost:${this.webServerPort}/session/${sessionName}`;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              sessionName: sessionName,
              monitoringUrl: monitoringUrl,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  // Public API methods for testing and coordination

  isMCPRunning(): boolean {
    return this.mcpRunning;
  }

  getSSHConnectionManager(): SSHConnectionManager {
    return this.sshManager;
  }

  async listTools(): Promise<string[]> {
    // Return available tool names directly from our schema
    return [
      "ssh_connect",
      "ssh_exec",
      "ssh_list_sessions",
      "ssh_disconnect",
      "ssh_get_monitoring_url",
    ];
  }

  async callTool(name: string, args: unknown): Promise<unknown> {
    try {
      switch (name) {
        case "ssh_connect": {
          const connectResult = await this.handleSSHConnect(
            args as SSHConnectArgs,
          );
          return JSON.parse(connectResult.content[0].text);
        }
        case "ssh_exec": {
          const execResult = await this.handleSSHExec(args as SSHExecArgs);
          return JSON.parse(execResult.content[0].text);
        }
        case "ssh_list_sessions": {
          const listResult = await this.handleSSHListSessions();
          return JSON.parse(listResult.content[0].text);
        }
        case "ssh_disconnect": {
          const disconnectResult = await this.handleSSHDisconnect(
            args as SSHDisconnectArgs,
          );
          return JSON.parse(disconnectResult.content[0].text);
        }
        case "ssh_get_monitoring_url": {
          const urlResult = await this.handleSSHGetMonitoringUrl(
            args as SSHGetMonitoringUrlArgs,
          );
          return JSON.parse(urlResult.content[0].text);
        }
        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getConfig(): MCPSSHServerConfig {
    return { ...this.config };
  }

  // Methods that should NOT be available in pure MCP server
  getWebPort(): never {
    throw new Error("HTTP functionality not available in pure MCP server");
  }

  isWebServerRunning(): never {
    throw new Error("HTTP functionality not available in pure MCP server");
  }
}
