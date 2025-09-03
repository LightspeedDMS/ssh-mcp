import { SSHConnectionManager } from "../src/ssh-connection-manager";
import { SSHConnectionConfig } from "../src/types";

describe("Story 2: Command Source Identification - SSH Manager Enhancement", () => {
  let sshManager: SSHConnectionManager;
  let testSessionName: string;

  beforeEach(async () => {
    sshManager = new SSHConnectionManager();
    testSessionName = `test-session-${Date.now()}`;
  });

  afterEach(() => {
    sshManager.cleanup();
  });

  describe("AC2.2: Command Source Identification", () => {
    it("should accept command source parameter in executeCommand method", async () => {
      // Arrange: Create SSH session
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost",
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      // Act & Assert: This should not throw when source is provided
      await expect(async () => {
        await sshManager.executeCommand(testSessionName, 'echo "test"', { source: 'user' });
      }).not.toThrow();
    }, 10000);

    it("should preserve command source through execution", async () => {
      // This will fail initially - executeCommand doesn't accept source yet
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost",
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      // Mock command history listener to capture source information
      let capturedHistoryEntry: any = null;
      sshManager.addCommandHistoryListener(testSessionName, (entry) => {
        capturedHistoryEntry = entry;
      });

      await sshManager.executeCommand(testSessionName, 'echo "user command"', { source: 'user' });

      expect(capturedHistoryEntry).toBeDefined();
      expect(capturedHistoryEntry.source).toBe('user');
    }, 10000);

    it("should track commands as claude-initiated when source is claude", async () => {
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost",
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      let capturedHistoryEntry: any = null;
      sshManager.addCommandHistoryListener(testSessionName, (entry) => {
        capturedHistoryEntry = entry;
      });

      await sshManager.executeCommand(testSessionName, 'echo "claude command"', { source: 'claude' });

      expect(capturedHistoryEntry).toBeDefined();
      expect(capturedHistoryEntry.source).toBe('claude');
    }, 10000);

    it("should default to claude source when no source is provided", async () => {
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost",
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      let capturedHistoryEntry: any = null;
      sshManager.addCommandHistoryListener(testSessionName, (entry) => {
        capturedHistoryEntry = entry;
      });

      // Execute without source parameter
      await sshManager.executeCommand(testSessionName, 'echo "default command"');

      expect(capturedHistoryEntry).toBeDefined();
      expect(capturedHistoryEntry.source).toBe('claude');
    }, 10000);

    it("should include command source in terminal output streaming", async () => {
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost", 
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      // This will fail initially - output entries don't include source yet
      let capturedOutputEntry: any = null;
      sshManager.addTerminalOutputListener(testSessionName, (entry) => {
        if (!capturedOutputEntry && entry.output) {
          capturedOutputEntry = entry;
        }
      });

      await sshManager.executeCommand(testSessionName, 'echo "sourced command"', { source: 'user' });

      expect(capturedOutputEntry).toBeDefined();
      expect(capturedOutputEntry.source).toBe('user');
    }, 10000);
  });

  describe("Command Source Type Validation", () => {
    it("should accept only valid source values", async () => {
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost",
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      // Valid sources should work
      await expect(
        sshManager.executeCommand(testSessionName, 'echo "user"', { source: 'user' })
      ).resolves.toBeDefined();
      
      await expect(
        sshManager.executeCommand(testSessionName, 'echo "claude"', { source: 'claude' })
      ).resolves.toBeDefined();

      // Invalid source should throw error
      await expect(
        sshManager.executeCommand(testSessionName, 'echo "invalid"', { source: 'invalid' as any })
      ).rejects.toThrow('Invalid command source');
    }, 15000);

    it("should validate source parameter type", async () => {
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost",
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      // Non-string source should throw error
      await expect(
        sshManager.executeCommand(testSessionName, 'echo "test"', { source: 123 as any })
      ).rejects.toThrow('Command source must be a string');
    }, 10000);
  });
});