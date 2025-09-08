import { MCPSSHServer } from "../src/mcp-ssh-server.js";
import { SSHConnectionManager } from "../src/ssh-connection-manager.js";

describe("Feature 03 Command Cancellation - Integration Validation", () => {
  let mcpServer: MCPSSHServer;
  let sshManager: SSHConnectionManager;
  const testSessionName = "feature-03-validation";

  beforeEach(async () => {
    sshManager = new SSHConnectionManager();
    mcpServer = new MCPSSHServer({}, sshManager);
    
    // Create real SSH connection
    const connectionResult = await mcpServer.callTool("ssh_connect", {
      name: testSessionName,
      host: "localhost",
      username: "jsbattig",
      keyFilePath: "/home/jsbattig/.ssh/id_ed25519"
    });
    
    if (!(connectionResult as any).success) {
      throw new Error(`Failed to establish SSH connection: ${(connectionResult as any).error}`);
    }
  });

  afterEach(async () => {
    try {
      await mcpServer.callTool("ssh_disconnect", {
        sessionName: testSessionName
      });
    } catch (error) {
      console.warn(`Warning: Error during SSH cleanup: ${error}`);
    }
  });

  it("should demonstrate complete command cancellation workflow", async () => {
    // ========================================================================
    // FEATURE 03 COMPLETE WORKFLOW VALIDATION
    // ========================================================================
    
    console.log("🚀 FEATURE 03: COMMAND CANCELLATION - COMPLETE WORKFLOW TEST");
    
    // Step 1: Verify all three cancellation tools are available
    console.log("\n📋 Step 1: Verify cancellation tools are available");
    const tools = await mcpServer.listTools();
    expect(tools).toContain("ssh_cancel_command");
    console.log("✅ ssh_cancel_command tool registered");
    
    // Step 2: Test browser command cancellation (Story 01)
    console.log("\n🖥️ Step 2: Test browser command cancellation (Story 01)");
    sshManager.addBrowserCommand(testSessionName, "browser-long-task", "browser-1", "user");
    sshManager.addBrowserCommand(testSessionName, "another-browser-task", "browser-2", "user");
    
    let buffer = sshManager.getBrowserCommandBuffer(testSessionName);
    expect(buffer.filter(cmd => cmd.source === "user")).toHaveLength(2);
    console.log(`📊 Added ${buffer.filter(cmd => cmd.source === "user").length} browser commands`);
    
    // Browser cancellation via Ctrl-C (SIGINT)
    sshManager.sendTerminalSignal(testSessionName, "SIGINT");
    await new Promise(resolve => setTimeout(resolve, 50));
    
    buffer = sshManager.getBrowserCommandBuffer(testSessionName);
    expect(buffer.filter(cmd => cmd.source === "user")).toHaveLength(0);
    console.log("✅ Browser commands cancelled via SIGINT");
    
    // Step 3: Test MCP command cancellation (Story 02) 
    console.log("\n🤖 Step 3: Test MCP command cancellation (Story 02)");
    sshManager.addBrowserCommand(testSessionName, "mcp-task-1", "mcp-1", "claude");
    sshManager.addBrowserCommand(testSessionName, "mcp-task-2", "mcp-2", "claude");
    
    buffer = sshManager.getBrowserCommandBuffer(testSessionName);
    expect(buffer.filter(cmd => cmd.source === "claude")).toHaveLength(2);
    console.log(`📊 Added ${buffer.filter(cmd => cmd.source === "claude").length} MCP commands`);
    
    // MCP cancellation via ssh_cancel_command tool
    const cancelResult = await mcpServer.callTool("ssh_cancel_command", {
      sessionName: testSessionName
    });
    
    expect(cancelResult).toMatchObject({
      success: true,
      message: "Cancelled 2 MCP command(s)"
    });
    console.log("✅ MCP commands cancelled via ssh_cancel_command tool");
    
    buffer = sshManager.getBrowserCommandBuffer(testSessionName);
    expect(buffer.filter(cmd => cmd.source === "claude")).toHaveLength(0);
    
    // Step 4: Test source-specific cancellation (Story 03)
    console.log("\n🎯 Step 4: Test source-specific cancellation isolation (Story 03)");
    
    // Add mixed commands
    sshManager.addBrowserCommand(testSessionName, "user-command", "user-1", "user");
    sshManager.addBrowserCommand(testSessionName, "mcp-command", "mcp-1", "claude");
    
    buffer = sshManager.getBrowserCommandBuffer(testSessionName);
    expect(buffer.filter(cmd => cmd.source === "user")).toHaveLength(1);
    expect(buffer.filter(cmd => cmd.source === "claude")).toHaveLength(1);
    console.log("📊 Added mixed source commands: 1 user, 1 MCP");
    
    // Browser cancellation should only affect user commands
    sshManager.sendTerminalSignal(testSessionName, "SIGINT");
    await new Promise(resolve => setTimeout(resolve, 50));
    
    buffer = sshManager.getBrowserCommandBuffer(testSessionName);
    expect(buffer.filter(cmd => cmd.source === "user")).toHaveLength(0);
    expect(buffer.filter(cmd => cmd.source === "claude")).toHaveLength(1);
    console.log("✅ Browser cancellation only affected user commands, MCP commands preserved");
    
    // MCP cancellation should only affect remaining MCP commands
    const finalCancelResult = await mcpServer.callTool("ssh_cancel_command", {
      sessionName: testSessionName
    });
    
    expect(finalCancelResult).toMatchObject({
      success: true,
      message: "Cancelled 1 MCP command(s)"
    });
    
    buffer = sshManager.getBrowserCommandBuffer(testSessionName);
    expect(buffer).toHaveLength(0);
    console.log("✅ MCP cancellation only affected MCP commands");
    
    // Step 5: Test MCP command execution after cancellations
    console.log("\n🔄 Step 5: Verify MCP commands can execute after cancellations");
    
    const execResult = await mcpServer.callTool("ssh_exec", {
      sessionName: testSessionName,
      command: "pwd"
    });
    
    expect(execResult).toMatchObject({
      success: true
    });
    console.log("✅ MCP command executed successfully after cancellations");
    
    console.log("\n🎉 FEATURE 03 COMMAND CANCELLATION - COMPLETE WORKFLOW VALIDATED!");
    console.log("   ✅ Story 01: Browser Command Cancellation");
    console.log("   ✅ Story 02: MCP Command Cancellation"); 
    console.log("   ✅ Story 03: Source-Specific Cancellation");
    console.log("   ✅ Integration: All cancellation mechanisms work together");
  });

  it("should maintain backward compatibility with existing functionality", async () => {
    console.log("\n🔒 BACKWARD COMPATIBILITY VALIDATION");
    
    // Test that existing MCP command gating still works
    sshManager.addBrowserCommand(testSessionName, "blocking-command", "block-1", "user");
    
    const blockedResult = await mcpServer.callTool("ssh_exec", {
      sessionName: testSessionName,
      command: "should-be-blocked"
    });
    
    expect(blockedResult).toMatchObject({
      success: false,
      error: "BROWSER_COMMANDS_EXECUTED"
    });
    console.log("✅ MCP command gating still works (Feature 02 preserved)");
    
    // Clear buffer to test normal execution
    sshManager.clearBrowserCommandBuffer(testSessionName);
    
    const normalResult = await mcpServer.callTool("ssh_exec", {
      sessionName: testSessionName,
      command: "echo 'normal execution'"
    });
    
    expect(normalResult).toMatchObject({
      success: true
    });
    console.log("✅ Normal MCP execution still works");
    
    console.log("✅ ALL BACKWARD COMPATIBILITY MAINTAINED");
  });
});