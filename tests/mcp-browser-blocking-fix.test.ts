/**
 * Test for MCP server browser blocking fix
 *
 * PROBLEM: When browser is connected and MCP commands are executed,
 * the MCP server blocks waiting for command completion, defeating
 * the purpose of browser commands with infinite timeout.
 *
 * SOLUTION: MCP should return immediately with command queued status
 * and command ID for polling when browser is connected.
 */

import { MCPSSHServer } from "../src/mcp-ssh-server.js";
import { WebServerManager } from "../src/web-server-manager.js";
import { SSHConnectionManager } from "../src/ssh-connection-manager.js";
import { TerminalSessionStateManager } from "../src/terminal-session-state-manager.js";
import WebSocket from "ws";

describe("MCP Browser Blocking Fix", () => {
  let mcpServer: MCPSSHServer;
  let webServerManager: WebServerManager;
  let sshManager: SSHConnectionManager;
  let sessionName: string;

  beforeEach(async () => {
    // Initialize components with shared state manager
    sshManager = new SSHConnectionManager();
    const sharedStateManager = new TerminalSessionStateManager();
    webServerManager = new WebServerManager(sshManager, {}, sharedStateManager);
    mcpServer = new MCPSSHServer({}, sshManager, sharedStateManager, webServerManager);

    sessionName = `test-session-${Date.now()}`;

    // Start web server for browser connections
    await webServerManager.start();

    // Set web server port in MCP server (required for monitoring URLs)
    const webPort = await webServerManager.getPort();
    mcpServer.setWebServerPort(webPort);
  });

  afterEach(async () => {
    try {
      if (mcpServer) {
        await mcpServer.stop();
      }
      if (webServerManager) {
        await webServerManager.stop();
      }
      if (sshManager && sshManager.hasSession(sessionName)) {
        await sshManager.disconnectSession(sessionName);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Immediate Return for Browser-Queued Commands", () => {
    it("should return immediately with command queued status when browser is connected", async () => {
      // Arrange: Connect SSH session
      const connectResult = await mcpServer.callTool("ssh_connect", {
        name: sessionName,
        host: "localhost",
        username: "jsbattig",
        keyFilePath: "/home/jsbattig/.ssh/id_ed25519"
      }) as any;

      expect(connectResult.success).toBe(true);

      // Get monitoring URL for WebSocket connection
      const urlResult = await mcpServer.callTool("ssh_get_monitoring_url", {
        sessionName: sessionName
      }) as any;

      if (!urlResult.success) {
        console.log("URL Result error:", JSON.stringify(urlResult, null, 2));
      }
      expect(urlResult.success).toBe(true);

      // Simulate browser connection via WebSocket
      const wsUrl = urlResult.monitoringUrl.replace("http://", "ws://").replace("/session/", "/ws/session/");
      const browserWs = new WebSocket(wsUrl);

      // Wait for WebSocket connection
      await new Promise((resolve, reject) => {
        browserWs.on('open', resolve);
        browserWs.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });

      // Act: Execute a long-running command via MCP
      const startTime = Date.now();
      const execResult = await mcpServer.callTool("ssh_exec", {
        sessionName: sessionName,
        command: "sleep 5"
      }) as any;
      const executionTime = Date.now() - startTime;

      // Assert: Should return immediately (< 1 second) with queued status
      expect(executionTime).toBeLessThan(1000); // Should return in < 1 second
      expect(execResult.success).toBe(true);
      expect(execResult.queued).toBe(true); // Command should be queued
      expect(execResult.commandId).toBeDefined(); // Should provide command ID for polling
      expect(execResult.message).toContain("Command queued"); // Clear status message

      // Cleanup
      browserWs.close();
    });

    it("should execute immediately when no browser is connected", async () => {
      // Arrange: Connect SSH session (no browser connection)
      const connectResult = await mcpServer.callTool("ssh_connect", {
        name: sessionName,
        host: "localhost",
        username: "jsbattig",
        keyFilePath: "/home/jsbattig/.ssh/id_ed25519"
      }) as any;

      expect(connectResult.success).toBe(true);

      // Act: Execute command with no browser connected
      const execResult = await mcpServer.callTool("ssh_exec", {
        sessionName: sessionName,
        command: "echo 'immediate execution'"
      }) as any;

      // Assert: Should execute immediately and return result
      expect(execResult.success).toBe(true);
      expect(execResult.result).toBeDefined();
      expect(execResult.result.stdout).toContain("immediate execution");
      expect(execResult.queued).toBeUndefined(); // Should not be queued
      expect(execResult.commandId).toBeUndefined(); // No command ID needed
    });

    it("should support polling for queued browser commands", async () => {
      // Arrange: Connect SSH and browser
      const connectResult = await mcpServer.callTool("ssh_connect", {
        name: sessionName,
        host: "localhost",
        username: "jsbattig",
        keyFilePath: "/home/jsbattig/.ssh/id_ed25519"
      }) as any;
      expect(connectResult.success).toBe(true);

      const urlResult = await mcpServer.callTool("ssh_get_monitoring_url", {
        sessionName: sessionName
      }) as any;
      const wsUrl = urlResult.monitoringUrl.replace("http://", "ws://").replace("/session/", "/ws/session/");
      const browserWs = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        browserWs.on('open', resolve);
        browserWs.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });

      // Act: Queue command and get command ID
      const execResult = await mcpServer.callTool("ssh_exec", {
        sessionName: sessionName,
        command: "echo 'test polling'"
      }) as any;

      expect(execResult.queued).toBe(true);
      const commandId = execResult.commandId;

      // Act: Poll for command status
      const pollResult = await mcpServer.callTool("ssh_poll_task", {
        sessionName: sessionName,
        taskId: commandId
      }) as any;

      if (!pollResult.success) {
        console.log("Poll Result error:", JSON.stringify(pollResult, null, 2));
      }

      // Assert: Should be able to poll command status
      expect(pollResult.success).toBe(true);
      expect(pollResult.taskId).toBe(commandId);

      // Cleanup
      browserWs.close();
    });
  });
});