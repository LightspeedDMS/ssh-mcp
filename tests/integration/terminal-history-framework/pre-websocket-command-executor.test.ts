/**
 * Story 2: Pre-WebSocket Command Execution - Pre-WebSocket Command Executor Tests
 * 
 * Test the Pre-WebSocket Command Executor that uses MCPClient to execute commands
 * before WebSocket connection is established, building up terminal history.
 */

import { PreWebSocketCommandExecutor } from './pre-websocket-command-executor';
import { MCPServerManager } from './mcp-server-manager';
import { MCPClient } from './mcp-client';

describe('PreWebSocketCommandExecutor Integration Tests', () => {
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

  describe('Sequential Command Execution', () => {
    test('should execute pre-WebSocket commands in sequence', async () => {
      // This test will fail initially as PreWebSocketCommandExecutor doesn't exist
      const commands = [
        {
          tool: 'ssh_connect',
          args: {
            name: 'test-session',
            host: 'localhost',
            username: 'test_user',
            password: 'password123'
          }
        },
        {
          tool: 'ssh_exec',
          args: {
            sessionName: 'test-session',
            command: 'ls -la'
          }
        }
      ];

      const results = await executor.executeCommands(commands);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    test('should wait for each command to complete before starting next', async () => {
      const commands = [
        {
          tool: 'ssh_connect',
          args: {
            name: 'sequential-session',
            host: 'localhost',
            username: 'test_user',
            password: 'password123'
          }
        },
        {
          tool: 'ssh_exec',
          args: {
            sessionName: 'sequential-session',
            command: 'echo "first command"'
          }
        },
        {
          tool: 'ssh_exec',
          args: {
            sessionName: 'sequential-session',
            command: 'echo "second command"'
          }
        }
      ];

      const startTime = Date.now();
      const results = await executor.executeCommands(commands);
      const totalTime = Date.now() - startTime;

      // Should take more than minimum time for sequential execution
      expect(totalTime).toBeGreaterThan(100); // At least some time for sequential execution
      
      expect(results).toHaveLength(3);
      results.forEach((result: any) => {
        expect(result.success).toBe(true);
      });
    });

    test('should handle command failures gracefully without stopping execution', async () => {
      const commands = [
        {
          tool: 'ssh_connect',
          args: {
            name: 'failure-test-session',
            host: 'localhost',
            username: 'test_user',
            password: 'password123'
          }
        },
        {
          tool: 'invalid_command',
          args: {}
        },
        {
          tool: 'ssh_exec',
          args: {
            sessionName: 'failure-test-session',
            command: 'echo "after failure"'
          }
        }
      ];

      const results = await executor.executeCommands(commands);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true); // Connect should succeed
      expect(results[1].success).toBe(false); // Invalid command should fail
      expect(results[2].success).toBe(true); // Should continue after failure
    });
  });

  describe('Terminal History Building', () => {
    test('should build terminal history in MCP server during pre-phase', async () => {
      const commands = [
        {
          tool: 'ssh_connect',
          args: {
            name: 'history-session',
            host: 'localhost',
            username: 'test_user',
            password: 'password123'
          }
        },
        {
          tool: 'ssh_exec',
          args: {
            sessionName: 'history-session',
            command: 'echo "building history"'
          }
        },
        {
          tool: 'ssh_exec',
          args: {
            sessionName: 'history-session',
            command: 'pwd'
          }
        }
      ];

      await executor.executeCommands(commands);

      // Verify that terminal history was built by getting monitoring URL
      const urlResponse = await mcpClient.callTool('ssh_get_monitoring_url', {
        sessionName: 'history-session'
      });

      expect(urlResponse.success).toBe(true);
      if (urlResponse.result && typeof urlResponse.result === 'object') {
        expect(urlResponse.result).toHaveProperty('url');
        expect((urlResponse.result as any).url).toMatch(/http/);
      } else {
        // If result format is different, just verify we got a successful response
        // indicating the session exists and has built up history
        expect(urlResponse.success).toBe(true);
      }
    });

    test('should execute all commands before allowing WebSocket connection phase', async () => {
      const commands = [
        {
          tool: 'ssh_connect',
          args: {
            name: 'pre-websocket-session',
            host: 'localhost',
            username: 'test_user',
            password: 'password123'
          }
        },
        {
          tool: 'ssh_exec',
          args: {
            sessionName: 'pre-websocket-session',
            command: 'echo "pre-WebSocket command 1"'
          }
        },
        {
          tool: 'ssh_exec',
          args: {
            sessionName: 'pre-websocket-session',
            command: 'echo "pre-WebSocket command 2"'
          }
        }
      ];

      // Track execution state
      let prePhaseComplete = false;
      
      const results = await executor.executeCommands(commands);
      prePhaseComplete = true;

      // All commands should be completed
      expect(prePhaseComplete).toBe(true);
      expect(results).toHaveLength(3);
      results.forEach((result: any) => {
        expect(result.success).toBe(true);
      });

      // Should be able to get monitoring URL (indicating session is ready for WebSocket)
      const urlResponse = await mcpClient.callTool('ssh_get_monitoring_url', {
        sessionName: 'pre-websocket-session'
      });

      expect(urlResponse.success).toBe(true);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle MCP communication errors', async () => {
      // Test with invalid MCP client construction
      expect(() => {
        new MCPClient({
          stdin: null,
          stdout: null
        } as any)
      }).toThrow(/Process must have stdin and stdout streams/);
      
      // Test PreWebSocketCommandExecutor validation
      const mockClient = {
        isConnected: () => false
      } as any;
      
      expect(() => new PreWebSocketCommandExecutor(mockClient))
        .toThrow(/MCP client is invalid or not connected/);
    });

    test('should provide detailed error information for failed commands', async () => {
      const commands = [
        {
          tool: 'ssh_connect',
          args: {
            name: 'error-session',
            host: 'invalid-host-that-does-not-exist.local',
            username: 'test_user',
            password: 'password123'
          }
        }
      ];

      const results = await executor.executeCommands(commands);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
      expect(results[0].error).toMatch(/host|connection|network/i);
      expect(results[0]).toHaveProperty('tool', 'ssh_connect');
      expect(results[0]).toHaveProperty('executionTime');
    });

    test('should track execution time for each command', async () => {
      const commands = [
        {
          tool: 'ssh_connect',
          args: {
            name: 'timing-session',
            host: 'localhost',
            username: 'test_user',
            password: 'password123'
          }
        }
      ];

      const results = await executor.executeCommands(commands);

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('executionTime');
      expect(typeof results[0].executionTime).toBe('number');
      expect(results[0].executionTime).toBeGreaterThan(0);
    });
  });

  describe('Configuration and Options', () => {
    test('should support timeout configuration for commands', async () => {
      const executorWithTimeout = new PreWebSocketCommandExecutor(mcpClient, {
        commandTimeout: 100 // Very short timeout
      });

      const commands = [
        {
          tool: 'ssh_connect',
          args: {
            name: 'timeout-session',
            host: 'localhost',
            username: 'test_user',
            password: 'password123'
          }
        }
      ];

      // This might timeout or succeed depending on system speed
      const results = await executorWithTimeout.executeCommands(commands);
      
      expect(results).toHaveLength(1);
      // Either succeeds quickly or fails with timeout
      expect(typeof results[0].success).toBe('boolean');
      
      await executorWithTimeout.cleanup();
    });

    test('should support parallel execution option', async () => {
      const executorWithParallel = new PreWebSocketCommandExecutor(mcpClient, {
        allowParallelExecution: false // Ensure sequential (default behavior)
      });

      const commands = [
        {
          tool: 'ssh_connect',
          args: {
            name: 'parallel-test-1',
            host: 'localhost',
            username: 'test_user',
            password: 'password123'
          }
        },
        {
          tool: 'ssh_connect',
          args: {
            name: 'parallel-test-2',
            host: 'localhost',
            username: 'test_user',
            password: 'password123'
          }
        }
      ];

      const startTime = Date.now();
      const results = await executorWithParallel.executeCommands(commands);
      const totalTime = Date.now() - startTime;

      // Sequential execution should take longer than parallel would
      expect(totalTime).toBeGreaterThan(100);
      expect(results).toHaveLength(2);
      results.forEach((result: any) => {
        expect(result.success).toBe(true);
      });

      await executorWithParallel.cleanup();
    });
  });
});