/**
 * Story 5: Terminal State Synchronization - State Recovery and Error Handling Unit Tests
 * 
 * These tests validate state recovery after disconnect and error state handling
 * following strict TDD practices. All tests should initially fail.
 */

import { WebServerManager } from '../src/web-server-manager.js';
import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import WebSocket from 'ws';

describe('Story 5: Terminal State Recovery and Error Handling - Unit Tests', () => {
  let webServerManager: WebServerManager;
  let sshManager: SSHConnectionManager;
  let testSessionName: string;

  beforeEach(() => {
    sshManager = new SSHConnectionManager();
    webServerManager = new WebServerManager(sshManager);
    testSessionName = 'test-recovery-session';
  });

  afterEach(async () => {
    if (webServerManager) {
      await webServerManager.stop();
    }
    if (sshManager) {
      await sshManager.cleanup();
    }
  });

  // AC5.4: State Recovery After Disconnect
  describe('AC5.4: State Recovery After Disconnect', () => {
    test('should restore correct terminal lock state after reconnection', async () => {
      // This test should fail initially - state recovery not implemented
      await webServerManager.start();
      const port = await webServerManager.getPort();
      
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'testuser',
        password: 'testpass'
      });

      // First connection - send command and disconnect before completion
      let ws1 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws1.on('open', resolve));

      const lockCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'sleep 0.5 && echo "recovery test"',
        commandId: 'recovery-cmd-1',
        source: 'user'
      };

      ws1.send(JSON.stringify(lockCommand));
      
      // Wait a bit then disconnect while command is still running
      await new Promise(resolve => setTimeout(resolve, 100));
      ws1.close();

      // Reconnect and check state recovery
      await new Promise(resolve => setTimeout(resolve, 50));
      const ws2 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws2.on('open', resolve));

      let recoveredState: any = null;

      ws2.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state_recovery') {
          recoveredState = message;
        }
      });

      // Request state recovery
      ws2.send(JSON.stringify({
        type: 'request_state_recovery',
        sessionName: testSessionName
      }));

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should recover the locked state with correct command info
      expect(recoveredState).toBeTruthy();
      expect(recoveredState.isLocked).toBe(true);
      expect(recoveredState.commandId).toBe('recovery-cmd-1');
      expect(recoveredState.source).toBe('user');

      ws2.close();
    });

    test('should synchronize complete terminal history after reconnection', async () => {
      // This test should fail initially - history sync not implemented
      await webServerManager.start();
      const port = await webServerManager.getPort();
      
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'testuser',
        password: 'testpass'
      });

      // First connection - execute some commands
      const ws1 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws1.on('open', resolve));

      const commands = [
        'echo "command 1"',
        'echo "command 2"', 
        'echo "command 3"'
      ];

      for (let i = 0; i < commands.length; i++) {
        const cmd = {
          type: 'terminal_input',
          sessionName: testSessionName,
          command: commands[i],
          commandId: `history-cmd-${i+1}`,
          source: 'user'
        };
        
        ws1.send(JSON.stringify(cmd));
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Store terminal history count for comparison
      const initialHistory = sshManager.getTerminalHistory(testSessionName);
      const expectedHistoryCount = initialHistory.length;

      ws1.close();

      // Reconnect and check history synchronization
      await new Promise(resolve => setTimeout(resolve, 100));
      const ws2 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws2.on('open', resolve));

      let receivedHistory: any[] = [];

      ws2.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_history_sync') {
          receivedHistory.push(message);
        }
      });

      // Wait for automatic history sync
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have received complete history
      expect(receivedHistory.length).toBe(expectedHistoryCount);
      
      // History should contain all commands
      const historyContent = receivedHistory.map(h => h.data).join('');
      commands.forEach(cmd => {
        expect(historyContent).toContain(cmd.replace('echo ', '').replace(/"/g, ''));
      });

      ws2.close();
    });

    test('should handle reconnection during command execution gracefully', async () => {
      // This test should fail initially - graceful reconnection not implemented  
      await webServerManager.start();
      const port = await webServerManager.getPort();
      
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'testuser', 
        password: 'testpass'
      });

      const ws1 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws1.on('open', resolve));

      // Start a long-running command
      const longCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'sleep 1 && echo "long command complete"',
        commandId: 'long-cmd-1',
        source: 'user'
      };

      ws1.send(JSON.stringify(longCommand));
      await new Promise(resolve => setTimeout(resolve, 200)); // Let command start

      // Simulate network disconnection
      ws1.close();

      // Reconnect while command is still executing
      const ws2 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws2.on('open', resolve));

      let gracefulReconnection = false;
      let commandCompleted = false;

      ws2.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'graceful_reconnection') {
          gracefulReconnection = true;
        }
        if (message.type === 'terminal_output' && message.data.includes('long command complete')) {
          commandCompleted = true;
        }
      });

      // Wait for command to complete
      await new Promise(resolve => setTimeout(resolve, 900));

      // Should handle reconnection gracefully and complete the command
      expect(gracefulReconnection).toBe(true);
      expect(commandCompleted).toBe(true);

      ws2.close();
    });

    test('should preserve terminal state across server restarts', async () => {
      // This test should fail initially - persistent state not implemented
      await webServerManager.start();
      const port = await webServerManager.getPort();
      
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'testuser',
        password: 'testpass'
      });

      const ws1 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws1.on('open', resolve));

      // Execute command and capture state
      const stateCommand = {
        type: 'terminal_input', 
        sessionName: testSessionName,
        command: 'export TEST_VAR="persistent_value" && echo $TEST_VAR',
        commandId: 'state-cmd-1',
        source: 'user'
      };

      ws1.send(JSON.stringify(stateCommand));
      await new Promise(resolve => setTimeout(resolve, 100));

      ws1.close();

      // Stop and restart server (simulating restart)
      await webServerManager.stop();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      webServerManager = new WebServerManager(sshManager, { port });
      await webServerManager.start();

      // Reconnect and check state persistence
      const ws2 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws2.on('open', resolve));

      let statePreserved = false;

      ws2.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_output' && 
            message.data.includes('persistent_value')) {
          statePreserved = true;
        }
      });

      // Test if previous state is preserved
      const testCommand = {
        type: 'terminal_input',
        sessionName: testSessionName, 
        command: 'echo $TEST_VAR',
        commandId: 'state-test-cmd',
        source: 'user'
      };

      ws2.send(JSON.stringify(testCommand));
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should preserve terminal state across restarts
      expect(statePreserved).toBe(true);

      ws2.close();
    });
  });

  // AC5.5: Error State Handling  
  describe('AC5.5: Error State Handling', () => {
    test('should unlock terminal after user command errors', async () => {
      // This test should fail initially - error state handling not implemented
      await webServerManager.start();
      const port = await webServerManager.getPort();
      
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'testuser',
        password: 'testpass'
      });

      const ws = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws.on('open', resolve));

      let terminalUnlocked = false;
      let errorWithSource = false;

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state' && !message.isLocked) {
          terminalUnlocked = true;
        }
        if (message.type === 'error' && message.source === 'user') {
          errorWithSource = true;
        }
      });

      // Send command that will fail
      const errorCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'nonexistent_command_should_fail',
        commandId: 'error-cmd-1',
        source: 'user'
      };

      ws.send(JSON.stringify(errorCommand));

      await new Promise(resolve => setTimeout(resolve, 200));

      // Terminal should unlock after error and provide source identification
      expect(terminalUnlocked).toBe(true);
      expect(errorWithSource).toBe(true);

      ws.close();
    });

    test('should provide clear error output with source identification', async () => {
      // This test should fail initially - error source identification not implemented
      await webServerManager.start();
      const port = await webServerManager.getPort();
      
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'testuser',
        password: 'testpass'
      });

      const ws = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws.on('open', resolve));

      let userErrorReceived = false;
      let errorDetails: any = null;

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'command_error' && message.source === 'user') {
          userErrorReceived = true;
          errorDetails = message;
        }
      });

      // Send user command that produces error
      const badCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'ls /nonexistent_directory_xyz',
        commandId: 'error-source-cmd',
        source: 'user'
      };

      ws.send(JSON.stringify(badCommand));

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should receive error with proper source identification
      expect(userErrorReceived).toBe(true);
      expect(errorDetails).toBeTruthy();
      expect(errorDetails.source).toBe('user');
      expect(errorDetails.commandId).toBe('error-source-cmd');
      expect(errorDetails.errorMessage).toContain('No such file or directory');

      ws.close();
    });

    test('should handle WebSocket connection errors gracefully', async () => {
      // This test should fail initially - connection error handling not implemented
      await webServerManager.start();
      const port = await webServerManager.getPort();
      
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'testuser',
        password: 'testpass'
      });

      const ws = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws.on('open', resolve));

      let connectionErrorHandled = false;
      let gracefulRecovery = false;

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'connection_error_handled') {
          connectionErrorHandled = true;
        }
        if (message.type === 'graceful_recovery') {
          gracefulRecovery = true;
        }
      });

      // Send command then immediately close connection to simulate error
      const testCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "testing connection error"',
        commandId: 'conn-error-cmd',
        source: 'user'
      };

      ws.send(JSON.stringify(testCommand));
      
      // Simulate connection error
      ws.close();

      // Reconnect after error
      await new Promise(resolve => setTimeout(resolve, 100));
      const ws2 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      
      ws2.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'connection_error_handled') {
          connectionErrorHandled = true;
        }
        if (message.type === 'graceful_recovery') {
          gracefulRecovery = true;
        }
      });

      await new Promise(resolve => ws2.on('open', resolve));
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle connection errors and recover gracefully
      expect(connectionErrorHandled).toBe(true);
      expect(gracefulRecovery).toBe(true);

      ws2.close();
    });

    test('should ensure immediate recovery from error states', async () => {
      // This test should fail initially - immediate error recovery not implemented
      await webServerManager.start();
      const port = await webServerManager.getPort();
      
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'testuser',
        password: 'testpass'
      });

      const ws = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws.on('open', resolve));

      let errorRecoveryTime: number | null = null;
      let terminalReadyTime: number | null = null;

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'error') {
          errorRecoveryTime = Date.now();
        }
        if (message.type === 'terminal_ready' && errorRecoveryTime) {
          terminalReadyTime = Date.now();
        }
      });

      // Send command that will cause error
      const errorCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'exit 1', // Command that exits with error
        commandId: 'recovery-test-cmd',
        source: 'user'
      };

      ws.send(JSON.stringify(errorCommand));

      await new Promise(resolve => setTimeout(resolve, 300));

      // Should recover immediately (within reasonable time)
      expect(errorRecoveryTime).not.toBeNull();
      expect(terminalReadyTime).not.toBeNull();
      expect(terminalReadyTime! - errorRecoveryTime!).toBeLessThan(100); // Recovery within 100ms

      ws.close();
    });

    test('should handle malformed WebSocket messages without crashing', async () => {
      // This test should fail initially - malformed message handling not robust
      await webServerManager.start();
      const port = await webServerManager.getPort();
      
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'testuser',
        password: 'testpass'
      });

      const ws = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws.on('open', resolve));

      let malformedMessageHandled = false;
      let systemStable = true;

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'malformed_message_handled') {
          malformedMessageHandled = true;
        }
      });

      ws.on('error', () => {
        systemStable = false;
      });

      // Send various malformed messages
      const malformedMessages = [
        'not json at all',
        '{"incomplete": json',
        '{"type": "terminal_input"}', // missing required fields
        '{"type": "unknown_type", "data": "test"}',
        '{"sessionName": null, "type": "terminal_input"}',
        Buffer.from([0x00, 0x01, 0x02]) // binary data
      ];

      for (const badMessage of malformedMessages) {
        try {
          if (typeof badMessage === 'string') {
            ws.send(badMessage);
          } else {
            ws.send(badMessage);
          }
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
          // Expected for some malformed messages
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // System should handle malformed messages gracefully and remain stable
      expect(systemStable).toBe(true);
      expect(malformedMessageHandled).toBe(true);

      // Should still be able to send valid commands after malformed ones
      const validCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "system still works"',
        commandId: 'post-malformed-cmd',
        source: 'user'
      };

      let validCommandWorked = false;

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_output' && 
            message.data.includes('system still works')) {
          validCommandWorked = true;
        }
      });

      ws.send(JSON.stringify(validCommand));
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(validCommandWorked).toBe(true);

      ws.close();
    });
  });
});