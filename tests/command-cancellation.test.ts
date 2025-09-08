import { MCPSSHServer } from "../src/mcp-ssh-server.js";
import { SSHConnectionManager } from "../src/ssh-connection-manager.js";

describe("Command Cancellation Feature 03", () => {
  let mcpServer: MCPSSHServer;
  let sshManager: SSHConnectionManager;
  const testSessionName = "cancellation-test-session";

  beforeEach(async () => {
    sshManager = new SSHConnectionManager();
    mcpServer = new MCPSSHServer({}, sshManager);
    
    // Create real SSH connection using CLAUDE.md compliant approach (no mocks)
    const connectionResult = await mcpServer.callTool("ssh_connect", {
      name: testSessionName,
      host: "localhost",
      username: "jsbattig",
      keyFilePath: "/home/jsbattig/.ssh/id_ed25519"
    });
    
    // Verify connection was successful
    if (!(connectionResult as any).success) {
      throw new Error(`Failed to establish SSH connection: ${(connectionResult as any).error}`);
    }
  });

  afterEach(async () => {
    // Cleanup real SSH connection
    try {
      await mcpServer.callTool("ssh_disconnect", {
        sessionName: testSessionName
      });
    } catch (error) {
      console.warn(`Warning: Error during SSH cleanup: ${error}`);
    }
  });

  describe("Story 01: Browser Command Cancellation", () => {
    it("should release browser command lock when Ctrl-C cancellation occurs", async () => {
      // This test is initially failing - we need to implement the enhancement
      
      // Arrange: Add browser command to buffer (simulates user typing in browser)
      sshManager.addBrowserCommand(testSessionName, "sleep 30", "long-cmd", "user");

      // Act: Simulate Ctrl-C cancellation via sendTerminalSignal
      // This should clear the browser command buffer to allow MCP commands
      sshManager.sendTerminalSignal(testSessionName, "SIGINT");

      // Brief pause to allow cancellation processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: Browser command buffer should be cleared after cancellation
      const bufferAfterCancel = sshManager.getBrowserCommandBuffer(testSessionName);
      expect(bufferAfterCancel).toHaveLength(0);

      // Assert: MCP command should now be allowed (no gating error)
      const result = await mcpServer.callTool("ssh_exec", {
        sessionName: testSessionName,
        command: "pwd"
      });

      expect(result).toMatchObject({
        success: true
      });
      // Should not receive BROWSER_COMMANDS_EXECUTED error
      expect(result).not.toMatchObject({
        error: "BROWSER_COMMANDS_EXECUTED"
      });
    });

    it("should handle Ctrl-C cancellation with multiple browser commands in buffer", async () => {
      // This test is initially failing - we need to implement the enhancement
      
      // Arrange: Add multiple browser commands to buffer
      sshManager.addBrowserCommand(testSessionName, "ls -la", "cmd-1", "user");
      sshManager.addBrowserCommand(testSessionName, "pwd", "cmd-2", "user");
      sshManager.addBrowserCommand(testSessionName, "sleep 30", "long-cmd", "user");

      // Verify buffer has content before cancellation
      expect(sshManager.getBrowserCommandBuffer(testSessionName)).toHaveLength(3);

      // Act: Simulate Ctrl-C cancellation
      sshManager.sendTerminalSignal(testSessionName, "SIGINT");

      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: All browser commands should be cleared after cancellation
      const bufferAfterCancel = sshManager.getBrowserCommandBuffer(testSessionName);
      expect(bufferAfterCancel).toHaveLength(0);

      // Assert: MCP command should proceed without gating error
      const result = await mcpServer.callTool("ssh_exec", {
        sessionName: testSessionName,
        command: "whoami"
      });

      expect(result).toMatchObject({
        success: true
      });
    });

    it("should preserve existing sendTerminalSignal functionality", async () => {
      // This test should pass - existing functionality should be preserved
      
      // Act: Send various terminal signals
      expect(() => {
        sshManager.sendTerminalSignal(testSessionName, "SIGINT");
        sshManager.sendTerminalSignal(testSessionName, "SIGTERM");
        sshManager.sendTerminalSignal(testSessionName, "SIGTSTP");
      }).not.toThrow();

      // Assert: Unsupported signal should throw error (existing behavior)
      expect(() => {
        sshManager.sendTerminalSignal(testSessionName, "UNSUPPORTED");
      }).toThrow("Unsupported signal: UNSUPPORTED");
    });

    it("should not affect other sessions when cancelling browser commands", async () => {
      // This test is initially failing - we need session isolation
      
      const secondSessionName = "second-cancellation-session";
      
      // Create second session
      await mcpServer.callTool("ssh_connect", {
        name: secondSessionName,
        host: "localhost",
        username: "jsbattig",
        keyFilePath: "/home/jsbattig/.ssh/id_ed25519"
      });

      try {
        // Arrange: Add commands to both sessions
        sshManager.addBrowserCommand(testSessionName, "sleep 30", "cmd-1", "user");
        sshManager.addBrowserCommand(secondSessionName, "ls -la", "cmd-2", "user");

        // Act: Cancel commands in first session only
        sshManager.sendTerminalSignal(testSessionName, "SIGINT");

        await new Promise(resolve => setTimeout(resolve, 100));

        // Assert: First session buffer should be cleared
        expect(sshManager.getBrowserCommandBuffer(testSessionName)).toHaveLength(0);

        // Assert: Second session buffer should remain intact
        expect(sshManager.getBrowserCommandBuffer(secondSessionName)).toHaveLength(1);
        expect(sshManager.getBrowserCommandBuffer(secondSessionName)[0].command).toBe("ls -la");

      } finally {
        // Cleanup second session
        await mcpServer.callTool("ssh_disconnect", {
          sessionName: secondSessionName
        });
      }
    });
  });

  describe("Story 02: MCP Command Cancellation", () => {
    it("should register ssh_cancel_command MCP tool", async () => {
      // This test is initially failing - tool doesn't exist yet
      
      // Act & Assert: Tool should be available in MCP server tools
      const tools = await mcpServer.listTools();
      
      expect(tools).toContain("ssh_cancel_command");
    });

    it("should return error when trying to cancel non-existent MCP command", async () => {
      // This test is initially failing - tool doesn't exist yet
      
      // Arrange: No MCP commands running
      
      // Act: Try to cancel MCP command
      const result = await mcpServer.callTool("ssh_cancel_command", {
        sessionName: testSessionName
      });

      // Assert: Should get informative error message
      expect(result).toMatchObject({
        success: false,
        error: "NO_ACTIVE_MCP_COMMAND",
        message: "No active MCP command to cancel"
      });
    });

    it("should prevent MCP from cancelling browser commands", async () => {
      // This test is initially failing - need source-specific cancellation
      
      // Arrange: User has browser command running (simulated by buffer entry)
      sshManager.addBrowserCommand(testSessionName, "sleep 30", "browser-cmd", "user");

      // Act: Try to cancel via MCP
      const result = await mcpServer.callTool("ssh_cancel_command", {
        sessionName: testSessionName
      });

      // Assert: Should get error - cannot cancel browser commands
      expect(result).toMatchObject({
        success: false,
        error: "NO_ACTIVE_MCP_COMMAND",
        message: "No active MCP command to cancel"
      });

      // Assert: Browser command should remain in buffer
      const buffer = sshManager.getBrowserCommandBuffer(testSessionName);
      expect(buffer).toHaveLength(1);
      expect(buffer[0].command).toBe("sleep 30");
    });
  });

  describe("Story 03: Source-Specific Cancellation", () => {
    it("should track command source for cancellation permissions", async () => {
      // This test is initially failing - need source tracking enhancement
      
      // Arrange: Add commands from different sources
      sshManager.addBrowserCommand(testSessionName, "browser-cmd", "cmd-1", "user");
      sshManager.addBrowserCommand(testSessionName, "mcp-cmd", "cmd-2", "claude");

      // Act: Get buffer contents
      const buffer = sshManager.getBrowserCommandBuffer(testSessionName);

      // Assert: Each command should have proper source attribution
      expect(buffer).toHaveLength(2);
      expect(buffer.find(cmd => cmd.command === "browser-cmd")?.source).toBe("user");
      expect(buffer.find(cmd => cmd.command === "mcp-cmd")?.source).toBe("claude");
    });

    it("should prevent cross-source cancellation interference", async () => {
      // This test is initially failing - need cross-source prevention logic
      
      // Arrange: Browser command running, MCP command queued
      sshManager.addBrowserCommand(testSessionName, "browser-sleep 30", "browser-cmd", "user");
      sshManager.addBrowserCommand(testSessionName, "mcp-command", "mcp-cmd", "claude");

      // Act: Browser cancellation should only affect browser commands
      sshManager.sendTerminalSignal(testSessionName, "SIGINT");

      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: Only browser commands should be cancelled, MCP commands preserved
      const buffer = sshManager.getBrowserCommandBuffer(testSessionName);
      
      // If properly implemented, only claude-sourced commands should remain
      const remainingCommands = buffer.filter(cmd => cmd.source === "claude");
      expect(remainingCommands).toHaveLength(1);
      expect(remainingCommands[0].command).toBe("mcp-command");
    });
  });
});