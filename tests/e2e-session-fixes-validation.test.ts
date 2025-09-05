import { SSHConnectionManager } from "../src/ssh-connection-manager";
import { SSHConnectionConfig } from "../src/types";
import * as os from 'os';
import * as path from 'path';

describe("E2E Session Fixes Validation", () => {
  let connectionManager: SSHConnectionManager;
  const testConfig: SSHConnectionConfig = {
    name: "e2e-session-fixes",
    host: "localhost",
    username: "jsbattig",
    keyFilePath: path.join(os.homedir(), '.ssh/id_ed25519'),
  };

  beforeEach(() => {
    connectionManager = new SSHConnectionManager();
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  describe("Critical Fix: Shell-Terminating Command Prevention", () => {
    it("should prevent exit command from terminating shell session", async () => {
      await connectionManager.createConnection(testConfig);

      // Attempt to execute exit command should be rejected
      await expect(
        connectionManager.executeCommand(testConfig.name, "exit"),
      ).rejects.toThrow(
        "would terminate the shell session, breaking session state persistence",
      );

      // Session should remain active and usable after prevention
      const result = await connectionManager.executeCommand(
        testConfig.name,
        'echo "session still active"',
      );
      expect(result.stdout.trim()).toBe("session still active");
      expect(result.exitCode).toBe(0);
    }, 20000);

    it("should prevent exit with code from terminating shell session", async () => {
      await connectionManager.createConnection(testConfig);

      await expect(
        connectionManager.executeCommand(testConfig.name, "exit 42"),
      ).rejects.toThrow("would terminate the shell session");

      // Verify session integrity maintained
      const verifyResult = await connectionManager.executeCommand(
        testConfig.name,
        "whoami",
      );
      expect(verifyResult.stdout.trim()).toBe("test_user");
    }, 20000);

    it("should prevent logout command from terminating shell session", async () => {
      await connectionManager.createConnection(testConfig);

      await expect(
        connectionManager.executeCommand(testConfig.name, "logout"),
      ).rejects.toThrow("would terminate the shell session");
    }, 20000);
  });

  describe("Critical Fix: STDERR Handling Documentation", () => {
    it("should document that stderr is combined with stdout in shell sessions", async () => {
      await connectionManager.createConnection(testConfig);

      // Error output should appear in stdout, not stderr
      const result = await connectionManager.executeCommand(
        testConfig.name,
        'echo "This is an error" >&2',
      );

      expect(result.stdout.trim()).toBe("This is an error");
      expect(result.stderr).toBe(""); // Always empty for shell sessions
      expect(result.exitCode).toBe(0);
    }, 20000);

    it("should handle mixed stdout and stderr output correctly", async () => {
      await connectionManager.createConnection(testConfig);

      const result = await connectionManager.executeCommand(
        testConfig.name,
        'echo "stdout message"; echo "stderr message" >&2; echo "more stdout"',
      );

      // All output should be in stdout
      expect(result.stdout).toContain("stdout message");
      expect(result.stdout).toContain("stderr message");
      expect(result.stdout).toContain("more stdout");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    }, 20000);
  });

  describe("Performance Fix: No Artificial Delays", () => {
    it("should execute commands without artificial delays", async () => {
      await connectionManager.createConnection(testConfig);

      const startTime = Date.now();
      const result = await connectionManager.executeCommand(
        testConfig.name,
        'echo "fast execution"',
      );
      const endTime = Date.now();

      expect(result.stdout.trim()).toBe("fast execution");
      expect(result.exitCode).toBe(0);

      // Should complete quickly - well under 1 second for simple command
      // We allow some network latency but no artificial delays
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(7000); // 7 second max including network and test environment overhead
    }, 20000);

    it("should execute multiple commands efficiently without accumulated delays", async () => {
      await connectionManager.createConnection(testConfig);

      const startTime = Date.now();

      // Execute 5 simple commands in sequence
      for (let i = 1; i <= 5; i++) {
        const result = await connectionManager.executeCommand(
          testConfig.name,
          `echo "Command ${i}"`,
        );
        expect(result.stdout.trim()).toBe(`Command ${i}`);
      }

      const totalTime = Date.now() - startTime;

      // Should not have accumulated artificial delays
      // Each command should be fast, total should be reasonable
      expect(totalTime).toBeLessThan(15000); // 15 seconds max for 5 commands
    }, 30000);
  });

  describe("Session State Persistence Validation", () => {
    it("should maintain session state without unauthorized fallbacks", async () => {
      await connectionManager.createConnection(testConfig);

      // Set up persistent state
      await connectionManager.executeCommand(
        testConfig.name,
        'export TEST_SESSION_VAR="persistent_state"',
      );

      // Change directory
      await connectionManager.executeCommand(
        testConfig.name,
        "mkdir -p ~/test-session-validation && cd ~/test-session-validation",
      );

      // Verify state persists across multiple commands
      const envResult = await connectionManager.executeCommand(
        testConfig.name,
        "echo $TEST_SESSION_VAR",
      );
      expect(envResult.stdout.trim()).toBe("persistent_state");

      const pwdResult = await connectionManager.executeCommand(
        testConfig.name,
        "pwd",
      );
      expect(pwdResult.stdout.trim()).toContain("test-session-validation");

      // Cleanup
      await connectionManager.executeCommand(
        testConfig.name,
        "cd ~ && rm -rf ~/test-session-validation",
      );
    }, 30000);

    it("should handle shell unavailability with proper error messages", async () => {
      const manager = new SSHConnectionManager();

      // Create connection but don't let shell initialize properly by cleanup immediately
      await manager.createConnection(testConfig);
      manager.cleanup(); // This should make shell unavailable

      // Attempting to use should give clear error
      await expect(
        manager.executeCommand(testConfig.name, 'echo "test"'),
      ).rejects.toThrow("Connection");

      manager.cleanup();
    }, 20000);
  });

  describe("Exit Code Handling Robustness", () => {
    it("should correctly capture exit codes for successful commands", async () => {
      await connectionManager.createConnection(testConfig);

      const result = await connectionManager.executeCommand(
        testConfig.name,
        "true",
      );
      expect(result.exitCode).toBe(0);
    }, 20000);

    it("should correctly capture exit codes for failed commands", async () => {
      await connectionManager.createConnection(testConfig);

      const result = await connectionManager.executeCommand(
        testConfig.name,
        "false",
      );
      expect(result.exitCode).toBe(1);
    }, 20000);

    it("should correctly capture custom exit codes", async () => {
      await connectionManager.createConnection(testConfig);

      // Use a non-terminating way to return custom exit code
      const result = await connectionManager.executeCommand(
        testConfig.name,
        'bash -c "exit 42"',
      );
      expect(result.exitCode).toBe(42);
    }, 20000);
  });

  describe("Edge Case Handling", () => {
    it("should handle commands with complex output parsing", async () => {
      await connectionManager.createConnection(testConfig);

      // Command that produces output similar to our parsing patterns
      const result = await connectionManager.executeCommand(
        testConfig.name,
        'echo "This contains EXIT_CODE: pattern but is not real exit code"',
      );

      expect(result.stdout.trim()).toBe(
        "This contains EXIT_CODE: pattern but is not real exit code",
      );
      expect(result.exitCode).toBe(0);
    }, 20000);

    it("should handle commands with special characters and escaping", async () => {
      await connectionManager.createConnection(testConfig);

      const result = await connectionManager.executeCommand(
        testConfig.name,
        'echo "Special chars: $PATH \\n \\t \'quotes\' \\"double\\""',
      );

      expect(result.stdout).toContain("Special chars");
      expect(result.exitCode).toBe(0);
    }, 20000);
  });
});
