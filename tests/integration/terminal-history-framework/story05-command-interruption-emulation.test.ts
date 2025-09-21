/**
 * Story 05: Command Interruption Emulation - Acceptance Criteria Tests
 * 
 * Tests all 19 acceptance criteria for command interruption emulation in the Villenele framework.
 * Focuses on timeout-based cancellation, protocol-specific cancellation mechanisms, and response capture.
 * 
 * CRITICAL: Following TDD methodology - these are failing tests that drive implementation.
 * IMPORTANT: No mocks in production code per CLAUDE.md - uses real WebSocket connections and MCP client.
 */

import { PostWebSocketCommandExecutor, EnhancedCommandParameter } from './post-websocket-command-executor';
import { MCPClient } from './mcp-client';
import { InitialHistoryReplayCapture } from './initial-history-replay-capture';
import { MCPServerManager } from './mcp-server-manager';
import { WebSocketConnectionDiscovery } from './websocket-connection-discovery';
// import { JestTestUtilities } from './jest-test-utilities'; // Will be used for integration later
import WebSocket from 'ws';

describe('Story 05: Command Interruption Emulation', () => {
  let serverManager: MCPServerManager;
  let mcpClient: MCPClient;
  let executor: PostWebSocketCommandExecutor;
  let historyCapture: InitialHistoryReplayCapture;
  let webSocketDiscovery: WebSocketConnectionDiscovery;
  let webSocket: WebSocket;
  // let testUtils: JestTestUtilities; // Unused for now, will be used in integration

  beforeEach(async () => {
    // Start fresh MCP server for each test
    serverManager = new MCPServerManager();
    await serverManager.start();
    
    const processInfo = serverManager.getProcess();
    if (!processInfo || !processInfo.stdin || !processInfo.stdout) {
      throw new Error('Failed to start MCP server for testing');
    }
    
    mcpClient = new MCPClient(processInfo as any);
    
    // Set up WebSocket discovery
    webSocketDiscovery = new WebSocketConnectionDiscovery(mcpClient);
    
    // Create SSH session for testing
    await mcpClient.callTool('ssh_connect', {
      name: 'story05-test-session',
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    });
    
    // Establish WebSocket connection
    const webSocketUrl = await webSocketDiscovery.discoverWebSocketUrl('story05-test-session');
    webSocket = await webSocketDiscovery.establishConnection(webSocketUrl);
    
    // Initialize history capture with the WebSocket
    historyCapture = new InitialHistoryReplayCapture();
    await historyCapture.captureInitialHistory(webSocket);
    
    executor = new PostWebSocketCommandExecutor(mcpClient, historyCapture, {
      sessionName: 'story05-test-session',
      enableSequentialExecution: true
    });

    // Initialize test utilities - will be used for integration
    // testUtils = JestTestUtilities.setupJestEnvironment('story05-command-interruption');
  });

  afterEach(async () => {
    if (historyCapture) {
      await historyCapture.cleanup();
    }
    if (webSocket) {
      webSocket.close();
    }
    if (mcpClient) {
      await mcpClient.disconnect();
    }
    if (serverManager) {
      await serverManager.stop();
    }
  });

  describe('Basic Timeout-Based Cancellation', () => {
    describe('AC 5.1: Browser command cancellation after timeout with sleep', () => {
      it('should cancel browser sleep command after timeout via WebSocket SIGINT', async () => {
        // Given: Browser command with cancellation: sleep 30, cancel after 3000ms
        const commands: EnhancedCommandParameter[] = [
          { 
            initiator: 'browser', 
            command: 'sleep 30', 
            cancel: true, 
            waitToCancelMs: 3000 
          }
        ];

        const startTime = performance.now();

        // When: Villenele executes the command
        const results = await executor.executeCommands(commands, webSocket);

        const executionTime = performance.now() - startTime;

        // Then: Command should be sent via WebSocket terminal_input message
        expect(results).toHaveLength(1);
        expect(results[0].initiator).toBe('browser');
        expect(results[0].command).toBe('sleep 30');
        expect(results[0].cancelRequested).toBe(true);
        expect(results[0].waitToCancelMs).toBe(3000);

        // And: After 3000ms, cancellation should be triggered via WebSocket SIGINT
        expect(executionTime).toBeLessThan(30000); // Should not wait full 30 seconds
        expect(executionTime).toBeGreaterThanOrEqual(2500); // Should wait roughly 3 seconds (±500ms tolerance)
        expect(executionTime).toBeLessThanOrEqual(3500);

        // And: Sleep command should be interrupted with ^C before 30 seconds complete
        // And: Cancellation should be captured in concatenatedResponses showing interrupted sleep
        const capturedMessages = results[0].capturedMessages;
        const messageContent = capturedMessages.map(msg => JSON.stringify(msg)).join(' ');
        
        // This test will fail initially until WebSocket SIGINT cancellation is implemented
        expect(messageContent).toContain('^C'); // Should show interrupt signal
        expect(messageContent).toContain('sleep'); // Should show the command was started
      });
    });

    describe('AC 5.2: MCP command cancellation after timeout', () => {
      it('should cancel MCP sleep command after timeout via ssh_cancel_command', async () => {
        // Given: MCP command with cancellation: sleep 15, cancel after 5000ms
        const commands: EnhancedCommandParameter[] = [
          { 
            initiator: 'mcp-client', 
            command: 'ssh_exec {"sessionName": "story05-test-session", "command": "sleep 15"}', 
            cancel: true, 
            waitToCancelMs: 5000 
          }
        ];

        const startTime = performance.now();

        // When: Villenele executes the command
        const results = await executor.executeCommands(commands, webSocket);

        const executionTime = performance.now() - startTime;

        // Then: Command should be sent via JSON-RPC stdin
        expect(results).toHaveLength(1);
        expect(results[0].initiator).toBe('mcp-client');
        expect(results[0].command).toBe('ssh_exec {"sessionName": "story05-test-session", "command": "sleep 15"}');
        expect(results[0].cancelRequested).toBe(true);
        expect(results[0].waitToCancelMs).toBe(5000);

        // And: After 5000ms, cancellation should be triggered via ssh_cancel_command tool
        expect(executionTime).toBeLessThan(15000); // Should not wait full 15 seconds
        expect(executionTime).toBeGreaterThanOrEqual(4500); // Should wait roughly 5 seconds (±500ms tolerance)
        expect(executionTime).toBeLessThanOrEqual(5500);

        // And: Command should be interrupted using MCP cancellation mechanism
        expect(results[0].mcpResponse).toBeDefined();
        
        // And: Cancellation result should be captured in response
        // This test will fail initially until MCP ssh_cancel_command cancellation is implemented
        expect(results[0].success).toBe(false); // Command should be cancelled, not successful completion
      });
    });

    describe('AC 5.3: Default cancellation timeout behavior', () => {
      it('should use default 10 second timeout when waitToCancelMs not specified', async () => {
        // Given: Command with cancel enabled but no timeout specified
        const commands: EnhancedCommandParameter[] = [
          { 
            initiator: 'browser', 
            command: 'sleep 20', 
            cancel: true 
            // waitToCancelMs not specified - should default to 10000
          }
        ];

        const startTime = performance.now();

        // When: Villenele processes the configuration
        const results = await executor.executeCommands(commands, webSocket);

        const executionTime = performance.now() - startTime;

        // Then: Default waitToCancelMs should be set to 10000 (10 seconds)
        expect(results[0].waitToCancelMs).toBe(10000);

        // And: Cancellation should trigger after 10 seconds
        expect(executionTime).toBeLessThan(20000); // Should not wait full 20 seconds
        expect(executionTime).toBeGreaterThanOrEqual(9500); // Should wait roughly 10 seconds (±500ms tolerance)
        expect(executionTime).toBeLessThanOrEqual(10500);

        // And: Command should be interrupted appropriately
        // This test will fail initially until default timeout behavior is implemented
        expect(results[0].cancelRequested).toBe(true);
      });
    });
  });

  describe('Protocol-Specific Cancellation Mechanisms', () => {
    describe('AC 5.4: WebSocket SIGINT signal cancellation', () => {
      it('should send WebSocket SIGINT signal for browser command cancellation', async () => {
        // Given: Browser command with cancellation
        const commands: EnhancedCommandParameter[] = [
          {
            initiator: 'browser',
            command: 'sleep 10',
            cancel: true,
            waitToCancelMs: 2000
          }
        ];

        // When: Timeout period expires
        const results = await executor.executeCommands(commands, webSocket);

        // Then: Villenele should send WebSocket message with SIGINT signal
        const capturedMessages = results[0].capturedMessages;
        const messageContent = capturedMessages.map(msg => JSON.stringify(msg)).join(' ');
        
        // Expected WebSocket message: {type: 'terminal_signal', sessionName: 'story05-test-session', signal: 'SIGINT'}
        // This test will fail initially until WebSocket SIGINT implementation is added
        expect(messageContent).toContain('terminal_signal');
        expect(messageContent).toContain('SIGINT');
        expect(messageContent).toContain('story05-test-session');

        // And: Terminal should receive interrupt signal
        // And: Command should terminate with interrupt indication: ^C
        expect(messageContent).toContain('^C');

        // And: Command prompt should return after interruption
        expect(messageContent).toMatch(/\[jsbattig@localhost.*\]\$/);
      });
    });

    describe('AC 5.5: MCP ssh_cancel_command cancellation', () => {
      it('should call ssh_cancel_command tool for MCP command cancellation', async () => {
        // Given: MCP command with cancellation
        const commands: EnhancedCommandParameter[] = [
          { 
            initiator: 'mcp-client', 
            command: 'find . -name "*.ts" -exec grep -l "export" {} \\;', 
            cancel: true, 
            waitToCancelMs: 4000 
          }
        ];

        // When: Timeout period expires
        const results = await executor.executeCommands(commands, webSocket);

        // Then: Villenele should call ssh_cancel_command tool with session name
        // This test will fail initially until MCP ssh_cancel_command implementation is added
        expect(results[0].mcpResponse).toBeDefined();
        expect(results[0].success).toBe(false); // Command cancelled, not successful

        // And: MCP server should cancel the running command
        // And: Cancellation result should indicate successful interruption
        // Implementation should track cancellation attempts in response

        // And: Session should remain active for subsequent commands
        // Follow-up command should still work after cancellation
        const followUpCommands: EnhancedCommandParameter[] = [
          { initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "story05-test-session", "command": "echo \"session still active\""}' }
        ];
        
        const followUpResults = await executor.executeCommands(followUpCommands, webSocket);
        expect(followUpResults[0].success).toBe(true);
      });
    });

    describe('AC 5.6: Mixed cancellation scenario execution', () => {
      it('should handle mixed browser and MCP cancellations in sequence', async () => {
        // Given: Sequence with mixed cancellations
        const commands: EnhancedCommandParameter[] = [
          { initiator: 'browser', command: 'pwd' },                                                    // No cancel
          { initiator: 'browser', command: 'sleep 10', cancel: true, waitToCancelMs: 2000 },         // Browser cancel
          { initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "story05-test-session", "command": "sleep 10"}', cancel: true, waitToCancelMs: 3000 },      // MCP cancel  
          { initiator: 'browser', command: 'whoami' }                                                 // No cancel
        ];

        const startTime = performance.now();

        // When: Villenele executes the complete sequence
        const results = await executor.executeCommands(commands, webSocket);

        const executionTime = performance.now() - startTime;

        // Then: First command should complete normally
        expect(results[0].success).toBe(true);
        expect(results[0].cancelRequested).toBe(false);

        // And: Second command should be cancelled via WebSocket after 2 seconds
        expect(results[1].cancelRequested).toBe(true);
        expect(results[1].waitToCancelMs).toBe(2000);

        // And: Third command should be cancelled via MCP after 3 seconds  
        expect(results[2].cancelRequested).toBe(true);
        expect(results[2].waitToCancelMs).toBe(3000);

        // And: Fourth command should execute normally after cancellations
        expect(results[3].success).toBe(true);
        expect(results[3].cancelRequested).toBe(false);

        // Total execution should be much less than 20 seconds (10+10 without cancellation)
        expect(executionTime).toBeLessThan(15000); // Should complete in under 15 seconds due to cancellations
      });
    });
  });

  describe('Cancellation Timing and Precision', () => {
    describe('AC 5.7: Cancellation timing accuracy', () => {
      it('should cancel within timing tolerance of ±500ms', async () => {
        // Given: Command with waitToCancelMs: 5000 (5 seconds)
        const commands: EnhancedCommandParameter[] = [
          { 
            initiator: 'browser', 
            command: 'sleep 15', 
            cancel: true, 
            waitToCancelMs: 5000 
          }
        ];

        const startTime = performance.now();

        // When: Villenele executes command with cancellation
        const results = await executor.executeCommands(commands, webSocket);

        const executionTime = performance.now() - startTime;

        // Then: Cancellation should occur within 5000ms ± 500ms tolerance
        expect(executionTime).toBeGreaterThanOrEqual(4500); // 5000ms - 500ms
        expect(executionTime).toBeLessThanOrEqual(5500);    // 5000ms + 500ms

        // And: Timing should be measured from command start, not configuration time
        expect(results[0].executionStartTime).toBeDefined();
        expect(results[0].executionEndTime).toBeDefined();
        
        const commandExecutionTime = results[0].executionEndTime - results[0].executionStartTime;
        expect(commandExecutionTime).toBeGreaterThanOrEqual(4500);
        expect(commandExecutionTime).toBeLessThanOrEqual(5500);
      });

      it('should maintain cancellation precision across multiple executions', async () => {
        // Test consistency across 3 executions
        const timings: number[] = [];
        
        for (let i = 0; i < 3; i++) {
          const commands: EnhancedCommandParameter[] = [
            { 
              initiator: 'browser', 
              command: 'sleep 15', 
              cancel: true, 
              waitToCancelMs: 3000 
            }
          ];

          const startTime = performance.now();
          await executor.executeCommands(commands, webSocket);
          const executionTime = performance.now() - startTime;
          
          timings.push(executionTime);
        }

        // And: Cancellation precision should be consistent across multiple executions
        for (const timing of timings) {
          expect(timing).toBeGreaterThanOrEqual(2500); // 3000ms - 500ms
          expect(timing).toBeLessThanOrEqual(3500);    // 3000ms + 500ms
        }

        // Variance should be reasonable (less than 1 second between fastest and slowest)
        const maxTiming = Math.max(...timings);
        const minTiming = Math.min(...timings);
        expect(maxTiming - minTiming).toBeLessThan(1000);
      });
    });

    describe('AC 5.8: Command completion before timeout', () => {
      it('should clear cancellation timer for commands that complete naturally', async () => {
        // Given: Fast command with long cancellation timeout
        const commands: EnhancedCommandParameter[] = [
          { 
            initiator: 'browser', 
            command: 'echo "quick"', 
            cancel: true, 
            waitToCancelMs: 10000 // Long timeout - command should complete first
          }
        ];

        const startTime = performance.now();

        // When: Command completes naturally before timeout
        const results = await executor.executeCommands(commands, webSocket);

        const executionTime = performance.now() - startTime;

        // Then: Cancellation timer should be cleared
        expect(executionTime).toBeLessThan(2000); // Should complete quickly, not wait 10 seconds

        // And: No cancellation signal should be sent
        const capturedMessages = results[0].capturedMessages;
        const messageContent = capturedMessages.map(msg => JSON.stringify(msg)).join(' ');
        expect(messageContent).not.toContain('^C'); // Should NOT contain interrupt signal

        // And: Command should complete normally with expected output
        expect(messageContent).toContain('quick');
        expect(results[0].success).toBe(true);
      });
    });

    describe('AC 5.9: Concurrent cancellation handling', () => {
      it('should handle multiple commands with different cancellation timers independently', async () => {
        // Given: Multiple commands with different cancellation timers
        // Note: This test simulates concurrent execution by running them in separate executor calls
        
        const shortCancelCommand: EnhancedCommandParameter[] = [
          { initiator: 'browser', command: 'sleep 15', cancel: true, waitToCancelMs: 2000 }
        ];
        
        const longCancelCommand: EnhancedCommandParameter[] = [
          { initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "story05-test-session", "command": "sleep 15"}', cancel: true, waitToCancelMs: 5000 }
        ];

        // When: Different cancellation timeouts expire at overlapping times
        const shortCancelPromise = executor.executeCommands(shortCancelCommand, webSocket);
        
        // Start second command slightly after first (simulate overlap)
        await new Promise(resolve => setTimeout(resolve, 1000));
        const longCancelPromise = executor.executeCommands(longCancelCommand, webSocket);

        const [shortResults, longResults] = await Promise.all([shortCancelPromise, longCancelPromise]);

        // Then: Each command should be cancelled independently
        expect(shortResults[0].waitToCancelMs).toBe(2000);
        expect(longResults[0].waitToCancelMs).toBe(5000);

        // And: Cancellation signals should not interfere with each other
        expect(shortResults[0].cancelRequested).toBe(true);
        expect(longResults[0].cancelRequested).toBe(true);

        // And: Session state should remain stable across concurrent cancellations
        // Verify with a follow-up command
        const followUpCommands: EnhancedCommandParameter[] = [
          { initiator: 'browser', command: 'echo "session stable"' }
        ];
        
        const followUpResults = await executor.executeCommands(followUpCommands, webSocket);
        expect(followUpResults[0].success).toBe(true);
      });
    });
  });

  describe('Cancellation Response Validation', () => {
    describe('AC 5.10: Browser cancellation response capture', () => {
      it('should capture complete response for cancelled browser commands', async () => {
        // Given: Browser command cancelled after timeout
        const commands: EnhancedCommandParameter[] = [
          { 
            initiator: 'browser', 
            command: 'sleep 30', 
            cancel: true, 
            waitToCancelMs: 2000 
          }
        ];

        // When: WebSocket SIGINT signal is sent
        const results = await executor.executeCommands(commands, webSocket);

        // Then: concatenatedResponses should contain command echo
        const capturedMessages = results[0].capturedMessages;
        const messageContent = capturedMessages.map(msg => JSON.stringify(msg)).join(' ');
        
        expect(messageContent).toContain('sleep 30'); // Command echo

        // And: Contain partial command output (if any produced before cancellation)
        // Sleep typically doesn't produce output, but should capture any that exists

        // And: Contain interrupt indicator: ^C
        expect(messageContent).toContain('^C');

        // And: Contain returned command prompt
        expect(messageContent).toMatch(/\[jsbattig@localhost.*\]\$/);
      });
    });

    describe('AC 5.11: MCP cancellation response capture', () => {
      it('should capture MCP cancellation response and confirmation', async () => {
        // Given: MCP command cancelled via ssh_cancel_command
        const commands: EnhancedCommandParameter[] = [
          { 
            initiator: 'mcp-client', 
            command: 'sleep 15', 
            cancel: true, 
            waitToCancelMs: 3000 
          }
        ];

        // When: Cancellation is executed
        const results = await executor.executeCommands(commands, webSocket);

        // Then: Response should contain command execution start
        expect(results[0].mcpResponse).toBeDefined();
        expect(results[0].command).toBe('ssh_exec {"sessionName": "story05-test-session", "command": "sleep 15"}');

        // And: Contain cancellation confirmation from MCP server
        // Implementation should track cancellation attempts
        expect(results[0].success).toBe(false); // Command was cancelled

        // And: Contain any partial output produced before cancellation
        // And: Maintain response format consistency for validation
        expect(results[0].executionStartTime).toBeDefined();
        expect(results[0].executionEndTime).toBeDefined();
      });
    });

    describe('AC 5.12: Post-cancellation session validation', () => {
      it('should maintain session integrity after command cancellations', async () => {
        // Given: Commands that have been cancelled via timeout mechanisms
        const cancelledCommands: EnhancedCommandParameter[] = [
          { initiator: 'browser', command: 'sleep 20', cancel: true, waitToCancelMs: 2000 },
          { initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "story05-test-session", "command": "sleep 20"}', cancel: true, waitToCancelMs: 3000 }
        ];

        await executor.executeCommands(cancelledCommands, webSocket);

        // When: Subsequent commands are executed in same session
        const subsequentCommands: EnhancedCommandParameter[] = [
          { initiator: 'browser', command: 'pwd' },
          { initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "story05-test-session", "command": "whoami"}' },
          { initiator: 'browser', command: 'echo "test after cancellation"' }
        ];

        const results = await executor.executeCommands(subsequentCommands, webSocket);

        // Then: SSH session should remain active and functional
        expect(results).toHaveLength(3);
        expect(results[0].success).toBe(true);
        expect(results[1].success).toBe(true);
        expect(results[2].success).toBe(true);

        // And: Working directory should be preserved correctly
        const pwdMessages = results[0].capturedMessages.map(msg => JSON.stringify(msg)).join(' ');
        expect(pwdMessages).toContain('/home/jsbattig'); // Should show expected working directory

        // And: Environment state should be maintained across cancellations
        // Whoami command should work 
        expect(results[1].mcpResponse?.success).toBe(true);

        // And: No session corruption should occur from interruptions
        const echoMessages = results[2].capturedMessages.map(msg => JSON.stringify(msg)).join(' ');
        expect(echoMessages).toContain('test after cancellation');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    describe('AC 5.13: Cancellation failure handling', () => {
      it('should handle cancellation mechanism failures gracefully', async () => {
        // This test requires mocking WebSocket disconnection or MCP error
        // For now, we'll test the error handling path by using invalid session
        
        // Given: Command with cancellation timeout
        const commands: EnhancedCommandParameter[] = [
          { 
            initiator: 'browser', 
            command: 'sleep 10', 
            cancel: true, 
            waitToCancelMs: 2000 
          }
        ];

        // When: Cancellation mechanism fails (simulated by closing WebSocket)
        webSocket.close();
        
        try {
          const results = await executor.executeCommands(commands, webSocket);
          
          // Then: Villenele should detect cancellation failure
          expect(results[0].error).toBeDefined();
          
          // And: Log specific error with reason
          expect(results[0].error).toContain('WebSocket'); // Should mention WebSocket connection issue
          
        } catch (error) {
          // And: Continue with next command or fail gracefully based on configuration
          expect(error).toBeDefined();
          
          // And: Provide diagnostic information for troubleshooting cancellation issues
          expect((error as Error).message).toContain('WebSocket'); // Should provide diagnostic info
        }
      });
    });

    describe('AC 5.14: Invalid timeout value handling', () => {
      it('should reject zero or negative timeout values', async () => {
        // Given: Command with invalid timeout: waitToCancelMs: 0
        const invalidCommands: EnhancedCommandParameter[] = [
          { 
            initiator: 'browser', 
            command: 'pwd', 
            cancel: true, 
            waitToCancelMs: 0  // Invalid: zero timeout
          }
        ];

        // When: Villenele validates the configuration
        // Then: Validation should reject zero or negative timeout values
        await expect(executor.executeCommands(invalidCommands, webSocket)).rejects.toThrow();

        // Test negative value
        const negativeCommands: EnhancedCommandParameter[] = [
          { 
            initiator: 'browser', 
            command: 'pwd', 
            cancel: true, 
            waitToCancelMs: -1000  // Invalid: negative timeout
          }
        ];

        await expect(executor.executeCommands(negativeCommands, webSocket)).rejects.toThrow();
      });

      it('should provide helpful error messages for invalid timeouts', async () => {
        // Given: Command with invalid timeout
        const invalidCommands: EnhancedCommandParameter[] = [
          { 
            initiator: 'browser', 
            command: 'pwd', 
            cancel: true, 
            waitToCancelMs: 500  // Invalid: too small (less than minimum 1000ms)
          }
        ];

        try {
          await executor.executeCommands(invalidCommands, webSocket);
          fail('Should have thrown validation error');
        } catch (error) {
          // And: Provide error: "waitToCancelMs must be positive value >= 1000"
          expect((error as Error).message).toContain('waitToCancelMs must be positive');
          
          // And: Suggest minimum reasonable timeout value
          expect((error as Error).message).toContain('1000');
        }
      });
    });

    describe('AC 5.15: Command already completed during cancellation attempt', () => {
      it('should handle race condition where command completes just as cancellation triggers', async () => {
        // Given: Command that completes just as cancellation timeout expires
        // Use a command that might complete around the cancellation time
        const commands: EnhancedCommandParameter[] = [
          { 
            initiator: 'browser', 
            command: 'sleep 2', // 2 second sleep
            cancel: true, 
            waitToCancelMs: 2000 // Cancel after 2 seconds - race condition
          }
        ];

        // When: Cancellation signal is sent after command natural completion
        const results = await executor.executeCommands(commands, webSocket);

        // Then: Cancellation should be safely ignored
        // And: No error should be generated for attempting to cancel completed command
        expect(results[0].error).toBeUndefined();

        // And: Final response should reflect natural completion, not interruption
        // const capturedMessages = results[0].capturedMessages; // Unused for now 
        // const messageContent = capturedMessages.map(msg => JSON.stringify(msg)).join(' '); // Unused for now
        
        // Should not contain ^C if command completed naturally
        // Note: Due to race conditions, this might contain ^C, so we test for no error instead
        expect(results[0].error).toBeUndefined();

        // And: Subsequent commands should execute normally
        const followUpCommands: EnhancedCommandParameter[] = [
          { initiator: 'browser', command: 'echo "after race condition"' }
        ];
        
        const followUpResults = await executor.executeCommands(followUpCommands, webSocket);
        expect(followUpResults[0].success).toBe(true);
      });
    });
  });

  describe('Complex Cancellation Scenarios', () => {
    describe('AC 5.16: Nested command cancellation testing', () => {
      it('should interrupt entire command hierarchy including nested processes', async () => {
        // Given: Script execution with cancellation
        const commands: EnhancedCommandParameter[] = [
          { 
            initiator: 'browser', 
            command: 'bash -c "sleep 30 && echo done"', 
            cancel: true, 
            waitToCancelMs: 5000 
          }
        ];

        const startTime = performance.now();

        // When: Cancellation timeout expires during nested script execution
        const results = await executor.executeCommands(commands, webSocket);

        const executionTime = performance.now() - startTime;

        // Then: Entire command hierarchy should be interrupted
        expect(executionTime).toBeLessThan(30000); // Should not wait for full sleep
        expect(executionTime).toBeGreaterThanOrEqual(4500); // Should wait roughly 5 seconds
        expect(executionTime).toBeLessThanOrEqual(5500);

        // And: Bash script and sleep command should both be terminated
        const capturedMessages = results[0].capturedMessages;
        const messageContent = capturedMessages.map(msg => JSON.stringify(msg)).join(' ');
        expect(messageContent).toContain('^C'); // Should show interruption
        expect(messageContent).not.toContain('done'); // Should not reach the echo

        // And: No orphaned processes should remain after cancellation
        // This is tested by ensuring session remains functional
        const cleanupCommands: EnhancedCommandParameter[] = [
          { initiator: 'browser', command: 'echo "cleanup successful"' }
        ];
        
        const cleanupResults = await executor.executeCommands(cleanupCommands, webSocket);
        expect(cleanupResults[0].success).toBe(true);
      });
    });

    describe('AC 5.17: Interactive nano editor cancellation', () => {
      it('should forcefully cancel nano editor and return to normal prompt', async () => {
        // Given: Browser command with nano editor cancellation
        const commands: EnhancedCommandParameter[] = [
          { 
            initiator: 'browser', 
            command: 'nano /tmp/test.txt', 
            cancel: true, 
            waitToCancelMs: 4000 
          }
        ];

        const startTime = performance.now();

        // When: Nano editor is launched and timeout expires
        const results = await executor.executeCommands(commands, webSocket);

        const executionTime = performance.now() - startTime;

        // Then: Nano editor should be forcefully cancelled via WebSocket SIGINT
        expect(executionTime).toBeGreaterThanOrEqual(3500); // Should wait roughly 4 seconds
        expect(executionTime).toBeLessThanOrEqual(4500);

        // And: Terminal should show ^C interruption and exit nano cleanly
        const capturedMessages = results[0].capturedMessages;
        const messageContent = capturedMessages.map(msg => JSON.stringify(msg)).join(' ');
        expect(messageContent).toContain('^C');

        // And: Terminal should return to normal command prompt without hanging in editor mode
        expect(messageContent).toMatch(/\[jsbattig@localhost.*\]\$/);

        // And: No orphaned nano processes should remain after cancellation
        const followUpCommands: EnhancedCommandParameter[] = [
          { initiator: 'browser', command: 'echo "nano cancelled successfully"' }
        ];
        
        const followUpResults = await executor.executeCommands(followUpCommands, webSocket);
        expect(followUpResults[0].success).toBe(true);
      });
    });

    describe('AC 5.18: Interactive command with user input cancellation', () => {
      it('should cancel interactive read command waiting for user input', async () => {
        // Given: Interactive command with cancellation
        const commands: EnhancedCommandParameter[] = [
          { 
            initiator: 'browser', 
            command: 'read -p "Enter input: " userInput', 
            cancel: true, 
            waitToCancelMs: 3000 
          }
        ];

        const startTime = performance.now();

        // When: Command waits for user input and timeout expires
        const results = await executor.executeCommands(commands, webSocket);

        const executionTime = performance.now() - startTime;

        // Then: Interactive command should be cancelled via SIGINT
        expect(executionTime).toBeGreaterThanOrEqual(2500); // Should wait roughly 3 seconds
        expect(executionTime).toBeLessThanOrEqual(3500);

        // And: Input prompt should be interrupted
        const capturedMessages = results[0].capturedMessages;
        const messageContent = capturedMessages.map(msg => JSON.stringify(msg)).join(' ');
        expect(messageContent).toContain('^C');

        // And: Terminal should return to normal command prompt
        expect(messageContent).toMatch(/\[jsbattig@localhost.*\]\$/);

        // And: No hanging input state should remain
        const followUpCommands: EnhancedCommandParameter[] = [
          { initiator: 'browser', command: 'echo "input cancelled successfully"' }
        ];
        
        const followUpResults = await executor.executeCommands(followUpCommands, webSocket);
        expect(followUpResults[0].success).toBe(true);
      });
    });

    describe('AC 5.19: Long sequence with multiple cancellations', () => {
      it('should handle extended sequence with multiple cancellation points', async () => {
        // Given: Extended sequence with multiple cancellation points
        const commands: EnhancedCommandParameter[] = [
          { initiator: 'browser', command: 'echo "start"' },
          { initiator: 'browser', command: 'sleep 20', cancel: true, waitToCancelMs: 2000 },
          { initiator: 'browser', command: 'nano /tmp/test.txt', cancel: true, waitToCancelMs: 1500 },
          { initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "story05-test-session", "command": "sleep 15"}', cancel: true, waitToCancelMs: 3000 },
          { initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "story05-test-session", "command": "echo \"end\""}' }
        ];

        const startTime = performance.now();

        // When: Villenele executes the complete sequence with multiple cancellations
        const results = await executor.executeCommands(commands, webSocket);

        const executionTime = performance.now() - startTime;

        // Then: All cancellation timeouts should be respected independently
        expect(results).toHaveLength(5);

        // First command - normal execution
        expect(results[0].success).toBe(true);
        expect(results[0].cancelRequested).toBe(false);

        // Second command - cancelled after 2 seconds
        expect(results[1].cancelRequested).toBe(true);
        expect(results[1].waitToCancelMs).toBe(2000);

        // Third command - cancelled after 1.5 seconds  
        expect(results[2].cancelRequested).toBe(true);
        expect(results[2].waitToCancelMs).toBe(1500);

        // Fourth command - cancelled after 3 seconds
        expect(results[3].cancelRequested).toBe(true);
        expect(results[3].waitToCancelMs).toBe(3000);

        // Fifth command - normal execution
        expect(results[4].success).toBe(true);
        expect(results[4].cancelRequested).toBe(false);

        // And: Sequence should continue after each cancellation
        // Total execution should be much less than 55 seconds (20+20+15 without cancellation)
        expect(executionTime).toBeLessThan(20000); // Should complete in under 20 seconds due to cancellations

        // And: Final command should execute normally after all interruptions
        const finalMessages = results[4].capturedMessages.map(msg => JSON.stringify(msg)).join(' ');
        expect(finalMessages).toContain('end');

        // And: Session integrity should be maintained throughout
        expect(results[4].success).toBe(true);
      });
    });
  });
});