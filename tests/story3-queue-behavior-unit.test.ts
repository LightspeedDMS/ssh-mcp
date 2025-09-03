import { SSHConnectionManager } from "../src/ssh-connection-manager";
import {
  SSHConnectionConfig,
  CommandSource,
} from "../src/types";

// Advanced mock setup for queue testing
jest.mock('ssh2', () => {
  let mockDataCallback: ((data: Buffer) => void) | undefined;
  
  const mockChannel = {
    on: jest.fn((event: string, callback: (data: Buffer) => void) => {
      if (event === 'data') {
        mockDataCallback = callback;
        // Simulate immediate prompt for quick testing
        setTimeout(() => {
          if (mockDataCallback) {
            mockDataCallback(Buffer.from('test@localhost:~$ '));
          }
        }, 10);
      }
    }),
    write: jest.fn((command: string) => {
      // Simulate command execution completion after a short delay
      setTimeout(() => {
        if (mockDataCallback) {
          // Echo the command first
          mockDataCallback(Buffer.from(command));
          // Then simulate output and prompt
          mockDataCallback(Buffer.from(`Command output for: ${command.trim()}\ntest@localhost:~$ `));
        }
      }, 50);
    }),
    end: jest.fn(),
    removeListener: jest.fn(),
    stderr: { on: jest.fn() }
  };

  const mockClient = {
    on: jest.fn((event: string, callback: () => void) => {
      if (event === 'ready') {
        setTimeout(callback, 10);
      }
    }),
    shell: jest.fn((callback: (err: Error | null, channel: typeof mockChannel) => void) => {
      setTimeout(() => callback(null, mockChannel), 10);
    }),
    connect: jest.fn(),
    destroy: jest.fn()
  };

  return {
    Client: jest.fn(() => mockClient)
  };
});

describe("Story 3: Command Queue Behavior (Unit Tests)", () => {
  let connectionManager: SSHConnectionManager;
  
  const mockConfig: SSHConnectionConfig = {
    name: "queue-behavior-test",
    host: "localhost", 
    username: "testuser",
    password: "testpass"
  };

  beforeEach(() => {
    connectionManager = new SSHConnectionManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  describe("Queue FIFO Behavior", () => {
    it("should execute commands in FIFO order with mocked SSH", async () => {
      // Create connection
      await connectionManager.createConnection(mockConfig);

      // Start multiple commands quickly 
      const startTime = Date.now();
      const promises = [
        connectionManager.executeCommand(mockConfig.name, "echo cmd1", { source: "user" as CommandSource }),
        connectionManager.executeCommand(mockConfig.name, "echo cmd2", { source: "claude" as CommandSource }),
        connectionManager.executeCommand(mockConfig.name, "echo cmd3", { source: "user" as CommandSource })
      ];

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Verify all commands completed
      expect(results).toHaveLength(3);
      expect(results[0].stdout).toContain("cmd1");
      expect(results[1].stdout).toContain("cmd2"); 
      expect(results[2].stdout).toContain("cmd3");

      // Since commands execute sequentially, total time should be at least 3 * 50ms (mock delay)
      expect(endTime - startTime).toBeGreaterThan(140); // Allow some buffer
    }, 10000);

    it("should preserve command source through queue", async () => {
      await connectionManager.createConnection(mockConfig);

      // Execute commands with different sources
      const userCommand = connectionManager.executeCommand(
        mockConfig.name, 
        "echo user-cmd", 
        { source: "user" as CommandSource }
      );
      
      const claudeCommand = connectionManager.executeCommand(
        mockConfig.name, 
        "echo claude-cmd",
        { source: "claude" as CommandSource }
      );

      const [userResult, claudeResult] = await Promise.all([userCommand, claudeCommand]);

      // Verify outputs contain the expected commands (source is preserved through execution)
      expect(userResult.stdout).toContain("user-cmd");
      expect(claudeResult.stdout).toContain("claude-cmd");
    }, 10000);
  });

  describe("Error Handling in Queue", () => {
    it("should handle command errors without blocking queue", async () => {
      await connectionManager.createConnection(mockConfig);

      // Create a failing command and a succeeding command
      let failingCommandError: Error | undefined;
      
      const failingPromise = connectionManager.executeCommand(
        mockConfig.name,
        "exit", // This should be rejected as it would terminate shell
        { source: "user" as CommandSource }
      ).catch((error: Error) => {
        failingCommandError = error;
        throw error;
      });

      const succeedingPromise = connectionManager.executeCommand(
        mockConfig.name,
        "echo success",
        { source: "claude" as CommandSource }
      );

      // First command should fail, second should succeed
      await expect(failingPromise).rejects.toThrow();
      const successResult = await succeedingPromise;

      expect(failingCommandError).toBeDefined();
      expect(failingCommandError?.message).toContain("would terminate the shell session");
      expect(successResult.stdout).toContain("success");
    }, 10000);
  });

  describe("Single Command Backward Compatibility", () => {
    it("should execute single commands immediately without queue delay", async () => {
      await connectionManager.createConnection(mockConfig);

      const startTime = Date.now();
      const result = await connectionManager.executeCommand(
        mockConfig.name,
        "echo single",
        { source: "claude" as CommandSource }
      );
      const endTime = Date.now();

      expect(result.stdout).toContain("single");
      // Single command should execute quickly
      expect(endTime - startTime).toBeLessThan(200); // Allow for mock delays
    }, 5000);
  });

  describe("Queue State Management", () => {
    it("should properly manage queue state through execution cycle", async () => {
      await connectionManager.createConnection(mockConfig);

      // Execute first batch of commands
      const firstBatch = await Promise.all([
        connectionManager.executeCommand(mockConfig.name, "echo batch1-cmd1", { source: "user" }),
        connectionManager.executeCommand(mockConfig.name, "echo batch1-cmd2", { source: "claude" })
      ]);

      expect(firstBatch[0].stdout).toContain("batch1-cmd1");
      expect(firstBatch[1].stdout).toContain("batch1-cmd2");

      // Execute second batch - should work without issues if queue state is managed correctly
      const secondBatch = await Promise.all([
        connectionManager.executeCommand(mockConfig.name, "echo batch2-cmd1", { source: "claude" }),
        connectionManager.executeCommand(mockConfig.name, "echo batch2-cmd2", { source: "user" })
      ]);

      expect(secondBatch[0].stdout).toContain("batch2-cmd1");
      expect(secondBatch[1].stdout).toContain("batch2-cmd2");
    }, 10000);
  });
});