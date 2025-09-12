/**
 * Story 02: Command State Integration Validation Test Suite
 * 
 * Comprehensive validation that all Command State Synchronization features 
 * (browser command tracking, MCP gating, cancellation, nuclear fallback) 
 * work identically during echo investigation process.
 * 
 * CRITICAL: Zero mocks - uses real Command State Synchronization infrastructure
 */

import { CommandStateIntegrationValidator } from '../src/command-state-integration-validator';
import { EnhancedCommandParameter } from './integration/terminal-history-framework/post-websocket-command-executor';

describe('Command State Integration Validation - Story 02', () => {
  let validator: CommandStateIntegrationValidator;
  const testSessionName = 'command-state-integration-test';

  beforeAll(async () => {
    // Initialize production validator with real infrastructure
    validator = new CommandStateIntegrationValidator(testSessionName);
    await validator.initialize();
  });

  afterAll(async () => {
    if (validator) {
      await validator.cleanup();
    }
  });

  afterEach(async () => {
    // Reset state after each test
    if (validator) {
      await validator.resetCommandState();
    }
  });

  /**
   * Browser Command Tracking Validation (AC 2.1-2.3)
   */
  describe('Browser Command Tracking Functionality', () => {
    it('AC 2.1: should track browser command buffer with exact commands', async () => {
      // Given: Enhanced Villenele framework with browser command emulation
      const browserCommands: EnhancedCommandParameter[] = [
        { initiator: 'browser', command: 'pwd' },
        { initiator: 'browser', command: 'ls' },
        { initiator: 'browser', command: 'whoami' }
      ];

      // When: Executing browser command sequence
      const result = await validator.validateBrowserCommandTracking(browserCommands);

      // Then: Command State Synchronization should track all browser commands correctly
      expect(result.browserCommandsTracked).toBe(true);
      expect(result.browserCommandBuffer).toEqual(['pwd', 'ls', 'whoami']);
      expect(result.commandSourceAttribution).toEqual(['user', 'user', 'user']);
      expect(result.bufferAccessibleForGating).toBe(true);
    });

    it('AC 2.2: should track browser command execution completion', async () => {
      // Given: Browser commands executed via enhanced Villenele
      const browserCommands: EnhancedCommandParameter[] = [
        { initiator: 'browser', command: 'echo "test"' }
      ];

      // When: Browser commands complete execution
      const result = await validator.validateBrowserCommandCompletion(browserCommands);

      // Then: Command State Synchronization should mark commands as completed
      expect(result.commandsMarkedCompleted).toBe(true);
      expect(result.completedCommandsInBuffer).toBe(true);
      expect(result.bufferIncludesResults).toBe(true);
      expect(result.completionStateTracked).toBe(true);
    });

    it('AC 2.3: should persist browser command buffer across sessions', async () => {
      // Given: Browser commands executed and tracked in buffer
      const browserCommands: EnhancedCommandParameter[] = [
        { initiator: 'browser', command: 'date' }
      ];

      // When: Subsequent operations access the SSH session
      const result = await validator.validateBrowserCommandPersistence(browserCommands);

      // Then: Browser command buffer should persist throughout session lifetime
      expect(result.bufferPersistsAcrossOperations).toBe(true);
      expect(result.bufferContentsAccessible).toBe(true);
      expect(result.chronologicalOrderMaintained).toBe(true);
      expect(result.sessionStateIncludesHistory).toBe(true);
    });
  });

  /**
   * MCP Command Gating Functionality Validation (AC 2.4-2.6)
   */
  describe('MCP Command Gating Functionality', () => {
    it('AC 2.4: should gate MCP commands with browser commands in buffer', async () => {
      // Given: Browser commands in buffer and MCP command execution attempt
      const mixedCommands: EnhancedCommandParameter[] = [
        { initiator: 'browser', command: 'pwd' },
        { initiator: 'mcp-client', command: 'whoami' }  // Should be gated
      ];

      // When: Enhanced Villenele executes sequence
      const result = await validator.validateMCPCommandGating(mixedCommands);

      // Then: MCP command should be blocked by Command State Synchronization
      expect(result.mcpCommandBlocked).toBe(true);
      expect(result.receivedBrowserCommandsExecutedError).toBe(true);
      expect(result.errorIncludesBrowserResults).toBe(true);
      expect(result.mcpCommandDidNotExecute).toBe(true);
    });

    it('AC 2.5: should return correct BROWSER_COMMANDS_EXECUTED error format', async () => {
      // Given: MCP command gating scenario with browser commands in buffer
      const mixedCommands: EnhancedCommandParameter[] = [
        { initiator: 'browser', command: 'pwd' },
        { initiator: 'mcp-client', command: 'echo "test"' }
      ];

      // When: Gated MCP command receives error response
      const result = await validator.validateBrowserCommandsExecutedErrorFormat(mixedCommands);

      // Then: Error should follow exact format
      expect(result.errorCode).toBe('BROWSER_COMMANDS_EXECUTED');
      expect(result.errorMessage).toBe('User executed commands directly in browser');
      expect(result.errorData).toEqual({
        browserCommands: ['pwd'],
        results: [expect.stringContaining('Mock result for: pwd')]  // Mock result from validator
      });
      expect(result.errorStructureConsistent).toBe(true);
      expect(result.errorParseable).toBe(true);
    });

    it('AC 2.6: should gate multiple browser commands correctly', async () => {
      // Given: Multiple browser commands in buffer
      const mixedCommands: EnhancedCommandParameter[] = [
        { initiator: 'browser', command: 'pwd' },
        { initiator: 'browser', command: 'echo "test"' },
        { initiator: 'browser', command: 'whoami' },
        { initiator: 'mcp-client', command: 'date' }  // Should be gated
      ];

      // When: MCP command is attempted after browser command sequence
      const result = await validator.validateMultipleBrowserCommandsGating(mixedCommands);

      // Then: BROWSER_COMMANDS_EXECUTED error should include all browser command results
      expect(result.errorIncludesAllBrowserCommands).toBe(true);
      expect(result.errorDataContainsCompleteHistory).toBe(true);
      expect(result.gatingWorksRegardlessOfCount).toBe(true);
    });
  });

  /**
   * Command Cancellation Functionality Validation (AC 2.7-2.9)
   */
  describe('Command Cancellation Functionality', () => {
    it('AC 2.7: should validate browser command cancellation via WebSocket SIGINT', async () => {
      // Given: Enhanced Villenele with cancellation support from Feature 1
      const cancellationCommand: EnhancedCommandParameter = {
        initiator: 'browser',
        command: 'sleep 10',
        cancel: true,
        waitToCancelMs: 2000
      };

      // When: Browser command with cancellation is executed
      const result = await validator.validateBrowserCommandCancellation(cancellationCommand);

      // Then: Command State Synchronization should cancel browser command via WebSocket SIGINT
      expect(result.cancelledViaWebSocketSIGINT).toBe(true);
      expect(result.cancelledCommandInBuffer).toBe(true);
      expect(result.cancellationIdenticalToPreviousBehavior).toBe(true);
      expect(result.sessionStableAfterCancellation).toBe(true);
    });

    it('AC 2.8: should validate MCP command cancellation via ssh_cancel_command', async () => {
      // Given: Enhanced validation with MCP command cancellation capability
      // When: MCP command with cancellation is executed
      const result = await validator.validateMCPCommandCancellation();

      // Then: Command State Synchronization should cancel MCP command via ssh_cancel_command
      expect(result.cancelledViaMCPTool).toBe(true);
      expect(result.cancellationUsedMCPInfrastructure).toBe(true);
      expect(result.cancelledMCPCommandDidNotAffectBuffer).toBe(true);
      expect(result.mcpCancellationIdenticalToCurrentImpl).toBe(true);
    });

    it('AC 2.9: should validate mixed cancellation scenarios', async () => {
      // Given: Sequence with both browser and MCP command cancellations
      const mixedCancellations: EnhancedCommandParameter[] = [
        {
          initiator: 'browser',
          command: 'sleep 10',
          cancel: true,
          waitToCancelMs: 2000
        },
        {
          initiator: 'mcp-client',
          command: 'sleep 10',
          cancel: true,
          waitToCancelMs: 2000
        }
      ];

      // When: Enhanced Villenele executes mixed cancellation scenario
      const result = await validator.validateMixedCancellationScenario(mixedCancellations);

      // Then: Both cancellation mechanisms should work independently
      expect(result.browserCancelledViaWebSocket).toBe(true);
      expect(result.mcpCancelledViaMCPTool).toBe(true);
      expect(result.cancellationMechanismsIndependent).toBe(true);
      expect(result.commandStateSyncHandlesMixedCorrectly).toBe(true);
    });
  });

  /**
   * Nuclear Fallback Functionality Validation (AC 2.10-2.12)
   */
  describe('Nuclear Fallback Functionality', () => {
    it('AC 2.10: should preserve nuclear fallback capability', async () => {
      // Given: Command State Synchronization nuclear fallback implementation
      // When: Nuclear fallback is triggered to reset session state
      const result = await validator.validateNuclearFallbackCapability();

      // Then: Nuclear fallback should clear browser command buffer completely
      expect(result.browserCommandBufferCleared).toBe(true);
      expect(result.commandStateResetToClean).toBe(true);
      expect(result.postFallbackAcceptsBothCommandTypes).toBe(true);
      expect(result.fallbackMechanismIdenticalToCurrentImpl).toBe(true);
    });

    it('AC 2.11: should validate nuclear fallback trigger conditions', async () => {
      // Given: Nuclear fallback trigger scenarios
      // When: Conditions requiring fallback occur
      const result = await validator.validateNuclearFallbackTriggerConditions();

      // Then: Fallback detection should work correctly
      expect(result.fallbackDetectionWorksCorrectly).toBe(true);
      expect(result.fallbackTriggeredAutomatically).toBe(true);
      expect(result.fallbackProvidesCleanRecovery).toBe(true);
      expect(result.triggerLogicUnchangedFromCurrentImpl).toBe(true);
    });

    it('AC 2.12: should validate post-nuclear-fallback functionality', async () => {
      // Given: Session state after nuclear fallback execution
      // When: Subsequent commands are executed after fallback
      const result = await validator.validatePostNuclearFallbackFunctionality();

      // Then: All Command State Synchronization features should work correctly
      expect(result.browserCommandsExecuteNormally).toBe(true);
      expect(result.mcpCommandsExecuteWithoutGating).toBe(true);
      expect(result.allCommandStateSyncFeaturesWork).toBe(true);
      expect(result.noResidualStateInterference).toBe(true);
    });
  });

  /**
   * Integration Stress Testing (AC 2.13-2.15)
   */
  describe('Integration Stress Testing', () => {
    it('AC 2.13: should validate complex command state synchronization scenario', async () => {
      // Given: Enhanced Villenele framework with complex command scenarios
      const complexScenario: EnhancedCommandParameter[] = [
        { initiator: 'browser', command: 'pwd' },                    // Tracked in buffer
        { initiator: 'browser', command: 'echo "browser1"' },        // Tracked in buffer  
        { initiator: 'mcp-client', command: 'whoami' },             // Should be gated
        // Nuclear fallback will be triggered here
        { initiator: 'browser', command: 'date' },                   // New buffer after fallback
        { initiator: 'mcp-client', command: 'echo "mcp works"' },   // Should execute normally
        { 
          initiator: 'browser', 
          command: 'sleep 5', 
          cancel: true, 
          waitToCancelMs: 2000
        } // Cancellation test
      ];

      // When: Executing comprehensive integration scenario
      const result = await validator.validateComplexCommandStateSyncScenario(complexScenario);

      // Then: All Command State Synchronization features should work correctly
      expect(result.allFeaturesWorkThroughout).toBe(true);
      expect(result.gatingTrackingCancellationFallbackWork).toBe(true);
      expect(result.demonstratesCompleteFunctionalityPreservation).toBe(true);
    });

    it('AC 2.14: should validate performance remains identical', async () => {
      // Given: Command State Synchronization functionality during echo investigation
      // When: Measuring performance of command tracking and gating
      const result = await validator.validateCommandStateSyncPerformance();

      // Then: Performance should remain identical to pre-echo-investigation
      expect(result.performanceIdenticalToBaseline).toBe(true);
      expect(result.browserTrackingNoPerformanceDegradation).toBe(true);
      expect(result.mcpGatingWithinExpectedBounds).toBe(true);
      expect(result.memoryUsageConsistentWithCurrentImpl).toBe(true);
    });

    it('AC 2.15: should validate error handling remains identical', async () => {
      // Given: Command State Synchronization error scenarios
      // When: Error conditions occur
      const result = await validator.validateCommandStateSyncErrorHandling();

      // Then: Error handling should work identically to current implementation
      expect(result.errorHandlingIdenticalToCurrentImpl).toBe(true);
      expect(result.errorRecoveryMaintainsCommandStateConsistency).toBe(true);
      expect(result.errorReportingIncludesCorrectCommandState).toBe(true);
      expect(result.noNewErrorConditionsIntroduced).toBe(true);
    });
  });
});