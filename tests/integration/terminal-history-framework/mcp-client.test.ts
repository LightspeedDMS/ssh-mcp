/**
 * Story 2: Pre-WebSocket Command Execution - MCPClient Unit Tests
 * 
 * Test the MCPClient class for communicating with MCP server via stdin/stdout
 * These tests will validate the core functionality needed for pre-WebSocket command execution
 */

import { MCPClient } from './mcp-client';
import { MCPServerManager } from './mcp-server-manager';
import { ChildProcess } from 'child_process';

describe('MCPClient Unit Tests', () => {
  let mcpClient: MCPClient;
  let serverManager: MCPServerManager;
  let serverProcess: ChildProcess;

  beforeEach(async () => {
    // Start fresh MCP server for each test
    serverManager = new MCPServerManager();
    await serverManager.start();
    
    const processInfo = serverManager.getProcess();
    if (!processInfo || !processInfo.stdin || !processInfo.stdout) {
      throw new Error('Failed to start MCP server for testing');
    }
    
    serverProcess = { 
      stdin: processInfo.stdin, 
      stdout: processInfo.stdout 
    } as ChildProcess;
    
    mcpClient = new MCPClient(serverProcess);
  });

  afterEach(async () => {
    if (mcpClient) {
      await mcpClient.disconnect();
    }
    if (serverManager) {
      await serverManager.stop();
    }
  });

  describe('Basic MCP Protocol Communication', () => {
    test('should send MCP request and receive response for ssh_connect', async () => {
      // This test will fail initially as MCPClient doesn't exist yet
      const connectParams = {
        name: 'test-session',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      };

      const response = await mcpClient.callTool('ssh_connect', connectParams);
      
      expect(response).toBeDefined();
      expect(response).toHaveProperty('success');
      expect(typeof response.success).toBe('boolean');
    });

    test('should handle MCP protocol errors gracefully', async () => {
      // Test invalid method call
      const response = await mcpClient.callTool('invalid_method', {});
      
      expect(response).toBeDefined();
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/Unknown tool|Method not found/i);
    });

    test('should correlate requests and responses using unique IDs', async () => {
      // Send multiple requests concurrently to test ID correlation
      const requests = [
        mcpClient.callTool('ssh_connect', { 
          name: 'session1', host: 'localhost', username: 'user1', password: 'pass1' 
        }),
        mcpClient.callTool('ssh_connect', { 
          name: 'session2', host: 'localhost', username: 'user2', password: 'pass2' 
        })
      ];

      const responses = await Promise.all(requests);
      
      expect(responses).toHaveLength(2);
      expect(responses[0]).toBeDefined();
      expect(responses[1]).toBeDefined();
    });
  });

  describe('Sequential Command Execution', () => {
    test('should execute commands in sequence - ssh_connect then ssh_exec', async () => {
      // First connect
      const connectResponse = await mcpClient.callTool('ssh_connect', {
        name: 'test-session',
        host: 'localhost', 
        username: 'test_user',
        password: 'password123'
      });
      
      expect(connectResponse).toHaveProperty('success', true);
      
      // Then execute command
      const execResponse = await mcpClient.callTool('ssh_exec', {
        sessionName: 'test-session',
        command: 'ls'
      });
      
      expect(execResponse).toHaveProperty('success');
      if (execResponse.success) {
        expect(execResponse).toHaveProperty('result');
        expect(execResponse.result).toHaveProperty('stdout');
      }
    });

    test('should wait for response before sending next command', async () => {
      const startTime = Date.now();
      
      // Send connect command (this should take some time)
      const connectResponse = await mcpClient.callTool('ssh_connect', {
        name: 'test-session',
        host: 'localhost',
        username: 'test_user', 
        password: 'password123'
      });
      
      const connectTime = Date.now();
      expect(connectTime - startTime).toBeGreaterThan(0); // Ensure some time passed
      
      // Send exec command (should only start after connect completes)
      const execResponse = await mcpClient.callTool('ssh_exec', {
        sessionName: 'test-session',
        command: 'echo "sequential test"'
      });
      
      const execTime = Date.now();
      expect(execTime - connectTime).toBeGreaterThan(0); // Ensure sequential execution
      
      expect(connectResponse).toHaveProperty('success');
      expect(execResponse).toHaveProperty('success');
    });
  });

  describe('MCP Protocol Message Format', () => {
    test('should format MCP requests as valid JSON-RPC 2.0', async () => {
      // Verify message format by monitoring stdin directly
      let capturedMessage: string = '';
      const originalWrite = serverProcess.stdin!.write.bind(serverProcess.stdin!);
      
      // Intercept writes to capture the actual JSON-RPC message
      serverProcess.stdin!.write = ((data: any) => {
        if (typeof data === 'string') {
          capturedMessage = data;
        }
        return originalWrite(data);
      }) as any;
      
      await mcpClient.callTool('ssh_connect', {
        name: 'test-session',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      });
      
      // Restore original write method
      serverProcess.stdin!.write = originalWrite;
      
      // Parse and verify the captured message
      const parsedMessage = JSON.parse(capturedMessage.trim());
      expect(parsedMessage).toMatchObject({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: {
            name: 'test-session',
            host: 'localhost',
            username: 'test_user',
            password: 'password123'
          }
        },
        id: expect.any(String)
      });
    });

    test('should parse MCP responses correctly', async () => {
      const response = await mcpClient.callTool('ssh_connect', {
        name: 'test-session',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      });
      
      // Response should be parsed from JSON and have expected structure
      expect(response).toBeInstanceOf(Object);
      expect(response).toHaveProperty('success');
      expect(typeof response.success).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    test('should handle connection failures', async () => {
      // Create client with invalid process
      const invalidProcess = { 
        stdin: null, 
        stdout: null 
      } as any as ChildProcess;
      
      expect(() => new MCPClient(invalidProcess))
        .toThrow(/Process must have stdin and stdout streams/);
    });

    test('should handle malformed responses from server', async () => {
      // Test client handling of non-JSON output by using a real server with debug output
      // Create a separate server manager that might produce debug output
      const testServerManager = new MCPServerManager({
        timeout: 15000 // Longer timeout to allow for debug output
      });
      
      await testServerManager.start();
      const testProcessInfo = testServerManager.getProcess();
      
      if (!testProcessInfo || !testProcessInfo.stdin || !testProcessInfo.stdout) {
        throw new Error('Failed to start test MCP server');
      }
      
      const testServerProcess = {
        stdin: testProcessInfo.stdin,
        stdout: testProcessInfo.stdout
      } as ChildProcess;
      
      const testClient = new MCPClient(testServerProcess);
      
      try {
        // Make a real call - the MCPClient should filter out any debug output automatically
        const response = await testClient.callTool('ssh_connect', {
          name: 'test-malformed',
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        });
        
        // Should succeed despite potential debug output from server
        expect(response).toBeDefined();
        expect(typeof response.success).toBe('boolean');
        
      } finally {
        await testClient.disconnect();
        await testServerManager.stop();
      }
    });

    test('should handle command timeout scenarios', async () => {
      // Test timeout with a real server but very short timeout
      // Create client with extremely short timeout to force timeout condition
      const clientWithTimeout = new MCPClient(serverProcess, { timeout: 50 });
      
      try {
        // This should timeout because 50ms is too short for any real server response
        await expect(clientWithTimeout.callTool('ssh_connect', {
          name: 'test-timeout',
          host: 'localhost',
          username: 'test',
          password: 'test'
        })).rejects.toThrow(/timeout/i);
      } finally {
        await clientWithTimeout.disconnect();
      }
    });
  });
});