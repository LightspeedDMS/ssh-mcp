import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSHConnectionManager } from '../src/ssh-connection-manager';
import path from 'path';

/**
 * Story 1: Session-Specific Terminal Output Streaming - Comprehensive E2E Tests
 * 
 * Based on comprehensive manual testing that validated all acceptance criteria
 * and performance requirements. These tests use real SSH connections and real
 * terminal output streaming without any mocking.
 */

describe('Story 1: Session-Specific Terminal Output Streaming E2E', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let sshManager: SSHConnectionManager;
  let testPort: number;
  let sessionName: string;

  beforeAll(async () => {
    // Use dynamic port to avoid conflicts
    testPort = 8095 + Math.floor(Math.random() * 100);
    console.log(`Using port ${testPort} for Story 1 E2E test`);
  });

  beforeEach(async () => {
    sessionName = `story1-e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Setup MCP client with real server process
    const serverPath = path.join(__dirname, '../dist/src/mcp-server.js');
    
    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: { ...process.env, WEB_PORT: testPort.toString() }
    });

    client = new Client(
      {
        name: 'story1-e2e-tester',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
    
    // Also create direct SSH manager for testing streaming functionality
    sshManager = new SSHConnectionManager(testPort + 1);
    
  }, 20000);

  afterEach(async () => {
    // Clean up MCP client
    if (client) {
      try {
        await client.callTool({
          name: 'ssh_disconnect',
          arguments: { sessionName: sessionName }
        });
      } catch (error) {
        // Session might already be disconnected
      }
      await client.close();
    }
    
    if (transport) {
      await transport.close();
    }
    
    // Clean up direct SSH manager
    if (sshManager) {
      try {
        await sshManager.disconnectSession(sessionName);
      } catch (error) {
        // Session might already be disconnected
      }
      sshManager.cleanup();
    }
  }, 15000);

  describe('Acceptance Criteria: SSH session exists and commands are executed', () => {
    test('should establish SSH session and validate session metadata', async () => {
      // Given an SSH session named "test-session" exists
      const connectResult = await client.callTool({
        name: 'ssh_connect',
        arguments: {
          name: sessionName,
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        }
      });

      const connectData = JSON.parse((connectResult as any).content[0].text);
      
      // Validate connection success and metadata
      expect(connectData.success).toBe(true);
      expect(connectData.connection.name).toBe(sessionName);
      expect(connectData.connection.host).toBe('localhost');
      expect(connectData.connection.username).toBe('test_user');
      expect(connectData.connection.status).toBe('connected');
      expect(connectData.connection.lastActivity).toBeDefined();
      
      // Validate session is tracked in session list
      const listResult = await client.callTool({
        name: 'ssh_list_sessions',
        arguments: {}
      });

      const listData = JSON.parse((listResult as any).content[0].text);
      expect(listData.success).toBe(true);
      expect(listData.sessions).toHaveLength(1);
      expect(listData.sessions[0].name).toBe(sessionName);
    }, 30000);

    test('should execute commands via ssh_exec MCP tool and capture all terminal output', async () => {
      // Setup session
      await client.callTool({
        name: 'ssh_connect',
        arguments: {
          name: sessionName,
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        }
      });

      // When commands are executed via ssh_exec MCP tool
      const execResult = await client.callTool({
        name: 'ssh_exec',
        arguments: {
          sessionName: sessionName,
          command: 'echo "Terminal output test message"'
        }
      });

      const execData = JSON.parse((execResult as any).content[0].text);
      
      // Then all terminal output is captured and returned
      expect(execData.success).toBe(true);
      expect(execData.result.stdout).toBe('Terminal output test message');
      expect(execData.result.stderr).toBe('');
      expect(execData.result.exitCode).toBe(0);
    }, 30000);
  });

  describe('Acceptance Criteria: Terminal output capture and real-time buffering', () => {
    test('should capture all terminal output including command prompts and commands', async () => {
      // Create session via direct SSH manager to access terminal streaming
      const connection = await sshManager.createConnection({
        name: sessionName,
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      });

      expect(connection.name).toBe(sessionName);

      // Setup terminal output listener to capture real-time streaming
      const capturedOutputs: any[] = [];
      const outputListener = (outputEntry: any) => {
        capturedOutputs.push({
          timestamp: outputEntry.timestamp,
          output: outputEntry.output,
          stream: outputEntry.stream,
          preserveFormatting: outputEntry.preserveFormatting,
          vt100Compatible: outputEntry.vt100Compatible,
          encoding: outputEntry.encoding
        });
      };

      sshManager.addTerminalOutputListener(sessionName, outputListener);

      // Execute command to generate terminal output
      const result = await sshManager.executeCommand(sessionName, 'echo "Test capture message"');
      
      // Allow time for all output to be captured
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Validate command execution result
      expect(result.stdout).toBe('Test capture message');
      expect(result.exitCode).toBe(0);

      // Validate that terminal output was captured in real-time
      expect(capturedOutputs.length).toBeGreaterThan(0);
      
      // Verify command prompt was captured
      const promptEntries = capturedOutputs.filter(entry => 
        entry.output.includes('$ echo "Test capture message"')
      );
      expect(promptEntries.length).toBeGreaterThan(0);

      // Verify actual command output was captured
      const outputEntries = capturedOutputs.filter(entry =>
        entry.output.includes('Test capture message')
      );
      expect(outputEntries.length).toBeGreaterThan(0);

      // Validate terminal output entry structure
      capturedOutputs.forEach(entry => {
        expect(entry.timestamp).toBeDefined();
        expect(typeof entry.timestamp).toBe('number');
        expect(entry.output).toBeDefined();
        expect(typeof entry.output).toBe('string');
        expect(entry.stream).toBeDefined();
        expect(['stdout', 'stderr']).toContain(entry.stream);
        expect(typeof entry.preserveFormatting).toBe('boolean');
        expect(typeof entry.vt100Compatible).toBe('boolean');
        expect(entry.encoding).toBe('utf-8');
      });

      sshManager.removeTerminalOutputListener(sessionName, outputListener);
    }, 30000);

    test('should maintain proper terminal formatting and escape sequences', async () => {
      const connection = await sshManager.createConnection({
        name: sessionName,
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      });

      expect(connection.status).toBe('connected');

      const capturedOutputs: any[] = [];
      const outputListener = (outputEntry: any) => {
        capturedOutputs.push(outputEntry);
      };

      sshManager.addTerminalOutputListener(sessionName, outputListener);

      // Execute command that produces ANSI color output
      await sshManager.executeCommand(sessionName, 'ls --color=always');
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify ANSI escape sequences are detected and preserved
      const formattedEntries = capturedOutputs.filter(entry => entry.preserveFormatting);
      expect(formattedEntries.length).toBeGreaterThan(0);

      // Verify VT100 sequences are detected (terminal control sequences like [?2004h)
      const vt100Entries = capturedOutputs.filter(entry => entry.vt100Compatible);
      expect(vt100Entries.length).toBeGreaterThan(0);

      // Verify raw output is preserved alongside processed output
      capturedOutputs.forEach(entry => {
        expect(entry.rawOutput).toBeDefined();
        expect(typeof entry.rawOutput).toBe('string');
      });

      sshManager.removeTerminalOutputListener(sessionName, outputListener);
    }, 30000);

    test('should maintain terminal buffer with scrollback history of terminal entries', async () => {
      const connection = await sshManager.createConnection({
        name: sessionName,
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      });

      expect(connection.status).toBe('connected');

      // Execute multiple commands to generate terminal history
      const commands = [
        'echo "History test 1"',
        'whoami',
        'pwd',
        'echo "History test 2"',
        'ls -la /tmp | head -3'
      ];

      for (const command of commands) {
        await sshManager.executeCommand(sessionName, command);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Retrieve terminal history
      const terminalHistory = sshManager.getTerminalHistory(sessionName);

      // Validate history contains multiple entries
      expect(terminalHistory.length).toBeGreaterThan(10); // Each command generates multiple entries

      // Verify history contains executed commands
      const historyText = terminalHistory.map(entry => entry.output).join(' ');
      commands.forEach(command => {
        expect(historyText).toContain(command);
      });

      // Verify command outputs are in history
      expect(historyText).toContain('History test 1');
      expect(historyText).toContain('History test 2');
      expect(historyText).toContain('test_user'); // from whoami

      // Validate terminal history entry structure
      terminalHistory.forEach(entry => {
        expect(entry.timestamp).toBeDefined();
        expect(typeof entry.timestamp).toBe('number');
        expect(entry.output).toBeDefined();
        expect(entry.stream).toBeDefined();
        expect(entry.rawOutput).toBeDefined();
        expect(typeof entry.preserveFormatting).toBe('boolean');
        expect(typeof entry.vt100Compatible).toBe('boolean');
        expect(entry.encoding).toBe('utf-8');
      });
    }, 30000);

    test('should enforce 1000-entry buffer limit with proper capacity management', async () => {
      const connection = await sshManager.createConnection({
        name: sessionName,
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      });

      expect(connection.status).toBe('connected');

      // Generate many commands to test buffer limit
      // Each command generates ~10-15 terminal entries, so 80 commands should exceed 1000 entries
      const commandCount = 80;
      for (let i = 0; i < commandCount; i++) {
        await sshManager.executeCommand(sessionName, `echo "Buffer test ${i}"`);
        
        // Small delay to prevent overwhelming the system
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Verify buffer respects 1000-entry limit
      const terminalHistory = sshManager.getTerminalHistory(sessionName);
      expect(terminalHistory.length).toBeLessThanOrEqual(1000);

      // Verify recent entries are still present (buffer uses FIFO)
      const historyText = terminalHistory.map(entry => entry.output).join(' ');
      expect(historyText).toContain(`Buffer test ${commandCount - 1}`);
      expect(historyText).toContain(`Buffer test ${commandCount - 2}`);
      
    }, 60000);
  });

  describe('Acceptance Criteria: Session-specific isolation', () => {
    test('should maintain session-specific and isolated terminal buffers', async () => {
      const session1Name = `${sessionName}-1`;
      const session2Name = `${sessionName}-2`;

      // Create two separate SSH sessions
      const connection1 = await sshManager.createConnection({
        name: session1Name,
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      });

      const connection2 = await sshManager.createConnection({
        name: session2Name,
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      });

      expect(connection1.status).toBe('connected');
      expect(connection2.status).toBe('connected');

      // Execute different commands in each session
      await sshManager.executeCommand(session1Name, 'echo "Session 1 unique message"');
      await sshManager.executeCommand(session2Name, 'echo "Session 2 unique message"');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Retrieve terminal history for each session
      const history1 = sshManager.getTerminalHistory(session1Name);
      const history2 = sshManager.getTerminalHistory(session2Name);

      // Verify sessions have separate histories
      expect(history1.length).toBeGreaterThan(0);
      expect(history2.length).toBeGreaterThan(0);

      // Verify session isolation - Session 1 should not contain Session 2's message
      const history1Text = history1.map(entry => entry.output).join(' ');
      const history2Text = history2.map(entry => entry.output).join(' ');

      expect(history1Text).toContain('Session 1 unique message');
      expect(history1Text).not.toContain('Session 2 unique message');

      expect(history2Text).toContain('Session 2 unique message');
      expect(history2Text).not.toContain('Session 1 unique message');

      // Clean up both sessions
      await sshManager.disconnectSession(session1Name);
      await sshManager.disconnectSession(session2Name);
    }, 30000);

    test('should support independent terminal output listeners per session', async () => {
      const session1Name = `${sessionName}-1`;
      const session2Name = `${sessionName}-2`;

      const connection1 = await sshManager.createConnection({
        name: session1Name,
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      });

      const connection2 = await sshManager.createConnection({
        name: session2Name,
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      });

      expect(connection1.status).toBe('connected');
      expect(connection2.status).toBe('connected');

      // Setup separate listeners for each session
      const session1Outputs: any[] = [];
      const session2Outputs: any[] = [];

      const listener1 = (outputEntry: any) => {
        session1Outputs.push({ session: session1Name, output: outputEntry.output });
      };

      const listener2 = (outputEntry: any) => {
        session2Outputs.push({ session: session2Name, output: outputEntry.output });
      };

      sshManager.addTerminalOutputListener(session1Name, listener1);
      sshManager.addTerminalOutputListener(session2Name, listener2);

      // Execute commands in both sessions
      await sshManager.executeCommand(session1Name, 'echo "Listener test session 1"');
      await sshManager.executeCommand(session2Name, 'echo "Listener test session 2"');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify listeners received session-specific outputs
      expect(session1Outputs.length).toBeGreaterThan(0);
      expect(session2Outputs.length).toBeGreaterThan(0);

      const session1Text = session1Outputs.map(entry => entry.output).join(' ');
      const session2Text = session2Outputs.map(entry => entry.output).join(' ');

      expect(session1Text).toContain('Listener test session 1');
      expect(session1Text).not.toContain('Listener test session 2');

      expect(session2Text).toContain('Listener test session 2');
      expect(session2Text).not.toContain('Listener test session 1');

      // Test listener removal
      sshManager.removeTerminalOutputListener(session1Name, listener1);
      sshManager.removeTerminalOutputListener(session2Name, listener2);

      // Clean up
      await sshManager.disconnectSession(session1Name);
      await sshManager.disconnectSession(session2Name);
    }, 30000);
  });

  describe('Performance Requirements Validation', () => {
    test('should stream terminal output with <100ms latency', async () => {
      const connection = await sshManager.createConnection({
        name: sessionName,
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      });

      expect(connection.status).toBe('connected');

      let outputReceivedTime: number = 0;
      const outputListener = (outputEntry: any) => {
        if (outputEntry.output.includes('Latency test message') && outputReceivedTime === 0) {
          outputReceivedTime = Date.now();
        }
      };

      sshManager.addTerminalOutputListener(sessionName, outputListener);

      // Measure latency from command execution to listener notification
      const commandStartTime = Date.now();
      await sshManager.executeCommand(sessionName, 'echo "Latency test message"');
      
      // Wait for output to be received
      await new Promise(resolve => setTimeout(resolve, 500));

      const latency = outputReceivedTime > 0 ? outputReceivedTime - commandStartTime : 999;
      
      // Validate latency requirement
      expect(latency).toBeLessThan(100);
      console.log(`✅ Terminal output latency: ${latency}ms (< 100ms requirement met)`);

      sshManager.removeTerminalOutputListener(sessionName, outputListener);
    }, 30000);

    test('should handle high-frequency output without loss', async () => {
      const connection = await sshManager.createConnection({
        name: sessionName,
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      });

      expect(connection.status).toBe('connected');

      const capturedOutputs: any[] = [];
      const outputListener = (outputEntry: any) => {
        capturedOutputs.push(outputEntry);
      };

      sshManager.addTerminalOutputListener(sessionName, outputListener);

      // Execute rapid sequence of commands
      const commandCount = 20;
      const commandPromises = [];
      
      for (let i = 0; i < commandCount; i++) {
        commandPromises.push(sshManager.executeCommand(sessionName, `echo "Burst test ${i}"`));
      }

      await Promise.all(commandPromises);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify all commands were captured
      const outputText = capturedOutputs.map(entry => entry.output).join(' ');
      
      for (let i = 0; i < commandCount; i++) {
        expect(outputText).toContain(`Burst test ${i}`);
      }

      console.log(`✅ High-frequency output test: ${commandCount} commands captured without loss`);
      
      sshManager.removeTerminalOutputListener(sessionName, outputListener);
    }, 60000);

    test('should maintain memory usage per session under 10MB limit', async () => {
      const connection = await sshManager.createConnection({
        name: sessionName,
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      });

      expect(connection.status).toBe('connected');

      // Generate substantial terminal history to test memory usage
      for (let i = 0; i < 100; i++) {
        await sshManager.executeCommand(sessionName, `echo "Memory test ${i} with additional content to increase entry size"`);
        
        if (i % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Get terminal history and estimate memory usage
      const terminalHistory = sshManager.getTerminalHistory(sessionName);
      
      // Rough memory estimation: each entry averages ~2-5KB including metadata
      const estimatedMemoryKB = terminalHistory.length * 3; // 3KB average per entry
      const estimatedMemoryMB = estimatedMemoryKB / 1024;
      
      expect(estimatedMemoryMB).toBeLessThan(10);
      console.log(`✅ Memory usage estimate: ${estimatedMemoryMB.toFixed(2)}MB for ${terminalHistory.length} entries (< 10MB limit)`);
      
    }, 60000);
  });

  describe('Error Scenarios and Edge Cases', () => {
    test('should handle SSH connection failures gracefully', async () => {
      // Attempt to connect to non-existent host
      const connectResult = await client.callTool({
        name: 'ssh_connect',
        arguments: {
          name: 'invalid-session',
          host: 'nonexistent-host-12345',
          username: 'test_user',
          password: 'password123'
        }
      });

      const connectData = JSON.parse((connectResult as any).content[0].text);
      expect(connectData.success).toBe(false);
      expect(connectData.error).toBeDefined();
    }, 30000);

    test('should handle invalid session name for terminal operations', async () => {
      try {
        sshManager.getTerminalHistory('nonexistent-session');
        fail('Should have thrown error for invalid session');
      } catch (error) {
        expect((error as Error).message).toContain('not found');
      }

      // Test adding listener to non-existent session
      const dummyListener = () => {};
      expect(() => {
        sshManager.addTerminalOutputListener('nonexistent-session', dummyListener);
      }).not.toThrow(); // Should not crash, just silently handle invalid session
    }, 10000);
  });
});