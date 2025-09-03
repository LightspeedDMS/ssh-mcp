/**
 * Story 5: Terminal State Synchronization - WebSocket Unit Tests
 * 
 * These tests focus on WebSocket state synchronization functionality
 * without requiring actual SSH connections.
 */

import { WebServerManager } from '../src/web-server-manager.js';
import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import WebSocket from 'ws';

// Mock SSH manager for unit testing
class MockSSHConnectionManager extends SSHConnectionManager {
  private mockSessions = new Set<string>();

  constructor() {
    super(8080);
  }

  hasSession(name: string): boolean {
    return this.mockSessions.has(name);
  }

  addMockSession(name: string): void {
    this.mockSessions.add(name);
  }

  async executeCommand(_sessionName: string, command: string, _options?: any): Promise<any> {
    // Mock command execution
    return {
      stdout: `Mock output for: ${command}`,
      stderr: '',
      exitCode: 0
    };
  }

  addTerminalOutputListener(): void {
    // Mock listener
  }

  removeTerminalOutputListener(): void {
    // Mock listener removal
  }

  getTerminalHistory(): any[] {
    return [];
  }

  async cleanup(): Promise<void> {
    this.mockSessions.clear();
  }
}

describe('Story 5: WebSocket Terminal State Synchronization - Unit Tests', () => {
  let webServerManager: WebServerManager;
  let mockSSHManager: MockSSHConnectionManager;
  let testSessionName: string;
  let serverPort: number;

  beforeEach(async () => {
    mockSSHManager = new MockSSHConnectionManager();
    webServerManager = new WebServerManager(mockSSHManager);
    testSessionName = 'test-sync-session';
    
    // Start server and get port
    await webServerManager.start();
    serverPort = await webServerManager.getPort();
    
    // Add mock session
    mockSSHManager.addMockSession(testSessionName);
  });

  afterEach(async () => {
    if (webServerManager) {
      await webServerManager.stop();
    }
    if (mockSSHManager) {
      await mockSSHManager.cleanup();
    }
  });

  // AC5.1: Source-Based Terminal Unlocking
  describe('AC5.1: Source-Based Terminal Unlocking - WebSocket Tests', () => {
    test('should send terminal lock state via WebSocket for user commands', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      
      await new Promise(resolve => ws.on('open', resolve));

      let lockStateMessages: any[] = [];

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state') {
          lockStateMessages.push(message);
        }
      });

      // Send user command
      const userCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "test"',
        commandId: 'test-lock-cmd',
        source: 'user'
      };

      ws.send(JSON.stringify(userCommand));

      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have received lock state update
      expect(lockStateMessages.length).toBeGreaterThanOrEqual(1);
      expect(lockStateMessages[0].isLocked).toBe(true);
      expect(lockStateMessages[0].commandId).toBe('test-lock-cmd');
      expect(lockStateMessages[0].source).toBe('user');

      ws.close();
    });

    test('should not send terminal lock state for non-user commands', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      
      await new Promise(resolve => ws.on('open', resolve));

      let lockStateMessages: any[] = [];

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state') {
          lockStateMessages.push(message);
        }
      });

      // Use public method to simulate Claude Code command
      await webServerManager.handleClaudeCodeCommand(testSessionName, 'echo "claude test"');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not have received any lock state updates for Claude commands
      expect(lockStateMessages.length).toBe(0);

      ws.close();
    });

    test('should unlock terminal after user command completion', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      
      await new Promise(resolve => ws.on('open', resolve));

      let lockStateMessages: any[] = [];

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state') {
          lockStateMessages.push(message);
        }
      });

      // Send user command
      const userCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "unlock test"',
        commandId: 'unlock-test-cmd',
        source: 'user'
      };

      ws.send(JSON.stringify(userCommand));

      // Wait for command processing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have received both lock and unlock states
      expect(lockStateMessages.length).toBeGreaterThanOrEqual(2);
      expect(lockStateMessages[0].isLocked).toBe(true);
      
      const finalState = lockStateMessages[lockStateMessages.length - 1];
      expect(finalState.isLocked).toBe(false);
      expect(finalState.commandId).toBeNull();

      ws.close();
    });
  });

  // AC5.2: Visual State Indicators
  describe('AC5.2: Visual State Indicators - WebSocket Tests', () => {
    test('should send visual indicators for user commands', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      
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
        command: 'echo "visual test"',
        commandId: 'visual-test-cmd',
        source: 'user'
      };

      ws.send(JSON.stringify(userCommand));

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have received visual indicator for user command
      const userIndicators = visualIndicators.filter(v => v.source === 'user');
      expect(userIndicators.length).toBeGreaterThan(0);
      expect(userIndicators[0].indicatorType).toBe('user_command_executing');

      ws.close();
    });

    test('should send different visual indicators for Claude Code commands', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      
      await new Promise(resolve => ws.on('open', resolve));

      let visualIndicators: any[] = [];

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'visual_state_indicator') {
          visualIndicators.push(message);
        }
      });

      // Execute Claude Code command
      await webServerManager.handleClaudeCodeCommand(testSessionName, 'echo "claude visual test"');

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have received visual indicator for Claude command
      const claudeIndicators = visualIndicators.filter(v => v.source === 'claude');
      expect(claudeIndicators.length).toBeGreaterThan(0);
      expect(claudeIndicators[0].indicatorType).toBe('claude_command_executing');

      ws.close();
    });

    test('should send processing state updates', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      
      await new Promise(resolve => ws.on('open', resolve));

      let processingStates: any[] = [];

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'processing_state') {
          processingStates.push(message);
        }
      });

      // Send user command
      const userCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "processing test"',
        commandId: 'processing-test-cmd',
        source: 'user'
      };

      ws.send(JSON.stringify(userCommand));

      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have received processing state updates
      expect(processingStates.length).toBeGreaterThanOrEqual(2);
      expect(processingStates[0].state).toBe('executing');
      
      const finalState = processingStates[processingStates.length - 1];
      expect(finalState.state).toBe('completed');

      ws.close();
    });
  });

  // AC5.3: Multiple Client Synchronization
  describe('AC5.3: Multiple Client Synchronization - WebSocket Tests', () => {
    test('should synchronize lock states across multiple clients', async () => {
      const ws1 = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      const ws2 = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      
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
        commandId: 'sync-test-cmd',
        source: 'user'
      };

      ws1.send(JSON.stringify(command));

      await new Promise(resolve => setTimeout(resolve, 300));

      // Both clients should receive the same lock state updates
      expect(client1States.length).toBeGreaterThan(0);
      expect(client2States.length).toBe(client1States.length);
      
      // First state should be locked
      expect(client1States[0].isLocked).toBe(client2States[0].isLocked);
      expect(client1States[0].commandId).toBe(client2States[0].commandId);

      ws1.close();
      ws2.close();
    });

    test('should send state recovery to new clients', async () => {
      // First client locks terminal
      const ws1 = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws1.on('open', resolve));

      const lockCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "lock for recovery"',
        commandId: 'recovery-lock-cmd',
        source: 'user'
      };

      ws1.send(JSON.stringify(lockCommand));
      await new Promise(resolve => setTimeout(resolve, 150)); // Give more time for lock to be processed

      // New client connects
      const ws2 = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      
      let recoveryMessage: any = null;

      // Set up message handler before connection opens
      ws2.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state_recovery') {
          recoveryMessage = message;
        }
      });

      await new Promise(resolve => ws2.on('open', resolve));
      
      // Give time for recovery message to be sent
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should receive state recovery message automatically upon connection
      expect(recoveryMessage).toBeTruthy();

      ws1.close();
      ws2.close();
    }, 10000); // Increase timeout for this specific test
  });

  // AC5.4: State Recovery After Disconnect
  describe('AC5.4: State Recovery - WebSocket Tests', () => {
    test('should handle state recovery requests', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws.on('open', resolve));

      let recoveryMessages: any[] = [];

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state_recovery' || message.type === 'graceful_recovery') {
          recoveryMessages.push(message);
        }
      });

      // Send state recovery request
      const recoveryRequest = {
        type: 'request_state_recovery',
        sessionName: testSessionName
      };

      ws.send(JSON.stringify(recoveryRequest));

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should receive recovery response
      const stateRecovery = recoveryMessages.find(m => m.type === 'terminal_lock_state_recovery');
      const gracefulRecovery = recoveryMessages.find(m => m.type === 'graceful_recovery');

      expect(stateRecovery).toBeTruthy();
      expect(gracefulRecovery).toBeTruthy();

      ws.close();
    });
  });

  // AC5.5: Error State Handling
  describe('AC5.5: Error State Handling - WebSocket Tests', () => {
    test('should handle malformed messages gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws.on('open', resolve));

      let malformedHandled = false;

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'malformed_message_handled') {
          malformedHandled = true;
        }
      });

      // Send malformed message
      ws.send('invalid json');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle malformed message gracefully
      expect(malformedHandled).toBe(true);

      // WebSocket should still be functional
      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.close();
    });

    test('should send terminal ready state after operations', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      await new Promise(resolve => ws.on('open', resolve));

      let terminalReadyReceived = false;

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_ready') {
          terminalReadyReceived = true;
        }
      });

      // Send user command
      const userCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "ready test"',
        commandId: 'ready-test-cmd',
        source: 'user'
      };

      ws.send(JSON.stringify(userCommand));

      await new Promise(resolve => setTimeout(resolve, 300));

      // Should receive terminal ready message
      expect(terminalReadyReceived).toBe(true);

      ws.close();
    });
  });
});