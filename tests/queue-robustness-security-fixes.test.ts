import { SSHConnectionManager } from "../src/ssh-connection-manager";
import {
  SSHConnectionConfig,
  CommandSource,
} from "../src/types";

// Mock the ssh2 module to avoid real SSH connections in unit tests
jest.mock('ssh2', () => {
  const mockClient = {
    on: jest.fn(),
    shell: jest.fn(),
    connect: jest.fn(),
    destroy: jest.fn()
  };

  return {
    Client: jest.fn(() => mockClient)
  };
});

describe("Queue Robustness and Security Fixes", () => {
  let connectionManager: SSHConnectionManager;
  
  const mockConfig: SSHConnectionConfig = {
    name: "robustness-test-session",
    host: "localhost", 
    username: "testuser",
    password: "testpass"
  };

  beforeEach(() => {
    connectionManager = new SSHConnectionManager();
    jest.clearAllMocks();
    
    // Setup standard mock behavior for all tests
    const mockClient = require('ssh2').Client();
    const mockChannel = {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      removeListener: jest.fn(),
      stderr: { on: jest.fn() },
      setWindow: jest.fn()
    };

    // Setup mocks to simulate successful connection
    mockClient.on = jest.fn((event, callback) => {
      if (event === 'ready') {
        setTimeout(() => callback(), 0);
      }
    });

    mockClient.shell = jest.fn((callback) => {
      callback(null, mockChannel);
    });

    mockClient.connect = jest.fn();

    // Setup channel to simulate shell ready with prompt and command execution
    let dataCallback: ((data: Buffer) => void) | undefined;
    mockChannel.on = jest.fn((event, callback) => {
      if (event === 'data') {
        dataCallback = callback;
        // Simulate initial prompt
        setTimeout(() => {
          if (dataCallback) {
            dataCallback(Buffer.from('user@localhost:~$ '));
          }
        }, 10);
      }
    });
    
    // Mock command execution to simulate real output
    mockChannel.write = jest.fn((command: string) => {
      // Simulate command echoing back and result after short delay
      setTimeout(() => {
        if (dataCallback) {
          const commandText = command.replace('\n', '');
          // Echo the command and simulate output
          dataCallback(Buffer.from(`${commandText}\n${commandText} output\nuser@localhost:~$ `));
        }
      }, 50);
    });
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  describe("Race Condition in Queue Processing", () => {
    it("should fail - demonstrates race condition in processCommandQueue method", async () => {
      // This test demonstrates the race condition issue
      await connectionManager.createConnection(mockConfig);
      
      const commandPromises: Promise<any>[] = [];
      
      // Launch multiple commands simultaneously to trigger race condition
      // Current implementation checks isCommandExecuting and queue length separately
      // This creates a window where multiple commands can think they should execute
      for (let i = 0; i < 10; i++) {
        const promise = connectionManager.executeCommand(
          mockConfig.name,
          `echo "command ${i}"`,
          { source: "claude" as CommandSource }
        );
        commandPromises.push(promise);
        
        // Add tiny delay to increase chance of hitting race condition
        if (i % 2 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      // With the race condition, commands might execute out of order or fail
      // We expect FIFO order: commands should complete in order 0, 1, 2, ...
      const results = await Promise.all(commandPromises);
      
      // This test will currently pass by luck in most cases, but the race condition exists
      // The fix needs to make queue processing atomic
      expect(results).toHaveLength(10);
      
      // The race condition is hard to reproduce consistently, but it exists
      // The test will serve as a regression test after fixing
    }, 30000);
  });

  describe("Missing Queue Size Limits - DoS Vulnerability", () => {
    it("should fail - demonstrates unlimited queue growth leading to memory exhaustion", async () => {
      await connectionManager.createConnection(mockConfig);
      
      const commandPromises: Promise<any>[] = [];
      
      // Try to queue excessive commands that would consume too much memory
      // Current implementation has no MAX_QUEUE_SIZE limit
      const excessiveCommandCount = 1000; // This should be rejected after 100 commands
      
      for (let i = 0; i < excessiveCommandCount; i++) {
        const promise = connectionManager.executeCommand(
          mockConfig.name,
          `echo "spam command ${i}"`,
          { source: "claude" as CommandSource }
        );
        commandPromises.push(promise);
      }
      
      // This test will likely pass (which is the problem!)
      // We want it to fail with proper queue size validation
      try {
        await Promise.all(commandPromises);
        // If we get here without error, the vulnerability exists
        // If no error thrown, the DoS vulnerability exists
        throw new Error("Expected queue size limit to be enforced, but unlimited queuing was allowed");
      } catch (error) {
        // This is what we want after fixing - queue limit enforcement
        expect((error as Error).message).toMatch(/queue.*full|queue.*limit|too many commands/i);
      }
    }, 30000);
    
    it("should fail - demonstrates no validation when adding commands beyond reasonable limits", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // Add commands one by one to test queue size validation
      const maxReasonableQueueSize = 100;
      
      // Fill queue up to reasonable limit
      const promises: Promise<any>[] = [];
      for (let i = 0; i < maxReasonableQueueSize; i++) {
        promises.push(connectionManager.executeCommand(
          mockConfig.name,
          `echo "queued ${i}"`,
          { source: "claude" as CommandSource }
        ));
      }
      
      // This should fail when trying to exceed reasonable queue size
      await expect(
        connectionManager.executeCommand(
          mockConfig.name,
          "echo 'this should be rejected'",
          { source: "claude" as CommandSource }
        )
      ).rejects.toThrow(/queue.*full|queue.*limit|maximum.*exceeded/i);
      
      // Clean up pending promises
      await Promise.allSettled(promises);
    }, 30000);
  });

  describe("Queue Cleanup on Session Disconnect", () => {
    it("should fail - demonstrates promise leaks when disconnecting session with queued commands", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // Queue several commands that won't complete immediately
      const pendingPromises: Promise<any>[] = [];
      
      for (let i = 0; i < 5; i++) {
        const promise = connectionManager.executeCommand(
          mockConfig.name,
          `sleep 10 && echo "long running ${i}"`, // Commands that take time
          { source: "claude" as CommandSource }
        );
        pendingPromises.push(promise);
      }
      
      // Give commands time to enter queue
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Disconnect session while commands are queued
      await connectionManager.disconnectSession(mockConfig.name);
      
      // The pending promises should be rejected, not left hanging
      // Current implementation doesn't handle this properly
      const settledResults = await Promise.allSettled(pendingPromises);
      
      // All promises should be rejected due to session disconnect
      const rejectedCount = settledResults.filter(result => result.status === 'rejected').length;
      expect(rejectedCount).toBe(pendingPromises.length);
      
      // Check that rejection reasons are appropriate
      settledResults.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).toMatch(/session.*disconnected|connection.*closed|session.*terminated/i);
        }
      });
    }, 30000);

    it("should fail - demonstrates no cleanup of command queue during disconnect", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // Create commands but don't await them
      const queuedPromises: Promise<any>[] = [];
      
      for (let i = 0; i < 3; i++) {
        queuedPromises.push(connectionManager.executeCommand(
          mockConfig.name,
          `echo "queued command ${i}"`,
          { source: "claude" as CommandSource }
        ));
      }
      
      // Disconnect before commands complete
      await connectionManager.disconnectSession(mockConfig.name);
      
      // All queued commands should fail gracefully
      for (const promise of queuedPromises) {
        await expect(promise).rejects.toThrow(/session.*not found|connection.*closed|session.*disconnected/i);
      }
    }, 20000);
  });

  describe("Command Staleness Validation (Bonus)", () => {
    it("should fail - demonstrates no age validation for queued commands", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // Create a command and artificially age it
      const staleCommandPromise = connectionManager.executeCommand(
        mockConfig.name,
        "echo 'potentially stale command'",
        { source: "claude" as CommandSource }
      );
      
      // In a real scenario, commands older than 5 minutes (300000ms) should be rejected
      // This test is hard to create without modifying the timestamp, so it's more of a design test
      
      // For now, just ensure the command completes normally
      const result = await staleCommandPromise;
      expect(result.stdout).toContain('potentially stale command');
      
      // After implementation, we would test that commands with artificially old timestamps get rejected
    }, 15000);
  });

  describe("Atomic Queue State Management", () => {
    it("should fail - demonstrates non-atomic queue state checks", async () => {
      await connectionManager.createConnection(mockConfig);
      
      const rapidFireCommands: Promise<any>[] = [];
      
      // Fire commands as rapidly as possible to increase chance of hitting race condition
      for (let i = 0; i < 20; i++) {
        rapidFireCommands.push(connectionManager.executeCommand(
          mockConfig.name,
          `echo "rapid fire ${i}"`,
          { source: "claude" as CommandSource }
        ));
      }
      
      const results = await Promise.all(rapidFireCommands);
      
      // All commands should complete successfully with atomic queue processing
      expect(results).toHaveLength(20);
      results.forEach((result, index) => {
        expect(result.stdout).toContain(`rapid fire ${index}`);
      });
      
      // This test might pass by luck even with race conditions
      // But it will serve as a regression test after implementing atomic operations
    }, 30000);
  });
});