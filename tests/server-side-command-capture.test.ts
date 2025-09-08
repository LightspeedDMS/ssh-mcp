/**
 * TDD Tests for Server-Side Command Capture Story
 * 
 * STORY REQUIREMENTS:
 * - Capture browser terminal commands server-side in SessionData buffer
 * - Maintain zero impact on user terminal experience  
 * - Support session isolation and complex commands
 * 
 * ACCEPTANCE CRITERIA:
 * 1. Basic Command Capture: `ls -la` captured in buffer, executes normally
 * 2. Multiple Command Sequence: Array of commands stored in execution order
 * 3. Complex Commands: Full pipeline commands captured exactly as typed
 * 4. Session Isolation: Commands separated per SSH session
 * 5. Buffer Persistence: Commands remain until explicitly cleared
 */

import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import { WebServerManager } from '../src/web-server-manager.js';
import { WebSocket } from 'ws';

describe('Server-Side Command Capture', () => {
  let sshManager: SSHConnectionManager;
  let webServerManager: WebServerManager;
  let webPort: number;
  const testSessionName = 'test-capture-session';

  beforeAll(async () => {
    sshManager = new SSHConnectionManager();
    webServerManager = new WebServerManager(sshManager);
    await webServerManager.start();
    webPort = await webServerManager.getPort();
  }, 30000);

  afterAll(async () => {
    await webServerManager.stop();
    sshManager.cleanup();
  });

  beforeEach(async () => {
    // Create fresh SSH session for each test
    try {
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '~/.ssh/id_ed25519'
      });
    } catch (error) {
      // Session may already exist from previous test - disconnect and recreate
      if (sshManager.hasSession(testSessionName)) {
        await sshManager.disconnectSession(testSessionName);
      }
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '~/.ssh/id_ed25519'
      });
    }
  }, 20000);

  afterEach(async () => {
    if (sshManager.hasSession(testSessionName)) {
      await sshManager.disconnectSession(testSessionName);
    }
  });

  describe('AC1: Basic Command Capture', () => {
    test('SHOULD capture ls -la command in browser command buffer', async () => {
      // ARRANGE: Set up WebSocket connection to simulate browser
      const wsUrl = `ws://localhost:${webPort}/ws/session/${testSessionName}`;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Wait for initial history replay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ACT: Send terminal input command via WebSocket (simulating browser user)
      const testCommand = 'ls -la';
      const commandId = `cmd-${Date.now()}`;
      
      ws.send(JSON.stringify({
        type: 'terminal_input',
        sessionName: testSessionName,
        command: testCommand,
        commandId: commandId
      }));

      // Wait for command execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      // ASSERT: Command should be captured in browser command buffer
      // This test will FAIL initially because browserCommandBuffer doesn't exist yet
      const capturedCommands = sshManager.getBrowserCommandBuffer(testSessionName);
      
      expect(capturedCommands).toBeDefined();
      expect(capturedCommands).toHaveLength(1);
      expect(capturedCommands[0]).toEqual({
        command: testCommand,
        commandId: commandId,
        timestamp: expect.any(Number),
        source: 'user',
        result: {
          stdout: expect.any(String),  // Should contain command output
          stderr: expect.any(String),
          exitCode: expect.any(Number)
        }
      });

      ws.close();
    }, 15000);

    test('SHOULD execute command normally while capturing', async () => {
      // ARRANGE: Set up WebSocket connection
      const wsUrl = `ws://localhost:${webPort}/ws/session/${testSessionName}`;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      let terminalOutput = '';
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_output') {
          terminalOutput += message.data;
        }
      });

      // ACT: Send command via WebSocket
      const testCommand = 'ls -la';
      const commandId = `cmd-${Date.now()}`;
      
      ws.send(JSON.stringify({
        type: 'terminal_input',
        sessionName: testSessionName,
        command: testCommand,
        commandId: commandId
      }));

      // Wait for command execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      // ASSERT: Command should execute normally (show directory listing)
      expect(terminalOutput).toContain('total');
      expect(terminalOutput).toContain('drwx'); // Directory permissions
      
      // AND command should be captured
      const capturedCommands = sshManager.getBrowserCommandBuffer(testSessionName);
      expect(capturedCommands).toHaveLength(1);
      expect(capturedCommands[0].command).toBe(testCommand);

      ws.close();
    }, 15000);
  });

  describe('AC2: Multiple Command Sequence', () => {
    test('SHOULD store array of commands in execution order', async () => {
      // ARRANGE: Set up WebSocket connection
      const wsUrl = `ws://localhost:${webPort}/ws/session/${testSessionName}`;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Wait for initial history replay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ACT: Send multiple commands in sequence
      const commands = ['pwd', 'whoami', 'date'];
      
      for (let i = 0; i < commands.length; i++) {
        const commandId = `cmd-${Date.now()}-${i}`;
        ws.send(JSON.stringify({
          type: 'terminal_input',
          sessionName: testSessionName,
          command: commands[i],
          commandId: commandId
        }));
        
        // Wait between commands to ensure proper sequencing
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // ASSERT: Commands should be stored in execution order
      // This test will FAIL initially because browserCommandBuffer doesn't exist yet
      const capturedCommands = sshManager.getBrowserCommandBuffer(testSessionName);
      
      expect(capturedCommands).toHaveLength(3);
      expect(capturedCommands[0].command).toBe('pwd');
      expect(capturedCommands[1].command).toBe('whoami');  
      expect(capturedCommands[2].command).toBe('date');
      
      // Verify chronological ordering by timestamp
      expect(capturedCommands[0].timestamp).toBeLessThan(capturedCommands[1].timestamp);
      expect(capturedCommands[1].timestamp).toBeLessThan(capturedCommands[2].timestamp);

      ws.close();
    }, 25000);
  });

  describe('AC3: Complex Commands', () => {
    test('SHOULD capture full pipeline commands exactly as typed', async () => {
      // ARRANGE: Set up WebSocket connection
      const wsUrl = `ws://localhost:${webPort}/ws/session/${testSessionName}`;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Wait for initial history replay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ACT: Send complex pipeline command
      const complexCommand = 'ls -la | grep -E "^d" | sort -k 9';
      const commandId = `cmd-${Date.now()}`;
      
      ws.send(JSON.stringify({
        type: 'terminal_input',
        sessionName: testSessionName,
        command: complexCommand,
        commandId: commandId
      }));

      // Wait for command execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      // ASSERT: Complex command should be captured exactly as typed
      // This test will FAIL initially because browserCommandBuffer doesn't exist yet
      const capturedCommands = sshManager.getBrowserCommandBuffer(testSessionName);
      
      expect(capturedCommands).toHaveLength(1);
      expect(capturedCommands[0].command).toBe(complexCommand);
      expect(capturedCommands[0].commandId).toBe(commandId);

      ws.close();
    }, 15000);

    test('SHOULD capture commands with special characters and quotes', async () => {
      // ARRANGE: Set up WebSocket connection
      const wsUrl = `ws://localhost:${webPort}/ws/session/${testSessionName}`;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Wait for initial history replay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ACT: Send command with special characters and quotes
      const specialCommand = 'echo "Hello World" && echo \'Single quotes\' | cat';
      const commandId = `cmd-${Date.now()}`;
      
      ws.send(JSON.stringify({
        type: 'terminal_input',
        sessionName: testSessionName,
        command: specialCommand,
        commandId: commandId
      }));

      // Wait for command execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      // ASSERT: Special command should be captured exactly as typed
      // This test will FAIL initially because browserCommandBuffer doesn't exist yet
      const capturedCommands = sshManager.getBrowserCommandBuffer(testSessionName);
      
      expect(capturedCommands).toHaveLength(1);
      expect(capturedCommands[0].command).toBe(specialCommand);

      ws.close();
    }, 15000);
  });

  describe('AC4: Session Isolation', () => {
    test('SHOULD separate commands by SSH session', async () => {
      // ARRANGE: Create second test session
      const secondSessionName = 'test-capture-session-2';
      
      await sshManager.createConnection({
        name: secondSessionName,
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '~/.ssh/id_ed25519'
      });

      // Set up WebSocket connections for both sessions
      const ws1 = new WebSocket(`ws://localhost:${webPort}/ws/session/${testSessionName}`);
      const ws2 = new WebSocket(`ws://localhost:${webPort}/ws/session/${secondSessionName}`);

      await Promise.all([
        new Promise((resolve, reject) => {
          ws1.on('open', resolve);
          ws1.on('error', reject);
        }),
        new Promise((resolve, reject) => {
          ws2.on('open', resolve);
          ws2.on('error', reject);
        })
      ]);

      // Wait for initial history replay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ACT: Send different commands to each session
      const command1 = 'pwd';
      const command2 = 'whoami';
      
      ws1.send(JSON.stringify({
        type: 'terminal_input',
        sessionName: testSessionName,
        command: command1,
        commandId: `cmd1-${Date.now()}`
      }));

      ws2.send(JSON.stringify({
        type: 'terminal_input',
        sessionName: secondSessionName,
        command: command2,
        commandId: `cmd2-${Date.now()}`
      }));

      // Wait for command execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      // ASSERT: Commands should be isolated per session
      // This test will FAIL initially because browserCommandBuffer doesn't exist yet
      const session1Commands = sshManager.getBrowserCommandBuffer(testSessionName);
      const session2Commands = sshManager.getBrowserCommandBuffer(secondSessionName);
      
      expect(session1Commands).toHaveLength(1);
      expect(session1Commands[0].command).toBe(command1);
      
      expect(session2Commands).toHaveLength(1);
      expect(session2Commands[0].command).toBe(command2);

      // Clean up second session
      ws1.close();
      ws2.close();
      await sshManager.disconnectSession(secondSessionName);
    }, 20000);
  });

  describe('AC5: Buffer Persistence', () => {
    test('SHOULD persist commands until explicitly cleared', async () => {
      // ARRANGE: Set up WebSocket connection
      const wsUrl = `ws://localhost:${webPort}/ws/session/${testSessionName}`;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Wait for initial history replay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ACT: Send command and close WebSocket connection
      const testCommand = 'ls -la';
      const commandId = `cmd-${Date.now()}`;
      
      ws.send(JSON.stringify({
        type: 'terminal_input',
        sessionName: testSessionName,
        command: testCommand,
        commandId: commandId
      }));

      // Wait for command execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      ws.close();
      
      // Wait for connection close
      await new Promise(resolve => setTimeout(resolve, 500));

      // ASSERT: Command should persist after WebSocket disconnection
      // This test will FAIL initially because browserCommandBuffer doesn't exist yet
      const capturedCommands = sshManager.getBrowserCommandBuffer(testSessionName);
      
      expect(capturedCommands).toBeDefined();
      expect(capturedCommands).toHaveLength(1);
      expect(capturedCommands[0].command).toBe(testCommand);
    }, 15000);

    test('SHOULD clear buffer only when explicitly requested', async () => {
      // ARRANGE: Add commands to buffer first
      const wsUrl = `ws://localhost:${webPort}/ws/session/${testSessionName}`;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Wait for initial history replay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Add some commands
      ws.send(JSON.stringify({
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'pwd',
        commandId: `cmd-${Date.now()}`
      }));

      await new Promise(resolve => setTimeout(resolve, 1500));

      ws.send(JSON.stringify({
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'whoami', 
        commandId: `cmd-${Date.now()}`
      }));

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify commands are captured
      let capturedCommands = sshManager.getBrowserCommandBuffer(testSessionName);
      expect(capturedCommands).toHaveLength(2);

      // ACT: Explicitly clear the buffer
      // This test will FAIL initially because clearBrowserCommandBuffer doesn't exist yet
      sshManager.clearBrowserCommandBuffer(testSessionName);

      // ASSERT: Buffer should be empty after explicit clear
      capturedCommands = sshManager.getBrowserCommandBuffer(testSessionName);
      expect(capturedCommands).toHaveLength(0);

      ws.close();
    }, 20000);
  });

  // CRITICAL ISSUE TESTS - Buffer Management
  describe('CRITICAL: Buffer Size Management', () => {
    test('SHOULD limit browserCommandBuffer to 500 entries (prevent unbounded growth)', async () => {
      // ARRANGE: Set up WebSocket connection
      const wsUrl = `ws://localhost:${webPort}/ws/session/${testSessionName}`;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Wait for initial history replay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ACT: Add 501 commands to exceed buffer limit
      console.log('Adding 501 commands to test buffer size limit...');
      for (let i = 0; i < 501; i++) {
        const commandId = `cmd-${Date.now()}-${i}`;
        ws.send(JSON.stringify({
          type: 'terminal_input',
          sessionName: testSessionName,
          command: `echo "Command ${i}"`,
          commandId: commandId
        }));
        
        // Small delay to ensure proper sequencing
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Wait for all commands to be processed
      await new Promise(resolve => setTimeout(resolve, 5000));

      // ASSERT: Buffer should contain only 500 entries (oldest removed)
      // This test will FAIL initially because buffer size limit doesn't exist yet
      const capturedCommands = sshManager.getBrowserCommandBuffer(testSessionName);
      
      expect(capturedCommands).toHaveLength(500);
      
      // Verify oldest command was removed (should start from command 1, not 0)
      expect(capturedCommands[0].command).toBe('echo "Command 1"');
      expect(capturedCommands[499].command).toBe('echo "Command 500"');

      ws.close();
    }, 60000);
  });

  describe('CRITICAL: Session Cleanup', () => {
    test('SHOULD clear browserCommandBuffer when session is disconnected', async () => {
      // ARRANGE: Set up WebSocket connection and add commands
      const wsUrl = `ws://localhost:${webPort}/ws/session/${testSessionName}`;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Wait for initial history replay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Add some commands to the buffer
      for (let i = 0; i < 5; i++) {
        const commandId = `cmd-${Date.now()}-${i}`;
        ws.send(JSON.stringify({
          type: 'terminal_input',
          sessionName: testSessionName,
          command: `echo "Test command ${i}"`,
          commandId: commandId
        }));
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Verify commands are in buffer
      let capturedCommands = sshManager.getBrowserCommandBuffer(testSessionName);
      expect(capturedCommands.length).toBeGreaterThan(0);
      console.log(`Commands in buffer before disconnect: ${capturedCommands.length}`);

      ws.close();
      await new Promise(resolve => setTimeout(resolve, 500));

      // ACT: Disconnect the SSH session (should trigger cleanup)
      await sshManager.disconnectSession(testSessionName);

      // ASSERT: browserCommandBuffer should be cleared
      // This test will FAIL initially because cleanup doesn't clear browserCommandBuffer
      try {
        const postDisconnectCommands = sshManager.getBrowserCommandBuffer(testSessionName);
        // This should either throw an error (session doesn't exist) or return empty array
        expect(postDisconnectCommands).toHaveLength(0);
      } catch (error) {
        // Session no longer exists is also acceptable - indicates proper cleanup
        expect((error as Error).message).toContain('Session');
      }
    }, 30000);
  });

});