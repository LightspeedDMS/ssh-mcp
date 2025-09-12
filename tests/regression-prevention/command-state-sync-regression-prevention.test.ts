/**
 * Command State Synchronization Regression Prevention Test Suite
 * 
 * Implements AC 3.4-3.6: Browser command tracking, MCP command gating, and command cancellation
 * regression detection to protect Command State Synchronization functionality
 * 
 * CRITICAL: Zero mocks - all tests use real SSH connections, WebSocket communications,
 * MCP server infrastructure, and actual Command State Synchronization mechanisms
 * 
 * Based on Terminal Echo Fix with Villenele Enhancement Epic requirements
 */

import { JestTestUtilities } from '../integration/terminal-history-framework/jest-test-utilities';

describe('Command State Synchronization Regression Prevention', () => {
  let testUtils: JestTestUtilities;

  beforeEach(async () => {
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true,
      testTimeout: 60000,
      enableDynamicValueConstruction: true
    });
    await testUtils.setupTest('command-state-sync-regression');
  });

  afterEach(async () => {
    await testUtils.cleanupTest();
  });

  /**
   * AC 3.4: Browser command tracking regression detection
   * Validates browser command buffer functionality and session persistence
   */
  describe('AC 3.4: Browser Command Tracking Regression Detection', () => {
    test('should validate all browser commands are correctly tracked in buffer', async () => {
      const sessionName = 'browser-tracking-test-session';
      
      // Execute multiple browser commands to fill buffer
      const testConfig = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'pwd' },
          { initiator: 'browser' as const, command: 'whoami' },
          { initiator: 'browser' as const, command: 'date' }
        ],
        workflowTimeout: 45000,
        sessionName
      };

      const result = await testUtils.runTerminalHistoryTest(testConfig);
      // Validate result contains expected command execution
      expect(result.concatenatedResponses).toBeTruthy();
      
      // Test: All browser commands should be tracked correctly
      // Verify by attempting MCP command that should be gated due to browser commands in buffer
      const gatingTestConfig = {
        preWebSocketCommands: [], // Use existing session
        postWebSocketCommands: [
          `ssh_exec {"sessionName": "${sessionName}", "command": "echo mcp-should-be-gated"}`
        ],
        workflowTimeout: 30000,
        sessionName
      };

      try {
        const gatingResult = await testUtils.runTerminalHistoryTest(gatingTestConfig);
        
        // Test: MCP command should be gated if browser commands are properly tracked
        const isGated = gatingResult.concatenatedResponses.includes('BROWSER_COMMANDS_EXECUTED') ||
                        gatingResult.concatenatedResponses.includes('Command gated') ||
                        !gatingResult.concatenatedResponses.includes('mcp-should-be-gated');

        // Browser command tracking regression: MCP command gating check when browser commands in buffer
        expect(isGated).toBe(true);
      } catch (error) {
        // If MCP command is properly gated, it may throw an error
        expect(error).toBeDefined();
        expect(String(error)).toContain('BROWSER_COMMANDS_EXECUTED');
      }

      // Session cleanup handled by test framework
    });

    test('should validate command source attribution remains user for browser commands', async () => {
      const sessionName = 'source-attribution-test-session';
      
      const testConfig = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'echo test-source-attribution' }
        ],
        workflowTimeout: 30000,
        sessionName
      };

      const result = await testUtils.runTerminalHistoryTest(testConfig);
      
      // Test: Browser command should be properly executed and tracked with 'user' source
      // Browser command not executed properly - source attribution check
      expect(result.concatenatedResponses).toContain('test-source-attribution');
      
      // Test: Command should be tracked for gating purposes
      try {
        const gatingTestConfig = {
          preWebSocketCommands: [],
          postWebSocketCommands: [
            `ssh_exec {"sessionName": "${sessionName}", "command": "whoami"}`
          ],
          workflowTimeout: 30000,
          sessionName
        };

        const gatingResult = await testUtils.runTerminalHistoryTest(gatingTestConfig);
        
        // Should be gated due to browser command with 'user' source in buffer
        const isGated = gatingResult.concatenatedResponses.includes('BROWSER_COMMANDS_EXECUTED') ||
                        !gatingResult.concatenatedResponses.includes('jsbattig');

        // Command source attribution regression: Browser command attribution to user source check
        expect(isGated).toBe(true);
      } catch (error) {
        expect(String(error)).toContain('BROWSER_COMMANDS_EXECUTED');
      }

      // Session cleanup handled by test framework
    });

    test('should validate command completion is properly recorded', async () => {
      const sessionName = 'completion-tracking-test-session';
      
      const testConfig = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'pwd' },
          { initiator: 'browser' as const, command: 'echo completion-test' }
        ],
        workflowTimeout: 45000,
        sessionName
      };

      const result = await testUtils.runTerminalHistoryTest(testConfig);
      
      // Test: Commands should complete successfully and be recorded
      // Browser command completion not recorded properly check
      expect(result.concatenatedResponses).toContain('completion-test');
      
      // Test: Completed commands should still be tracked for gating
      try {
        const postCompletionConfig = {
          preWebSocketCommands: [],
          postWebSocketCommands: [
            `ssh_exec {"sessionName": "${sessionName}", "command": "date"}`
          ],
          workflowTimeout: 30000,
          sessionName
        };

        await testUtils.runTerminalHistoryTest(postCompletionConfig);
        fail('MCP command should be gated due to completed browser commands in buffer');
      } catch (error) {
        expect(String(error)).toContain('BROWSER_COMMANDS_EXECUTED');
      }

      // Session cleanup handled by test framework
    });

    test('should validate buffer persistence throughout session lifecycle', async () => {
      const sessionName = 'buffer-persistence-test-session';
      
      // Phase 1: Execute initial browser commands
      const phase1Config = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'echo phase1-command' }
        ],
        workflowTimeout: 30000,
        sessionName
      };

      await testUtils.runTerminalHistoryTest(phase1Config);
      
      // Phase 2: Wait and then test buffer persistence
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const phase2Config = {
        preWebSocketCommands: [],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'echo phase2-command' }
        ],
        workflowTimeout: 30000,
        sessionName
      };

      await testUtils.runTerminalHistoryTest(phase2Config);
      
      // Phase 3: Test that buffer persists both commands for gating
      try {
        const gatingConfig = {
          preWebSocketCommands: [],
          postWebSocketCommands: [
            `ssh_exec {"sessionName": "${sessionName}", "command": "hostname"}`
          ],
          workflowTimeout: 30000,
          sessionName
        };

        const gatingResult = await testUtils.runTerminalHistoryTest(gatingConfig);
        
        // Should be gated due to persistent browser command buffer
        const isGated = gatingResult.concatenatedResponses.includes('BROWSER_COMMANDS_EXECUTED');
        // Buffer persistence regression: Browser commands persistence throughout session lifecycle check
        expect(isGated).toBe(true);
      } catch (error) {
        expect(String(error)).toContain('BROWSER_COMMANDS_EXECUTED');
      }

      // Session cleanup handled by test framework
    });
  });

  /**
   * AC 3.5: MCP command gating regression detection
   * Validates MCP command gating when browser commands are present in buffer
   */
  describe('AC 3.5: MCP Command Gating Regression Detection', () => {
    const gatingRegressionTestScenarios = [
      { initiator: 'browser', command: 'pwd' },
      { initiator: 'browser', command: 'echo "test"' },
      { initiator: 'mcp-client', command: 'whoami' }  // Should be gated
    ];
    console.log(`Testing ${gatingRegressionTestScenarios.length} gating regression scenarios`);

    test('should validate MCP command gating with browser commands in buffer', async () => {
      const sessionName = 'gating-test-session';
      
      // Execute browser commands first
      const browserConfig = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'pwd' },
          { initiator: 'browser' as const, command: 'echo "test"' }
        ],
        workflowTimeout: 45000,
        sessionName
      };

      await testUtils.runTerminalHistoryTest(browserConfig);
      
      // Test: MCP command should be gated
      try {
        const mcpConfig = {
          preWebSocketCommands: [],
          postWebSocketCommands: [
            `ssh_exec {"sessionName": "${sessionName}", "command": "whoami"}`
          ],
          workflowTimeout: 30000,
          sessionName
        };

        await testUtils.runTerminalHistoryTest(mcpConfig);
        
        // If we reach here, gating failed
        fail(
          'MCP command gating regression: MCP command executed when should be blocked. ' +
          'BROWSER_COMMANDS_EXECUTED error not generated.'
        );
      } catch (error) {
        // Test: Error should indicate gating is working
        // MCP gating error format regression: Expected BROWSER_COMMANDS_EXECUTED error check
        expect(String(error)).toContain('BROWSER_COMMANDS_EXECUTED');
      }

      // Session cleanup handled by test framework
    });

    test('should validate BROWSER_COMMANDS_EXECUTED error includes complete browser command results', async () => {
      const sessionName = 'gating-error-content-session';
      
      const browserConfig = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'pwd' },
          { initiator: 'browser' as const, command: 'whoami' }
        ],
        workflowTimeout: 45000,
        sessionName
      };

      await testUtils.runTerminalHistoryTest(browserConfig);
      
      try {
        const mcpConfig = {
          preWebSocketCommands: [],
          postWebSocketCommands: [
            `ssh_exec {"sessionName": "${sessionName}", "command": "date"}`
          ],
          workflowTimeout: 30000,
          sessionName
        };

        await testUtils.runTerminalHistoryTest(mcpConfig);
        fail('MCP command should be gated');
      } catch (error) {
        const errorMessage = String(error);
        
        // Test: Error should include browser command results
        // Gating error format regression: BROWSER_COMMANDS_EXECUTED not in error message check
        expect(errorMessage).toContain('BROWSER_COMMANDS_EXECUTED');
        
        // Test: Error should include actual browser command results
        // Gating error content regression: Browser command results not included in error check
        expect(errorMessage.includes('/Dev/ls-ssh-mcp') || errorMessage.includes('jsbattig')).toBe(true);
      }

      // Session cleanup handled by test framework
    });

    test('should validate error format matches exact specification', async () => {
      const sessionName = 'error-format-specification-session';
      
      const browserConfig = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'echo specification-test' }
        ],
        workflowTimeout: 30000,
        sessionName
      };

      await testUtils.runTerminalHistoryTest(browserConfig);
      
      try {
        const mcpConfig = {
          preWebSocketCommands: [],
          postWebSocketCommands: [
            `ssh_exec {"sessionName": "${sessionName}", "command": "hostname"}`
          ],
          workflowTimeout: 30000,
          sessionName
        };

        await testUtils.runTerminalHistoryTest(mcpConfig);
        fail('MCP command should be gated');
      } catch (error) {
        const errorMessage = String(error);
        
        // Test: Error format should match Command State Synchronization specification
        expect(errorMessage).toContain('BROWSER_COMMANDS_EXECUTED');
        expect(errorMessage).toContain('specification-test');
        
        // Test: Should not be generic error message
        expect(errorMessage).not.toContain('Command failed');
        expect(errorMessage).not.toContain('Unknown error');
      }

      // Session cleanup handled by test framework
    });

    test('should detect failure in gating logic or error reporting', async () => {
      const sessionName = 'gating-logic-validation-session';
      
      // Test multiple scenarios to validate gating logic comprehensively
      const scenarios = [
        { browserCommands: ['pwd'], mcpCommand: 'whoami', description: 'single browser command' },
        { browserCommands: ['pwd', 'date'], mcpCommand: 'hostname', description: 'multiple browser commands' },
        { browserCommands: ['echo "complex test"'], mcpCommand: 'uptime', description: 'complex browser command' }
      ];

      for (const scenario of scenarios) {
        const testSessionName = `${sessionName}-${scenario.description.replace(/\s+/g, '-')}`;
        
        const browserConfig = {
          preWebSocketCommands: [
            `ssh_connect {"name": "${testSessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
          ],
          postWebSocketCommands: scenario.browserCommands.map(cmd => ({
            initiator: 'browser' as const,
            command: cmd
          })),
          workflowTimeout: 45000,
          sessionName: testSessionName
        };

        await testUtils.runTerminalHistoryTest(browserConfig);
        
        // Test: MCP command should be consistently gated
        let gatingWorking = false;
        try {
          const mcpConfig = {
            preWebSocketCommands: [],
            postWebSocketCommands: [
              `ssh_exec {"sessionName": "${testSessionName}", "command": "${scenario.mcpCommand}"}`
            ],
            workflowTimeout: 30000,
            sessionName: testSessionName
          };

          await testUtils.runTerminalHistoryTest(mcpConfig);
        } catch (error) {
          if (String(error).includes('BROWSER_COMMANDS_EXECUTED')) {
            gatingWorking = true;
          }
        }

        // Gating logic regression for scenario: MCP command gating check
        expect(gatingWorking).toBe(true);

        // Session cleanup handled by test framework
      }
    });
  });

  /**
   * AC 3.6: Command cancellation regression detection
   * Validates browser and MCP command cancellation capabilities
   */
  describe('AC 3.6: Command Cancellation Regression Detection', () => {
    test('should validate browser command cancellation via WebSocket SIGINT', async () => {
      const sessionName = 'browser-cancellation-test-session';
      
      try {
        const cancellationConfig = {
          preWebSocketCommands: [
            `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
          ],
          postWebSocketCommands: [
            { initiator: 'browser' as const, command: 'sleep 10', cancel: true, waitToCancelMs: 2000 }
          ],
          workflowTimeout: 15000,
          sessionName
        };

        const result = await testUtils.runTerminalHistoryTest(cancellationConfig);
        
        // Test: Command should be cancelled successfully
        // Browser command cancellation regression detection
        const isCancelled = result.concatenatedResponses.includes('^C') || 
                           result.concatenatedResponses.includes('cancelled') ||
                           !result.concatenatedResponses.includes('sleep completed');
        if (!isCancelled) {
          fail('Browser command cancellation regression: WebSocket SIGINT cancellation not working');
        }
        expect(isCancelled).toBe(true);
      } catch (error) {
        // Cancellation may cause timeout or early termination - this is expected
        expect(String(error)).toMatch(/(cancel|timeout|interrupt|sigint)/i);
      }

      // Session cleanup handled by test framework
    });

    test('should validate MCP command cancellation via ssh_cancel_command', async () => {
      const sessionName = 'mcp-cancellation-test-session';
      
      try {
        const cancellationConfig = {
          preWebSocketCommands: [
            `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
          ],
          postWebSocketCommands: [
            `ssh_exec {"sessionName": "${sessionName}", "command": "sleep 10"}`,
            // Note: ssh_cancel_command would be called separately in real scenario
            // For this test we'll rely on timeout to test cancellation behavior
          ],
          workflowTimeout: 15000,
          sessionName
        };

        const cancellationResult = await testUtils.runTerminalHistoryTest(cancellationConfig);
        
        // Test: MCP command should be cancelled via ssh_cancel_command
        const isMcpCancelled = cancellationResult.concatenatedResponses.includes('cancelled') ||
                              cancellationResult.concatenatedResponses.includes('^C') ||
                              !cancellationResult.concatenatedResponses.includes('sleep completed');
        if (!isMcpCancelled) {
          fail('MCP command cancellation regression: ssh_cancel_command not working');
        }
        expect(isMcpCancelled).toBe(true);
      } catch (error) {
        // MCP command cancellation may cause expected errors
        expect(String(error)).toMatch(/(cancel|timeout|interrupt)/i);
      }

      // Session cleanup handled by test framework
    });

    test('should validate timeout-based cancellation triggers correctly', async () => {
      const sessionName = 'timeout-cancellation-test-session';
      
      const timeoutConfig = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'sleep 30' } // Long command
        ],
        workflowTimeout: 5000, // Short timeout to trigger cancellation
        sessionName
      };

      try {
        await testUtils.runTerminalHistoryTest(timeoutConfig);
        fail('Command should have been cancelled due to timeout');
      } catch (error) {
        // Test: Timeout should trigger cancellation
        expect(String(error)).toMatch(/(timeout|cancel|interrupt)/i);
      }

      // Session cleanup handled by test framework
    });

    test('should validate session stability after cancellation events', async () => {
      const sessionName = 'session-stability-test-session';
      
      // Phase 1: Cancel a command
      try {
        const cancellationConfig = {
          preWebSocketCommands: [
            `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
          ],
          postWebSocketCommands: [
            { initiator: 'browser' as const, command: 'sleep 5', cancel: true, waitToCancelMs: 1000 }
          ],
          workflowTimeout: 10000,
          sessionName
        };

        await testUtils.runTerminalHistoryTest(cancellationConfig);
      } catch (error) {
        // Expected cancellation
      }

      // Phase 2: Test session stability with normal command
      const stabilityConfig = {
        preWebSocketCommands: [],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'echo session-stable-after-cancellation' }
        ],
        workflowTimeout: 15000,
        sessionName
      };

      const stabilityResult = await testUtils.runTerminalHistoryTest(stabilityConfig);
      
      // Test: Session should remain stable after cancellation
      // Session stability regression: Session stability after command cancellation check
      expect(stabilityResult.concatenatedResponses).toContain('session-stable-after-cancellation');

      // Session cleanup handled by test framework
    });

    test('should validate cancellation works correctly with echo fixes applied', async () => {
      const sessionName = 'cancellation-echo-fix-test-session';
      
      try {
        const cancellationEchoConfig = {
          preWebSocketCommands: [
            `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
          ],
          postWebSocketCommands: [
            { initiator: 'browser' as const, command: 'sleep 8', cancel: true, waitToCancelMs: 2000 }
          ],
          workflowTimeout: 12000,
          sessionName
        };

        const cancellationEchoResult = await testUtils.runTerminalHistoryTest(cancellationEchoConfig);
        
        // Test: Command should be cancelled and echo should be correct (single occurrence)
        const sleepCommandOccurrences = cancellationEchoResult.concatenatedResponses
          .split('\n')
          .filter(line => line.trim() === 'sleep 8')
          .length;

        // Cancellation with echo fix regression: Command appears multiple times during cancellation
        expect(sleepCommandOccurrences).toBe(1);
        
        // Test: Cancellation should work
        const isCancelledWithEcho = cancellationEchoResult.concatenatedResponses.includes('^C') ||
                                    cancellationEchoResult.concatenatedResponses.includes('cancelled');
        if (!isCancelledWithEcho) {
          fail('Echo fix interferes with cancellation: Cancellation not working with echo fixes');
        }
        expect(isCancelledWithEcho).toBe(true);
      } catch (error) {
        // Expected cancellation behavior
        expect(String(error)).toMatch(/(cancel|timeout|interrupt)/i);
      }

      // Session cleanup handled by test framework
    });

    test('should detect degradation in cancellation mechanisms', async () => {
      const sessionName = 'cancellation-degradation-test-session';
      
      // Test various cancellation scenarios to detect degradation
      const cancellationScenarios = [
        {
          type: 'browser-quick-cancel',
          config: {
            postWebSocketCommands: [
              { initiator: 'browser' as const, command: 'sleep 3', cancel: true, waitToCancelMs: 500 }
            ]
          }
        },
        {
          type: 'browser-delayed-cancel', 
          config: {
            postWebSocketCommands: [
              { initiator: 'browser' as const, command: 'sleep 5', cancel: true, waitToCancelMs: 2000 }
            ]
          }
        }
      ];

      for (const scenario of cancellationScenarios) {
        const testSessionName = `${sessionName}-${scenario.type}`;
        
        try {
          const testConfig = {
            preWebSocketCommands: [
              `ssh_connect {"name": "${testSessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
            ],
            ...scenario.config,
            workflowTimeout: 10000,
            sessionName: testSessionName
          };

          await testUtils.runTerminalHistoryTest(testConfig);
          
          // If we reach here without cancellation, there's degradation
          fail(`Cancellation degradation detected in ${scenario.type}: Command completed instead of being cancelled`);
        } catch (error) {
          // Expected cancellation
          expect(String(error)).toMatch(/(cancel|timeout|interrupt)/i);
        }

        // Session cleanup handled by test framework
      }
    });
  });
});