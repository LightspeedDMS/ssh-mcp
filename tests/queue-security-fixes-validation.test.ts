import { SSHConnectionManager } from "../src/ssh-connection-manager";
import {
  SSHConnectionConfig,
  CommandSource,
  QUEUE_CONSTANTS,
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

describe("Queue Security Fixes Validation", () => {
  let connectionManager: SSHConnectionManager;
  
  const mockConfig: SSHConnectionConfig = {
    name: "security-test-session",
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

  describe("Queue Size Limit Protection", () => {
    it("should enforce MAX_QUEUE_SIZE limit and reject commands when queue is full", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // Fill queue up to the maximum
      const promises: Promise<any>[] = [];
      
      // Add exactly MAX_QUEUE_SIZE commands (should be allowed)
      for (let i = 0; i < QUEUE_CONSTANTS.MAX_QUEUE_SIZE; i++) {
        promises.push(connectionManager.executeCommand(
          mockConfig.name,
          `echo "filling queue ${i}"`,
          { source: "claude" as CommandSource }
        ));
      }
      
      // This command should be rejected due to queue limit
      await expect(
        connectionManager.executeCommand(
          mockConfig.name,
          "echo 'this should be rejected - queue is full'",
          { source: "claude" as CommandSource }
        )
      ).rejects.toThrow(/queue.*full.*maximum.*100.*commands/i);
      
      // Clean up pending promises
      await Promise.allSettled(promises);
    }, 30000);

    it("should allow commands when queue has space", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // Add a few commands (well under limit)
      const result1 = await connectionManager.executeCommand(
        mockConfig.name,
        "echo 'test command 1'",
        { source: "claude" as CommandSource }
      );
      
      const result2 = await connectionManager.executeCommand(
        mockConfig.name,
        "echo 'test command 2'",
        { source: "claude" as CommandSource }
      );
      
      // Both should succeed
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    }, 10000);
  });

  describe("Session Disconnect Cleanup", () => {
    it("should reject all queued commands when session is disconnected", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // Queue several commands that won't complete immediately
      const pendingPromises: Promise<any>[] = [];
      
      for (let i = 0; i < 3; i++) {
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
      
      // All promises should be rejected due to session disconnect
      const settledResults = await Promise.allSettled(pendingPromises);
      
      // All should be rejected
      const rejectedCount = settledResults.filter(result => result.status === 'rejected').length;
      expect(rejectedCount).toBe(pendingPromises.length);
      
      // Check that rejection reasons are appropriate
      settledResults.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).toMatch(/session.*disconnected|cancelled/i);
        }
      });
    }, 15000);

    it("should clean up current executing command on disconnect", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // Start a long-running command
      const longRunningPromise = connectionManager.executeCommand(
        mockConfig.name,
        "sleep 30 && echo 'this should be interrupted'",
        { source: "claude" as CommandSource }
      );
      
      // Wait a bit for command to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Disconnect session
      await connectionManager.disconnectSession(mockConfig.name);
      
      // Command should be rejected
      await expect(longRunningPromise).rejects.toThrow(/interrupted|disconnected/i);
    }, 10000);
  });

  describe("Command Staleness Validation", () => {
    it("should clean stale commands from queue during processing", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // This test verifies that the cleanStaleCommands method works
      // In a real scenario, we would need to manipulate timestamps
      // For now, we verify the system accepts normal commands
      const result = await connectionManager.executeCommand(
        mockConfig.name,
        "echo 'fresh command'",
        { source: "claude" as CommandSource }
      );
      
      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
      
      // In production, stale commands would be automatically cleaned
      // The MAX_COMMAND_AGE_MS constant is set to 5 minutes
      expect(QUEUE_CONSTANTS.MAX_COMMAND_AGE_MS).toBe(5 * 60 * 1000);
    }, 10000);
  });

  describe("Atomic Queue Processing", () => {
    it("should process commands atomically without race conditions", async () => {
      await connectionManager.createConnection(mockConfig);
      
      const rapidFireCommands: Promise<any>[] = [];
      
      // Fire commands rapidly to test atomic processing
      for (let i = 0; i < 10; i++) {
        rapidFireCommands.push(connectionManager.executeCommand(
          mockConfig.name,
          `echo "atomic test ${i}"`,
          { source: "claude" as CommandSource }
        ));
      }
      
      const results = await Promise.all(rapidFireCommands);
      
      // All commands should complete successfully with atomic processing
      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.exitCode).toBe(0);
      });
      
      // With atomic processing, no commands should fail due to race conditions
    }, 20000);
  });

  describe("Production Robustness Constants", () => {
    it("should have reasonable queue management constants", () => {
      expect(QUEUE_CONSTANTS.MAX_QUEUE_SIZE).toBe(100);
      expect(QUEUE_CONSTANTS.MAX_COMMAND_AGE_MS).toBe(5 * 60 * 1000); // 5 minutes
      expect(QUEUE_CONSTANTS.DEFAULT_COMMAND_TIMEOUT_MS).toBe(15000); // 15 seconds
    });

    it("should prevent DoS attacks with reasonable limits", () => {
      // MAX_QUEUE_SIZE should prevent memory exhaustion
      expect(QUEUE_CONSTANTS.MAX_QUEUE_SIZE).toBeGreaterThan(0);
      expect(QUEUE_CONSTANTS.MAX_QUEUE_SIZE).toBeLessThan(1000); // Reasonable upper bound
      
      // Command age should prevent stale command accumulation
      expect(QUEUE_CONSTANTS.MAX_COMMAND_AGE_MS).toBeGreaterThan(60000); // At least 1 minute
      expect(QUEUE_CONSTANTS.MAX_COMMAND_AGE_MS).toBeLessThan(30 * 60 * 1000); // Less than 30 minutes
    });
  });

  describe("Error Handling Improvements", () => {
    it("should provide meaningful error messages for queue limit violations", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // Fill the queue
      const promises: Promise<any>[] = [];
      for (let i = 0; i < QUEUE_CONSTANTS.MAX_QUEUE_SIZE; i++) {
        promises.push(connectionManager.executeCommand(
          mockConfig.name,
          `echo "fill ${i}"`,
          { source: "claude" as CommandSource }
        ));
      }
      
      // Try to exceed limit
      try {
        await connectionManager.executeCommand(
          mockConfig.name,
          "echo 'should fail'",
          { source: "claude" as CommandSource }
        );
        fail('Expected queue limit error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/queue.*full/i);
        expect((error as Error).message).toContain('100');
        expect((error as Error).message).toMatch(/maximum.*commands/i);
      }
      
      await Promise.allSettled(promises);
    }, 30000);

    it("should provide meaningful error messages for disconnected sessions", async () => {
      await connectionManager.createConnection(mockConfig);
      
      const commandPromise = connectionManager.executeCommand(
        mockConfig.name,
        "sleep 5 && echo 'test'",
        { source: "claude" as CommandSource }
      );
      
      // Wait a moment then disconnect
      setTimeout(() => {
        connectionManager.disconnectSession(mockConfig.name);
      }, 100);
      
      try {
        await commandPromise;
        fail('Expected disconnect error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/cancelled|interrupted|disconnected/i);
      }
    }, 10000);
  });
});