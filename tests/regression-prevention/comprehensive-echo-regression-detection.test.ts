/**
 * Comprehensive Echo Regression Detection Test Suite
 * 
 * Implements AC 3.1-3.3: Echo duplication detection across all command types and protocols
 * 
 * CRITICAL: Zero mocks - all tests use real SSH connections, WebSocket communications,
 * and actual MCP server infrastructure to validate echo behavior
 * 
 * Based on Terminal Echo Fix with Villenele Enhancement Epic requirements
 */

import { JestTestUtilities } from '../integration/terminal-history-framework/jest-test-utilities';

describe('Comprehensive Echo Regression Detection', () => {
  let testUtils: JestTestUtilities;

  beforeEach(async () => {
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true,
      testTimeout: 60000,
      enableDynamicValueConstruction: true
    });
    await testUtils.setupTest('echo-regression-detection');
  });

  afterEach(async () => {
    await testUtils.cleanupTest();
  });

  /**
   * AC 3.1: Echo duplication detection test suite
   * Tests all command types for single display occurrence
   */
  describe('AC 3.1: Echo Duplication Detection', () => {
    const echoRegressionTests = {
      basicCommands: ['pwd', 'whoami', 'date', 'hostname'],
      fileOperations: ['ls', 'ls -la', 'cat /etc/hostname', 'find /tmp -name "*.tmp" -maxdepth 1'],
      textProcessing: ['grep root /etc/passwd', 'wc -l /etc/passwd', 'head -5 /etc/passwd', 'tail -10 /etc/passwd'],
      systemCommands: ['ps aux | head -5', 'df -h', 'free -m', 'uptime'],
      complexCommands: ['ps aux | grep ssh | head -3', 'find /usr -name "*.log" -maxdepth 2 | head -5']
    };

    test('should detect echo duplication in basic commands', async () => {
      const sessionName = 'echo-basic-test-session';
      
      for (const command of echoRegressionTests.basicCommands) {
        const testConfig = {
          preWebSocketCommands: [
            `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
          ],
          postWebSocketCommands: [
            { initiator: 'browser' as const, command }
          ],
          workflowTimeout: 30000,
          sessionName
        };

        const result = await testUtils.runTerminalHistoryTest(testConfig);
        
        // Test: Command should appear exactly once (not duplicated)
        const commandOccurrences = result.concatenatedResponses
          .split('\n')
          .filter(line => line.trim() === command.trim())
          .length;

        expect(commandOccurrences).toBe(1);

        // Session cleanup handled by test framework
      }
    });

    test('should detect echo duplication in file operations', async () => {
      const sessionName = 'echo-file-ops-test-session';
      
      for (const command of echoRegressionTests.fileOperations) {
        const testConfig = {
          preWebSocketCommands: [
            `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
          ],
          postWebSocketCommands: [
            { initiator: 'browser' as const, command }
          ],
          workflowTimeout: 30000,
          sessionName
        };

        const result = await testUtils.runTerminalHistoryTest(testConfig);
        
        // Test: Command should appear exactly once
        const commandOccurrences = result.concatenatedResponses
          .split('\n')
          .filter(line => line.trim() === command.trim())
          .length;

        // File operation command echo duplication regression detection
        if (commandOccurrences !== 1) {
          fail(`File operation command "${command}" appears ${commandOccurrences} times instead of once. ` +
               `This indicates echo duplication regression.\nResponse: ${result.concatenatedResponses}`);
        }
        expect(commandOccurrences).toBe(1);

        // Session cleanup handled by test framework
      }
    });

    test('should detect echo duplication in text processing commands', async () => {
      const sessionName = 'echo-text-processing-test-session';
      
      for (const command of echoRegressionTests.textProcessing) {
        const testConfig = {
          preWebSocketCommands: [
            `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
          ],
          postWebSocketCommands: [
            { initiator: 'browser' as const, command }
          ],
          workflowTimeout: 30000,
          sessionName
        };

        const result = await testUtils.runTerminalHistoryTest(testConfig);
        
        // Test: Command should appear exactly once
        const commandOccurrences = result.concatenatedResponses
          .split('\n')
          .filter(line => line.trim() === command.trim())
          .length;

        // Text processing command echo duplication regression detection
        if (commandOccurrences !== 1) {
          fail(`Text processing command "${command}" appears ${commandOccurrences} times instead of once. ` +
               `This indicates echo duplication regression.\nResponse: ${result.concatenatedResponses}`);
        }
        expect(commandOccurrences).toBe(1);

        // Session cleanup handled by test framework
      }
    });

    test('should detect echo duplication in system commands', async () => {
      const sessionName = 'echo-system-test-session';
      
      for (const command of echoRegressionTests.systemCommands) {
        const testConfig = {
          preWebSocketCommands: [
            `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
          ],
          postWebSocketCommands: [
            { initiator: 'browser' as const, command }
          ],
          workflowTimeout: 30000,
          sessionName
        };

        const result = await testUtils.runTerminalHistoryTest(testConfig);
        
        // Test: Command should appear exactly once
        const commandOccurrences = result.concatenatedResponses
          .split('\n')
          .filter(line => line.trim() === command.trim())
          .length;

        // System command echo duplication regression detection
        if (commandOccurrences !== 1) {
          fail(`System command "${command}" appears ${commandOccurrences} times instead of once. ` +
               `This indicates echo duplication regression.\nResponse: ${result.concatenatedResponses}`);
        }
        expect(commandOccurrences).toBe(1);

        // Session cleanup handled by test framework
      }
    });

    test('should detect echo duplication in complex commands', async () => {
      const sessionName = 'echo-complex-test-session';
      
      for (const command of echoRegressionTests.complexCommands) {
        const testConfig = {
          preWebSocketCommands: [
            `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
          ],
          postWebSocketCommands: [
            { initiator: 'browser' as const, command }
          ],
          workflowTimeout: 30000,
          sessionName
        };

        const result = await testUtils.runTerminalHistoryTest(testConfig);
        
        // Test: Command should appear exactly once
        const commandOccurrences = result.concatenatedResponses
          .split('\n')
          .filter(line => line.trim() === command.trim())
          .length;

        // Complex command echo duplication regression detection
        if (commandOccurrences !== 1) {
          fail(`Complex command "${command}" appears ${commandOccurrences} times instead of once. ` +
               `This indicates echo duplication regression.\nResponse: ${result.concatenatedResponses}`);
        }
        expect(commandOccurrences).toBe(1);

        // Session cleanup handled by test framework
      }
    });
  });

  /**
   * AC 3.2: Cross-command-type echo validation
   * Comprehensive echo regression test coverage across all command categories
   */
  describe('AC 3.2: Cross-Command-Type Echo Validation', () => {
    test('should validate echo behavior consistency across all command types', async () => {
      const sessionName = 'cross-command-validation-session';
      
      // Test all command types in sequence to validate consistency
      const allCommands = [
        'pwd',           // basic
        'ls -la',        // file operations  
        'grep root /etc/passwd | head -1', // text processing
        'ps aux | head -3',  // system
        'find /tmp -name "*.tmp" -maxdepth 1 | wc -l' // complex
      ];

      const testConfig = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: allCommands.map(command => ({ 
          initiator: 'browser' as const, 
          command 
        })),
        workflowTimeout: 60000,
        sessionName
      };

      const result = await testUtils.runTerminalHistoryTest(testConfig);
      
      // Test: Each command should appear exactly once
      for (const command of allCommands) {
        const commandOccurrences = result.concatenatedResponses
          .split('\n')
          .filter(line => line.trim() === command.trim())
          .length;

        // Cross-type validation echo behavior inconsistency detection
        if (commandOccurrences !== 1) {
          fail(`Cross-type validation: Command "${command}" appears ${commandOccurrences} times instead of once. ` +
               `Echo behavior inconsistency detected.\nFull response: ${result.concatenatedResponses}`);
        }
        expect(commandOccurrences).toBe(1);
      }

      // Session cleanup handled by test framework
    });

    test('should cause immediate build failure on echo regression', async () => {
      // This test validates that the test suite itself will cause CI/CD build failure
      // by using a deliberately failing assertion when echo duplication is detected
      
      const sessionName = 'build-failure-validation-session';
      const testCommand = 'whoami';

      const testConfig = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: testCommand }
        ],
        workflowTimeout: 30000,
        sessionName
      };

      const result = await testUtils.runTerminalHistoryTest(testConfig);
      
      const commandOccurrences = result.concatenatedResponses
        .split('\n')
        .filter(line => line.trim() === testCommand.trim())
        .length;

      // Test: This assertion will fail in CI/CD if echo regression exists
      // causing immediate build failure as required by AC 3.2
      if (commandOccurrences > 1) {
        fail(
          `CRITICAL ECHO REGRESSION DETECTED: Command "${testCommand}" appears ${commandOccurrences} times. ` +
          `This will cause CI/CD build failure. Deployment blocked until regression resolved.`
        );
      }

      // Echo regression validation: Command should appear exactly once
      expect(commandOccurrences).toBe(1);

      // Session cleanup handled by test framework
    });
  });

  /**
   * AC 3.3: Protocol-specific echo regression detection  
   * Validates browser vs MCP command execution paths
   */
  describe('AC 3.3: Protocol-Specific Echo Regression Detection', () => {
    test('should validate browser commands display exactly once via WebSocket', async () => {
      const sessionName = 'protocol-browser-test-session';
      const testCommands = ['pwd', 'whoami', 'date'];

      for (const command of testCommands) {
        const testConfig = {
          preWebSocketCommands: [
            `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
          ],
          postWebSocketCommands: [
            { initiator: 'browser' as const, command }
          ],
          workflowTimeout: 30000,
          sessionName
        };

        const result = await testUtils.runTerminalHistoryTest(testConfig);
        
        // Test: Browser command via WebSocket terminal_input should display exactly once
        const commandOccurrences = result.concatenatedResponses
          .split('\n')
          .filter(line => line.trim() === command.trim())
          .length;

        // Browser command WebSocket protocol-specific regression detection
        if (commandOccurrences !== 1) {
          fail(`Browser command "${command}" via WebSocket displays ${commandOccurrences} times instead of once. ` +
               `Protocol-specific regression detected in WebSocket terminal_input path.`);
        }
        expect(commandOccurrences).toBe(1);

        // Test: Response should contain WebSocket-specific indicators
        expect(result.concatenatedResponses).toContain('\r\n');

        // Session cleanup handled by test framework
      }
    });

    test('should validate MCP commands display exactly once via JSON-RPC', async () => {
      const sessionName = 'protocol-mcp-test-session';
      const testCommands = ['pwd', 'whoami', 'date'];

      for (const command of testCommands) {
        const testConfig = {
          preWebSocketCommands: [
            `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
          ],
          postWebSocketCommands: [
            `ssh_exec {"sessionName": "${sessionName}", "command": "${command}"}`
          ],
          workflowTimeout: 30000,
          sessionName
        };

        const result = await testUtils.runTerminalHistoryTest(testConfig);
        
        // Test: MCP command via JSON-RPC stdin should display exactly once
        const commandOccurrences = result.concatenatedResponses
          .split('\n')
          .filter(line => line.trim() === command.trim())
          .length;

        // MCP command JSON-RPC protocol-specific regression detection
        if (commandOccurrences !== 1) {
          fail(`MCP command "${command}" via JSON-RPC displays ${commandOccurrences} times instead of once. ` +
               `Protocol-specific regression detected in JSON-RPC stdin path.`);
        }
        expect(commandOccurrences).toBe(1);

        // Session cleanup handled by test framework
      }
    });

    test('should validate mixed protocol sequences maintain correct echo display', async () => {
      const sessionName = 'mixed-protocol-test-session';

      const testConfig = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'pwd' },        // WebSocket
          `ssh_exec {"sessionName": "${sessionName}", "command": "whoami"}`, // JSON-RPC
          { initiator: 'browser' as const, command: 'date' },        // WebSocket
          `ssh_exec {"sessionName": "${sessionName}", "command": "hostname"}` // JSON-RPC
        ],
        workflowTimeout: 60000,
        sessionName
      };

      const result = await testUtils.runTerminalHistoryTest(testConfig);
      
      // Test: Each command should appear exactly once regardless of protocol
      const commands = ['pwd', 'whoami', 'date', 'hostname'];
      
      for (const command of commands) {
        const commandOccurrences = result.concatenatedResponses
          .split('\n')
          .filter(line => line.trim() === command.trim())
          .length;

        // Mixed protocol command transition echo artifacts detection
        if (commandOccurrences !== 1) {
          fail(`Mixed protocol command "${command}" appears ${commandOccurrences} times instead of once. ` +
               `Protocol transition introduces echo artifacts.`);
        }
        expect(commandOccurrences).toBe(1);
      }

      // Session cleanup handled by test framework
    });

    test('should detect protocol transitions dont introduce echo artifacts', async () => {
      const sessionName = 'protocol-transition-test-session';

      // Test multiple protocol transitions to ensure no echo artifacts
      const testConfig = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'echo browser1' },
          `ssh_exec {"sessionName": "${sessionName}", "command": "echo mcp1"}`,
          { initiator: 'browser' as const, command: 'echo browser2' },
          `ssh_exec {"sessionName": "${sessionName}", "command": "echo mcp2"}`,
          { initiator: 'browser' as const, command: 'echo browser3' }
        ],
        workflowTimeout: 60000,
        sessionName
      };

      const result = await testUtils.runTerminalHistoryTest(testConfig);
      
      // Test: No echo artifacts should be introduced by protocol transitions
      const responseLines = result.concatenatedResponses.split('\n');
      
      // Check for unexpected duplicate echo patterns at transition points
      const echoCommands = ['echo browser1', 'echo mcp1', 'echo browser2', 'echo mcp2', 'echo browser3'];
      
      for (const command of echoCommands) {
        const commandOccurrences = responseLines
          .filter(line => line.trim() === command.trim())
          .length;

        // Protocol transition artifacts detection
        if (commandOccurrences !== 1) {
          fail(`Protocol transition artifact: Command "${command}" appears ${commandOccurrences} times. ` +
               `Echo artifacts detected during protocol transitions.`);
        }
        expect(commandOccurrences).toBe(1);
      }

      // Test: Echo fix should remain effective for browser commands specifically
      const browserCommands = ['echo browser1', 'echo browser2', 'echo browser3'];
      for (const browserCommand of browserCommands) {
        const occurrences = responseLines
          .filter(line => line.trim() === browserCommand.trim())
          .length;

        // Browser command echo fix effectiveness detection
        if (occurrences !== 1) {
          fail(`Browser command "${browserCommand}" echo fix not effective: appears ${occurrences} times`);
        }
        expect(occurrences).toBe(1);
      }

      // Session cleanup handled by test framework
    });

    test('should validate echo fix remains effective for browser commands only', async () => {
      // This test specifically validates that echo fixes apply to browser commands
      // while preserving normal behavior for MCP commands
      
      const browserSessionName = 'echo-fix-browser-session';
      const mcpSessionName = 'echo-fix-mcp-session';

      // Test browser command echo behavior
      const browserTestConfig = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${browserSessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'echo test-browser-echo-fix' }
        ],
        workflowTimeout: 30000,
        sessionName: browserSessionName
      };

      const browserResult = await testUtils.runTerminalHistoryTest(browserTestConfig);
      
      // Test MCP command echo behavior
      const mcpTestConfig = {
        preWebSocketCommands: [
          `ssh_connect {"name": "${mcpSessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
        ],
        postWebSocketCommands: [
          `ssh_exec {"sessionName": "${mcpSessionName}", "command": "echo test-mcp-normal-behavior"}`
        ],
        workflowTimeout: 30000,
        sessionName: mcpSessionName
      };

      const mcpResult = await testUtils.runTerminalHistoryTest(mcpTestConfig);
      
      // Test: Browser commands should have echo fix applied (single occurrence)
      const browserCommandOccurrences = browserResult.concatenatedResponses
        .split('\n')
        .filter(line => line.trim() === 'echo test-browser-echo-fix')
        .length;

      // Echo fix effectiveness for browser commands
      if (browserCommandOccurrences !== 1) {
        fail(`Echo fix not effective: Browser command appears ${browserCommandOccurrences} times instead of once`);
      }
      expect(browserCommandOccurrences).toBe(1);

      // Test: MCP commands should maintain normal behavior (single occurrence)
      const mcpCommandOccurrences = mcpResult.concatenatedResponses
        .split('\n')
        .filter(line => line.trim() === 'echo test-mcp-normal-behavior')
        .length;

      // MCP command behavior validation
      if (mcpCommandOccurrences !== 1) {
        fail(`MCP command behavior altered: Command appears ${mcpCommandOccurrences} times instead of once`);
      }
      expect(mcpCommandOccurrences).toBe(1);

      // Session cleanup handled by test framework
      // Session cleanup handled by test framework
    });
  });
});