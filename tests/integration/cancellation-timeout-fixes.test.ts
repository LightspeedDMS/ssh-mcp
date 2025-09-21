/**
 * Comprehensive TDD Tests for Cancellation and Timeout System Fixes
 *
 * Critical Issues Being Tested:
 * 1. Browser commands timeout after 15000ms instead of infinite wait
 * 2. SIGINT cancellation completely broken - doesn't destroy SSH streams
 * 3. State management issues with sessions staying busy after completion
 * 4. No prompt restoration after SIGINT cancellation
 * 5. Commands after cancellation get queued instead of executing immediately
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SSHConnectionManager } from '../../src/ssh-connection-manager.js';
import { Client } from 'ssh2';

describe('Cancellation and Timeout System Fixes', () => {
  let sshManager: SSHConnectionManager;
  let mockClient: jest.Mocked<Client>;
  let mockStream: any;

  beforeEach(() => {
    sshManager = new SSHConnectionManager(8080);

    // Mock SSH client and stream
    mockStream = {
      on: jest.fn(),
      destroy: jest.fn(),
      stderr: {
        on: jest.fn()
      }
    };

    mockClient = {
      connect: jest.fn(),
      exec: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn()
    } as any;

    // Setup default client behavior
    mockClient.on.mockImplementation((event: string, callback: any) => {
      if (event === 'ready') {
        setTimeout(() => callback(), 10);
      }
      return mockClient;
    });

    mockClient.exec.mockImplementation((_command: string, callback: any) => {
      setTimeout(() => callback(null, mockStream), 10);
      return mockClient;
    });

    // Mock Client constructor
    jest.doMock('ssh2', () => ({
      Client: jest.fn(() => mockClient)
    }));
  });

  afterEach(() => {
    sshManager.cleanup();
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('Browser Command Infinite Timeout Issue', () => {
    test('FAILING: Browser commands should wait forever, not timeout at 15000ms', async () => {
      // Create SSH connection
      await sshManager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'testuser'
      });

      // Start a long-running browser command
      const commandPromise = sshManager.executeCommand(
        'test-session',
        'sleep 20', // Command that takes 20 seconds
        { source: 'user' } // Browser command
      );

      // Wait 16 seconds (more than current 15000ms timeout)
      await new Promise(resolve => setTimeout(resolve, 16000));

      // Browser command should still be running, not timed out
      // Currently FAILS: Browser commands timeout after 15000ms
      // Should PASS: Browser commands wait indefinitely

      // Simulate command completion after 20 seconds
      setTimeout(() => {
        const streamCallbacks = mockStream.on.mock.calls;
        const closeCallback = streamCallbacks.find((call: any) => call[0] === 'close')?.[1];
        if (closeCallback) {
          closeCallback(0); // Exit code 0
        }
      }, 4000); // Complete after 4 more seconds (20 total)

      const result = await commandPromise;
      expect(result.exitCode).toBe(0);
    }, 25000); // Test timeout of 25 seconds

    test('PASSING: MCP commands should still have timeout', async () => {
      await sshManager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'testuser'
      });

      // MCP command should timeout after 15000ms
      const commandPromise = sshManager.executeCommand(
        'test-session',
        'sleep 20',
        { source: 'claude', timeout: 5000 }
      );

      await expect(commandPromise).rejects.toThrow(/timed out after 5000ms/);
    });
  });

  describe('SIGINT Stream Destruction Issue', () => {
    test('FAILING: SIGINT should destroy active SSH streams and cancel commands', async () => {
      await sshManager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'testuser'
      });

      // Start a long-running command
      const commandPromise = sshManager.executeCommand(
        'test-session',
        'sleep 30',
        { source: 'user' }
      );

      // Send SIGINT after 1 second
      setTimeout(() => {
        sshManager.sendTerminalSignal('test-session', 'SIGINT');
      }, 1000);

      // Currently FAILS: SIGINT doesn't destroy streams, command continues
      // Should PASS: Command gets cancelled with proper error
      await expect(commandPromise).rejects.toThrow(/Interrupted by SIGINT/);

      // Verify stream was destroyed
      expect(mockStream.destroy).toHaveBeenCalled();
    });

    test('FAILING: Multiple active streams should all be destroyed on SIGINT', async () => {
      await sshManager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'testuser'
      });

      // Start multiple commands (if using background execution)
      const command1Promise = sshManager.executeCommand(
        'test-session',
        'sleep 30',
        { source: 'claude', asyncTimeout: 5000 }
      );

      const command2Promise = sshManager.executeCommand(
        'test-session',
        'sleep 30',
        { source: 'user' }
      );

      // Send SIGINT
      setTimeout(() => {
        sshManager.sendTerminalSignal('test-session', 'SIGINT');
      }, 1000);

      // Both commands should be cancelled
      // Currently FAILS: Streams not tracked and destroyed
      await expect(command1Promise).rejects.toThrow();
      await expect(command2Promise).rejects.toThrow();
    });
  });

  describe('State Management Cleanup Issue', () => {
    test('FAILING: Session state should be cleared after command completion', async () => {
      await sshManager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'testuser'
      });

      // Execute a command that completes successfully
      const command1Promise = sshManager.executeCommand(
        'test-session',
        'echo "hello"',
        { source: 'user' }
      );

      // Simulate command completion
      setTimeout(() => {
        const streamCallbacks = mockStream.on.mock.calls;
        const dataCallback = streamCallbacks.find((call: any) => call[0] === 'data')?.[1];
        const closeCallback = streamCallbacks.find((call: any) => call[0] === 'close')?.[1];

        if (dataCallback) {
          dataCallback(Buffer.from('hello\n'));
        }
        if (closeCallback) {
          closeCallback(0);
        }
      }, 100);

      await command1Promise;

      // Immediately execute another command - should NOT get SESSION_BUSY error
      const command2Promise = sshManager.executeCommand(
        'test-session',
        'echo "world"',
        { source: 'user' }
      );

      // Currently FAILS: Second command gets queued or SESSION_BUSY error
      // Should PASS: Second command executes immediately

      setTimeout(() => {
        const streamCallbacks = mockStream.on.mock.calls;
        const latestCloseCallback = streamCallbacks.filter((call: any) => call[0] === 'close').pop()?.[1];
        if (latestCloseCallback) {
          latestCloseCallback(0);
        }
      }, 100);

      const result2 = await command2Promise;
      expect(result2.exitCode).toBe(0);
    });

    test('FAILING: Session state should be cleared after SIGINT cancellation', async () => {
      await sshManager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'testuser'
      });

      // Start a command
      const command1Promise = sshManager.executeCommand(
        'test-session',
        'sleep 30',
        { source: 'user' }
      );

      // Send SIGINT
      setTimeout(() => {
        sshManager.sendTerminalSignal('test-session', 'SIGINT');
      }, 100);

      try {
        await command1Promise;
      } catch (error) {
        // Expected cancellation error
      }

      // Execute another command after cancellation - should work immediately
      const command2Promise = sshManager.executeCommand(
        'test-session',
        'echo "after-cancel"',
        { source: 'user' }
      );

      // Currently FAILS: Session stays in busy state
      // Should PASS: New command executes immediately

      setTimeout(() => {
        const streamCallbacks = mockStream.on.mock.calls;
        const latestCloseCallback = streamCallbacks.filter((call: any) => call[0] === 'close').pop()?.[1];
        if (latestCloseCallback) {
          latestCloseCallback(0);
        }
      }, 100);

      const result = await command2Promise;
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Prompt Restoration After SIGINT Issue', () => {
    test('FAILING: Fresh prompt should appear after SIGINT cancellation', async () => {
      await sshManager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'testuser'
      });

      // Track broadcasted messages
      const broadcastedMessages: string[] = [];
      sshManager.addTerminalOutputListener('test-session', (entry) => {
        broadcastedMessages.push(entry.content);
      });

      // Start a command
      const commandPromise = sshManager.executeCommand(
        'test-session',
        'sleep 30',
        { source: 'user' }
      );

      // Send SIGINT
      setTimeout(() => {
        sshManager.sendTerminalSignal('test-session', 'SIGINT');
      }, 100);

      try {
        await commandPromise;
      } catch (error) {
        // Expected cancellation
      }

      // Wait for prompt injection
      await new Promise(resolve => setTimeout(resolve, 200));

      // Currently FAILS: No prompt appears after SIGINT
      // Should PASS: Fresh prompt broadcasted
      const hasPrompt = broadcastedMessages.some(msg =>
        msg.includes('[testuser@localhost') && msg.includes(']$')
      );
      expect(hasPrompt).toBe(true);
    });
  });

  describe('Command Queue After Cancellation Issue', () => {
    test('FAILING: Commands after cancellation should execute immediately, not get queued', async () => {
      await sshManager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'testuser'
      });

      // Start a long-running command
      const command1Promise = sshManager.executeCommand(
        'test-session',
        'sleep 30',
        { source: 'user' }
      );

      // Send SIGINT to cancel
      setTimeout(() => {
        sshManager.sendTerminalSignal('test-session', 'SIGINT');
      }, 100);

      try {
        await command1Promise;
      } catch (error) {
        // Expected cancellation
      }

      // Execute new command immediately after cancellation
      const startTime = Date.now();
      const command2Promise = sshManager.executeCommand(
        'test-session',
        'echo "immediate"',
        { source: 'user' }
      );

      setTimeout(() => {
        const streamCallbacks = mockStream.on.mock.calls;
        const latestCloseCallback = streamCallbacks.filter((call: any) => call[0] === 'close').pop()?.[1];
        if (latestCloseCallback) {
          latestCloseCallback(0);
        }
      }, 50);

      await command2Promise;
      const executionTime = Date.now() - startTime;

      // Currently FAILS: Command gets queued and has significant delay
      // Should PASS: Command executes immediately (< 500ms)
      expect(executionTime).toBeLessThan(500);
    });
  });

  describe('Stream Tracking Requirements', () => {
    test('FAILING: Active SSH streams should be tracked per session for cancellation', async () => {
      await sshManager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'testuser'
      });

      // This test will fail until we implement stream tracking
      // We need to verify that SessionData stores active streams

      // Start a command
      const commandPromise = sshManager.executeCommand(
        'test-session',
        'sleep 10',
        { source: 'user' }
      );

      // Currently FAILS: No mechanism to track active streams
      // Should PASS: SessionData.activeStreams contains the stream

      // This is a design test - implementation needed
      const sessionData = (sshManager as any)['connections'].get('test-session');
      expect(sessionData?.activeStreams).toBeDefined();
      expect(sessionData?.activeStreams?.size).toBeGreaterThan(0);

      // Cleanup
      setTimeout(() => {
        const streamCallbacks = mockStream.on.mock.calls;
        const closeCallback = streamCallbacks.find((call: any) => call[0] === 'close')?.[1];
        if (closeCallback) {
          closeCallback(0);
        }
      }, 100);

      await commandPromise;
    });
  });
});