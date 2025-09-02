/**
 * Unit tests for MCPSSHServer - Testing the separate MCP server implementation
 */
import { MCPSSHServer } from "../src/mcp-ssh-server.js";

describe("MCPSSHServer - Unit Tests", () => {
  let mcpServer: MCPSSHServer;

  afterEach(async () => {
    if (mcpServer) {
      await mcpServer.stop();
    }
  });

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      mcpServer = new MCPSSHServer();
      expect(mcpServer).toBeDefined();
    });

    it("should initialize with custom config", () => {
      const config = {
        sshTimeout: 20000,
        maxSessions: 5,
        logLevel: "debug",
      };
      mcpServer = new MCPSSHServer(config);
      expect(mcpServer).toBeDefined();
    });

    it("should validate config parameters", () => {
      expect(() => new MCPSSHServer({ sshTimeout: -1 })).toThrow(
        "Invalid ssh timeout",
      );
      expect(() => new MCPSSHServer({ maxSessions: 0 })).toThrow(
        "Invalid max sessions",
      );
    });
  });

  describe("MCP Server Functionality", () => {
    beforeEach(() => {
      mcpServer = new MCPSSHServer();
    });

    it("should provide SSH tools in tool list", async () => {
      const tools = await mcpServer.listTools();
      expect(tools).toContain("ssh_connect");
      expect(tools).toContain("ssh_exec");
      expect(tools).toContain("ssh_list_sessions");
      expect(tools).toContain("ssh_disconnect");
      expect(tools).toContain("ssh_get_monitoring_url");
    });

    it("should NOT have HTTP server capabilities", () => {
      expect(() => mcpServer.getWebPort()).toThrow(
        "HTTP functionality not available",
      );
      expect(() => mcpServer.isWebServerRunning()).toThrow(
        "HTTP functionality not available",
      );
    });

    it("should report MCP running status", () => {
      expect(mcpServer.isMCPRunning()).toBe(false); // Not started yet
    });

    it("should handle unknown tool calls gracefully", async () => {
      const result = await mcpServer.callTool("unknown_tool", {}) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown tool");
    });
  });

  describe("Port Coordination", () => {
    beforeEach(() => {
      mcpServer = new MCPSSHServer();
    });

    it("should accept web server port from main orchestrator", () => {
      mcpServer.setWebServerPort(9000);
      expect(mcpServer.getWebServerPort()).toBe(9000);
    });

    it("should throw error if web server port not set", () => {
      expect(() => mcpServer.getWebServerPort()).toThrow(
        "Web server port not set by orchestrator",
      );
    });
  });

  describe("Config Management", () => {
    it("should return config object", () => {
      const config = {
        sshTimeout: 25000,
        maxSessions: 8,
        logLevel: "warn",
      };
      mcpServer = new MCPSSHServer(config);

      const returnedConfig = mcpServer.getConfig();
      expect(returnedConfig.sshTimeout).toBe(25000);
      expect(returnedConfig.maxSessions).toBe(8);
      expect(returnedConfig.logLevel).toBe("warn");
    });
  });

  describe("Cleanup", () => {
    it("should cleanup resources on stop", async () => {
      mcpServer = new MCPSSHServer();

      // Should not throw error even if not started
      await expect(mcpServer.stop()).resolves.not.toThrow();
      expect(mcpServer.isMCPRunning()).toBe(false);
    });
  });
});
