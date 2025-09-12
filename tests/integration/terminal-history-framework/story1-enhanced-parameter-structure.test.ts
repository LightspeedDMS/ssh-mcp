/**
 * Story 01: Enhanced Parameter Structure Refactor - Acceptance Criteria Tests
 * 
 * Tests all 14 acceptance criteria for enhanced parameter structure in PostWebSocketCommandExecutor.
 * Focuses on parameter validation, default handling, and mixed parameter combinations.
 * 
 * CRITICAL: Following TDD methodology - these are failing tests that drive implementation.
 */

import { PostWebSocketCommandExecutor, ParameterValidationError, PostWebSocketCommand } from './post-websocket-command-executor';
import { MCPClient } from './mcp-client';
import { InitialHistoryReplayCapture } from './initial-history-replay-capture';
import WebSocket from 'ws';

// Mock WebSocket for testing parameter validation (not command execution)
const mockWebSocket = {
  readyState: WebSocket.OPEN,
  send: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn()
} as unknown as WebSocket;

describe('Story 01: Enhanced Parameter Structure Refactor', () => {
  let executor: PostWebSocketCommandExecutor;
  let mockMCPClient: jest.Mocked<MCPClient>;
  let mockHistoryCapture: jest.Mocked<InitialHistoryReplayCapture>;

  beforeEach(() => {
    // Create mocks for dependencies
    mockMCPClient = {
      callTool: jest.fn().mockResolvedValue({ success: true, result: 'mock-response' })
    } as unknown as jest.Mocked<MCPClient>;

    mockHistoryCapture = {
      getRealTimeMessages: jest.fn().mockReturnValue([]),
      getHistoryMessages: jest.fn().mockReturnValue([])
    } as unknown as jest.Mocked<InitialHistoryReplayCapture>;

    executor = new PostWebSocketCommandExecutor(mockMCPClient, mockHistoryCapture);
  });

  describe('AC 1.1: Enhanced structure acceptance', () => {
    it('should accept enhanced structure without validation errors', async () => {
      // Given: Enhanced parameter structure
      const commands: PostWebSocketCommand[] = [
        { initiator: 'mcp-client', command: 'pwd' }
      ];

      // When: Processing the configuration
      const promise = executor.executeCommands(commands, mockWebSocket);

      // Then: Should not throw validation errors
      await expect(promise).resolves.toBeDefined();
    });

    it('should properly type and route enhanced commands', async () => {
      // Given: Enhanced parameter structure  
      const commands: PostWebSocketCommand[] = [
        { initiator: 'browser', command: 'date' }
      ];

      // When: Executing commands
      const results = await executor.executeCommands(commands, mockWebSocket);

      // Then: Command should be properly typed and routed
      expect(results).toHaveLength(1);
      expect(results[0].initiator).toBe('browser');
      expect(results[0].command).toBe('date');
    });
  });

  describe('AC 1.2: Invalid initiator validation', () => {
    it('should throw clear error for invalid initiator', async () => {
      // Given: Invalid initiator
      const commands: PostWebSocketCommand[] = [
        { initiator: 'invalid-type' as any, command: 'pwd' }
      ];

      // When: Validating the configuration
      const promise = executor.executeCommands(commands, mockWebSocket);

      // Then: Should throw specific error
      await expect(promise).rejects.toThrow(ParameterValidationError);
      await expect(promise).rejects.toThrow("Initiator must be 'browser' or 'mcp-client'");
    });
  });

  describe('AC 1.3: Basic cancellation parameter acceptance', () => {
    it('should accept cancel parameter without errors', async () => {
      // Given: Enhanced parameter with cancellation
      const commands: PostWebSocketCommand[] = [
        { initiator: 'browser', command: 'nano /tmp/test', cancel: true }
      ];

      // When: Validating the configuration
      const promise = executor.executeCommands(commands, mockWebSocket);

      // Then: Should accept without errors and prepare for timeout-based cancellation logic
      await expect(promise).resolves.toBeDefined();
      const results = await promise;
      expect(results[0].cancelRequested).toBe(true);
    });
  });

  describe('AC 1.4: Cancellation with custom timeout', () => {
    it('should accept both cancel and waitToCancelMs parameters', async () => {
      // Given: Custom cancellation timeout
      const commands: PostWebSocketCommand[] = [
        { initiator: 'mcp-client', command: 'sleep 30', cancel: true, waitToCancelMs: 5000 }
      ];

      // When: Validating the configuration
      const results = await executor.executeCommands(commands, mockWebSocket);

      // Then: Should accept both parameters and prepare 5-second cancellation timeout
      expect(results[0].cancelRequested).toBe(true);
      expect(results[0].waitToCancelMs).toBe(5000);
    });
  });

  describe('AC 1.5: Invalid timeout value rejection', () => {
    it('should throw error for negative timeout values', async () => {
      // Given: Invalid negative timeout
      const commands: PostWebSocketCommand[] = [
        { initiator: 'mcp-client', command: 'pwd', cancel: true, waitToCancelMs: -100 }
      ];

      // When: Validating the configuration
      const promise = executor.executeCommands(commands, mockWebSocket);

      // Then: Should throw specific error
      await expect(promise).rejects.toThrow(ParameterValidationError);
      await expect(promise).rejects.toThrow("waitToCancelMs must be positive number");
    });

    it('should throw error for zero timeout values', async () => {
      // Given: Invalid zero timeout
      const commands: PostWebSocketCommand[] = [
        { initiator: 'browser', command: 'pwd', cancel: true, waitToCancelMs: 0 }
      ];

      // When: Validating the configuration
      const promise = executor.executeCommands(commands, mockWebSocket);

      // Then: Should throw specific error
      await expect(promise).rejects.toThrow("waitToCancelMs must be positive number");
    });
  });

  describe('AC 1.6: Timeout without cancellation handling', () => {
    it('should accept but log warning when waitToCancelMs provided with cancel false', async () => {
      // Mock console.warn to capture warning
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Given: Timeout without cancellation
      const commands: PostWebSocketCommand[] = [
        { initiator: 'browser', command: 'pwd', cancel: false, waitToCancelMs: 5000 }
      ];

      // When: Validating the configuration
      const results = await executor.executeCommands(commands, mockWebSocket);

      // Then: Should accept but log warning and execute normally
      expect(warnSpy).toHaveBeenCalledWith("waitToCancelMs ignored when cancel is false");
      expect(results[0].cancelRequested).toBe(false);
      expect(results[0].waitToCancelMs).toBe(5000); // Preserved but ignored

      warnSpy.mockRestore();
    });
  });

  describe('AC 1.7: Default cancellation timeout', () => {
    it('should default waitToCancelMs to 10000 when cancel is true', async () => {
      // Given: Command with cancel but no waitToCancelMs
      const commands: PostWebSocketCommand[] = [
        { initiator: 'browser', command: 'sleep 20', cancel: true }
      ];

      // When: Processing the configuration
      const results = await executor.executeCommands(commands, mockWebSocket);

      // Then: Should default waitToCancelMs to 10000 (10 seconds)
      expect(results[0].cancelRequested).toBe(true);
      expect(results[0].waitToCancelMs).toBe(10000);
    });
  });

  describe('AC 1.8: Default cancel behavior', () => {
    it('should default cancel to false when not provided', async () => {
      // Given: Command with no cancel parameter
      const commands: PostWebSocketCommand[] = [
        { initiator: 'mcp-client', command: 'pwd' }
      ];

      // When: Processing the configuration
      const results = await executor.executeCommands(commands, mockWebSocket);

      // Then: Should default cancel to false and execute normally
      expect(results[0].cancelRequested).toBe(false);
      expect(results[0].waitToCancelMs).toBe(10000); // Default timeout even when not cancelling
    });
  });

  describe('AC 1.9: Minimal parameter command execution', () => {
    it('should execute normally with only required parameters', async () => {
      // Given: Command with only required parameters
      const commands: PostWebSocketCommand[] = [
        { initiator: 'browser', command: 'ls' }
      ];

      // When: Executing the configuration
      const results = await executor.executeCommands(commands, mockWebSocket);

      // Then: Should execute normally without timeout or cancellation logic
      expect(results).toHaveLength(1);
      expect(results[0].initiator).toBe('browser');
      expect(results[0].command).toBe('ls');
      expect(results[0].cancelRequested).toBe(false);
    });
  });

  describe('AC 1.10: Invalid cancel type rejection', () => {
    it('should throw error for non-boolean cancel value', async () => {
      // Given: Invalid cancel value
      const commands: PostWebSocketCommand[] = [
        { initiator: 'browser', command: 'pwd', cancel: 'maybe' as any }
      ];

      // When: Validating the configuration
      const promise = executor.executeCommands(commands, mockWebSocket);

      // Then: Should throw specific error
      await expect(promise).rejects.toThrow(ParameterValidationError);
      await expect(promise).rejects.toThrow("cancel must be boolean value (true or false)");
    });
  });

  describe('AC 1.11: Invalid timeout type rejection', () => {
    it('should throw error for non-numeric waitToCancelMs', async () => {
      // Given: Invalid waitToCancelMs
      const commands: PostWebSocketCommand[] = [
        { initiator: 'browser', command: 'pwd', cancel: true, waitToCancelMs: 'soon' as any }
      ];

      // When: Validating the configuration
      const promise = executor.executeCommands(commands, mockWebSocket);

      // Then: Should throw specific error
      await expect(promise).rejects.toThrow(ParameterValidationError);
      await expect(promise).rejects.toThrow("waitToCancelMs must be numeric value in milliseconds");
    });
  });

  describe('AC 1.12: Missing required initiator', () => {
    it('should throw error for missing initiator', async () => {
      // Given: Missing initiator
      const commands: PostWebSocketCommand[] = [
        { command: 'pwd', cancel: true } as any
      ];

      // When: Validating the configuration
      const promise = executor.executeCommands(commands, mockWebSocket);

      // Then: Should throw specific error
      await expect(promise).rejects.toThrow(ParameterValidationError);
      await expect(promise).rejects.toThrow("initiator field required: must be 'browser' or 'mcp-client'");
    });
  });

  describe('AC 1.13: Missing required command', () => {
    it('should throw error for missing command', async () => {
      // Given: Missing command
      const commands: PostWebSocketCommand[] = [
        { initiator: 'browser', cancel: true } as any
      ];

      // When: Validating the configuration
      const promise = executor.executeCommands(commands, mockWebSocket);

      // Then: Should throw specific error
      await expect(promise).rejects.toThrow(ParameterValidationError);
      await expect(promise).rejects.toThrow("command field required: must be non-empty string");
    });

    it('should throw error for empty command string', async () => {
      // Given: Empty command string
      const commands: PostWebSocketCommand[] = [
        { initiator: 'browser', command: '   ' }
      ];

      // When: Validating the configuration
      const promise = executor.executeCommands(commands, mockWebSocket);

      // Then: Should throw specific error
      await expect(promise).rejects.toThrow("command field required: must be non-empty string");
    });
  });

  describe('AC 1.14: Mixed parameter combinations handling', () => {
    it('should handle complex configuration with all parameter variations', async () => {
      // Given: Complex configuration with all parameter variations
      const commands: PostWebSocketCommand[] = [
        { initiator: 'browser', command: 'pwd' },                                      // Basic browser
        { initiator: 'mcp-client', command: 'date' },                                 // Basic MCP  
        { initiator: 'browser', command: 'nano file.txt', cancel: true },            // Browser + default cancel
        { initiator: 'mcp-client', command: 'sleep 30', cancel: true, waitToCancelMs: 3000 }, // MCP + custom cancel
        { initiator: 'browser', command: 'echo done' }                               // Basic browser final
      ];

      // When: Processing the configuration
      const results = await executor.executeCommands(commands, mockWebSocket);

      // Then: Each command should be validated according to its specific parameters
      expect(results).toHaveLength(5);

      // Validate first command - Basic browser
      expect(results[0].initiator).toBe('browser');
      expect(results[0].command).toBe('pwd');
      expect(results[0].cancelRequested).toBe(false);

      // Validate second command - Basic MCP
      expect(results[1].initiator).toBe('mcp-client');
      expect(results[1].command).toBe('date');
      expect(results[1].cancelRequested).toBe(false);

      // Validate third command - Browser + default cancel
      expect(results[2].initiator).toBe('browser');
      expect(results[2].command).toBe('nano file.txt');
      expect(results[2].cancelRequested).toBe(true);
      expect(results[2].waitToCancelMs).toBe(10000); // Default timeout

      // Validate fourth command - MCP + custom cancel
      expect(results[3].initiator).toBe('mcp-client');
      expect(results[3].command).toBe('sleep 30');
      expect(results[3].cancelRequested).toBe(true);
      expect(results[3].waitToCancelMs).toBe(3000); // Custom timeout

      // Validate fifth command - Basic browser final
      expect(results[4].initiator).toBe('browser');
      expect(results[4].command).toBe('echo done');
      expect(results[4].cancelRequested).toBe(false);

      // And maintain sequential execution order regardless of parameter complexity
      expect(results.map(r => r.command)).toEqual(['pwd', 'date', 'nano file.txt', 'sleep 30', 'echo done']);
    });

    it('should prepare appropriate execution strategy for each command type', async () => {
      // Given: Mixed initiator types
      const commands: PostWebSocketCommand[] = [
        { initiator: 'browser', command: 'pwd' },
        { initiator: 'mcp-client', command: 'date' }
      ];

      // When: Processing the configuration
      const results = await executor.executeCommands(commands, mockWebSocket);

      // Then: Should prepare correct execution strategy per command
      expect(results[0].initiator).toBe('browser');
      expect(results[1].initiator).toBe('mcp-client');
      // Execution strategy is prepared but actual routing logic will be in future stories
    });
  });

  describe('Legacy string format support', () => {
    it('should handle legacy string commands with default parameters', async () => {
      // Given: Legacy string commands
      const commands: PostWebSocketCommand[] = [
        'pwd',
        'date'
      ];

      // When: Processing the configuration
      const results = await executor.executeCommands(commands, mockWebSocket);

      // Then: Should convert to enhanced structure with defaults
      expect(results).toHaveLength(2);
      expect(results[0].initiator).toBe('mcp-client'); // Default initiator
      expect(results[0].command).toBe('pwd');
      expect(results[0].cancelRequested).toBe(false);
      expect(results[0].waitToCancelMs).toBe(10000);

      expect(results[1].initiator).toBe('mcp-client'); // Default initiator  
      expect(results[1].command).toBe('date');
      expect(results[1].cancelRequested).toBe(false);
    });

    it('should handle mixed legacy and enhanced formats', async () => {
      // Given: Mixed formats
      const commands: PostWebSocketCommand[] = [
        'pwd',  // Legacy
        { initiator: 'browser', command: 'date', cancel: true } // Enhanced
      ];

      // When: Processing the configuration
      const results = await executor.executeCommands(commands, mockWebSocket);

      // Then: Should handle both formats correctly
      expect(results[0].initiator).toBe('mcp-client'); // Legacy default
      expect(results[0].cancelRequested).toBe(false);
      
      expect(results[1].initiator).toBe('browser'); // Enhanced specified
      expect(results[1].cancelRequested).toBe(true);
    });
  });
});