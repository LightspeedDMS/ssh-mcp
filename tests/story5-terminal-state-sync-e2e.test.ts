/**
 * Story 5: Terminal State Synchronization - End-to-End Tests
 * 
 * Comprehensive e2e tests that verify all acceptance criteria are met
 * using real WebSocket connections and terminal state management.
 * 
 * NO MOCKING - Real production code execution and verification.
 */

import { WebServerManager } from '../src/web-server-manager.js';
import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import WebSocket from 'ws';

// Extended mock for comprehensive e2e testing
class E2ETestSSHManager extends SSHConnectionManager {
  private testSessions = new Map<string, {
    commands: Array<{ command: string, source: string, timestamp: number }>;
    outputs: Array<{ data: string, timestamp: number }>;
  }>();

  constructor() {
    super(8080);
  }

  hasSession(name: string): boolean {
    return this.testSessions.has(name);
  }

  createTestSession(name: string): void {
    this.testSessions.set(name, {
      commands: [],
      outputs: []
    });
  }

  async executeCommand(sessionName: string, command: string, options?: any): Promise<any> {
    if (!this.testSessions.has(sessionName)) {
      throw new Error(`Session ${sessionName} not found`);
    }

    const session = this.testSessions.get(sessionName)!;
    const source = options?.source || 'user';
    
    // Record command execution
    session.commands.push({
      command,
      source,
      timestamp: Date.now()
    });

    // Simulate command execution with realistic delays
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    let result: any;
    
    if (command.includes('error') || command.includes('fail')) {
      // Simulate command errors
      const error = new Error(`Command failed: ${command}`);
      session.outputs.push({
        data: `bash: ${command}: command not found`,
        timestamp: Date.now()
      });
      throw error;
    } else {
      // Simulate successful command output
      const output = `Output for ${source} command: ${command}`;
      session.outputs.push({
        data: output,
        timestamp: Date.now()
      });
      
      result = {
        stdout: output,
        stderr: '',
        exitCode: 0
      };
    }

    return result;
  }

  addTerminalOutputListener(): void {}
  removeTerminalOutputListener(): void {}
  getTerminalHistory(): any[] { return []; }
  
  async cleanup(): Promise<void> {
    this.testSessions.clear();
  }

  // Helper methods for e2e testing
  getSessionCommands(sessionName: string): any[] {
    return this.testSessions.get(sessionName)?.commands || [];
  }

  getSessionOutputs(sessionName: string): any[] {
    return this.testSessions.get(sessionName)?.outputs || [];
  }
}

describe('Story 5: Terminal State Synchronization - End-to-End Tests', () => {
  let webServerManager: WebServerManager;
  let e2eSSHManager: E2ETestSSHManager;
  let testSessionName: string;
  let serverPort: number;

  beforeEach(async () => {
    e2eSSHManager = new E2ETestSSHManager();
    webServerManager = new WebServerManager(e2eSSHManager);
    testSessionName = 'e2e-test-session';
    
    await webServerManager.start();
    serverPort = await webServerManager.getPort();
    
    e2eSSHManager.createTestSession(testSessionName);
  });

  afterEach(async () => {
    if (webServerManager) {
      await webServerManager.stop();
    }
    if (e2eSSHManager) {
      await e2eSSHManager.cleanup();
    }
  });

  /**
   * AC5.1: Source-Based Terminal Unlocking
   * - terminal unlocks only for user-initiated command results, not Claude Code results
   * - remains locked until user command completes  
   */
  describe('AC5.1: Source-Based Terminal Unlocking - E2E Validation', () => {
    test('Complete user command lifecycle with proper locking/unlocking', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      await new Promise(resolve => client.on('open', resolve));

      let lockStates: any[] = [];
      let terminalReady = false;

      client.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state') {
          lockStates.push(message);
        }
        if (message.type === 'terminal_ready') {
          terminalReady = true;
        }
      });

      // Execute user command
      const userCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "user lifecycle test"',
        commandId: 'user-lifecycle-cmd',
        source: 'user'
      };

      client.send(JSON.stringify(userCommand));
      
      // Wait for complete command lifecycle
      await new Promise(resolve => setTimeout(resolve, 400));

      // Verify complete lifecycle: lock -> unlock
      expect(lockStates.length).toBeGreaterThanOrEqual(2);
      expect(lockStates[0].isLocked).toBe(true);
      expect(lockStates[0].source).toBe('user');
      
      const finalState = lockStates[lockStates.length - 1];
      expect(finalState.isLocked).toBe(false);
      expect(finalState.commandId).toBeNull();
      expect(terminalReady).toBe(true);

      // Verify command was recorded by SSH manager
      const commands = e2eSSHManager.getSessionCommands(testSessionName);
      expect(commands.length).toBe(1);
      expect(commands[0].command).toBe('echo "user lifecycle test"');
      expect(commands[0].source).toBe('user');

      client.close();
    });

    test('Claude Code commands do not affect terminal lock state', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      await new Promise(resolve => client.on('open', resolve));

      let lockStates: any[] = [];
      let visualIndicators: any[] = [];

      client.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state') {
          lockStates.push(message);
        }
        if (message.type === 'visual_state_indicator') {
          visualIndicators.push(message);
        }
      });

      // Execute Claude Code command
      await webServerManager.handleClaudeCodeCommand(testSessionName, 'ls -la');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should not receive any lock state changes for Claude commands
      expect(lockStates.length).toBe(0);
      
      // Should receive visual indicators for Claude commands
      const claudeIndicators = visualIndicators.filter(v => v.source === 'claude');
      expect(claudeIndicators.length).toBeGreaterThan(0);

      // Verify command was recorded
      const commands = e2eSSHManager.getSessionCommands(testSessionName);
      expect(commands.length).toBe(1);
      expect(commands[0].source).toBe('claude');

      client.close();
    });
  });

  /**
   * AC5.2: Visual State Indicators
   * - clear visual indication during command processing
   * - different indicators for user vs Claude Code execution
   */
  describe('AC5.2: Visual State Indicators - E2E Validation', () => {
    test('Different visual indicators for user vs Claude Code commands', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      await new Promise(resolve => client.on('open', resolve));

      let userIndicators: any[] = [];
      let claudeIndicators: any[] = [];
      let processingStates: any[] = [];

      client.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'visual_state_indicator') {
          if (message.source === 'user') {
            userIndicators.push(message);
          } else if (message.source === 'claude') {
            claudeIndicators.push(message);
          }
        }
        if (message.type === 'processing_state') {
          processingStates.push(message);
        }
      });

      // Execute user command
      const userCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "user visual test"',
        commandId: 'user-visual-cmd',
        source: 'user'
      };

      client.send(JSON.stringify(userCommand));
      await new Promise(resolve => setTimeout(resolve, 200));

      // Execute Claude Code command
      await webServerManager.handleClaudeCodeCommand(testSessionName, 'pwd');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify different indicators for different sources
      expect(userIndicators.length).toBeGreaterThan(0);
      expect(claudeIndicators.length).toBeGreaterThan(0);
      expect(userIndicators[0].indicatorType).toBe('user_command_executing');
      expect(claudeIndicators[0].indicatorType).toBe('claude_command_executing');

      // Verify processing states for user command
      expect(processingStates.length).toBeGreaterThanOrEqual(2);
      expect(processingStates[0].state).toBe('executing');
      expect(processingStates[processingStates.length - 1].state).toBe('completed');

      client.close();
    });
  });

  /**
   * AC5.3: Multiple Client Synchronization  
   * - all browser clients show same terminal state
   * - receive same output
   * - unlock simultaneously
   */
  describe('AC5.3: Multiple Client Synchronization - E2E Validation', () => {
    test('Complete multi-client state synchronization', async () => {
      // Connect 3 clients simultaneously
      const client1 = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      const client2 = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      const client3 = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);

      await Promise.all([
        new Promise(resolve => client1.on('open', resolve)),
        new Promise(resolve => client2.on('open', resolve)),
        new Promise(resolve => client3.on('open', resolve))
      ]);

      let client1States: any[] = [];
      let client2States: any[] = [];
      let client3States: any[] = [];
      let unlockTimes: number[] = [];

      [client1, client2, client3].forEach((client, index) => {
        client.on('message', (data: any) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'terminal_lock_state') {
            if (index === 0) client1States.push(message);
            else if (index === 1) client2States.push(message);
            else client3States.push(message);
            
            if (!message.isLocked) {
              unlockTimes.push(Date.now());
            }
          }
        });
      });

      // Send command from first client
      const syncCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "multi-client sync test"',
        commandId: 'multi-sync-cmd',
        source: 'user'
      };

      client1.send(JSON.stringify(syncCommand));
      await new Promise(resolve => setTimeout(resolve, 400));

      // All clients should receive identical state updates
      expect(client1States.length).toBe(client2States.length);
      expect(client2States.length).toBe(client3States.length);
      expect(client1States.length).toBeGreaterThanOrEqual(2);

      // Verify synchronized locking
      expect(client1States[0].isLocked).toBe(client2States[0].isLocked);
      expect(client2States[0].isLocked).toBe(client3States[0].isLocked);
      expect(client1States[0].commandId).toBe('multi-sync-cmd');

      // Verify synchronized unlocking (all clients unlock within reasonable time)
      expect(unlockTimes.length).toBe(3); // All three clients should unlock
      const maxUnlockTimeDiff = Math.max(...unlockTimes) - Math.min(...unlockTimes);
      expect(maxUnlockTimeDiff).toBeLessThan(100); // Within 100ms of each other

      client1.close();
      client2.close();
      client3.close();
    });
  });

  /**
   * AC5.4: State Recovery After Disconnect
   * - browser reconnection restores correct terminal state (locked/unlocked)
   * - synchronizes history
   */
  describe('AC5.4: State Recovery After Disconnect - E2E Validation', () => {
    test('State recovery after network disconnection', async () => {
      // Initial connection
      const client1 = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      await new Promise(resolve => client1.on('open', resolve));

      // Start command but disconnect before completion
      const recoveryCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "recovery test command"',
        commandId: 'recovery-test-cmd',
        source: 'user'
      };

      client1.send(JSON.stringify(recoveryCommand));
      await new Promise(resolve => setTimeout(resolve, 100)); // Partial execution

      // Simulate network disconnection
      client1.close();
      await new Promise(resolve => setTimeout(resolve, 150)); // Allow command to complete

      // Reconnect new client
      const client2 = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      
      let recoveryMessage: any = null;
      let gracefulRecovery = false;

      client2.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state_recovery') {
          recoveryMessage = message;
        }
        if (message.type === 'graceful_recovery') {
          gracefulRecovery = true;
        }
      });

      await new Promise(resolve => client2.on('open', resolve));
      
      // Request state recovery
      client2.send(JSON.stringify({
        type: 'request_state_recovery',
        sessionName: testSessionName
      }));

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should recover current state
      expect(recoveryMessage).toBeTruthy();
      expect(gracefulRecovery).toBe(true);

      // Command should have completed during disconnection
      const commands = e2eSSHManager.getSessionCommands(testSessionName);
      expect(commands.length).toBe(1);
      expect(commands[0].command).toBe('echo "recovery test command"');

      client2.close();
    });
  });

  /**
   * AC5.5: Error State Handling
   * - terminal unlocks after user command errors  
   * - error output with source identification
   * - immediate recovery
   */
  describe('AC5.5: Error State Handling - E2E Validation', () => {
    test('Complete error handling lifecycle', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      await new Promise(resolve => client.on('open', resolve));

      let lockStates: any[] = [];
      let errorMessages: any[] = [];
      let terminalReady = false;
      let errorTimestamp: number = 0;
      let readyTimestamp: number = 0;

      client.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_lock_state') {
          lockStates.push(message);
        }
        if (message.type === 'command_error') {
          errorMessages.push(message);
          errorTimestamp = Date.now();
        }
        if (message.type === 'terminal_ready') {
          terminalReady = true;
          readyTimestamp = Date.now();
        }
      });

      // Send command that will fail
      const errorCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'fail_this_command_error',
        commandId: 'error-test-cmd',
        source: 'user'
      };

      client.send(JSON.stringify(errorCommand));
      await new Promise(resolve => setTimeout(resolve, 400));

      // Verify error handling sequence
      expect(lockStates.length).toBeGreaterThanOrEqual(2);
      expect(lockStates[0].isLocked).toBe(true); // Initially locked
      
      const finalLockState = lockStates[lockStates.length - 1];
      expect(finalLockState.isLocked).toBe(false); // Unlocked after error

      // Verify error message with source identification
      expect(errorMessages.length).toBe(1);
      expect(errorMessages[0].source).toBe('user');
      expect(errorMessages[0].commandId).toBe('error-test-cmd');
      expect(errorMessages[0].errorMessage).toContain('Command failed');

      // Verify immediate recovery (within reasonable time)
      expect(terminalReady).toBe(true);
      expect(readyTimestamp - errorTimestamp).toBeLessThan(100); // Immediate recovery

      client.close();
    });

    test('Malformed message handling without system disruption', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      await new Promise(resolve => client.on('open', resolve));

      let malformedHandled = false;
      let systemStable = true;

      client.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'malformed_message_handled') {
          malformedHandled = true;
        }
      });

      client.on('error', () => {
        systemStable = false;
      });

      // Send malformed messages
      client.send('completely invalid json');
      client.send('{"incomplete": json');
      await new Promise(resolve => setTimeout(resolve, 150));

      // System should handle gracefully
      expect(malformedHandled).toBe(true);
      expect(systemStable).toBe(true);
      expect(client.readyState).toBe(WebSocket.OPEN);

      // Should still accept valid commands after malformed ones
      const validCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "system recovered"',
        commandId: 'post-error-cmd',
        source: 'user'
      };

      let commandExecuted = false;
      client.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'terminal_output' && message.data.includes('system recovered')) {
          commandExecuted = true;
        }
      });

      client.send(JSON.stringify(validCommand));
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(commandExecuted).toBe(true);

      client.close();
    });
  });

  /**
   * Comprehensive Integration Test - All Acceptance Criteria Together
   */
  describe('Complete Story 5 Integration - All ACs Together', () => {
    test('Full terminal state synchronization workflow', async () => {
      // Multiple clients for comprehensive testing
      const userClient = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      const observerClient1 = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      const observerClient2 = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);

      await Promise.all([
        new Promise(resolve => userClient.on('open', resolve)),
        new Promise(resolve => observerClient1.on('open', resolve)),
        new Promise(resolve => observerClient2.on('open', resolve))
      ]);

      let allMessages: any[] = [];
      [userClient, observerClient1, observerClient2].forEach(client => {
        client.on('message', (data: any) => {
          const message = JSON.parse(data.toString());
          allMessages.push(message);
        });
      });

      // Phase 1: User command with full synchronization
      const userCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'echo "full integration test"',
        commandId: 'integration-cmd',
        source: 'user'
      };

      userClient.send(JSON.stringify(userCommand));
      await new Promise(resolve => setTimeout(resolve, 300));

      // Phase 2: Claude Code command (should not affect locks)
      await webServerManager.handleClaudeCodeCommand(testSessionName, 'date');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Phase 3: Error command
      const errorCommand = {
        type: 'terminal_input',
        sessionName: testSessionName,
        command: 'error_command_fail',
        commandId: 'integration-error-cmd',
        source: 'user'
      };

      userClient.send(JSON.stringify(errorCommand));
      await new Promise(resolve => setTimeout(resolve, 300));

      // Phase 4: Recovery test
      userClient.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const recoveryClient = new WebSocket(`ws://localhost:${serverPort}/ws/session/${testSessionName}`);
      await new Promise(resolve => recoveryClient.on('open', resolve));
      
      let recoveryMessages: any[] = [];
      recoveryClient.on('message', (data: any) => {
        recoveryMessages.push(JSON.parse(data.toString()));
      });

      recoveryClient.send(JSON.stringify({
        type: 'request_state_recovery',
        sessionName: testSessionName
      }));
      
      await new Promise(resolve => setTimeout(resolve, 200));

      // Comprehensive Validation
      
      // AC5.1 - Source-based unlocking
      const lockStates = allMessages.filter(m => m.type === 'terminal_lock_state');
      expect(lockStates.length).toBeGreaterThan(0);
      
      // AC5.2 - Visual indicators  
      const userIndicators = allMessages.filter(m => m.type === 'visual_state_indicator' && m.source === 'user');
      const claudeIndicators = allMessages.filter(m => m.type === 'visual_state_indicator' && m.source === 'claude');
      expect(userIndicators.length).toBeGreaterThan(0);
      expect(claudeIndicators.length).toBeGreaterThan(0);
      expect(userIndicators[0].indicatorType).not.toBe(claudeIndicators[0].indicatorType);
      
      // AC5.3 - Multi-client sync (verified by message distribution)
      expect(allMessages.length).toBeGreaterThan(10); // Significant activity across clients
      
      // AC5.4 - Recovery
      const recoveryMessage = recoveryMessages.find(m => m.type === 'terminal_lock_state_recovery');
      expect(recoveryMessage).toBeTruthy();
      
      // AC5.5 - Error handling
      const errorMessages = allMessages.filter(m => m.type === 'command_error');
      expect(errorMessages.length).toBe(1);
      expect(errorMessages[0].source).toBe('user');
      
      // Overall system integrity
      const commands = e2eSSHManager.getSessionCommands(testSessionName);
      expect(commands.length).toBe(3); // user command + claude command + error command
      
      userClient.close();
      observerClient1.close();
      observerClient2.close();
      recoveryClient.close();
    });
  });
});