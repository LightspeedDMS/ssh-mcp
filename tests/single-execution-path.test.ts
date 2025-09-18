import { SSHConnectionManager } from "../src/ssh-connection-manager";
import {
  SSHConnectionConfig,
  ConnectionStatus,
} from "../src/types";

describe("Single Execution Path - No Shell Sessions", () => {
  let connectionManager: SSHConnectionManager;

  beforeEach(() => {
    connectionManager = new SSHConnectionManager();
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  describe("Interface Constraints", () => {
    it("should NOT have shell session methods in the interface", () => {
      // These methods should not exist after removal
      expect((connectionManager as any).sendTerminalInput).toBeUndefined();
      expect((connectionManager as any).sendTerminalInputRaw).toBeUndefined();
      expect((connectionManager as any).sendTerminalSignal).toBeUndefined();
      expect((connectionManager as any).resizeTerminal).toBeUndefined();
      expect((connectionManager as any).setupShellHandlers).toBeUndefined();
      expect((connectionManager as any).detectShellPrompt).toBeUndefined();
    });

    it("should NOT have shell-related fields in SessionData", async () => {
      const config: SSHConnectionConfig = {
        name: "test-no-shell",
        host: "localhost",
        username: "jsbattig",
        keyFilePath: "~/.ssh/id_ed25519",
      };

      const connection = await connectionManager.createConnection(config);
      expect(connection.status).toBe(ConnectionStatus.CONNECTED);

      // Access private connections map to verify SessionData structure
      const connections = (connectionManager as any).connections;
      const sessionData = connections.get("test-no-shell");

      // These shell-related fields should NOT exist
      expect(sessionData.shellChannel).toBeUndefined();
      expect(sessionData.isShellReady).toBeUndefined();
      expect(sessionData.initialPromptShown).toBeUndefined();
      expect(sessionData.rawInputMode).toBeUndefined();
      expect(sessionData.echoDisabled).toBeUndefined();
      expect(sessionData.lastCommandSent).toBeUndefined();
      expect(sessionData.expectingCommandEcho).toBeUndefined();
      expect(sessionData.currentCommand).toBeUndefined();
      expect(sessionData.nuclearFallback).toBeUndefined();
    }, 15000);
  });

  describe("Single Execution Path - client.exec() Only", () => {
    beforeEach(async () => {
      const config: SSHConnectionConfig = {
        name: "test-exec-only",
        host: "localhost",
        username: "jsbattig",
        keyFilePath: "~/.ssh/id_ed25519",
      };

      await connectionManager.createConnection(config);
    }, 15000);

    it("should execute MCP commands using client.exec() only", async () => {
      const result = await connectionManager.executeCommand(
        "test-exec-only",
        "echo 'MCP test'",
        { source: "claude" }
      );

      expect(result).toBeDefined();
      expect(result.stdout).toContain("MCP test");
      expect(result.exitCode).toBe(0);
    }, 10000);

    it("should execute browser commands using client.exec() only", async () => {
      const result = await connectionManager.executeCommand(
        "test-exec-only",
        "whoami",
        { source: "user" }
      );

      expect(result).toBeDefined();
      expect(result.stdout).toContain("jsbattig");
      expect(result.exitCode).toBe(0);
    }, 10000);

    it("should execute system commands using client.exec() only", async () => {
      const result = await connectionManager.executeCommand(
        "test-exec-only",
        "pwd",
        { source: "system" }
      );

      expect(result).toBeDefined();
      expect(result.stdout).toBeTruthy();
      expect(result.exitCode).toBe(0);
    }, 10000);

    it("should handle command failures correctly through client.exec()", async () => {
      const result = await connectionManager.executeCommand(
        "test-exec-only",
        "non-existent-command-12345",
        { source: "claude" }
      );

      expect(result).toBeDefined();
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr || result.stdout).toContain("not found");
    }, 10000);

    it("should execute multiple sequential commands using client.exec() only", async () => {
      // First command
      const result1 = await connectionManager.executeCommand(
        "test-exec-only",
        "echo 'first'",
        { source: "claude" }
      );

      expect(result1.stdout).toContain("first");
      expect(result1.exitCode).toBe(0);

      // Second command
      const result2 = await connectionManager.executeCommand(
        "test-exec-only",
        "echo 'second'",
        { source: "user" }
      );

      expect(result2.stdout).toContain("second");
      expect(result2.exitCode).toBe(0);

      // Third command
      const result3 = await connectionManager.executeCommand(
        "test-exec-only",
        "date",
        { source: "system" }
      );

      expect(result3.stdout).toBeTruthy();
      expect(result3.exitCode).toBe(0);
    }, 15000);
  });

  describe("No Shell Session Dependencies", () => {
    it("should create connection without shell initialization", async () => {
      const config: SSHConnectionConfig = {
        name: "test-no-shell-init",
        host: "localhost",
        username: "jsbattig",
        keyFilePath: "~/.ssh/id_ed25519",
      };

      const startTime = Date.now();
      const connection = await connectionManager.createConnection(config);
      const endTime = Date.now();

      expect(connection.status).toBe(ConnectionStatus.CONNECTED);

      // Connection should be faster without shell initialization
      expect(endTime - startTime).toBeLessThan(5000);

      // Should be able to execute commands immediately
      const result = await connectionManager.executeCommand(
        "test-no-shell-init",
        "echo 'immediate execution'",
        { source: "claude" }
      );

      expect(result.stdout).toContain("immediate execution");
      expect(result.exitCode).toBe(0);
    }, 15000);

    it("should NOT wait for shell prompts or readiness", async () => {
      const config: SSHConnectionConfig = {
        name: "test-no-prompt-wait",
        host: "localhost",
        username: "jsbattig",
        keyFilePath: "~/.ssh/id_ed25519",
      };

      // Connection should resolve immediately after SSH handshake
      const connection = await connectionManager.createConnection(config);
      expect(connection.status).toBe(ConnectionStatus.CONNECTED);

      // No shell readiness checks should be needed
      const connections = (connectionManager as any).connections;
      const sessionData = connections.get("test-no-prompt-wait");

      // These readiness-related fields should not exist
      expect(sessionData.isShellReady).toBeUndefined();
      expect(sessionData.initialPromptShown).toBeUndefined();
    }, 10000);
  });

  describe("Command Queue and Gating", () => {
    it("should maintain command queueing system without shell dependencies", async () => {
      const config: SSHConnectionConfig = {
        name: "test-queue-only",
        host: "localhost",
        username: "jsbattig",
        keyFilePath: "~/.ssh/id_ed25519",
      };

      await connectionManager.createConnection(config);

      // Execute multiple commands to test queueing
      const promises = [
        connectionManager.executeCommand("test-queue-only", "echo 'cmd1'", { source: "claude" }),
        connectionManager.executeCommand("test-queue-only", "echo 'cmd2'", { source: "user" }),
        connectionManager.executeCommand("test-queue-only", "echo 'cmd3'", { source: "claude" }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0].stdout).toContain("cmd1");
      expect(results[1].stdout).toContain("cmd2");
      expect(results[2].stdout).toContain("cmd3");

      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
    }, 15000);

    it("should maintain browser command tracking without shell sessions", async () => {
      const config: SSHConnectionConfig = {
        name: "test-browser-tracking",
        host: "localhost",
        username: "jsbattig",
        keyFilePath: "~/.ssh/id_ed25519",
      };

      await connectionManager.createConnection(config);

      // Add browser command
      connectionManager.addBrowserCommand(
        "test-browser-tracking",
        "echo 'browser test'",
        "cmd-123",
        "user"
      );

      const commands = connectionManager.getBrowserCommandBuffer("test-browser-tracking");
      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe("echo 'browser test'");
      expect(commands[0].commandId).toBe("cmd-123");
      expect(commands[0].source).toBe("user");
    }, 10000);
  });
});