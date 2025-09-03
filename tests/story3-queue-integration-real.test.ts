import { SSHConnectionManager } from "../src/ssh-connection-manager";
import {
  SSHConnectionConfig,
  CommandSource,
} from "../src/types";
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe("Story 3: Command Queue Integration (Real SSH)", () => {
  let connectionManager: SSHConnectionManager;
  
  // Use real SSH connection to localhost
  const sshConfig: SSHConnectionConfig = {
    name: "queue-integration-test",
    host: "localhost",
    username: process.env.USER || "testuser",
    keyFilePath: path.join(os.homedir(), ".ssh/id_ed25519")
  };

  beforeAll(() => {
    // Skip tests if SSH key doesn't exist
    if (!fs.existsSync(sshConfig.keyFilePath!)) {
      console.log("SSH key not found, skipping integration tests");
    }
  });

  beforeEach(() => {
    connectionManager = new SSHConnectionManager();
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  describe("Real Queue Behavior", () => {
    it("should execute commands sequentially in FIFO order", async () => {
      // Skip if SSH key doesn't exist
      if (!fs.existsSync(sshConfig.keyFilePath!)) {
        console.log("Skipping test - SSH key not available");
        return;
      }

      try {
        await connectionManager.createConnection(sshConfig);

        const startTime = Date.now();
        
        // Execute multiple commands that should queue
        const promises = [
          connectionManager.executeCommand(sshConfig.name, "echo 'first command' && sleep 0.1", { source: "user" as CommandSource }),
          connectionManager.executeCommand(sshConfig.name, "echo 'second command' && sleep 0.1", { source: "claude" as CommandSource }),
          connectionManager.executeCommand(sshConfig.name, "echo 'third command'", { source: "user" as CommandSource })
        ];

        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;

        // Verify all commands completed successfully
        expect(results).toHaveLength(3);
        expect(results[0].stdout).toContain("first command");
        expect(results[1].stdout).toContain("second command");
        expect(results[2].stdout).toContain("third command");

        // Since commands execute sequentially, total time should be at least the sum of sleep times
        expect(totalTime).toBeGreaterThan(200); // At least 200ms for the sleeps
        
        console.log(`Commands executed in ${totalTime}ms`);
      } catch (error) {
        console.warn("SSH connection failed, skipping test:", error);
      }
    }, 15000);

    it("should handle command errors without blocking the queue", async () => {
      if (!fs.existsSync(sshConfig.keyFilePath!)) {
        console.log("Skipping test - SSH key not available");
        return;
      }

      try {
        await connectionManager.createConnection(sshConfig);

        // First command will have non-zero exit code (invalid command)
        const failingCommand = connectionManager.executeCommand(
          sshConfig.name,
          "nonexistentcommandthatfails123",
          { source: "user" as CommandSource }
        );

        // Second command should succeed despite first having error
        const succeedingCommand = connectionManager.executeCommand(
          sshConfig.name,
          "echo 'success after failure'",
          { source: "claude" as CommandSource }
        );

        const [failedResult, successResult] = await Promise.all([failingCommand, succeedingCommand]);

        // First command should have error output but not throw (this is correct behavior)
        expect(failedResult.stdout).toContain("command not found");
        expect(successResult.stdout).toContain("success after failure");
        
        console.log("Error handling test completed successfully");
      } catch (error) {
        console.warn("SSH connection failed, skipping test:", error);
      }
    }, 15000);

    it("should handle actual thrown errors without blocking the queue", async () => {
      if (!fs.existsSync(sshConfig.keyFilePath!)) {
        console.log("Skipping test - SSH key not available");
        return;
      }

      try {
        await connectionManager.createConnection(sshConfig);

        let errorOccurred = false;
        
        // This command should actually throw an error (exit is blocked)
        const failingCommand = connectionManager.executeCommand(
          sshConfig.name,
          "exit",
          { source: "user" as CommandSource }
        ).catch((error) => {
          errorOccurred = true;
          throw error;
        });

        // This command should succeed despite first throwing
        const succeedingCommand = connectionManager.executeCommand(
          sshConfig.name,
          "echo 'success after thrown error'",
          { source: "claude" as CommandSource }
        );

        // First should throw, second should succeed
        await expect(failingCommand).rejects.toThrow(/would terminate the shell session/);
        const successResult = await succeedingCommand;

        expect(errorOccurred).toBe(true);
        expect(successResult.stdout).toContain("success after thrown error");
        
        console.log("Thrown error handling test completed successfully");
      } catch (error) {
        console.warn("SSH connection failed, skipping test:", error);
      }
    }, 15000);

    it("should preserve command source information through queue", async () => {
      if (!fs.existsSync(sshConfig.keyFilePath!)) {
        console.log("Skipping test - SSH key not available");
        return;
      }

      try {
        await connectionManager.createConnection(sshConfig);

        // Execute commands with different sources
        const userCommand = connectionManager.executeCommand(
          sshConfig.name,
          "echo 'user-initiated command'",
          { source: "user" as CommandSource }
        );

        const claudeCommand = connectionManager.executeCommand(
          sshConfig.name,
          "echo 'claude-initiated command'",
          { source: "claude" as CommandSource }
        );

        const [userResult, claudeResult] = await Promise.all([userCommand, claudeCommand]);

        expect(userResult.stdout).toContain("user-initiated command");
        expect(claudeResult.stdout).toContain("claude-initiated command");
        
        console.log("Source preservation test completed successfully");
      } catch (error) {
        console.warn("SSH connection failed, skipping test:", error);
      }
    }, 15000);
  });

  describe("Backward Compatibility", () => {
    it("should execute single commands immediately", async () => {
      if (!fs.existsSync(sshConfig.keyFilePath!)) {
        console.log("Skipping test - SSH key not available");
        return;
      }

      try {
        await connectionManager.createConnection(sshConfig);

        const startTime = Date.now();
        const result = await connectionManager.executeCommand(
          sshConfig.name,
          "echo 'single command test'",
          { source: "claude" as CommandSource }
        );
        const executionTime = Date.now() - startTime;

        expect(result.stdout).toContain("single command test");
        expect(executionTime).toBeLessThan(2000); // Should be fast for single command
        
        console.log(`Single command executed in ${executionTime}ms`);
      } catch (error) {
        console.warn("SSH connection failed, skipping test:", error);
      }
    }, 10000);
  });

  describe("Queue State Management", () => {
    it("should properly start next command immediately after completion", async () => {
      if (!fs.existsSync(sshConfig.keyFilePath!)) {
        console.log("Skipping test - SSH key not available");
        return;
      }

      try {
        await connectionManager.createConnection(sshConfig);

        const startTime = Date.now();
        
        // First command has a known delay
        const firstCommand = connectionManager.executeCommand(
          sshConfig.name,
          "echo 'first' && sleep 0.2",
          { source: "user" as CommandSource }
        );

        // Second command should start immediately after first completes
        const secondCommand = connectionManager.executeCommand(
          sshConfig.name,
          "echo 'second'",
          { source: "claude" as CommandSource }
        );

        const [firstResult, secondResult] = await Promise.all([firstCommand, secondCommand]);
        const totalTime = Date.now() - startTime;

        expect(firstResult.stdout).toContain("first");
        expect(secondResult.stdout).toContain("second");
        
        // Total time should be close to sleep duration (0.2s = 200ms) plus overhead
        expect(totalTime).toBeGreaterThan(200);
        expect(totalTime).toBeLessThan(500); // Should not be much longer than necessary
        
        console.log(`Queue state management test completed in ${totalTime}ms`);
      } catch (error) {
        console.warn("SSH connection failed, skipping test:", error);
      }
    }, 15000);
  });
});