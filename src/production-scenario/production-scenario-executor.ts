/**
 * Production Scenario Executor - CLAUDE.md Foundation #6 compliant
 * 
 * Focused component for executing production scenarios with real validation
 * Part of Production Scenario Validator refactoring to follow KISS principle
 */

import { JestTestUtilities } from '../../tests/integration/terminal-history-framework/jest-test-utilities';
import { TerminalQualityAnalyzer } from './terminal-quality-analyzer';
import { PerformanceMetricsCollector, PerformanceMetrics } from './performance-metrics-collector';

export interface ProductionCommand {
  initiator: 'browser' | 'mcp-client';
  command: string;
  cancel?: boolean;
  waitToCancelMs?: number;
  timeout?: number;
}

export interface ProductionScenarioConfig {
  name: string;
  description: string;
  commands: ProductionCommand[];
  expectedDuration?: number;
  performanceThresholds?: {
    maxExecutionTime?: number;
    maxMemoryUsage?: number;
    minResponseTime?: number;
  };
}

export interface ProductionValidationResult {
  success: boolean;
  scenarioName: string;
  executionTime: number;
  professionalDisplay: boolean;
  echoQuality: 'excellent' | 'good' | 'poor';
  terminalFormatting: 'clean' | 'acceptable' | 'poor';
  userExperience: 'professional' | 'acceptable' | 'poor';
  errors: string[];
  warnings: string[];
  performanceMetrics?: PerformanceMetrics;
  rawWorkflowResult?: any;
}

export interface ProductionScenarioExecutorConfig {
  username: string;
  sshKeyPath: string;
  enableProfessionalDisplayValidation?: boolean;
  enablePerformanceMonitoring?: boolean;
  enableDetailedLogging?: boolean;
  defaultTimeout?: number;
}

export class ProductionScenarioExecutor {
  private config: Required<ProductionScenarioExecutorConfig>;
  private testUtils: JestTestUtilities;
  private qualityAnalyzer: TerminalQualityAnalyzer;
  private performanceCollector: PerformanceMetricsCollector;

  // Named constants - CLAUDE.md Foundation #8 compliance
  private static readonly QUALITY_THRESHOLDS = {
    EXCELLENT: 0.95,
    GOOD: 0.8,
    POOR: 0.5,
    MINIMUM_ACCEPTABLE: 0.7
  };

  private static readonly PERFORMANCE_LIMITS = {
    MAX_COMMAND_TIME_MS: 15000,
    MAX_SESSION_TIME_MS: 35 * 60 * 1000, // 35 minutes
    MAX_MEMORY_MB: 512,
    MIN_RESPONSE_TIME_MS: 50
  };

  constructor(config: ProductionScenarioExecutorConfig) {
    this.config = {
      username: config.username,
      sshKeyPath: config.sshKeyPath,
      enableProfessionalDisplayValidation: config.enableProfessionalDisplayValidation ?? true,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring ?? true,
      enableDetailedLogging: config.enableDetailedLogging ?? false,
      defaultTimeout: config.defaultTimeout ?? 60000
    };

    this.testUtils = new JestTestUtilities({
      enableDetailedLogging: this.config.enableDetailedLogging,
      enableErrorDiagnostics: true,
      testTimeout: this.config.defaultTimeout,
      enableDynamicValueConstruction: true
    });

    this.qualityAnalyzer = new TerminalQualityAnalyzer();
    this.performanceCollector = new PerformanceMetricsCollector();
  }

  /**
   * Execute a production scenario with comprehensive validation
   * Core method for AC 2.1-2.3, 2.6, 2.10-2.12
   */
  async executeProductionScenario(scenario: ProductionScenarioConfig): Promise<ProductionValidationResult> {
    const startTime = Date.now();
    const result: ProductionValidationResult = {
      success: false,
      scenarioName: scenario.name,
      executionTime: 0,
      professionalDisplay: false,
      echoQuality: 'poor',
      terminalFormatting: 'poor',
      userExperience: 'poor',
      errors: [],
      warnings: []
    };

    try {
      // Initialize test environment
      await this.testUtils.setupTest(`production-scenario-${scenario.name}`);

      // Convert production commands to test configuration
      const testConfig = this.convertToTestConfiguration(scenario);
      
      // Execute the scenario using the Villenele framework
      const workflowResult = await this.testUtils.runTerminalHistoryTest(testConfig);
      
      result.rawWorkflowResult = workflowResult;
      result.success = workflowResult.success;
      result.executionTime = Date.now() - startTime;

      if (workflowResult.success) {
        // Validate professional display and user experience
        await this.validateProfessionalDisplay(workflowResult, result);
        await this.validateEchoQuality(workflowResult, result);
        await this.validateTerminalFormatting(workflowResult, result);
        await this.validateUserExperience(result);

        // Collect performance metrics if enabled
        if (this.config.enablePerformanceMonitoring) {
          result.performanceMetrics = this.performanceCollector.collectPerformanceMetrics(
            workflowResult, 
            scenario.commands.length, 
            result.executionTime
          );
        }

        // Validate performance thresholds
        if (scenario.performanceThresholds) {
          await this.validatePerformanceThresholds(scenario, result);
        }
      } else {
        result.errors.push('Scenario execution failed');
        if (workflowResult.error) {
          result.errors.push(workflowResult.error);
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Production scenario execution failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await this.testUtils.cleanupTest();
    }

    return result;
  }

  /**
   * Generate extended usage commands for testing (AC 2.4)
   */
  generateExtendedUsageCommands(commandCount: number): ProductionCommand[] {
    const commands: ProductionCommand[] = [];
    const commandTypes = [
      'basic_commands',
      'file_operations', 
      'system_monitoring',
      'text_processing',
      'network_commands'
    ];

    // Generate mixed commands for extended testing
    for (let i = 0; i < commandCount; i++) {
      const commandType = commandTypes[i % commandTypes.length];
      const initiator = i % 2 === 0 ? 'browser' : 'mcp-client';
      
      let command: string;
      switch (commandType) {
        case 'basic_commands':
          command = ['pwd', 'whoami', 'date', 'hostname'][i % 4];
          break;
        case 'file_operations':
          command = ['ls -la', 'find . -name "*.ts" | head -5', 'wc -l *.md', 'du -sh *'][i % 4];
          break;
        case 'system_monitoring':
          command = ['ps aux | head -10', 'df -h', 'free -m', 'uptime'][i % 4];
          break;
        case 'text_processing':
          command = ['grep -r "export" src/ | wc -l', 'sort package.json', 'head -10 README.md', 'tail -5 package.json'][i % 4];
          break;
        case 'network_commands':
          command = ['ping -c 2 localhost', 'netstat -tuln | head -5', 'curl -s http://localhost:8080 | head -5 || echo "no server"', 'ss -tuln | head -5'][i % 4];
          break;
        default:
          command = 'echo "extended test command ' + i + '"';
      }

      commands.push({
        initiator,
        command,
        timeout: ProductionScenarioExecutor.PERFORMANCE_LIMITS.MAX_COMMAND_TIME_MS
      });
    }

    return commands;
  }

  /**
   * Generate concurrent user commands for multi-user testing (AC 2.5, 2.13)
   */
  generateConcurrentUserCommands(commandCount: number, userId: number): ProductionCommand[] {
    const commands: ProductionCommand[] = [];
    
    for (let i = 0; i < commandCount; i++) {
      commands.push({
        initiator: i % 2 === 0 ? 'browser' : 'mcp-client',
        command: `echo "user-${userId}-command-${i}"`,
        timeout: 10000
      });
    }

    return commands;
  }

  /**
   * Validate professional display quality
   */
  private async validateProfessionalDisplay(workflowResult: any, result: ProductionValidationResult): Promise<void> {
    if (!this.config.enableProfessionalDisplayValidation) {
      result.professionalDisplay = true;
      return;
    }

    const displayResult = this.qualityAnalyzer.validateProfessionalDisplay(workflowResult);
    result.professionalDisplay = displayResult.professionalDisplay;
    result.warnings.push(...displayResult.warnings);
  }

  /**
   * Validate echo quality using quality analyzer
   */
  private async validateEchoQuality(workflowResult: any, result: ProductionValidationResult): Promise<void> {
    const output = workflowResult.concatenatedResponses;
    result.echoQuality = this.qualityAnalyzer.calculateEchoQuality(output);
  }

  /**
   * Validate terminal formatting quality using quality analyzer
   */
  private async validateTerminalFormatting(workflowResult: any, result: ProductionValidationResult): Promise<void> {
    const output = workflowResult.concatenatedResponses;
    result.terminalFormatting = this.qualityAnalyzer.calculateTerminalFormatting(output);
  }

  /**
   * Validate overall user experience
   */
  private async validateUserExperience(result: ProductionValidationResult): Promise<void> {
    // User experience is a composite of professional display, echo quality, and terminal formatting
    const professionalScore = result.professionalDisplay ? 1.0 : 0.0;
    const echoScore = result.echoQuality === 'excellent' ? 1.0 : result.echoQuality === 'good' ? 0.7 : 0.3;
    const formattingScore = result.terminalFormatting === 'clean' ? 1.0 : result.terminalFormatting === 'acceptable' ? 0.7 : 0.3;
    
    const overallScore = (professionalScore + echoScore + formattingScore) / 3;
    
    if (overallScore >= ProductionScenarioExecutor.QUALITY_THRESHOLDS.EXCELLENT * 0.95) {
      result.userExperience = 'professional';
    } else if (overallScore >= ProductionScenarioExecutor.QUALITY_THRESHOLDS.MINIMUM_ACCEPTABLE) {
      result.userExperience = 'acceptable';
    } else {
      result.userExperience = 'poor';
    }
  }

  /**
   * Validate performance thresholds using performance collector
   */
  private async validatePerformanceThresholds(scenario: ProductionScenarioConfig, result: ProductionValidationResult): Promise<void> {
    if (!scenario.performanceThresholds || !result.performanceMetrics) return;

    const validation = this.performanceCollector.validatePerformanceThresholds(
      result.performanceMetrics, 
      scenario.performanceThresholds
    );

    if (!validation.passed) {
      result.warnings.push(...validation.warnings);
    }
  }

  /**
   * Convert production scenario to Villenele test configuration
   */
  private convertToTestConfiguration(scenario: ProductionScenarioConfig): any {
    const preWebSocketCommands = [];
    const postWebSocketCommands = [];

    // Add SSH connection as first command
    preWebSocketCommands.push(`ssh_connect {"name": "${scenario.name}-session", "host": "localhost", "username": "${this.config.username}", "keyFilePath": "${this.config.sshKeyPath}"}`);

    // Convert production commands to test format
    for (const command of scenario.commands) {
      // Properly escape quotes in the command for JSON
      const escapedCommand = command.command.replace(/"/g, '\\"');
      const mcpCommand = `ssh_exec {"sessionName": "${scenario.name}-session", "command": "${escapedCommand}"}`;
      
      if (command.initiator === 'browser') {
        // Pre-WebSocket commands simulate browser history
        preWebSocketCommands.push(mcpCommand);
      } else {
        // Post-WebSocket commands simulate MCP client commands
        postWebSocketCommands.push({
          initiator: 'mcp-client',
          command: mcpCommand
        });
      }
    }

    return {
      preWebSocketCommands,
      postWebSocketCommands,
      workflowTimeout: scenario.expectedDuration || this.config.defaultTimeout,
      sessionName: `${scenario.name}-session`
    };
  }
}