/**
 * Story 6: Comprehensive Response Collection and Output Implementation
 * 
 * ComprehensiveResponseCollector orchestrates the complete terminal history testing framework
 * workflow by integrating all components from Stories 1-5:
 * - MCPServerManager (Story 1): Server lifecycle management
 * - PreWebSocketCommandExecutor (Story 2): Pre-WebSocket command execution
 * - WebSocketConnectionDiscovery (Story 3): WebSocket connection establishment
 * - InitialHistoryReplayCapture (Story 4): Initial history capture
 * - PostWebSocketCommandExecutor (Story 5): Post-WebSocket command execution
 * 
 * Key responsibilities:
 * 1. Orchestrate complete testing workflow from server launch to cleanup
 * 2. Concatenate WebSocket responses verbatim preserving exact formatting
 * 3. Handle timeout scenarios gracefully (10-second configurable limit)
 * 4. Provide clear separation between history replay and real-time message phases
 * 5. Clean up all resources (server, WebSocket, etc.)
 * 
 * CRITICAL: No mocks in production code - uses real integrations with all components.
 */

import { MCPServerManager } from './mcp-server-manager';
import { MCPClient } from './mcp-client';
import { PreWebSocketCommandExecutor, PreWebSocketCommand } from './pre-websocket-command-executor';
import { WebSocketConnectionDiscovery } from './websocket-connection-discovery';
import { InitialHistoryReplayCapture, CapturedMessage } from './initial-history-replay-capture';
import { PostWebSocketCommandExecutor } from './post-websocket-command-executor';
import WebSocket from 'ws';

/**
 * Configuration for ComprehensiveResponseCollector
 */
export interface ComprehensiveResponseCollectorConfig {
  workflowTimeout?: number;                // Total workflow timeout (default: 10000ms)
  sessionName?: string;                    // SSH session name
  preWebSocketCommands?: PreWebSocketCommand[];  // Commands to execute before WebSocket connection
  postWebSocketCommands?: string[];        // Commands to execute after WebSocket connection
  historyReplayTimeout?: number;           // History replay phase timeout (default: 5000ms)
  commandTimeout?: number;                 // Individual command timeout (default: 30000ms)
}

/**
 * Phase breakdown information for detailed workflow analysis
 */
export interface PhaseBreakdown {
  serverLaunchSuccess: boolean;
  preWebSocketCommandsSuccess: boolean;
  webSocketConnectionSuccess: boolean;
  historyReplayCaptureSuccess: boolean;
  postWebSocketCommandsSuccess: boolean;
  historyMessageCount: number;
  realTimeMessageCount: number;
  historyReplayMessages: string[];
  realTimeMessages: string[];
  serverLaunchTime?: number;
  preWebSocketExecutionTime?: number;
  webSocketConnectionTime?: number;
  historyReplayTime?: number;
  postWebSocketExecutionTime?: number;
}

/**
 * Result of complete workflow execution
 */
export interface WorkflowResult {
  success: boolean;
  concatenatedResponses: string;           // Verbatim concatenated WebSocket responses
  error?: string;                          // Error message if workflow failed
  totalExecutionTime: number;              // Total workflow execution time
  phaseBreakdown?: PhaseBreakdown;         // Detailed breakdown of workflow phases
}

/**
 * ComprehensiveResponseCollector - Orchestrator for complete terminal history testing framework
 */
export class ComprehensiveResponseCollector {
  private config: Required<ComprehensiveResponseCollectorConfig>;
  private serverManager?: MCPServerManager;
  private mcpClient?: MCPClient;
  private preWebSocketExecutor?: PreWebSocketCommandExecutor;
  private connectionDiscovery?: WebSocketConnectionDiscovery;
  private historyCapture?: InitialHistoryReplayCapture;
  private postWebSocketExecutor?: PostWebSocketCommandExecutor;
  private currentWebSocket?: WebSocket;
  private workflowStartTime: number = 0;
  private workflowTimeoutId?: NodeJS.Timeout;

  constructor(config: ComprehensiveResponseCollectorConfig = {}) {
    // Validate configuration
    if (config.workflowTimeout !== undefined && config.workflowTimeout <= 0) {
      throw new Error('workflowTimeout must be positive');
    }
    if (config.historyReplayTimeout !== undefined && config.historyReplayTimeout <= 0) {
      throw new Error('historyReplayTimeout must be positive');
    }
    if (config.sessionName !== undefined && config.sessionName.trim().length === 0) {
      throw new Error('sessionName cannot be empty');
    }

    this.config = {
      workflowTimeout: config.workflowTimeout ?? 10000,
      sessionName: config.sessionName ?? 'comprehensive-test-session',
      preWebSocketCommands: config.preWebSocketCommands ?? [
        { tool: 'ssh_connect', args: { name: config.sessionName ?? 'comprehensive-test-session', host: 'localhost', username: 'jsbattig', keyFilePath: '~/.ssh/id_ed25519' } }
      ],
      postWebSocketCommands: config.postWebSocketCommands ?? [],
      historyReplayTimeout: config.historyReplayTimeout ?? 5000,
      commandTimeout: config.commandTimeout ?? 30000
    };
  }

  /**
   * Set framework components for dependency injection
   */
  setServerManager(serverManager: MCPServerManager): void {
    this.serverManager = serverManager;
  }

  setMcpClient(mcpClient: MCPClient): void {
    this.mcpClient = mcpClient;
  }

  setPreWebSocketExecutor(executor: PreWebSocketCommandExecutor): void {
    this.preWebSocketExecutor = executor;
  }

  setConnectionDiscovery(discovery: WebSocketConnectionDiscovery): void {
    this.connectionDiscovery = discovery;
  }

  setHistoryCapture(capture: InitialHistoryReplayCapture): void {
    this.historyCapture = capture;
  }

  setPostWebSocketExecutor(executor: PostWebSocketCommandExecutor): void {
    this.postWebSocketExecutor = executor;
  }

  /**
   * Check if all required components are initialized
   */
  areComponentsInitialized(): boolean {
    return !!(this.serverManager && 
              this.mcpClient && 
              this.preWebSocketExecutor && 
              this.connectionDiscovery && 
              this.historyCapture && 
              this.postWebSocketExecutor);
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<ComprehensiveResponseCollectorConfig> {
    return { ...this.config };
  }

  /**
   * Execute complete comprehensive workflow
   * Orchestrates Stories 1-5 integration for terminal history testing
   */
  async executeComprehensiveWorkflow(): Promise<WorkflowResult> {
    if (!this.areComponentsInitialized()) {
      throw new Error('Framework components not initialized');
    }

    this.workflowStartTime = Date.now();
    const phaseBreakdown: PhaseBreakdown = {
      serverLaunchSuccess: false,
      preWebSocketCommandsSuccess: false,
      webSocketConnectionSuccess: false,
      historyReplayCaptureSuccess: false,
      postWebSocketCommandsSuccess: false,
      historyMessageCount: 0,
      realTimeMessageCount: 0,
      historyReplayMessages: [],
      realTimeMessages: []
    };

    try {
      // Execute workflow with timeout
      const result = await Promise.race([
        this.executeWorkflowSteps(phaseBreakdown),
        this.createTimeoutPromise()
      ]);

      return result;
    } catch (error) {
      const totalTime = Date.now() - this.workflowStartTime;
      
      // Ensure cleanup even on error
      await this.cleanupResources();

      return {
        success: false,
        concatenatedResponses: '',
        error: error instanceof Error ? error.message : String(error),
        totalExecutionTime: totalTime,
        phaseBreakdown
      };
    }
  }

  /**
   * Execute the complete workflow steps
   */
  private async executeWorkflowSteps(phaseBreakdown: PhaseBreakdown): Promise<WorkflowResult> {
    try {
      // Phase 1: Launch MCP Server (Story 1)
      const serverLaunchStart = Date.now();
      if (!this.serverManager!.isRunning()) {
        await this.serverManager!.start();
      }
      phaseBreakdown.serverLaunchSuccess = true;
      phaseBreakdown.serverLaunchTime = Date.now() - serverLaunchStart;

      // Phase 2: Execute Pre-WebSocket Commands (Story 2)
      const preWebSocketStart = Date.now();
      await this.preWebSocketExecutor!.executeCommands(this.config.preWebSocketCommands);
      phaseBreakdown.preWebSocketCommandsSuccess = true;
      phaseBreakdown.preWebSocketExecutionTime = Date.now() - preWebSocketStart;

      // Phase 3: Establish WebSocket Connection (Story 3)
      const webSocketStart = Date.now();
      const webSocketUrl = await this.connectionDiscovery!.discoverWebSocketUrl(this.config.sessionName);
      this.currentWebSocket = await this.connectionDiscovery!.establishConnection(webSocketUrl);
      phaseBreakdown.webSocketConnectionSuccess = true;
      phaseBreakdown.webSocketConnectionTime = Date.now() - webSocketStart;

      // Phase 4: Capture Initial History Replay (Story 4)
      const historyStart = Date.now();
      await this.historyCapture!.captureInitialHistory(this.currentWebSocket);
      await this.historyCapture!.waitForHistoryReplayComplete();
      phaseBreakdown.historyReplayCaptureSuccess = true;
      phaseBreakdown.historyReplayTime = Date.now() - historyStart;

      // Phase 5: Execute Post-WebSocket Commands (Story 5)
      const postWebSocketStart = Date.now();
      await this.postWebSocketExecutor!.executeCommands(this.config.postWebSocketCommands, this.currentWebSocket);
      phaseBreakdown.postWebSocketCommandsSuccess = true;
      phaseBreakdown.postWebSocketExecutionTime = Date.now() - postWebSocketStart;

      // Collect and concatenate responses
      const concatenatedResponses = this.concatenateWebSocketResponses(phaseBreakdown);

      const totalTime = Date.now() - this.workflowStartTime;

      return {
        success: true,
        concatenatedResponses,
        totalExecutionTime: totalTime,
        phaseBreakdown
      };

    } catch (error) {
      const totalTime = Date.now() - this.workflowStartTime;
      
      // Ensure cleanup on error
      await this.cleanupResources();

      return {
        success: false,
        concatenatedResponses: '',
        error: error instanceof Error ? error.message : String(error),
        totalExecutionTime: totalTime,
        phaseBreakdown
      };
    }
  }

  /**
   * Create timeout promise for workflow timeout handling
   * CRITICAL: Store timer reference to prevent resource leaks
   */
  private createTimeoutPromise(): Promise<WorkflowResult> {
    return new Promise((_, reject) => {
      this.workflowTimeoutId = setTimeout(() => {
        reject(new Error(`Workflow timeout after ${this.config.workflowTimeout}ms`));
      }, this.config.workflowTimeout);
    });
  }

  /**
   * Concatenate WebSocket responses verbatim preserving exact formatting
   * CRITICAL: Preserves CRLF line endings required for xterm.js terminal display
   */
  private concatenateWebSocketResponses(phaseBreakdown: PhaseBreakdown): string {
    const historyMessages = this.historyCapture!.getHistoryMessages();
    const realTimeMessages = this.historyCapture!.getRealTimeMessages();

    // Update phase breakdown
    phaseBreakdown.historyMessageCount = historyMessages.length;
    phaseBreakdown.realTimeMessageCount = realTimeMessages.length;
    phaseBreakdown.historyReplayMessages = historyMessages.map(msg => msg.data);
    phaseBreakdown.realTimeMessages = realTimeMessages.map(msg => msg.data);

    // Concatenate all messages verbatim in chronological order
    const allMessages: CapturedMessage[] = [...historyMessages, ...realTimeMessages]
      .sort((a, b) => a.timestamp - b.timestamp);

    // Join message data verbatim - NO modification of line endings
    return allMessages.map(msg => msg.data).join('');
  }

  /**
   * Comprehensive resource cleanup
   * CRITICAL: Clean up all resources to prevent hanging tests
   */
  async cleanup(): Promise<void> {
    await this.cleanupResources();
  }

  /**
   * Internal resource cleanup implementation
   * CRITICAL: Clean up timer to prevent Jest warnings about async operations
   */
  private async cleanupResources(): Promise<void> {
    // Clear workflow timeout timer to prevent resource leak
    if (this.workflowTimeoutId) {
      clearTimeout(this.workflowTimeoutId);
      this.workflowTimeoutId = undefined;
    }

    const cleanupPromises: Promise<void>[] = [];

    // Close WebSocket connection
    if (this.currentWebSocket) {
      try {
        if (this.currentWebSocket.readyState === WebSocket.OPEN) {
          this.currentWebSocket.close();
        }
        this.currentWebSocket.removeAllListeners();
        this.currentWebSocket.terminate();
      } catch {
        // Ignore WebSocket cleanup errors
      }
      this.currentWebSocket = undefined;
    }

    // Cleanup components - always attempt cleanup even if server isn't running
    if (this.historyCapture) {
      cleanupPromises.push(this.historyCapture.cleanup());
    }
    if (this.preWebSocketExecutor) {
      cleanupPromises.push(this.preWebSocketExecutor.cleanup());
    }
    if (this.postWebSocketExecutor) {
      cleanupPromises.push(this.postWebSocketExecutor.cleanup());
    }
    if (this.mcpClient) {
      cleanupPromises.push(this.mcpClient.disconnect());
    }
    if (this.serverManager) {
      cleanupPromises.push(this.serverManager.stop());
    }

    // Wait for all cleanup operations to complete
    await Promise.allSettled(cleanupPromises);
  }
}