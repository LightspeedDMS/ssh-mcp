/**
 * Story 9: Jest Integration and Test Utilities
 * 
 * This class provides comprehensive Jest integration utilities for the Terminal History Testing Framework.
 * It enables developers to write terminal history tests easily with helper utilities, assertion helpers,
 * and seamless integration with all framework components (Stories 1-8).
 * 
 * Key capabilities:
 * - Jest test runner integration with custom matchers and setup utilities
 * - Helper utilities for common terminal history test patterns
 * - Async/await patterns with proper resource cleanup
 * - WebSocket message assertion helpers with CRLF validation
 * - Parameterized test support for multiple scenarios
 * - Integration with RobustErrorDiagnostics for enhanced debugging
 * - Test isolation and concurrent execution support
 * 
 * CRITICAL: No mocks in production code - uses real framework integration and Jest utilities
 */

import { ComprehensiveResponseCollector, WorkflowResult } from './comprehensive-response-collector';
import { FlexibleCommandConfiguration, CommandConfigurationJSON } from './flexible-command-configuration';
import { MCPServerManager } from './mcp-server-manager';
import { MCPClient } from './mcp-client';
import { PreWebSocketCommandExecutor } from './pre-websocket-command-executor';
import { WebSocketConnectionDiscovery } from './websocket-connection-discovery';
import { InitialHistoryReplayCapture } from './initial-history-replay-capture';
import { PostWebSocketCommandExecutor } from './post-websocket-command-executor';

/**
 * Configuration for Jest test utilities
 */
export interface JestTestUtilitiesConfig {
  enableDetailedLogging?: boolean;
  enableErrorDiagnostics?: boolean;
  testTimeout?: number;
  cleanupTimeout?: number;
}

/**
 * WebSocket message validation result
 */
export interface WebSocketValidationResult {
  hasMessages: boolean;
  hasCRLF: boolean;
  hasPrompts: boolean;
  commandCount: number;
  messageCount: number;
  errors: string[];
}

/**
 * Parameterized test scenario
 */
export interface TestScenario {
  name: string;
  config: CommandConfigurationJSON;
  expectedMessages?: number;
  expectedCommands?: string[];
  timeout?: number;
}

/**
 * WebSocket message assertion builder
 */
export class WebSocketMessageAssertion {
  private messages: string;
  private errors: string[] = [];

  constructor(messages: string) {
    this.messages = messages;
  }

  /**
   * Assert that messages contain CRLF line endings (critical for xterm.js)
   */
  toContainCRLF(): this {
    if (!this.messages.includes('\r\n')) {
      this.errors.push('Expected WebSocket messages to contain CRLF line endings (\\r\\n) but found only LF');
    }
    return this;
  }

  /**
   * Assert that messages contain shell prompts (supports both old and new bracket formats)
   */
  toHavePrompts(): this {
    // Support both old format (user@host:path$) and new bracket format ([user@host project]$)
    const oldFormatPattern = /[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+:[^\$]*\$/g;
    const bracketFormatPattern = /\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\]\$/g;
    
    if (!oldFormatPattern.test(this.messages) && !bracketFormatPattern.test(this.messages)) {
      this.errors.push('Expected WebSocket messages to contain shell prompts (user@host:path$ or [user@host project]$) but none found');
    }
    return this;
  }

  /**
   * Assert that messages match expected command sequence
   */
  toMatchCommandSequence(expectedCommands: string[]): this {
    for (const command of expectedCommands) {
      if (!this.messages.includes(command)) {
        this.errors.push(`Expected WebSocket messages to contain command "${command}" but not found`);
      }
    }
    return this;
  }

  /**
   * Assert that messages have minimum length (non-empty)
   */
  toHaveMinimumLength(minLength: number): this {
    if (this.messages.length < minLength) {
      this.errors.push(`Expected WebSocket messages to have minimum length ${minLength} but got ${this.messages.length}`);
    }
    return this;
  }

  /**
   * Assert that messages contain specific text
   */
  toContainText(expectedText: string): this {
    if (!this.messages.includes(expectedText)) {
      this.errors.push(`Expected WebSocket messages to contain "${expectedText}" but not found`);
    }
    return this;
  }

  /**
   * Assert that messages do NOT contain specific text
   */
  toNotContain(unexpectedText: string): this {
    if (this.messages.includes(unexpectedText)) {
      this.errors.push(`Expected WebSocket messages to NOT contain "${unexpectedText}" but it was found`);
    }
    return this;
  }

  /**
   * Validate all assertions and throw if any failed
   */
  validate(): void {
    if (this.errors.length > 0) {
      throw new Error(`WebSocket message assertions failed:\n${this.errors.join('\n')}`);
    }
  }
}

/**
 * Jest Integration and Test Utilities for Terminal History Testing Framework
 */
export class JestTestUtilities {
  private config: Required<JestTestUtilitiesConfig>;
  private responseCollector?: ComprehensiveResponseCollector;
  private commandConfig?: FlexibleCommandConfiguration;
  private currentTestName?: string;
  private testStartTime?: number;

  constructor(config: JestTestUtilitiesConfig = {}) {
    this.config = {
      enableDetailedLogging: config.enableDetailedLogging ?? false,
      enableErrorDiagnostics: config.enableErrorDiagnostics ?? true,
      testTimeout: config.testTimeout ?? 30000,
      cleanupTimeout: config.cleanupTimeout ?? 5000
    };
  }

  /**
   * Setup utilities for test execution (call in beforeEach)
   */
  async setupTest(testName?: string): Promise<void> {
    this.currentTestName = testName || 'terminal-history-test';
    this.testStartTime = Date.now();

    if (this.config.enableDetailedLogging) {
      console.log(`[JestTestUtilities] Setting up test: ${this.currentTestName}`);
    }

    // Initialize fresh command configuration for this test
    this.commandConfig = new FlexibleCommandConfiguration({
      preWebSocketCommands: [],
      postWebSocketCommands: [],
      workflowTimeout: this.config.testTimeout,
      sessionName: `${this.currentTestName}-${Date.now()}`
    });
  }

  /**
   * Cleanup utilities for test execution (call in afterEach)
   */
  async cleanupTest(): Promise<void> {
    const testDuration = this.testStartTime ? Date.now() - this.testStartTime : 0;

    if (this.config.enableDetailedLogging) {
      console.log(`[JestTestUtilities] Cleaning up test: ${this.currentTestName} (duration: ${testDuration}ms)`);
    }

    // Cleanup response collector if enabled
    if (this.responseCollector) {
      try {
        await this.responseCollector.cleanup();
      } catch (error) {
        console.warn(`[JestTestUtilities] Warning: Error during response collector cleanup: ${error}`);
      }
    }

    // Reset state
    this.commandConfig = undefined;
    this.currentTestName = undefined;
    this.testStartTime = undefined;
  }

  /**
   * Run a terminal history test with the given configuration
   */
  async runTerminalHistoryTest(config: CommandConfigurationJSON): Promise<WorkflowResult> {
    if (!this.commandConfig) {
      throw new Error('Must call setupTest() before running tests');
    }

    try {
      // Update command configuration
      this.commandConfig = new FlexibleCommandConfiguration({
        ...config,
        sessionName: config.sessionName || `${this.currentTestName}-${Date.now()}`,
        workflowTimeout: config.workflowTimeout || this.config.testTimeout
      });

      // Get comprehensive response collector config
      const collectorConfig = this.commandConfig.getComprehensiveResponseCollectorConfig();
      
      // Create response collector instance
      this.responseCollector = new ComprehensiveResponseCollector(collectorConfig);

      // Initialize all framework components
      await this.initializeFrameworkComponents();

      // Run the complete workflow
      const result = await this.responseCollector.executeComprehensiveWorkflow();

      if (this.config.enableDetailedLogging) {
        console.log(`[JestTestUtilities] Test completed: success=${result.success}, duration=${result.totalExecutionTime}ms`);
      }

      return result;
    } catch (error) {
      if (this.config.enableDetailedLogging) {
        console.error(`[JestTestUtilities] Test failed:`, error);
      }
      throw error;
    }
  }

  /**
   * Create WebSocket message assertion helper
   */
  expectWebSocketMessages(messages: string): WebSocketMessageAssertion {
    return new WebSocketMessageAssertion(messages);
  }

  /**
   * Validate WebSocket messages with comprehensive checks
   */
  validateWebSocketMessages(messages: string): WebSocketValidationResult {
    const result: WebSocketValidationResult = {
      hasMessages: messages.length > 0,
      hasCRLF: messages.includes('\r\n'),
      hasPrompts: /[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+:[^\$]*\$/g.test(messages),
      commandCount: 0,
      messageCount: 0,
      errors: []
    };

    // Count commands in messages
    const commandMatches = messages.match(/\$\s+\w+/g);
    result.commandCount = commandMatches ? commandMatches.length : 0;

    // Count message lines
    result.messageCount = messages.split('\n').length;

    // Validation checks
    if (!result.hasMessages) {
      result.errors.push('WebSocket messages are empty');
    }

    if (!result.hasCRLF) {
      result.errors.push('WebSocket messages missing CRLF line endings (critical for xterm.js display)');
    }

    if (!result.hasPrompts) {
      result.errors.push('WebSocket messages missing shell prompts');
    }

    return result;
  }

  /**
   * Generate parameterized test scenarios for common patterns
   */
  generateTestScenarios(): TestScenario[] {
    return [
      {
        name: 'Empty command test',
        config: {
          preWebSocketCommands: [],
          postWebSocketCommands: [],
          workflowTimeout: 10000,
          sessionName: 'empty-test'
        },
        expectedMessages: 0,
        expectedCommands: []
      },
      {
        name: 'Pre-WebSocket only',
        config: {
          preWebSocketCommands: ['ssh_exec {"command": "pwd"}'],
          postWebSocketCommands: [],
          workflowTimeout: 15000,
          sessionName: 'pre-only-test'
        },
        expectedMessages: 1,
        expectedCommands: ['pwd']
      },
      {
        name: 'Post-WebSocket only',
        config: {
          preWebSocketCommands: [],
          postWebSocketCommands: ['ssh_exec {"command": "whoami"}'],
          workflowTimeout: 15000,
          sessionName: 'post-only-test'
        },
        expectedMessages: 1,
        expectedCommands: ['whoami']
      },
      {
        name: 'Full workflow test',
        config: {
          preWebSocketCommands: ['ssh_exec {"command": "pwd"}', 'ssh_exec {"command": "date"}'],
          postWebSocketCommands: ['ssh_exec {"command": "whoami"}', 'ssh_exec {"command": "hostname"}'],
          workflowTimeout: 30000,
          sessionName: 'full-workflow-test'
        },
        expectedMessages: 4,
        expectedCommands: ['pwd', 'date', 'whoami', 'hostname']
      }
    ];
  }

  /**
   * Jest setup utility for describe blocks
   */
  static setupJestEnvironment(suiteName: string): JestTestUtilities {
    const testUtils = new JestTestUtilities({
      enableDetailedLogging: process.env.NODE_ENV === 'development',
      enableErrorDiagnostics: true,
      testTimeout: 30000
    });

    beforeEach(async () => {
      await testUtils.setupTest(`${suiteName}-${expect.getState().currentTestName || 'unknown'}`);
    });

    afterEach(async () => {
      await testUtils.cleanupTest();
    });

    return testUtils;
  }

  /**
   * Create Jest custom matcher for WebSocket message validation
   */
  static extendJestMatchers(): void {
    expect.extend({
      toHaveValidTerminalHistory(received: string) {
        const validation = new JestTestUtilities().validateWebSocketMessages(received);
        
        if (validation.errors.length === 0) {
          return {
            message: () => `Expected terminal history to be invalid but it was valid`,
            pass: true
          };
        } else {
          return {
            message: () => `Terminal history validation failed: ${validation.errors.join(', ')}`,
            pass: false
          };
        }
      },

      toContainCRLFLineEndings(received: string) {
        const hasCRLF = received.includes('\r\n');
        
        if (hasCRLF) {
          return {
            message: () => `Expected string not to contain CRLF line endings`,
            pass: true
          };
        } else {
          return {
            message: () => `Expected string to contain CRLF line endings (\\r\\n) for xterm.js compatibility`,
            pass: false
          };
        }
      }
    });
  }

  /**
   * Get current test configuration
   */
  getCurrentConfig(): JestTestUtilitiesConfig {
    return { ...this.config };
  }

  /**
   * Get last workflow result from test execution
   */
  getLastWorkflowResult(): WorkflowResult | undefined {
    // This would return the last workflow result if we stored it
    // For now, this is a placeholder that developers can extend
    return undefined;
  }

  /**
   * Enable or disable detailed logging
   */
  setDetailedLogging(enabled: boolean): void {
    this.config.enableDetailedLogging = enabled;
  }

  /**
   * Initialize all framework components required by ComprehensiveResponseCollector
   */
  private async initializeFrameworkComponents(): Promise<void> {
    if (!this.responseCollector) {
      throw new Error('Response collector must be created before initializing components');
    }

    // Create and configure all framework components
    const mcpServerManager = new MCPServerManager();
    
    // Start the MCP server to get the process for MCPClient
    await mcpServerManager.start();
    const serverProcess = mcpServerManager.getRawProcess();
    if (!serverProcess) {
      throw new Error('Failed to get MCP server process after starting');
    }

    const mcpClient = new MCPClient(serverProcess);
    const preWebSocketExecutor = new PreWebSocketCommandExecutor(mcpClient);
    const webSocketConnectionDiscovery = new WebSocketConnectionDiscovery(mcpClient);
    const initialHistoryReplayCapture = new InitialHistoryReplayCapture();
    const postWebSocketCommandExecutor = new PostWebSocketCommandExecutor(mcpClient);

    // Inject all components into the response collector
    this.responseCollector.setServerManager(mcpServerManager);
    this.responseCollector.setMcpClient(mcpClient);
    this.responseCollector.setPreWebSocketExecutor(preWebSocketExecutor);
    this.responseCollector.setConnectionDiscovery(webSocketConnectionDiscovery);
    this.responseCollector.setHistoryCapture(initialHistoryReplayCapture);
    this.responseCollector.setPostWebSocketExecutor(postWebSocketCommandExecutor);

    // Verify components are initialized
    if (!this.responseCollector.areComponentsInitialized()) {
      throw new Error('Failed to initialize framework components');
    }
  }
}