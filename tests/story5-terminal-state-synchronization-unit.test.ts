/**
 * Story 5: Terminal State Synchronization - Unit Tests
 * 
 * These tests validate the core terminal state synchronization functionality
 * following strict TDD practices. All tests should initially fail until
 * the implementation is complete.
 */

import { WebServerManager } from '../src/web-server-manager.js';
import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import WebSocket from 'ws';

describe('Story 5: Terminal State Synchronization - Unit Tests', () => {
  let webServerManager: WebServerManager;
  let sshManager: SSHConnectionManager;
  let testSessionName: string;

  beforeEach(() => {
    sshManager = new SSHConnectionManager();
    webServerManager = new WebServerManager(sshManager);
    testSessionName = 'test-session-sync';
  });

  afterEach(async () => {
    if (webServerManager) {
      await webServerManager.stop();
    }
    if (sshManager) {
      await sshManager.cleanup();
    }
  });

  // AC5.1: Source-Based Terminal Unlocking
  describe('AC5.1: Source-Based Terminal Unlocking', () => {
    test('should track terminal lock state per user command', async () => {
      // This test should fail initially - we need to implement source-based locking
      await webServerManager.start();
      const port = await webServerManager.getPort();
      
      // Create SSH session for testing
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'testuser',
        password: 'testpass'
      });

      // Connect WebSocket client
      const ws = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      
      await new Promise(resolve => ws.on('open', resolve));

      let lockState: any = null;
      let unlockReceived = false;

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state') {
          lockState = message;
          if (!message.isLocked) {
            unlockReceived = true;
          }
        }
      });

      // Send user-initiated command
      const userCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "user test"',
        commandId: 'user-cmd-1',
        source: 'user'
      };

      ws.send(JSON.stringify(userCommand));

      // Wait for lock state updates
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have received lock state message indicating terminal is locked for user command
      expect(lockState).toBeTruthy();
      expect(lockState.isLocked).toBe(true);
      expect(lockState.commandId).toBe('user-cmd-1');
      expect(lockState.source).toBe('user');

      ws.close();

      // This test will fail initially because source-based locking isn't implemented
      expect(unlockReceived).toBe(false); // Should stay locked until user command completes
    });

    test('should not lock terminal for Claude Code commands', async () => {
      // This test should fail initially - Claude Code commands shouldn't affect lock state
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

      let lockStateReceived = false;

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state') {
          lockStateReceived = true;
        }
      });

      // Simulate Claude Code command execution
      await sshManager.executeCommand(testSessionName, 'echo "claude code test"', { 
        source: 'claude' 
      });

      // Wait to see if any lock state changes occurred
      await new Promise(resolve => setTimeout(resolve, 100));

      // Terminal should not lock for Claude Code commands
      expect(lockStateReceived).toBe(false);

      ws.close();
    });

    test('should unlock terminal only when user-initiated command completes', async () => {
      // This test should fail initially - we need proper completion detection
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

      let finalLockState: any = null;
      const lockStates: any[] = [];

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state') {
          lockStates.push(message);
          finalLockState = message;
        }
      });

      // Send user command that should complete
      const userCommand = {
        type: 'terminal_input',
        sessionName: testSessionName, 
        command: 'echo "test" && sleep 0.1',
        commandId: 'user-cmd-complete',
        source: 'user'
      };

      ws.send(JSON.stringify(userCommand));

      // Wait for command completion
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have received lock/unlock sequence
      expect(lockStates.length).toBeGreaterThanOrEqual(2);
      expect(lockStates[0].isLocked).toBe(true);
      expect(finalLockState.isLocked).toBe(false);
      expect(finalLockState.source).toBe('user');

      ws.close();
    });
  });

  // AC5.2: Visual State Indicators  
  describe('AC5.2: Visual State Indicators', () => {
    test('should provide different visual indicators for user vs Claude Code execution', async () => {
      // This test should fail initially - visual indicators not implemented
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

      let visualIndicators: any[] = [];

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'visual_state_indicator') {
          visualIndicators.push(message);
        }
      });

      // Send user command
      const userCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "user"',
        commandId: 'visual-test-user',
        source: 'user'
      };

      ws.send(JSON.stringify(userCommand));

      // Execute Claude Code command  
      await sshManager.executeCommand(testSessionName, 'echo "claude"', { 
        source: 'claude' 
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have received different visual indicators
      const userIndicators = visualIndicators.filter(v => v.source === 'user');
      const claudeIndicators = visualIndicators.filter(v => v.source === 'claude');

      expect(userIndicators.length).toBeGreaterThan(0);
      expect(claudeIndicators.length).toBeGreaterThan(0);
      expect(userIndicators[0].indicatorType).not.toBe(claudeIndicators[0].indicatorType);

      ws.close();
    });

    test('should show clear processing state during command execution', async () => {
      // This test should fail initially - processing indicators not implemented
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

      let processingStates: any[] = [];

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'processing_state') {
          processingStates.push(message);
        }
      });

      // Send command that takes some time
      const command = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'sleep 0.2 && echo "done"',
        commandId: 'processing-test',
        source: 'user'
      };

      ws.send(JSON.stringify(command));

      await new Promise(resolve => setTimeout(resolve, 300));

      // Should show processing states: started -> executing -> completed
      expect(processingStates.length).toBeGreaterThanOrEqual(2);
      expect(processingStates[0].state).toBe('executing');
      expect(processingStates[processingStates.length - 1].state).toBe('completed');

      ws.close();
    });
  });

  // AC5.3: Multiple Client Synchronization
  describe('AC5.3: Multiple Client Synchronization', () => {
    test('should synchronize terminal state across multiple browser clients', async () => {
      // This test should fail initially - multi-client sync not implemented
      await webServerManager.start();
      const port = await webServerManager.getPort();
      
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'testuser',
        password: 'testpass'
      });

      // Connect two WebSocket clients  
      const ws1 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      const ws2 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      
      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);

      let client1States: any[] = [];
      let client2States: any[] = [];

      ws1.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state') {
          client1States.push(message);
        }
      });

      ws2.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state') {  
          client2States.push(message);
        }
      });

      // Send command from first client
      const command = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "sync test"',
        commandId: 'sync-cmd-1',
        source: 'user'
      };

      ws1.send(JSON.stringify(command));

      await new Promise(resolve => setTimeout(resolve, 150));

      // Both clients should receive the same state updates
      expect(client1States.length).toBeGreaterThan(0);
      expect(client2States.length).toBeGreaterThan(0);
      expect(client1States.length).toBe(client2States.length);
      
      // States should be identical
      for (let i = 0; i < client1States.length; i++) {
        expect(client1States[i].isLocked).toBe(client2States[i].isLocked);
        expect(client1States[i].commandId).toBe(client2States[i].commandId);
      }

      ws1.close();
      ws2.close();
    });

    test('should show same terminal output to all connected clients', async () => {
      // This test should fail initially - synchronized output not guaranteed  
      await webServerManager.start();
      const port = await webServerManager.getPort();
      
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'testuser', 
        password: 'testpass'
      });

      const ws1 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      const ws2 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      const ws3 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      
      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve)), 
        new Promise(resolve => ws3.on('open', resolve))
      ]);

      let client1Output: any[] = [];
      let client2Output: any[] = [];
      let client3Output: any[] = [];

      ws1.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_output') {
          client1Output.push(message.data);
        }
      });

      ws2.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_output') {
          client2Output.push(message.data);
        }
      });

      ws3.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_output') {
          client3Output.push(message.data);
        }
      });

      // Execute command
      await sshManager.executeCommand(testSessionName, 'echo "multi-client test"', { 
        source: 'user' 
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // All clients should receive identical output
      expect(client1Output.length).toBeGreaterThan(0);
      expect(client2Output.length).toBe(client1Output.length);
      expect(client3Output.length).toBe(client1Output.length);
      
      for (let i = 0; i < client1Output.length; i++) {
        expect(client1Output[i]).toBe(client2Output[i]);
        expect(client1Output[i]).toBe(client3Output[i]);
      }

      ws1.close();
      ws2.close(); 
      ws3.close();
    });

    test('should unlock all clients simultaneously when command completes', async () => {
      // This test should fail initially - synchronized unlocking not implemented
      await webServerManager.start();
      const port = await webServerManager.getPort();
      
      await sshManager.createConnection({
        name: testSessionName,
        host: 'localhost',
        username: 'testuser',
        password: 'testpass'
      });

      const ws1 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      const ws2 = new WebSocket(`ws://localhost:${port}/ws/session/${testSessionName}`);
      
      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);

      let client1UnlockTime: number | null = null;
      let client2UnlockTime: number | null = null;

      ws1.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state' && !message.isLocked) {
          client1UnlockTime = Date.now();
        }
      });

      ws2.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state' && !message.isLocked) {
          client2UnlockTime = Date.now();
        }
      });

      // Send command from client 1
      const command = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "unlock test"',
        commandId: 'unlock-cmd-1', 
        source: 'user'
      };

      ws1.send(JSON.stringify(command));

      await new Promise(resolve => setTimeout(resolve, 150));

      // Both clients should unlock at nearly the same time
      expect(client1UnlockTime).not.toBeNull();
      expect(client2UnlockTime).not.toBeNull();
      expect(Math.abs(client1UnlockTime! - client2UnlockTime!)).toBeLessThan(50); // Within 50ms

      ws1.close();
      ws2.close();
    });
  });
});