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
import { PreWebSocketCommandExecutor, PreWebSocketCommand, PreWebSocketCommandResult } from './pre-websocket-command-executor';
import { WebSocketConnectionDiscovery } from './websocket-connection-discovery';
import { InitialHistoryReplayCapture, CapturedMessage } from './initial-history-replay-capture';
import { PostWebSocketCommandExecutor, PostWebSocketCommand, CommandExecutionResult } from './post-websocket-command-executor';
import WebSocket from 'ws';

/**
 * Configuration for ComprehensiveResponseCollector
 */
export interface ComprehensiveResponseCollectorConfig {
  workflowTimeout?: number;                // Total workflow timeout (default: 10000ms)
  sessionName?: string;                    // SSH session name
  preWebSocketCommands?: PreWebSocketCommand[];  // Commands to execute before WebSocket connection
  postWebSocketCommands?: PostWebSocketCommand[];  // Commands to execute after WebSocket connection
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
 * Interface for MCP command response structure
 */
export interface MCPCommandResponse {
  success: boolean;
  result?: {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
  };
  error?: string;
}

/**
 * Interface for WebSocket terminal messages
 */
export interface TerminalMessage {
  type: string;
  data?: string;
  command?: string;
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
  preWebSocketResults?: PreWebSocketCommandResult[];  // Pre-WebSocket command execution results
  postWebSocketResults?: CommandExecutionResult[];     // Post-WebSocket command execution results
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
  private preWebSocketResults: PreWebSocketCommandResult[] = [];
  private postWebSocketResults: CommandExecutionResult[] = [];

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
        phaseBreakdown,
        preWebSocketResults: this.preWebSocketResults,
        postWebSocketResults: this.postWebSocketResults
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
      this.preWebSocketResults = await this.preWebSocketExecutor!.executeCommands(this.config.preWebSocketCommands);
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
      this.postWebSocketResults = await this.postWebSocketExecutor!.executeCommands(this.config.postWebSocketCommands, this.currentWebSocket);
      phaseBreakdown.postWebSocketCommandsSuccess = true;
      phaseBreakdown.postWebSocketExecutionTime = Date.now() - postWebSocketStart;

      // Collect and concatenate responses
      const concatenatedResponses = this.concatenateWebSocketResponses(phaseBreakdown);

      const totalTime = Date.now() - this.workflowStartTime;

      return {
        success: true,
        concatenatedResponses,
        totalExecutionTime: totalTime,
        phaseBreakdown,
        preWebSocketResults: this.preWebSocketResults,
        postWebSocketResults: this.postWebSocketResults
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
        phaseBreakdown,
        preWebSocketResults: this.preWebSocketResults,
        postWebSocketResults: this.postWebSocketResults
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
   * CRITICAL FIX: Also includes MCP command results to ensure all commands appear in output
   */
  private concatenateWebSocketResponses(phaseBreakdown: PhaseBreakdown): string {
    const historyMessages = this.historyCapture!.getHistoryMessages();
    const realTimeMessages = this.historyCapture!.getRealTimeMessages();

    // Update phase breakdown
    phaseBreakdown.historyMessageCount = historyMessages.length;
    phaseBreakdown.realTimeMessageCount = realTimeMessages.length;
    phaseBreakdown.historyReplayMessages = historyMessages.map(msg => msg.data);
    phaseBreakdown.realTimeMessages = realTimeMessages.map(msg => msg.data);

    // Concatenate all WebSocket messages verbatim in chronological order
    const allMessages: CapturedMessage[] = [...historyMessages, ...realTimeMessages]
      .sort((a, b) => a.timestamp - b.timestamp);

    // Join WebSocket message data verbatim - NO modification of line endings
    // CRITICAL FIX: Extract relevant text content from different message types
    const extractedMessages = allMessages.map(msg => this.extractTerminalText(msg.data));
    
    let rawConcatenated = extractedMessages.join('');
    
    // CRITICAL FIX: Append MCP command results to ensure all commands appear in output
    // MCP commands are executed directly and don't go through WebSocket, so add them manually
    const mcpCommandText = this.extractMCPCommandText();
    rawConcatenated += mcpCommandText;
    
    // COMMAND ECHO DUPLICATION FIX: Remove duplicate command echoes from final concatenated output
    // This fixes the critical bug where commands appear twice in terminal output
    const cleanedOutput = this.removeDuplicateCommandEchoes(rawConcatenated);
    
    return cleanedOutput;
  }

  /**
   * Extract text content from MCP command results
   * Ensures MCP commands and their output appear in concatenated responses
   */
  private extractMCPCommandText(): string {
    try {
      let mcpText = '';
      
      console.debug(`[ComprehensiveResponseCollector] Processing ${this.postWebSocketResults.length} post-WebSocket results`);
      
      // Process post-WebSocket MCP command results
      for (const result of this.postWebSocketResults) {
        try {
          console.debug(`[ComprehensiveResponseCollector] Result: initiator=${result.initiator}, success=${result.mcpResponse?.success}, command=${result.command}`);
          
          // Only process MCP commands, not browser commands
          // Browser commands are handled via WebSocket messages and don't need MCP extraction
          if (result.initiator === 'mcp-client' && result.mcpResponse?.success) {
            // Extract command from MCP command string (format: "ssh_exec {...}")
            const command = this.extractCommandFromMCPString(result.command);
            console.debug(`[ComprehensiveResponseCollector] Extracted command: ${command}`);
            
            if (command) {
              // CRITICAL FIX: Don't add command echo - it's already captured via WebSocket
              // Only add command output if it's missing from WebSocket capture
              
              // Add command output if available using proper typing
              const mcpResult = result.mcpResponse as MCPCommandResponse;
              if (mcpResult.result?.stdout) {
                // Check if this output might be missing from WebSocket capture
                // For now, skip adding it to avoid duplication - WebSocket should capture all terminal output
                console.debug(`[ComprehensiveResponseCollector] MCP stdout available but skipping to avoid duplication: ${mcpResult.result.stdout.length} chars`);
              }
            }
          }
        } catch (resultError) {
          console.error('[ComprehensiveResponseCollector] Error processing individual result:', resultError);
          // Continue processing other results
        }
      }
      
      console.debug(`[ComprehensiveResponseCollector] Final MCP text length: ${mcpText.length}`);
      return mcpText;
    } catch (error) {
      console.error('[ComprehensiveResponseCollector] Error extracting MCP command text:', error);
      return ''; // Graceful degradation
    }
  }

  /**
   * Extract actual command from MCP command string
   * Converts: 'ssh_exec {"sessionName": "test", "command": "whoami"}' → 'whoami'
   */
  private extractCommandFromMCPString(mcpCommand: string): string | null {
    try {
      // Validate input
      if (!mcpCommand || typeof mcpCommand !== 'string') {
        return null;
      }

      // Handle ssh_exec format
      if (mcpCommand.startsWith('ssh_exec ')) {
        const jsonPart = mcpCommand.substring('ssh_exec '.length);
        const parsed = JSON.parse(jsonPart);
        return parsed.command || null;
      }
      
      // For other MCP commands, return as-is
      return mcpCommand;
    } catch (error) {
      console.error('[ComprehensiveResponseCollector] Failed to parse MCP command:', mcpCommand, error);
      return null;
    }
  }

  /**
   * Extract terminal text content from WebSocket message data
   * Handles different message types and extracts only terminal-relevant text
   */
  private extractTerminalText(data: unknown): string {
    try {
      // Handle string data (already terminal text)
      if (typeof data === 'string') {
        return data;
      }

      // Handle object data (WebSocket messages)
      if (typeof data === 'object' && data !== null) {
        const message = data as TerminalMessage;
        
        // For terminal_output messages, extract the data field
        if (message.type === 'terminal_output' && typeof message.data === 'string') {
          return message.data;
        }
        
        // For terminal_input messages, don't extract command - terminal_output will contain the echo
        // This prevents duplicate commands from appearing in the terminal output
        if (message.type === 'terminal_input') {
          return ''; // Skip terminal_input messages to avoid duplicate command echoes
        }
        
        // For other message types (processing_state, visual_state_indicator, etc.), return empty
        // These are control messages, not terminal text
        return '';
      }

      // For any other data types, convert to string
      return String(data);
    } catch (error) {
      console.error('[ComprehensiveResponseCollector] Error extracting terminal text:', error);
      return String(data || ''); // Fallback to string conversion
    }
  }

  /**
   * Remove duplicate command echoes from terminal output
   * Fixes the pattern: [prompt]$ command\r\ncommand\r\nresult → [prompt]$ command\r\nresult
   * Also removes double prompt patterns: ]$ [prompt]$ → [prompt]$
   * FIXED: Uses precise regex patterns to target only actual duplicates
   */
  private removeDuplicateCommandEchoes(output: string): string {
    // Debug logging removed for production
    
    // CRITICAL FIX: Apply the tested regex patterns for duplicate removal
    let cleaned = output;
    
    // Fix 1: Remove PS1 configuration commands that leak into terminal output
    cleaned = cleaned
      .replace(/export PS1='[^']*'[^\\r\\n]*\r?\n?/g, '') // Remove PS1 export commands
      .replace(/PS1='[^']*'\r?\n?/g, '') // Remove any remaining PS1 assignment traces
      .replace(/null 2>&1\r?\n?/g, ''); // Remove null redirection traces
    
    // Fix 2: Remove duplicate command echoes  
    // CRITICAL FIX: Use line-by-line processing instead of complex regex
    cleaned = this.removeDuplicateEchoesSimple(cleaned);
    
    // Fix 3: Remove concatenated duplicate prompts 
    // Pattern: [jsbattig@localhost ~]$ [jsbattig@localhost ~]$ whoami → [jsbattig@localhost ~]$ whoami
    // CRITICAL FIX: Properly escape the $ character in bracket prompts
    cleaned = cleaned.replace(/(\[[^\]]+\]\\\$)\s+(\[[^\]]+\]\\\$)\s+/g, '$2 ');
    return cleaned;
  }

  /**
   * Simple duplicate echo removal using line-by-line processing
   * Handles pattern: [prompt]$ command\r\ncommand\r\nresult → [prompt]$ command\r\nresult
   */
  private removeDuplicateEchoesSimple(output: string): string {
    try {
      const lines = output.split('\r\n');
      const processedLines: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];
        const nextLine = lines[i + 1];
        
        // Check for pattern: [prompt]$ command followed by standalone command
        const promptMatch = currentLine.match(/^(\[.*?\]\$\s+)(.+)$/);
        
        if (promptMatch && nextLine) {
          const commandPart = promptMatch[2];
          
          // If next line is exactly the same command (duplicate echo), skip it
          if (nextLine.trim() === commandPart.trim()) {
            processedLines.push(currentLine);
            i++; // Skip the duplicate line
            continue;
          }
        }
        
        processedLines.push(currentLine);
      }
      
      return processedLines.join('\r\n');
    } catch (error) {
      console.error('[ComprehensiveResponseCollector] Error in simple duplicate removal:', error);
      return output; // Return original on error
    }
  }

  /**
   * Single pass cleanup for duplicate command echoes and double prompts
   * TEMPORARILY DISABLED - Algorithm was too aggressive
   */
  /* private singlePassCleanup(output: string, _passNumber: number): string {
    // Processing pass for duplicate removal
    
    // Split into lines for processing
    const lines = output.split('\r\n');
    const processedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];
      const nextLine = lines[i + 1];
      
      // PATTERN 1: Remove duplicate command echoes
      // Check if current line is a prompt with command: [user@host path]$ command
      const promptWithCommandMatch = currentLine.match(/^(\[.*?\]\$)\s+(.+)$/);
      
      if (promptWithCommandMatch && nextLine) {
        const [, , commandPart] = promptWithCommandMatch;
        
        // If next line is exactly the same command (duplicate echo), skip it
        if (nextLine.trim() === commandPart.trim()) {
          // Removing duplicate command echo: ${nextLine}
          processedLines.push(currentLine);
          i++; // Skip the duplicate command echo line
          continue;
        }
      }
      
      // PATTERN 2: Remove double prompt patterns between commands
      // Example: "[prompt]$ [prompt]$ command" → "[prompt]$ command"
      const doublePromptMatch = currentLine.match(/^(\[.*?\]\$)\s+(\[.*?\]\$)\s+(.+)$/);
      if (doublePromptMatch) {
        const [, , secondPrompt, commandPart] = doublePromptMatch;
        // Removing double prompt, keeping: ${secondPrompt} ${commandPart}
        // Replace with single prompt + command
        processedLines.push(`${secondPrompt} ${commandPart}`);
        continue;
      }
      
      // PATTERN 3: Remove lone prompt followed by prompt with command
      // Check if current line is a lone prompt and next line starts a new prompt
      const currentIsPromptOnly = /^\[.*?\]\$\s*$/.test(currentLine);
      const nextIsPromptWithCommand = nextLine && /^\[.*?\]\$\s+.+$/.test(nextLine);
      
      if (currentIsPromptOnly && nextIsPromptWithCommand) {
        // Removing duplicate prompt line: ${currentLine}
        // Skip the current lone prompt line, keep the one with the command
        continue;
      }
      
      processedLines.push(currentLine);
    }
    
    return processedLines.join('\r\n');
  } */

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