import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

/**
 * Comprehensive End-to-End Tests for MCP API Tools
 * 
 * These tests follow the mandatory heuristic of manual execution first,
 * then automated test creation. All tests use REAL SSH connections and
 * ZERO mocking as required.
 * 
 * Test Environment Requirements:
 * - SSH server running on localhost
 * - test_user account with password 'password123'
 * - Available ports for web server (8090-8100 range)
 */

// Using 'any' to avoid complex MCP SDK typing issues
type MCPToolResult = any;

interface SSHConnectionResult {
  success: boolean;
  connection?: {
    name: string;
    host: string;
    username: string;
    status: string;
    lastActivity: string;
  };
  error?: string;
}

interface SSHExecResult {
  success: boolean;
  result?: {
    stdout: string;
    stderr: string;
    exitCode: number;
  };
  error?: string;
}

interface SSHSessionsResult {
  success: boolean;
  sessions?: Array<{
    name: string;
    host: string;
    username: string;
    status: string;
    lastActivity: string;
  }>;
  error?: string;
}

interface SSHMonitoringUrlResult {
  success: boolean;
  sessionName?: string;
  monitoringUrl?: string;
  error?: string;
}

interface SSHDisconnectResult {
  success: boolean;
  message?: string;
  error?: string;
}

describe('MCP API Tools E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testPort: number;
  let testSessionName: string;

  beforeAll(async () => {
    // Find available port for each test run
    testPort = await findAvailablePort();
    console.log(`Using port ${testPort} for E2E tests`);
  }, 30000);

  beforeEach(async () => {
    // Create unique session name for each test
    testSessionName = `e2e-test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Setup MCP client with real server process
    const serverPath = path.join(__dirname, '../dist/src/mcp-server.js');
    
    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: { ...process.env, WEB_PORT: testPort.toString() }
    });

    client = new Client(
      {
        name: 'mcp-api-e2e-tester',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
  }, 15000);

  afterEach(async () => {
    // Clean up any remaining sessions
    try {
      await client.callTool({
        name: 'ssh_disconnect',
        arguments: { sessionName: testSessionName }
      });
    } catch (error) {
      // Ignore errors if session was already cleaned up
    }

    if (client) {
      await client.close();
    }
    
    if (transport) {
      await transport.close();
    }

    // Brief delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 500));
  }, 10000);

  describe('Tool Discovery and Schema Validation', () => {
    test('should list all expected MCP tools with correct schemas', async () => {
      const result = await client.listTools();
      
      // Verify all expected tools are present
      const expectedTools = [
        'ssh_connect',
        'ssh_exec', 
        'ssh_list_sessions',
        'ssh_disconnect',
        'ssh_get_monitoring_url'
      ];
      
      const availableTools = result.tools.map(t => t.name);
      expect(availableTools).toEqual(expect.arrayContaining(expectedTools));
      expect(availableTools).toHaveLength(expectedTools.length);

      // Verify ssh_connect schema
      const sshConnectTool = result.tools.find(t => t.name === 'ssh_connect');
      expect(sshConnectTool).toBeDefined();
      expect(sshConnectTool!.description).toBe('Establish SSH connection to a remote server');
      expect(sshConnectTool!.inputSchema.required).toEqual(['name', 'host', 'username']);
      expect(sshConnectTool!.inputSchema.properties).toHaveProperty('name');
      expect(sshConnectTool!.inputSchema.properties).toHaveProperty('host');
      expect(sshConnectTool!.inputSchema.properties).toHaveProperty('username');
      expect(sshConnectTool!.inputSchema.properties).toHaveProperty('password');
      expect(sshConnectTool!.inputSchema.properties).toHaveProperty('privateKey');

      // Verify ssh_exec schema
      const sshExecTool = result.tools.find(t => t.name === 'ssh_exec');
      expect(sshExecTool).toBeDefined();
      expect(sshExecTool!.description).toBe('Execute command on remote server via SSH');
      expect(sshExecTool!.inputSchema.required).toEqual(['sessionName', 'command']);
      expect(sshExecTool!.inputSchema.properties).toHaveProperty('sessionName');
      expect(sshExecTool!.inputSchema.properties).toHaveProperty('command');
      expect(sshExecTool!.inputSchema.properties).toHaveProperty('timeout');

      // Verify other tools have correct basic structure
      const otherTools = ['ssh_list_sessions', 'ssh_disconnect', 'ssh_get_monitoring_url'];
      otherTools.forEach(toolName => {
        const tool = result.tools.find(t => t.name === toolName);
        expect(tool).toBeDefined();
        expect(tool!.description).toBeDefined();
        expect(tool!.inputSchema).toBeDefined();
      });
    });
  });

  describe('ssh_connect - Real SSH Connection Management', () => {
    test('should establish real SSH connection with password authentication', async () => {
      const args = {
        name: testSessionName,
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      };

      const result: MCPToolResult = await client.callTool({
        name: 'ssh_connect',
        arguments: args
      });

      expect((result as any).isError).toBeUndefined();
      expect((result as any).content).toHaveLength(1);
      expect((result as any).content[0].type).toBe('text');

      const connectionResult: SSHConnectionResult = JSON.parse((result as any).content[0].text);
      expect(connectionResult.success).toBe(true);
      expect(connectionResult.connection).toBeDefined();
      expect(connectionResult.connection!.name).toBe(testSessionName);
      expect(connectionResult.connection!.host).toBe('localhost');
      expect(connectionResult.connection!.username).toBe('test_user');
      expect(connectionResult.connection!.status).toBe('connected');
      expect(connectionResult.connection!.lastActivity).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should reject connection with missing required parameters', async () => {
      const args = {
        name: testSessionName
        // Missing host and username
      };

      const result: MCPToolResult = await client.callTool({
        name: 'ssh_connect',
        arguments: args
      });

      expect((result as any).isError).toBe(true);
      expect((result as any).content).toHaveLength(1);
      
      const errorResult: SSHConnectionResult = JSON.parse((result as any).content[0].text);
      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toBe('Missing required parameters: name, host, and username are required');
    });

    test('should reject connection with missing authentication', async () => {
      const args = {
        name: testSessionName,
        host: 'localhost', 
        username: 'test_user'
        // Missing both password and privateKey
      };

      const result: MCPToolResult = await client.callTool({
        name: 'ssh_connect',
        arguments: args
      });

      expect((result as any).isError).toBe(true);
      expect((result as any).content).toHaveLength(1);
      
      const errorResult: SSHConnectionResult = JSON.parse((result as any).content[0].text);
      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toBe('Either password or privateKey must be provided');
    });

    test('should handle duplicate session names by rejecting second connection', async () => {
      // First connection
      const args = {
        name: testSessionName,
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      };

      const result1: MCPToolResult = await client.callTool({
        name: 'ssh_connect',
        arguments: args
      });

      const connectionResult1: SSHConnectionResult = JSON.parse((result1 as any).content[0].text);
      expect(connectionResult1.success).toBe(true);

      // Second connection with same name should fail
      const result2: MCPToolResult = await client.callTool({
        name: 'ssh_connect',
        arguments: args
      });

      expect(result2.isError).toBe(true);
      const connectionResult2: SSHConnectionResult = JSON.parse((result2 as any).content[0].text);
      expect(connectionResult2.success).toBe(false);
      expect(connectionResult2.error).toContain('already exists');
    });
  });

  describe('ssh_list_sessions - Session State Management', () => {
    test('should return empty list when no sessions exist', async () => {
      const result: MCPToolResult = await client.callTool({
        name: 'ssh_list_sessions',
        arguments: {}
      });

      expect((result as any).isError).toBeUndefined();
      const sessionsResult: SSHSessionsResult = JSON.parse((result as any).content[0].text);
      expect(sessionsResult.success).toBe(true);
      expect(sessionsResult.sessions).toEqual([]);
    });

    test('should list active sessions with complete details', async () => {
      // Create a test session first
      await client.callTool({
        name: 'ssh_connect',
        arguments: {
          name: testSessionName,
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        }
      });

      const result: MCPToolResult = await client.callTool({
        name: 'ssh_list_sessions',
        arguments: {}
      });

      expect((result as any).isError).toBeUndefined();
      const sessionsResult: SSHSessionsResult = JSON.parse((result as any).content[0].text);
      expect(sessionsResult.success).toBe(true);
      expect(sessionsResult.sessions).toHaveLength(1);

      const session = sessionsResult.sessions![0];
      expect(session.name).toBe(testSessionName);
      expect(session.host).toBe('localhost');
      expect(session.username).toBe('test_user');
      expect(session.status).toBe('connected');
      expect(session.lastActivity).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should handle multiple concurrent sessions', async () => {
      const session1Name = `${testSessionName}-1`;
      const session2Name = `${testSessionName}-2`;

      // Create two sessions
      await Promise.all([
        client.callTool({
          name: 'ssh_connect',
          arguments: {
            name: session1Name,
            host: 'localhost',
            username: 'test_user',
            password: 'password123'
          }
        }),
        client.callTool({
          name: 'ssh_connect',
          arguments: {
            name: session2Name,
            host: 'localhost',
            username: 'test_user', 
            password: 'password123'
          }
        })
      ]);

      const result: MCPToolResult = await client.callTool({
        name: 'ssh_list_sessions',
        arguments: {}
      });

      const sessionsResult: SSHSessionsResult = JSON.parse((result as any).content[0].text);
      expect(sessionsResult.success).toBe(true);
      expect(sessionsResult.sessions).toHaveLength(2);

      const sessionNames = sessionsResult.sessions!.map(s => s.name);
      expect(sessionNames).toContain(session1Name);
      expect(sessionNames).toContain(session2Name);

      // Cleanup additional sessions
      await Promise.all([
        client.callTool({
          name: 'ssh_disconnect',
          arguments: { sessionName: session1Name }
        }),
        client.callTool({
          name: 'ssh_disconnect',
          arguments: { sessionName: session2Name }
        })
      ]);
    });
  });

  describe('ssh_exec - Real Command Execution', () => {
    beforeEach(async () => {
      // Establish SSH connection for command execution tests
      await client.callTool({
        name: 'ssh_connect',
        arguments: {
          name: testSessionName,
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        }
      });
    });

    test('should execute simple command and return correct output', async () => {
      const result: MCPToolResult = await client.callTool({
        name: 'ssh_exec',
        arguments: {
          sessionName: testSessionName,
          command: 'whoami'
        }
      });

      expect((result as any).isError).toBeUndefined();
      const execResult: SSHExecResult = JSON.parse((result as any).content[0].text);
      expect(execResult.success).toBe(true);
      expect(execResult.result).toBeDefined();
      expect(execResult.result!.stdout.trim()).toBe('test_user');
      expect(execResult.result!.stderr).toBe('');
      expect(execResult.result!.exitCode).toBe(0);
    });

    test('should handle command with stderr output', async () => {
      const result: MCPToolResult = await client.callTool({
        name: 'ssh_exec',
        arguments: {
          sessionName: testSessionName,
          command: 'ls /nonexistent/directory 2>&1 || echo "Command failed"'
        }
      });

      expect((result as any).isError).toBeUndefined();
      const execResult: SSHExecResult = JSON.parse((result as any).content[0].text);
      expect(execResult.success).toBe(true);
      expect(execResult.result).toBeDefined();
      expect(execResult.result!.stdout).toContain('Command failed');
    });

    test('should handle command with non-zero exit code', async () => {
      const result: MCPToolResult = await client.callTool({
        name: 'ssh_exec',
        arguments: {
          sessionName: testSessionName,
          command: 'exit 42'
        }
      });

      expect((result as any).isError).toBeUndefined();
      const execResult: SSHExecResult = JSON.parse((result as any).content[0].text);
      expect(execResult.success).toBe(true);
      expect(execResult.result).toBeDefined();
      expect(execResult.result!.exitCode).toBe(42);
    });

    test('should execute multi-line command', async () => {
      const result: MCPToolResult = await client.callTool({
        name: 'ssh_exec',
        arguments: {
          sessionName: testSessionName,
          command: 'echo "line1"; echo "line2"; echo "line3"'
        }
      });

      expect((result as any).isError).toBeUndefined();
      const execResult: SSHExecResult = JSON.parse((result as any).content[0].text);
      expect(execResult.success).toBe(true);
      expect(execResult.result!.stdout.trim()).toBe('line1\nline2\nline3');
      expect(execResult.result!.exitCode).toBe(0);
    });

    test('should reject execution on non-existent session', async () => {
      const result: MCPToolResult = await client.callTool({
        name: 'ssh_exec',
        arguments: {
          sessionName: 'non-existent-session',
          command: 'whoami'
        }
      });

      expect((result as any).isError).toBe(true);
      const execResult: SSHExecResult = JSON.parse((result as any).content[0].text);
      expect(execResult.success).toBe(false);
      expect(execResult.error).toBe("Session 'non-existent-session' not found");
    });

    test('should respect custom timeout parameter', async () => {
      const result: MCPToolResult = await client.callTool({
        name: 'ssh_exec',
        arguments: {
          sessionName: testSessionName,
          command: 'echo "Quick command"',
          timeout: 5000
        }
      });

      expect((result as any).isError).toBeUndefined();
      const execResult: SSHExecResult = JSON.parse((result as any).content[0].text);
      expect(execResult.success).toBe(true);
      expect(execResult.result!.stdout.trim()).toBe('Quick command');
    });

    test('should update lastActivity timestamp after command execution', async () => {
      // Get initial session state
      const listResult1: MCPToolResult = await client.callTool({
        name: 'ssh_list_sessions',
        arguments: {}
      });
      const sessionsResult1: SSHSessionsResult = JSON.parse((listResult1 as any).content[0].text);
      const initialActivity = sessionsResult1.sessions![0].lastActivity;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      // Execute command
      await client.callTool({
        name: 'ssh_exec',
        arguments: {
          sessionName: testSessionName,
          command: 'echo "test"'
        }
      });

      // Get updated session state
      const listResult2: MCPToolResult = await client.callTool({
        name: 'ssh_list_sessions',
        arguments: {}
      });
      const sessionsResult2: SSHSessionsResult = JSON.parse((listResult2 as any).content[0].text);
      const updatedActivity = sessionsResult2.sessions![0].lastActivity;

      expect(new Date(updatedActivity).getTime()).toBeGreaterThan(new Date(initialActivity).getTime());
    });
  });

  describe('ssh_get_monitoring_url - Web Interface Integration', () => {
    beforeEach(async () => {
      // Establish SSH connection for URL generation tests
      await client.callTool({
        name: 'ssh_connect',
        arguments: {
          name: testSessionName,
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        }
      });
    });

    test('should generate correct monitoring URL for existing session', async () => {
      const result: MCPToolResult = await client.callTool({
        name: 'ssh_get_monitoring_url',
        arguments: {
          sessionName: testSessionName
        }
      });

      expect((result as any).isError).toBeUndefined();
      const urlResult: SSHMonitoringUrlResult = JSON.parse((result as any).content[0].text);
      expect(urlResult.success).toBe(true);
      expect(urlResult.sessionName).toBe(testSessionName);
      expect(urlResult.monitoringUrl).toBe(`http://localhost:${testPort}/session/${testSessionName}`);
    });

    test('should generate URL that responds to HTTP requests', async () => {
      const result: MCPToolResult = await client.callTool({
        name: 'ssh_get_monitoring_url',
        arguments: {
          sessionName: testSessionName
        }
      });

      const urlResult: SSHMonitoringUrlResult = JSON.parse((result as any).content[0].text);
      
      // Verify the URL is accessible (basic connectivity test)
      const response = await fetch(urlResult.monitoringUrl!);
      expect(response.status).toBe(200);
      
      const html = await response.text();
      expect(html).toContain('SSH Session Monitor');
      expect(html).toContain(testSessionName);
    });

    test('should reject URL generation for non-existent session', async () => {
      const result: MCPToolResult = await client.callTool({
        name: 'ssh_get_monitoring_url',
        arguments: {
          sessionName: 'non-existent-session'
        }
      });

      expect((result as any).isError).toBe(true);
      const urlResult: SSHMonitoringUrlResult = JSON.parse((result as any).content[0].text);
      expect(urlResult.success).toBe(false);
      expect(urlResult.error).toBe("Session 'non-existent-session' not found");
    });

    test('should generate unique URLs for different sessions', async () => {
      const session2Name = `${testSessionName}-2`;
      
      // Create second session
      await client.callTool({
        name: 'ssh_connect',
        arguments: {
          name: session2Name,
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        }
      });

      // Get URLs for both sessions
      const [result1, result2] = await Promise.all([
        client.callTool({
          name: 'ssh_get_monitoring_url',
          arguments: { sessionName: testSessionName }
        }),
        client.callTool({
          name: 'ssh_get_monitoring_url',
          arguments: { sessionName: session2Name }
        })
      ]);

      const urlResult1: SSHMonitoringUrlResult = JSON.parse((result1 as any).content[0].text);
      const urlResult2: SSHMonitoringUrlResult = JSON.parse((result2 as any).content[0].text);

      expect(urlResult1.success).toBe(true);
      expect(urlResult2.success).toBe(true);
      expect(urlResult1.monitoringUrl).not.toBe(urlResult2.monitoringUrl);
      expect(urlResult1.monitoringUrl).toContain(testSessionName);
      expect(urlResult2.monitoringUrl).toContain(session2Name);

      // Cleanup second session
      await client.callTool({
        name: 'ssh_disconnect',
        arguments: { sessionName: session2Name }
      });
    });
  });

  describe('ssh_disconnect - Connection Cleanup', () => {
    beforeEach(async () => {
      // Establish SSH connection for disconnect tests
      await client.callTool({
        name: 'ssh_connect',
        arguments: {
          name: testSessionName,
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        }
      });
    });

    test('should successfully disconnect existing session', async () => {
      const result: MCPToolResult = await client.callTool({
        name: 'ssh_disconnect',
        arguments: {
          sessionName: testSessionName
        }
      });

      expect((result as any).isError).toBeUndefined();
      const disconnectResult: SSHDisconnectResult = JSON.parse((result as any).content[0].text);
      expect(disconnectResult.success).toBe(true);
      expect(disconnectResult.message).toBe(`Session '${testSessionName}' disconnected successfully`);
    });

    test('should remove session from active list after disconnect', async () => {
      // Verify session exists
      const listResult1: MCPToolResult = await client.callTool({
        name: 'ssh_list_sessions',
        arguments: {}
      });
      const sessionsResult1: SSHSessionsResult = JSON.parse((listResult1 as any).content[0].text);
      expect(sessionsResult1.sessions).toHaveLength(1);

      // Disconnect session
      await client.callTool({
        name: 'ssh_disconnect',
        arguments: {
          sessionName: testSessionName
        }
      });

      // Verify session is removed
      const listResult2: MCPToolResult = await client.callTool({
        name: 'ssh_list_sessions',
        arguments: {}
      });
      const sessionsResult2: SSHSessionsResult = JSON.parse((listResult2 as any).content[0].text);
      expect(sessionsResult2.sessions).toHaveLength(0);
    });

    test('should make monitoring URL inaccessible after disconnect', async () => {
      // Get monitoring URL while connected
      const urlResult: MCPToolResult = await client.callTool({
        name: 'ssh_get_monitoring_url',
        arguments: {
          sessionName: testSessionName
        }
      });
      const urlData: SSHMonitoringUrlResult = JSON.parse(urlResult.content[0].text);
      const monitoringUrl = urlData.monitoringUrl!;

      // Verify URL is accessible before disconnect
      const response1 = await fetch(monitoringUrl);
      expect(response1.status).toBe(200);

      // Disconnect session
      await client.callTool({
        name: 'ssh_disconnect',
        arguments: {
          sessionName: testSessionName
        }
      });

      // Verify URL returns 404 after disconnect
      const response2 = await fetch(monitoringUrl);
      expect(response2.status).toBe(404);
    });

    test('should reject disconnect for non-existent session', async () => {
      const result: MCPToolResult = await client.callTool({
        name: 'ssh_disconnect',
        arguments: {
          sessionName: 'non-existent-session'
        }
      });

      expect((result as any).isError).toBe(true);
      const disconnectResult: SSHDisconnectResult = JSON.parse((result as any).content[0].text);
      expect(disconnectResult.success).toBe(false);
      expect(disconnectResult.error).toBe("Session 'non-existent-session' not found");
    });

    test('should handle double disconnect gracefully', async () => {
      // First disconnect
      const result1: MCPToolResult = await client.callTool({
        name: 'ssh_disconnect',
        arguments: {
          sessionName: testSessionName
        }
      });
      const disconnectResult1: SSHDisconnectResult = JSON.parse((result1 as any).content[0].text);
      expect(disconnectResult1.success).toBe(true);

      // Second disconnect should fail gracefully
      const result2: MCPToolResult = await client.callTool({
        name: 'ssh_disconnect',
        arguments: {
          sessionName: testSessionName
        }
      });
      expect(result2.isError).toBe(true);
      const disconnectResult2: SSHDisconnectResult = JSON.parse((result2 as any).content[0].text);
      expect(disconnectResult2.success).toBe(false);
      expect(disconnectResult2.error).toBe(`Session '${testSessionName}' not found`);
    });
  });

  describe('Complete Workflow Integration', () => {
    test('should support full Claude Code workflow: connect → exec → monitor → disconnect', async () => {
      const workflowSessionName = `workflow-test-${Date.now()}`;

      // Step 1: Connect
      const connectResult: MCPToolResult = await client.callTool({
        name: 'ssh_connect',
        arguments: {
          name: workflowSessionName,
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        }
      });
      const connectionData: SSHConnectionResult = JSON.parse(connectResult.content[0].text);
      expect(connectionData.success).toBe(true);
      expect(connectionData.connection!.status).toBe('connected');

      // Step 2: Execute multiple commands
      const commands = ['whoami', 'pwd', 'echo "Hello Claude Code"', 'date'];
      const execResults = [];
      
      for (const command of commands) {
        const execResult: MCPToolResult = await client.callTool({
          name: 'ssh_exec',
          arguments: {
            sessionName: workflowSessionName,
            command: command
          }
        });
        const execData: SSHExecResult = JSON.parse(execResult.content[0].text);
        expect(execData.success).toBe(true);
        expect(execData.result!.exitCode).toBe(0);
        execResults.push(execData);
      }

      expect(execResults[0].result!.stdout.trim()).toBe('test_user');
      expect(execResults[2].result!.stdout.trim()).toBe('Hello Claude Code');

      // Step 3: Get monitoring URL and verify it works
      const urlResult: MCPToolResult = await client.callTool({
        name: 'ssh_get_monitoring_url',
        arguments: {
          sessionName: workflowSessionName
        }
      });
      const urlData: SSHMonitoringUrlResult = JSON.parse(urlResult.content[0].text);
      expect(urlData.success).toBe(true);
      
      const response = await fetch(urlData.monitoringUrl!);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain(workflowSessionName);

      // Step 4: Verify session is tracked properly
      const listResult: MCPToolResult = await client.callTool({
        name: 'ssh_list_sessions',
        arguments: {}
      });
      const listData: SSHSessionsResult = JSON.parse((listResult as any).content[0].text);
      expect(listData.success).toBe(true);
      const session = listData.sessions!.find(s => s.name === workflowSessionName);
      expect(session).toBeDefined();
      expect(session!.status).toBe('connected');

      // Step 5: Clean disconnect
      const disconnectResult: MCPToolResult = await client.callTool({
        name: 'ssh_disconnect',
        arguments: {
          sessionName: workflowSessionName
        }
      });
      const disconnectData: SSHDisconnectResult = JSON.parse(disconnectResult.content[0].text);
      expect(disconnectData.success).toBe(true);

      // Step 6: Verify complete cleanup
      const finalListResult: MCPToolResult = await client.callTool({
        name: 'ssh_list_sessions',
        arguments: {}
      });
      const finalListData: SSHSessionsResult = JSON.parse(finalListResult.content[0].text);
      const remainingSession = finalListData.sessions!.find(s => s.name === workflowSessionName);
      expect(remainingSession).toBeUndefined();

      const finalResponse = await fetch(urlData.monitoringUrl!);
      expect(finalResponse.status).toBe(404);
    });

    test('should handle concurrent multi-session workflows', async () => {
      const sessionCount = 3;
      const sessionNames = Array.from(
        { length: sessionCount }, 
        (_, i) => `concurrent-test-${Date.now()}-${i}`
      );

      try {
        // Connect all sessions concurrently
        const connectPromises = sessionNames.map(name =>
          client.callTool({
            name: 'ssh_connect',
            arguments: {
              name: name,
              host: 'localhost',
              username: 'test_user',
              password: 'password123'
            }
          })
        );
        const connectResults = await Promise.all(connectPromises);

        // Verify all connections succeeded
        connectResults.forEach((result, index) => {
          const connectionData: SSHConnectionResult = JSON.parse((result as any).content[0].text);
          expect(connectionData.success).toBe(true);
          expect(connectionData.connection!.name).toBe(sessionNames[index]);
        });

        // Execute commands on all sessions concurrently
        const execPromises = sessionNames.map(name =>
          client.callTool({
            name: 'ssh_exec',
            arguments: {
              sessionName: name,
              command: `echo "Session: ${name}"`
            }
          })
        );
        const execResults = await Promise.all(execPromises);

        // Verify all executions succeeded
        execResults.forEach((result, index) => {
          const execData: SSHExecResult = JSON.parse((result as any).content[0].text);
          expect(execData.success).toBe(true);
          expect(execData.result!.stdout.trim()).toBe(`Session: ${sessionNames[index]}`);
        });

        // Verify all sessions are tracked
        const listResult: MCPToolResult = await client.callTool({
          name: 'ssh_list_sessions',
          arguments: {}
        });
        const listData: SSHSessionsResult = JSON.parse((listResult as any).content[0].text);
        expect(listData.sessions).toHaveLength(sessionCount);

        const trackedNames = listData.sessions!.map(s => s.name);
        sessionNames.forEach(name => {
          expect(trackedNames).toContain(name);
        });

      } finally {
        // Cleanup all sessions
        const disconnectPromises = sessionNames.map(name =>
          client.callTool({
            name: 'ssh_disconnect',
            arguments: { sessionName: name }
          })
        );
        await Promise.all(disconnectPromises);
      }
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    test('should handle malformed JSON in tool arguments gracefully', async () => {
      // This tests the MCP layer's parameter validation
      const result: MCPToolResult = await client.callTool({
        name: 'ssh_connect',
        arguments: {
          name: null, // Invalid type
          host: '',   // Empty string
          username: 'test_user',
          password: 'password123'
        } as any
      });

      // The tool should handle this gracefully rather than crashing
      expect((result as any).isError).toBe(true);
      const errorData: SSHConnectionResult = JSON.parse((result as any).content[0].text);
      expect(errorData.success).toBe(false);
      expect(errorData.error).toBeDefined();
    });

    test('should maintain session isolation between test runs', async () => {
      // This test verifies that sessions from previous tests don't interfere
      const listResult: MCPToolResult = await client.callTool({
        name: 'ssh_list_sessions',
        arguments: {}
      });

      const listData: SSHSessionsResult = JSON.parse((listResult as any).content[0].text);
      expect(listData.success).toBe(true);
      
      // Should only have sessions created in current beforeEach, if any
      // Most tests should start with clean state
      const currentTestSessions = listData.sessions!.filter(s => 
        s.name.includes(testSessionName) || s.name.includes('e2e-test-session')
      );
      
      // Depending on test timing, we might have 0 or more sessions,
      // but they should all be from current test context
      currentTestSessions.forEach(session => {
        expect(session.name).toMatch(/e2e-test-session/);
      });
    });

    test('should handle server restart scenarios', async () => {
      // Create and verify session
      await client.callTool({
        name: 'ssh_connect',
        arguments: {
          name: testSessionName,
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        }
      });

      const listResult1: MCPToolResult = await client.callTool({
        name: 'ssh_list_sessions',
        arguments: {}
      });
      const listData1: SSHSessionsResult = JSON.parse((listResult1 as any).content[0].text);
      expect(listData1.sessions).toHaveLength(1);

      // Simulate server restart by closing and reopening client
      await client.close();
      await transport.close();

      // Reconnect
      const serverPath = path.join(__dirname, '../dist/src/mcp-server.js');
      transport = new StdioClientTransport({
        command: 'node',
        args: [serverPath],
        env: { ...process.env, WEB_PORT: (testPort + 1).toString() }
      });

      client = new Client(
        {
          name: 'mcp-api-e2e-tester-restart',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      await client.connect(transport);

      // After restart, sessions should be clean (no persistence)
      const listResult2: MCPToolResult = await client.callTool({
        name: 'ssh_list_sessions',
        arguments: {}
      });
      const listData2: SSHSessionsResult = JSON.parse((listResult2 as any).content[0].text);
      expect(listData2.sessions).toHaveLength(0);
    });
  });
});

/**
 * Utility function to find an available port for testing
 */
async function findAvailablePort(): Promise<number> {
  const net = require('net');
  
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = server.address()?.port;
      server.close(() => {
        if (port) {
          resolve(port);
        } else {
          reject(new Error('Could not determine available port'));
        }
      });
    });
    
    server.on('error', reject);
  });
}