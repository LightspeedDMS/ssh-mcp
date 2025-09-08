/**
 * Story 7: Flexible Command Configuration Implementation
 * 
 * FlexibleCommandConfiguration provides JSON-based configuration support for
 * terminal history testing framework. It validates command syntax, supports
 * empty arrays for either phase, and integrates with ComprehensiveResponseCollector.
 * 
 * Key features:
 * 1. JSON schema validation for configuration structure
 * 2. Command syntax validation (MCP tool format checking)
 * 3. Support for empty command arrays (skip phases)
 * 4. Clear error reporting with specific validation failures
 * 5. Integration with existing framework components
 * 6. Support for complex multi-session scenarios
 * 7. Type safety with proper TypeScript interfaces
 * 
 * CRITICAL: No mocks in production code - uses real configuration validation and integration
 */

import { PreWebSocketCommand } from './pre-websocket-command-executor';
import { ComprehensiveResponseCollectorConfig } from './comprehensive-response-collector';

/**
 * JSON configuration schema for flexible command configuration
 */
export interface CommandConfigurationJSON {
  preWebSocketCommands: string[];        // Commands executed before WebSocket connection (JSON format)
  postWebSocketCommands: string[];       // Commands executed after WebSocket connection (JSON format)
  workflowTimeout?: number;              // Total workflow timeout (default: 10000ms)
  sessionName?: string;                  // SSH session name (default: 'flexible-config-session')
}

/**
 * Configuration validation error with specific details
 */
export class ConfigurationValidationError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ConfigurationValidationError';
  }
}

/**
 * FlexibleCommandConfiguration - JSON-based command configuration with validation
 * 
 * Provides flexible JSON configuration support for terminal history testing framework.
 * Converts JSON string commands to internal format and validates syntax.
 */
export class FlexibleCommandConfiguration {
  private readonly config: Required<CommandConfigurationJSON>;
  private readonly preWebSocketCommands: PreWebSocketCommand[];
  private readonly postWebSocketCommands: string[];

  constructor(configJSON: CommandConfigurationJSON) {
    // Validate configuration structure and values
    this.validateConfiguration(configJSON);

    // Set defaults for optional properties
    this.config = {
      preWebSocketCommands: configJSON.preWebSocketCommands,
      postWebSocketCommands: configJSON.postWebSocketCommands,
      workflowTimeout: configJSON.workflowTimeout ?? 10000,
      sessionName: configJSON.sessionName ?? 'flexible-config-session'
    };

    // Validate and parse command syntax
    this.preWebSocketCommands = this.parsePreWebSocketCommands(this.config.preWebSocketCommands);
    this.postWebSocketCommands = this.validatePostWebSocketCommands(this.config.postWebSocketCommands);
  }

  /**
   * Validate configuration structure and basic constraints
   */
  private validateConfiguration(config: CommandConfigurationJSON): void {
    // Validate workflowTimeout
    if (config.workflowTimeout !== undefined && config.workflowTimeout <= 0) {
      throw new ConfigurationValidationError('workflowTimeout must be positive');
    }

    // Validate sessionName
    if (config.sessionName !== undefined && config.sessionName.trim().length === 0) {
      throw new ConfigurationValidationError('sessionName cannot be empty');
    }

    // Validate arrays exist
    if (!Array.isArray(config.preWebSocketCommands)) {
      throw new ConfigurationValidationError('preWebSocketCommands must be an array');
    }

    if (!Array.isArray(config.postWebSocketCommands)) {
      throw new ConfigurationValidationError('postWebSocketCommands must be an array');
    }
  }

  /**
   * Parse and validate preWebSocketCommands from JSON strings to PreWebSocketCommand objects
   */
  private parsePreWebSocketCommands(commands: string[]): PreWebSocketCommand[] {
    const parsedCommands: PreWebSocketCommand[] = [];

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      try {
        const parsed = this.parseCommand(command);
        parsedCommands.push(parsed);
      } catch (error) {
        // If it's already a ConfigurationValidationError, re-throw as-is
        if (error instanceof ConfigurationValidationError) {
          throw error;
        }
        // Wrap other errors with context
        throw new ConfigurationValidationError(
          `Invalid JSON in preWebSocketCommand at index ${i}: ${command}`,
          error
        );
      }
    }

    return parsedCommands;
  }

  /**
   * Validate postWebSocketCommands syntax (kept as strings)
   */
  private validatePostWebSocketCommands(commands: string[]): string[] {
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      try {
        // Validate syntax by parsing, but keep as strings
        this.parseCommand(command);
      } catch (error) {
        // If it's already a ConfigurationValidationError, re-throw as-is
        if (error instanceof ConfigurationValidationError) {
          throw error;
        }
        // Wrap other errors with context
        throw new ConfigurationValidationError(
          `Invalid JSON in postWebSocketCommand at index ${i}: ${command}`,
          error
        );
      }
    }

    return [...commands];
  }

  /**
   * Parse a single command string in MCP tool format: "tool_name {json_args}"
   */
  private parseCommand(commandString: string): PreWebSocketCommand {
    const trimmed = commandString.trim();
    
    // Find the first space to separate tool name from JSON
    const spaceIndex = trimmed.indexOf(' ');
    
    if (spaceIndex === -1) {
      throw new ConfigurationValidationError(`Command must have JSON parameters: ${commandString}`);
    }

    const tool = trimmed.substring(0, spaceIndex).trim();
    const jsonPart = trimmed.substring(spaceIndex + 1).trim();

    if (!tool) {
      throw new ConfigurationValidationError(`Command must have tool name: ${commandString}`);
    }

    if (!jsonPart) {
      throw new ConfigurationValidationError(`Command must have JSON parameters: ${commandString}`);
    }

    // Parse JSON arguments
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(jsonPart);
    } catch (error) {
      // Re-throw the original error message to preserve error hierarchy
      throw new ConfigurationValidationError(`Invalid JSON in command: ${jsonPart}`);
    }

    // Ensure args is an object
    if (typeof args !== 'object' || args === null || Array.isArray(args)) {
      throw new ConfigurationValidationError(
        `Command arguments must be a JSON object: ${commandString}`
      );
    }

    return {
      tool,
      args
    };
  }

  /**
   * Get parsed preWebSocketCommands as PreWebSocketCommand objects
   */
  getPreWebSocketCommands(): PreWebSocketCommand[] {
    return [...this.preWebSocketCommands];
  }

  /**
   * Get postWebSocketCommands as strings (for ComprehensiveResponseCollector)
   */
  getPostWebSocketCommands(): string[] {
    return [...this.postWebSocketCommands];
  }

  /**
   * Get workflow timeout value
   */
  getWorkflowTimeout(): number {
    return this.config.workflowTimeout;
  }

  /**
   * Get session name
   */
  getSessionName(): string {
    return this.config.sessionName;
  }

  /**
   * Get configuration compatible with ComprehensiveResponseCollector
   */
  getComprehensiveResponseCollectorConfig(): ComprehensiveResponseCollectorConfig {
    return {
      preWebSocketCommands: this.getPreWebSocketCommands(),
      postWebSocketCommands: this.getPostWebSocketCommands(),
      workflowTimeout: this.getWorkflowTimeout(),
      sessionName: this.getSessionName()
    };
  }

  /**
   * Get original JSON configuration (for debugging/logging)
   */
  getOriginalConfig(): Required<CommandConfigurationJSON> {
    return { ...this.config };
  }
}