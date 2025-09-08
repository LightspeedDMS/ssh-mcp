import { MCPSSHServer } from "../src/mcp-ssh-server.js";
import { SSHConnectionManager } from "../src/ssh-connection-manager.js";

describe("MCP Command Interception", () => {
  let mcpServer: MCPSSHServer;
  let sshManager: SSHConnectionManager;
  const testSessionName = "interception-test-session";

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

  describe("Buffer Content Detection", () => {
    it("should intercept MCP ssh_exec when browser commands are buffered", async () => {
      // Arrange: Add commands to browser buffer
      sshManager.addBrowserCommand(testSessionName, "pwd", "cmd-1", "user");
      sshManager.addBrowserCommand(testSessionName, "whoami", "cmd-2", "user");

      // Act: Try to execute command via MCP
      const result = await mcpServer.callTool("ssh_exec", {
        sessionName: testSessionName,
        command: "ls -la"
      });

      // Assert: Should get CommandGatingError with complete command objects
      expect(result).toEqual({
        success: false,
        error: "BROWSER_COMMANDS_EXECUTED",
        message: "User executed commands directly in browser", 
        browserCommands: [
          {
            command: "pwd",
            commandId: "cmd-1",
            timestamp: expect.any(Number),
            source: "user",
            result: {
              stdout: "",
              stderr: "",
              exitCode: -1  // -1 indicates command not yet completed
            }
          },
          {
            command: "whoami",
            commandId: "cmd-2",
            timestamp: expect.any(Number),
            source: "user",
            result: {
              stdout: "",
              stderr: "",
              exitCode: -1  // -1 indicates command not yet completed
            }
          }
        ],
        retryAllowed: true
      });
    });

    it("should raise CommandGatingError when browser command buffer contains content", async () => {
      // Arrange: Add single command to browser buffer
      sshManager.addBrowserCommand(testSessionName, "echo 'test'", "cmd-1", "user");

      // Act: Try to execute command via MCP
      const result = await mcpServer.callTool("ssh_exec", {
        sessionName: testSessionName,
        command: "date"
      });

      // Assert: Should get structured error response
      expect(result).toEqual({
        success: false,
        error: "BROWSER_COMMANDS_EXECUTED",
        message: "User executed commands directly in browser",
        browserCommands: [
          {
            command: "echo 'test'",
            commandId: "cmd-1",
            timestamp: expect.any(Number),
            source: "user",
            result: {
              stdout: "",
              stderr: "",
              exitCode: -1  // -1 indicates command not yet completed
            }
          }
        ], 
        retryAllowed: true
      });
    });
  });

  describe("Empty Buffer Pass-Through", () => {
    it("should proceed normally when browser command buffer is empty", async () => {
      // Arrange: Ensure buffer is empty
      sshManager.clearBrowserCommandBuffer(testSessionName);

      // Act: Execute command via MCP (real SSH execution)
      const result = await mcpServer.callTool("ssh_exec", {
        sessionName: testSessionName,
        command: "echo 'test'"
      });

      // Assert: Should get standard MCP success response with real command output
      expect(result).toEqual({
        success: true,
        result: {
          stdout: expect.stringContaining("test"),
          stderr: "",
          exitCode: 0
        }
      });
    });

    it("should return standard MCP response when buffer is empty", async () => {
      // Arrange: Explicitly clear buffer 
      sshManager.clearBrowserCommandBuffer(testSessionName);

      // Act: Execute command via MCP (real SSH execution)
      const result = await mcpServer.callTool("ssh_exec", {
        sessionName: testSessionName,
        command: "echo 'Hello World'"
      });

      // Assert: Standard success response format with real command output
      expect(result).toEqual({
        success: true,
        result: {
          stdout: expect.stringContaining("Hello World"),
          stderr: "",
          exitCode: 0
        }
      });
    });
  });

  describe("Multiple Buffered Commands", () => {
    it("should include complete command array in error response", async () => {
      // Arrange: Add multiple commands to buffer
      sshManager.addBrowserCommand(testSessionName, "pwd", "cmd-1", "user");
      sshManager.addBrowserCommand(testSessionName, "ls -la", "cmd-2", "user");
      sshManager.addBrowserCommand(testSessionName, "whoami", "cmd-3", "user");

      // Act: Try to execute command via MCP
      const result = await mcpServer.callTool("ssh_exec", {
        sessionName: testSessionName,
        command: "date"
      });

      // Assert: Should include all buffered commands
      expect(result).toEqual({
        success: false,
        error: "BROWSER_COMMANDS_EXECUTED",
        message: "User executed commands directly in browser",
        browserCommands: [
          {
            command: "pwd",
            commandId: "cmd-1",
            timestamp: expect.any(Number),
            source: "user",
            result: {
              stdout: "",
              stderr: "",
              exitCode: -1
            }
          },
          {
            command: "ls -la",
            commandId: "cmd-2",
            timestamp: expect.any(Number),
            source: "user",
            result: {
              stdout: "",
              stderr: "",
              exitCode: -1
            }
          },
          {
            command: "whoami",
            commandId: "cmd-3",
            timestamp: expect.any(Number),
            source: "user",
            result: {
              stdout: "",
              stderr: "",
              exitCode: -1
            }
          }
        ],
        retryAllowed: true
      });
    });

    it("should clear buffer after interception error response", async () => {
      // Arrange: Add commands to buffer
      const commands = ["git status", "git log --oneline", "git branch"];
      commands.forEach((cmd, i) => {
        sshManager.addBrowserCommand(testSessionName, cmd, `cmd-${i}`, "user");
      });

      // Verify buffer has content before interception
      expect(sshManager.getBrowserCommandBuffer(testSessionName)).toHaveLength(3);

      // Act: Try to execute command (should be intercepted)
      const result = await mcpServer.callTool("ssh_exec", {
        sessionName: testSessionName,
        command: "echo 'blocked'"
      });

      // Assert: Should get error response and buffer cleared 
      expect(result).toMatchObject({
        success: false,
        error: "BROWSER_COMMANDS_EXECUTED"
      });
      
      // Buffer should be cleared after error response
      const bufferAfterInterception = sshManager.getBrowserCommandBuffer(testSessionName);
      expect(bufferAfterInterception).toHaveLength(0);
    });

    it("should handle mixed user and claude commands in buffer", async () => {
      // Arrange: Add commands from different sources
      sshManager.addBrowserCommand(testSessionName, "user command", "cmd-1", "user");
      sshManager.addBrowserCommand(testSessionName, "claude command", "cmd-2", "claude");
      sshManager.addBrowserCommand(testSessionName, "another user command", "cmd-3", "user");

      // Act: Try to execute command via MCP
      const result = await mcpServer.callTool("ssh_exec", {
        sessionName: testSessionName,
        command: "intercepted"
      });

      // Assert: Should include all buffered commands regardless of source
      expect(result).toEqual({
        success: false,
        error: "BROWSER_COMMANDS_EXECUTED",
        message: "User executed commands directly in browser",
        browserCommands: [
          {
            command: "user command",
            commandId: "cmd-1",
            timestamp: expect.any(Number),
            source: "user",
            result: {
              stdout: "",
              stderr: "",
              exitCode: -1
            }
          },
          {
            command: "claude command",
            commandId: "cmd-2",
            timestamp: expect.any(Number),
            source: "claude",
            result: {
              stdout: "",
              stderr: "",
              exitCode: -1
            }
          },
          {
            command: "another user command",
            commandId: "cmd-3",
            timestamp: expect.any(Number),
            source: "user",
            result: {
              stdout: "",
              stderr: "",
              exitCode: -1
            }
          }
        ],
        retryAllowed: true
      });
    });
  });

  describe("Buffer Clearing After Error Response", () => {
    it("should clear buffer after sending error response", async () => {
      // Arrange: Add commands to buffer
      sshManager.addBrowserCommand(testSessionName, "test command 1", "cmd-1", "user");
      sshManager.addBrowserCommand(testSessionName, "test command 2", "cmd-2", "user");

      // Verify buffer has content before interception
      expect(sshManager.getBrowserCommandBuffer(testSessionName)).toHaveLength(2);

      // Act: Execute command that triggers interception
      const result = await mcpServer.callTool("ssh_exec", {
        sessionName: testSessionName,
        command: "blocked command"
      });

      // Assert: Should get error response
      expect(result).toMatchObject({
        success: false,
        error: "BROWSER_COMMANDS_EXECUTED"
      });

      // Assert: Buffer should be cleared after error response
      expect(sshManager.getBrowserCommandBuffer(testSessionName)).toHaveLength(0);
    });

    it("should clear buffer only after error response is sent", async () => {
      // Arrange: Add commands to buffer
      sshManager.addBrowserCommand(testSessionName, "buffered command", "cmd-1", "user");

      // Verify buffer has content before interception
      expect(sshManager.getBrowserCommandBuffer(testSessionName)).toHaveLength(1);

      // Act: Execute command that triggers interception
      const result = await mcpServer.callTool("ssh_exec", {
        sessionName: testSessionName,
        command: "intercepted"
      });

      // Assert: Error response received and buffer cleared
      expect(result).toMatchObject({
        success: false,
        error: "BROWSER_COMMANDS_EXECUTED"
      });
      
      // Assert: Buffer should be cleared after error response
      expect(sshManager.getBrowserCommandBuffer(testSessionName)).toHaveLength(0);
    });
  });

  describe("Error Response Format Validation", () => {
    it("should return properly formatted CommandGatingError", async () => {
      // Arrange: Add command to buffer
      sshManager.addBrowserCommand(testSessionName, "format test", "cmd-1", "user");

      // Act: Execute command via MCP
      const result = await mcpServer.callTool("ssh_exec", {
        sessionName: testSessionName,
        command: "test"
      });

      // Assert: Verify exact error response format
      expect(result).toEqual({
        success: false,
        error: "BROWSER_COMMANDS_EXECUTED",
        message: "User executed commands directly in browser",
        browserCommands: [
          {
            command: "format test",
            commandId: "cmd-1",
            timestamp: expect.any(Number),
            source: "user",
            result: {
              stdout: "",
              stderr: "",
              exitCode: -1
            }
          }
        ],
        retryAllowed: true
      });

      // Assert: Response should be JSON serializable
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it("should maintain JSON-RPC 2.0 compliance in error response", async () => {
      // Arrange: Add commands to buffer
      sshManager.addBrowserCommand(testSessionName, "compliance test", "cmd-1", "user");

      // Act: Execute command via MCP 
      const result = await mcpServer.callTool("ssh_exec", {
        sessionName: testSessionName,
        command: "test"
      });

      // Assert: Should have required fields for structured error
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error", "BROWSER_COMMANDS_EXECUTED");
      expect(result).toHaveProperty("message");
      expect(result).toHaveProperty("browserCommands");
      expect(result).toHaveProperty("retryAllowed", true);
    });
  });
});