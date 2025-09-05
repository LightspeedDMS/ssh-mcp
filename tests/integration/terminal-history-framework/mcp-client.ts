/**
 * Story 2: Pre-WebSocket Command Execution - MCPClient Implementation
 * 
 * MCPClient provides communication with MCP server via stdin/stdout using MCP protocol.
 * This is the core functionality for executing commands before WebSocket connection.
 * 
 * CRITICAL: No mocks in production code. This communicates with real MCP server.
 */

import { ChildProcess } from 'child_process';
import * as readline from 'readline';

export interface MCPClientConfig {
  timeout?: number;
}

interface MCPRequest {
  jsonrpc: string;
  method: string;
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
  id: string;
}

interface MCPResponse {
  jsonrpc: string;
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPToolResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

export class MCPClient {
  private process: ChildProcess;
  private config: Required<MCPClientConfig>;
  private requestId: number = 0;
  private pendingRequests: Map<string, {
    resolve: (value: MCPToolResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private readline: readline.Interface | null = null;

  constructor(process: ChildProcess, config: MCPClientConfig = {}) {
    this.process = process;
    this.config = {
      timeout: config.timeout ?? 30000
    };

    this.setupMessageHandling();
  }

  /**
   * Setup message handling for MCP protocol communication
   */
  private setupMessageHandling(): void {
    if (!this.process || !this.process.stdout || !this.process.stdin) {
      throw new Error('Process must have stdin and stdout streams');
    }

    // Setup readline to parse line-delimited JSON responses
    this.readline = readline.createInterface({
      input: this.process.stdout,
      crlfDelay: Infinity
    });

    this.readline.on('line', (line: string) => {
      // Filter out non-JSON lines (debug output, logs, etc.)
      const trimmedLine = line.trim();
      
      // Skip empty lines and lines that don't look like JSON
      if (!trimmedLine || !trimmedLine.startsWith('{')) {
        return;
      }
      
      try {
        const response = JSON.parse(trimmedLine) as MCPResponse;
        this.handleResponse(response);
      } catch (error) {
        // Handle malformed JSON responses - but don't reject all if it's just debug output
        console.warn(`Ignoring non-JSON output from MCP server: ${trimmedLine}`);
      }
    });

    this.readline.on('error', (error: Error) => {
      this.rejectAllPending(new Error(`MCP communication error: ${error.message}`));
    });
  }

  /**
   * Handle MCP protocol response from server
   */
  private handleResponse(response: MCPResponse): void {
    const request = this.pendingRequests.get(response.id);
    if (!request) {
      // Ignore responses for unknown requests
      return;
    }

    // Clear timeout and remove from pending
    clearTimeout(request.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      request.reject(new Error(`MCP Error: ${response.error.message}`));
    } else {
      // Parse the result as MCP tool response
      const result = this.parseToolResponse(response.result);
      request.resolve(result);
    }
  }

  /**
   * Parse MCP tool response from raw result
   */
  private parseToolResponse(result: unknown): MCPToolResponse {
    if (typeof result === 'object' && result !== null) {
      // Handle MCP tool response format: {content: [{text: "JSON_STRING", type: "text"}]}
      const resultObj = result as any;
      
      if (resultObj.content && Array.isArray(resultObj.content) && resultObj.content.length > 0) {
        const contentItem = resultObj.content[0];
        if (contentItem.text && typeof contentItem.text === 'string') {
          try {
            // Parse the nested JSON from text field
            const parsedText = JSON.parse(contentItem.text);
            return parsedText as MCPToolResponse;
          } catch (error) {
            // If parsing fails, return error
            return { 
              success: false, 
              error: `Failed to parse tool response: ${error instanceof Error ? error.message : String(error)}` 
            };
          }
        }
      }
      
      // Direct result format
      return result as MCPToolResponse;
    } else {
      // Wrap primitive results
      return { success: true, result } as MCPToolResponse;
    }
  }

  /**
   * Reject all pending requests with the given error
   */
  private rejectAllPending(error: Error): void {
    for (const request of this.pendingRequests.values()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Send MCP message to server
   */
  private sendMessage(message: MCPRequest): void {
    if (!this.process.stdin || this.process.stdin.destroyed) {
      throw new Error('Cannot send message: stdin stream is not available');
    }

    const messageJson = JSON.stringify(message) + '\n';
    this.process.stdin.write(messageJson);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  /**
   * Call MCP tool with given name and arguments
   * This is the core method for executing commands via MCP protocol
   */
  public async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResponse> {
    const requestId = this.generateRequestId();

    const request: MCPRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name,
        arguments: args
      },
      id: requestId
    };

    return new Promise<MCPToolResponse>((resolve, reject) => {
      // Setup timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`MCP request timeout for tool '${name}'`));
      }, this.config.timeout);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      try {
        // Send the request
        this.sendMessage(request);
      } catch (error) {
        // Clean up on send failure
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from MCP server and cleanup resources
   */
  public async disconnect(): Promise<void> {
    // Reject all pending requests
    this.rejectAllPending(new Error('MCP client disconnecting'));

    // Close readline interface
    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }

    // Don't close process streams - they're managed by MCPServerManager
  }

  /**
   * Check if client is connected and ready for communication
   */
  public isConnected(): boolean {
    return this.process.stdin !== null && 
           !this.process.stdin.destroyed && 
           this.process.stdout !== null && 
           !this.process.stdout.destroyed;
  }
}