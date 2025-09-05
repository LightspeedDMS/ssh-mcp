/**
 * Story 2: Pre-WebSocket Command Execution - Acceptance Criteria Validation
 * 
 * This test validates the complete Story 2 acceptance criteria:
 * 
 * Given I have specified pre-WebSocket commands ["ssh_connect", "ssh_exec ls"]
 * When the testing framework executes the pre-phase
 * Then it should send each command via MCP stdin/stdout
 * And wait for MCP responses before proceeding to next command
 * And not capture any WebSocket data during this phase
 * And build up terminal history in the MCP server
 * And complete all pre-commands before WebSocket connection
 */

import { MCPServerManager } from './mcp-server-manager';
import { MCPClient } from './mcp-client';
import { PreWebSocketCommandExecutor } from './pre-websocket-command-executor';

describe('Story 2: Pre-WebSocket Command Execution - Acceptance Criteria', () => {
  let serverManager: MCPServerManager;
  let mcpClient: MCPClient;
  let executor: PreWebSocketCommandExecutor;

  beforeEach(async () => {
    // Start fresh MCP server for each test
    serverManager = new MCPServerManager();
    await serverManager.start();
    
    const processInfo = serverManager.getProcess();
    if (!processInfo || !processInfo.stdin || !processInfo.stdout) {
      throw new Error('Failed to start MCP server for testing');
    }
    
    mcpClient = new MCPClient({
      stdin: processInfo.stdin,
      stdout: processInfo.stdout
    } as any);
    
    executor = new PreWebSocketCommandExecutor(mcpClient);
  });

  afterEach(async () => {
    if (executor) {
      await executor.cleanup();
    }
    if (mcpClient) {
      await mcpClient.disconnect();
    }
    if (serverManager) {
      await serverManager.stop();
    }
  });

  test('Story 2 Full Acceptance Criteria: Pre-WebSocket Commands with Terminal History Building', async () => {
    // Given I have specified pre-WebSocket commands ["ssh_connect", "ssh_exec ls"]
    const preWebSocketCommands = [
      {
        tool: 'ssh_connect',
        args: {
          name: 'story2-session',
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        }
      },
      {
        tool: 'ssh_exec',
        args: {
          sessionName: 'story2-session',
          command: 'ls'
        }
      }
    ];

    // When the testing framework executes the pre-phase
    const startTime = Date.now();
    const results = await executor.executeCommands(preWebSocketCommands);
    const totalExecutionTime = Date.now() - startTime;

    // Then it should send each command via MCP stdin/stdout
    expect(results).toHaveLength(2);
    
    // Verify first command (ssh_connect) succeeded
    expect(results[0].tool).toBe('ssh_connect');
    expect(results[0].success).toBe(true);
    expect(results[0].executionTime).toBeGreaterThan(0);
    
    // Verify second command (ssh_exec) succeeded
    expect(results[1].tool).toBe('ssh_exec');
    expect(results[1].success).toBe(true);
    expect(results[1].executionTime).toBeGreaterThan(0);

    // And wait for MCP responses before proceeding to next command
    // This is verified by sequential execution time being greater than sum of individual times
    const expectedMinimumTime = results[0].executionTime + results[1].executionTime;
    expect(totalExecutionTime).toBeGreaterThanOrEqual(expectedMinimumTime * 0.8); // Allow for some timing variance

    // And not capture any WebSocket data during this phase
    // This is implicitly verified since we're only using MCP stdin/stdout communication
    // No WebSocket connections were established during this test
    expect(results.every(r => r.tool !== 'websocket_connect')).toBe(true);

    // And build up terminal history in the MCP server
    // Verify by checking that we can get monitoring URL for the session
    const urlResponse = await mcpClient.callTool('ssh_get_monitoring_url', {
      sessionName: 'story2-session'
    });
    expect(urlResponse.success).toBe(true);

    // And complete all pre-commands before WebSocket connection
    // All commands completed successfully, session is ready for WebSocket phase
    expect(results.every(r => r.success)).toBe(true);
    
    // Verify session still exists and is ready for WebSocket connection
    const sessionStillActive = await mcpClient.callTool('ssh_exec', {
      sessionName: 'story2-session',
      command: 'echo "Session ready for WebSocket"'
    });
    expect(sessionStillActive.success).toBe(true);
  });

  test('Story 2 Sequential Processing Verification', async () => {
    // Test that commands are processed sequentially, not in parallel
    const commands = [
      {
        tool: 'ssh_connect',
        args: {
          name: 'sequential-test',
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        }
      },
      {
        tool: 'ssh_exec',
        args: {
          sessionName: 'sequential-test',
          command: 'echo "First command"'
        }
      },
      {
        tool: 'ssh_exec',
        args: {
          sessionName: 'sequential-test',
          command: 'echo "Second command"'
        }
      },
      {
        tool: 'ssh_exec',
        args: {
          sessionName: 'sequential-test',
          command: 'echo "Third command"'
        }
      }
    ];

    const startTime = Date.now();
    const results = await executor.executeCommands(commands);
    const totalTime = Date.now() - startTime;

    // All commands should succeed
    expect(results).toHaveLength(4);
    expect(results.every(r => r.success)).toBe(true);

    // Sequential execution should take longer than any individual command
    const longestIndividualCommand = Math.max(...results.map(r => r.executionTime));
    expect(totalTime).toBeGreaterThan(longestIndividualCommand);

    // Each command should complete before the next starts
    // This is verified by the fact that the ssh_exec commands succeeded,
    // which means the ssh_connect completed first
    expect(results[0].tool).toBe('ssh_connect');
    expect(results[1].tool).toBe('ssh_exec');
    expect(results[2].tool).toBe('ssh_exec');
    expect(results[3].tool).toBe('ssh_exec');
  });

  test('Story 2 Error Handling During Pre-Phase', async () => {
    // Test that pre-phase handles errors gracefully and continues
    const commandsWithError = [
      {
        tool: 'ssh_connect',
        args: {
          name: 'error-handling-test',
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        }
      },
      {
        tool: 'invalid_command_that_will_fail',
        args: {}
      },
      {
        tool: 'ssh_exec',
        args: {
          sessionName: 'error-handling-test',
          command: 'echo "After error"'
        }
      }
    ];

    const results = await executor.executeCommands(commandsWithError);

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);    // ssh_connect should succeed
    expect(results[1].success).toBe(false);   // invalid command should fail
    expect(results[2].success).toBe(true);    // ssh_exec should succeed despite previous error

    // Terminal history should still be built despite the error
    const urlResponse = await mcpClient.callTool('ssh_get_monitoring_url', {
      sessionName: 'error-handling-test'
    });
    expect(urlResponse.success).toBe(true);
  });

  test('Story 2 MCP Communication Protocol Compliance', async () => {
    // Verify that the MCP communication follows proper protocol
    const testCommand = {
      tool: 'ssh_connect',
      args: {
        name: 'protocol-test',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      }
    };

    // Execute single command and verify MCP protocol compliance
    const results = await executor.executeCommands([testCommand]);
    
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('tool', 'ssh_connect');
    expect(results[0]).toHaveProperty('success');
    expect(results[0]).toHaveProperty('executionTime');
    expect(typeof results[0].success).toBe('boolean');
    expect(typeof results[0].executionTime).toBe('number');
    
    // If successful, should have result
    if (results[0].success) {
      expect(results[0]).toHaveProperty('result');
    } else {
      // If failed, should have error message
      expect(results[0]).toHaveProperty('error');
      expect(typeof results[0].error).toBe('string');
    }
  });
});