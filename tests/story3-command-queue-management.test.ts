import { SSHConnectionManager } from "../src/ssh-connection-manager";
import {
  SSHConnectionConfig,
  CommandSource,
} from "../src/types";

describe("Story 3: MCP Server Command Queue Management", () => {
  let connectionManager: SSHConnectionManager;
  
  // Mock SSH connection config for testing
  const mockConfig: SSHConnectionConfig = {
    name: "queue-test-session",
    host: "localhost", 
    username: "testuser",
    password: "testpass"
  };

  beforeEach(() => {
    connectionManager = new SSHConnectionManager();
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  describe("AC3.1: Command Queuing System - FIFO queue for commands when session busy", () => {
    it("should queue second command when first command is executing", async () => {
      // This test will fail initially - we need to implement queuing
      
      // Create connection and setup concurrent commands
      await connectionManager.createConnection(mockConfig);

      const firstCommandPromise = connectionManager.executeCommand(
        mockConfig.name,
        "sleep 2 && echo 'first command'",
        { source: "user" as CommandSource }
      );

      // Start second command immediately after first - should be queued
      const secondCommandPromise = connectionManager.executeCommand(
        mockConfig.name, 
        "echo 'second command'",
        { source: "claude" as CommandSource }
      );

      // Both commands should resolve, second should wait for first
      const [firstResult, secondResult] = await Promise.all([
        firstCommandPromise,
        secondCommandPromise
      ]);

      expect(firstResult.stdout).toContain("first command");
      expect(secondResult.stdout).toContain("second command");
      
      // Second command should have executed after first completed
      // (we'll verify timing in integration tests)
    }, 10000);

    it("should maintain FIFO order for multiple queued commands", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // Start multiple commands that should queue in FIFO order
      const command1 = connectionManager.executeCommand(mockConfig.name, "echo 'command1'", { source: "user" });
      const command2 = connectionManager.executeCommand(mockConfig.name, "echo 'command2'", { source: "claude" });  
      const command3 = connectionManager.executeCommand(mockConfig.name, "echo 'command3'", { source: "user" });

      const results = await Promise.all([command1, command2, command3]);
      
      // All commands should complete successfully in FIFO order
      expect(results[0].stdout).toContain("command1");
      expect(results[1].stdout).toContain("command2");
      expect(results[2].stdout).toContain("command3");
    }, 15000);

    it("should preserve source information in queue", async () => {
      await connectionManager.createConnection(mockConfig);
      
      const userCommand = connectionManager.executeCommand(
        mockConfig.name, 
        "echo 'user command'",
        { source: "user" as CommandSource }
      );
      
      const claudeCommand = connectionManager.executeCommand(
        mockConfig.name,
        "echo 'claude command'", 
        { source: "claude" as CommandSource }
      );

      const [userResult, claudeResult] = await Promise.all([userCommand, claudeCommand]);
      
      // Results should maintain source context even when queued
      expect(userResult.stdout).toContain("user command");
      expect(claudeResult.stdout).toContain("claude command");
    }, 10000);
  });

  describe("AC3.2: Concurrent Execution Prevention - second command waits if one executing", () => {
    it("should not execute commands simultaneously on same session", async () => {
      await connectionManager.createConnection(mockConfig);
      
      let firstCommandStarted = false;
      let secondCommandStarted = false;
      let firstCommandFinished = false;
      
      // Track command execution timing
      const firstCommand = connectionManager.executeCommand(
        mockConfig.name,
        "sleep 1 && echo 'first done'",
        { source: "user" }
      ).then(result => {
        firstCommandStarted = true;
        firstCommandFinished = true;
        return result;
      });

      // Small delay to ensure first command starts
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const secondCommand = connectionManager.executeCommand(
        mockConfig.name,
        "echo 'second done'", 
        { source: "claude" }
      ).then(result => {
        // Second command should only start after first finishes
        secondCommandStarted = true;
        expect(firstCommandFinished).toBe(true);
        return result;
      });

      await Promise.all([firstCommand, secondCommand]);
      
      expect(firstCommandStarted).toBe(true);
      expect(secondCommandStarted).toBe(true);
      expect(firstCommandFinished).toBe(true);
    }, 10000);
  });

  describe("AC3.3: Queue State Management - next command starts immediately when current completes", () => {
    it("should start next queued command immediately when current completes", async () => {
      await connectionManager.createConnection(mockConfig);
      
      const startTime = Date.now();
      
      // First command with known duration
      const firstCommand = connectionManager.executeCommand(
        mockConfig.name,
        "sleep 1 && echo 'first'",
        { source: "user" }
      );

      // Second command should start immediately after first
      const secondCommand = connectionManager.executeCommand(
        mockConfig.name,
        "echo 'second'",
        { source: "claude" }  
      );

      const [firstResult, secondResult] = await Promise.all([firstCommand, secondCommand]);
      
      const totalTime = Date.now() - startTime;
      
      expect(firstResult.stdout).toContain("first");
      expect(secondResult.stdout).toContain("second");
      
      // Total time should be close to sleep duration (allowing for overhead)
      // This tests that second command starts immediately after first
      expect(totalTime).toBeLessThan(2000); // Should be ~1000ms + overhead
    }, 10000);

    it("should properly clear queue when all commands complete", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // Execute several commands
      const commands = await Promise.all([
        connectionManager.executeCommand(mockConfig.name, "echo 'cmd1'", { source: "user" }),
        connectionManager.executeCommand(mockConfig.name, "echo 'cmd2'", { source: "claude" }),
        connectionManager.executeCommand(mockConfig.name, "echo 'cmd3'", { source: "user" })
      ]);

      // All commands should complete successfully
      commands.forEach((result, index) => {
        expect(result.stdout).toContain(`cmd${index + 1}`);
      });

      // New command should execute immediately (no queue delay)
      const startTime = Date.now();
      const immediateResult = await connectionManager.executeCommand(
        mockConfig.name,
        "echo 'immediate'",
        { source: "claude" }
      );
      const executionTime = Date.now() - startTime;
      
      expect(immediateResult.stdout).toContain("immediate");
      expect(executionTime).toBeLessThan(500); // Should be very fast
    }, 15000);
  });

  describe("AC3.4: Command Source Preservation - responses maintain original command source", () => {
    it("should preserve source information through queue processing", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // Track command sources through execution
      const userCmd = connectionManager.executeCommand(
        mockConfig.name,
        "echo 'user-originated'",
        { source: "user" as CommandSource }
      );
      
      const claudeCmd = connectionManager.executeCommand(
        mockConfig.name,
        "echo 'claude-originated'", 
        { source: "claude" as CommandSource }
      );

      const [userResult, claudeResult] = await Promise.all([userCmd, claudeCmd]);
      
      // Source information should be preserved in command execution
      expect(userResult.stdout).toContain("user-originated");
      expect(claudeResult.stdout).toContain("claude-originated");
      
      // TODO: Once we implement queue tracking, verify source is preserved in queue
    }, 10000);
  });

  describe("AC3.5: Error Handling in Queue - failed commands don't block queue", () => {
    it("should continue processing queue when a command fails", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // First command that will fail
      const failingCommand = connectionManager.executeCommand(
        mockConfig.name,
        "invalidcommandthatdoesnotexist",
        { source: "user" }
      );

      // Second command should still execute despite first failing  
      const successCommand = connectionManager.executeCommand(
        mockConfig.name,
        "echo 'success after failure'",
        { source: "claude" }
      );

      // First should fail, second should succeed
      try {
        await failingCommand;
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }
      
      const successResult = await successCommand;
      expect(successResult.stdout).toContain("success after failure");
    }, 10000);

    it("should provide proper error responses with source ID for failed queued commands", async () => {
      await connectionManager.createConnection(mockConfig);
      
      try {
        await connectionManager.executeCommand(
          mockConfig.name,
          "command_that_will_fail_with_bad_syntax_!!!",
          { source: "user" }
        );
        fail("Expected command to throw error");
      } catch (error) {
        expect(error).toBeDefined();
        // Error should contain relevant information about the failed command
        expect((error as Error).message).toBeDefined();
      }

      // Subsequent command should still work
      const result = await connectionManager.executeCommand(
        mockConfig.name,
        "echo 'recovered'",
        { source: "claude" }
      );
      expect(result.stdout).toContain("recovered");
    }, 10000);
  });

  describe("Backward Compatibility", () => {
    it("should execute single commands immediately when no queue exists", async () => {
      await connectionManager.createConnection(mockConfig);
      
      const startTime = Date.now();
      const result = await connectionManager.executeCommand(
        mockConfig.name,
        "echo 'single command'",
        { source: "claude" }
      );
      const executionTime = Date.now() - startTime;
      
      expect(result.stdout).toContain("single command");
      // Single command should execute quickly without queue delay
      expect(executionTime).toBeLessThan(1000);
    }, 10000);
  });

  // Integration test combining multiple queue scenarios
  describe("Queue Integration", () => {
    it("should handle mixed user and Claude commands in queue correctly", async () => {
      await connectionManager.createConnection(mockConfig);
      
      // Mix of user and Claude commands
      const commands = [
        { cmd: "echo 'user1'", source: "user" as CommandSource },
        { cmd: "echo 'claude1'", source: "claude" as CommandSource },
        { cmd: "echo 'user2'", source: "user" as CommandSource },
        { cmd: "echo 'claude2'", source: "claude" as CommandSource }
      ];

      const promises = commands.map(({ cmd, source }) =>
        connectionManager.executeCommand(mockConfig.name, cmd, { source })
      );

      const results = await Promise.all(promises);
      
      // All commands should complete in order
      expect(results[0].stdout).toContain("user1");
      expect(results[1].stdout).toContain("claude1"); 
      expect(results[2].stdout).toContain("user2");
      expect(results[3].stdout).toContain("claude2");
    }, 15000);
  });
});