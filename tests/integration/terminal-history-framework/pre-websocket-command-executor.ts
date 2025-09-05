/**
 * Story 2: Pre-WebSocket Command Executor Implementation
 * 
 * PreWebSocketCommandExecutor executes commands via MCPClient before WebSocket connection,
 * building up terminal history in the MCP server. This is the core functionality for
 * Story 2: executing commands sequentially to prepare the session for browser access.
 * 
 * CRITICAL: No mocks in production code. This communicates with real MCP server via MCPClient.
 */

import { MCPClient, MCPToolResponse } from './mcp-client';

export interface PreWebSocketCommand {
  tool: string;
  args: Record<string, unknown>;
}

export interface PreWebSocketCommandResult {
  tool: string;
  args: Record<string, unknown>;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
}

export interface PreWebSocketExecutorConfig {
  commandTimeout?: number;
  allowParallelExecution?: boolean;
  stopOnError?: boolean;
}

export class PreWebSocketCommandExecutor {
  private mcpClient: MCPClient;
  private config: Required<PreWebSocketExecutorConfig>;

  constructor(mcpClient: MCPClient, config: PreWebSocketExecutorConfig = {}) {
    if (!mcpClient || !mcpClient.isConnected()) {
      throw new Error('MCP client is invalid or not connected');
    }

    this.mcpClient = mcpClient;
    this.config = {
      commandTimeout: config.commandTimeout ?? 30000,
      allowParallelExecution: config.allowParallelExecution ?? false,
      stopOnError: config.stopOnError ?? false
    };
  }

  /**
   * Execute commands in sequence via MCP protocol
   * This builds terminal history in the MCP server before WebSocket connection
   */
  public async executeCommands(commands: PreWebSocketCommand[]): Promise<PreWebSocketCommandResult[]> {
    if (!commands || commands.length === 0) {
      return [];
    }

    const results: PreWebSocketCommandResult[] = [];

    if (this.config.allowParallelExecution) {
      // Execute commands in parallel
      const promises = commands.map(command => this.executeCommand(command));
      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);
    } else {
      // Execute commands sequentially (default behavior)
      for (const command of commands) {
        const result = await this.executeCommand(command);
        results.push(result);

        // Stop execution on error if configured to do so
        if (this.config.stopOnError && !result.success) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute a single command via MCP client
   */
  private async executeCommand(command: PreWebSocketCommand): Promise<PreWebSocketCommandResult> {
    const startTime = Date.now();

    try {
      const response: MCPToolResponse = await this.mcpClient.callTool(command.tool, command.args);
      const executionTime = Date.now() - startTime;

      return {
        tool: command.tool,
        args: command.args,
        success: response.success,
        result: response.result,
        error: response.error,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        tool: command.tool,
        args: command.args,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      };
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    // PreWebSocketCommandExecutor doesn't manage the MCPClient lifecycle
    // MCPClient cleanup is handled by the caller
  }

  /**
   * Check if executor is ready for command execution
   */
  public isReady(): boolean {
    return this.mcpClient.isConnected();
  }

  /**
   * Get current configuration
   */
  public getConfig(): Required<PreWebSocketExecutorConfig> {
    return { ...this.config };
  }
}