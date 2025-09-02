import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

/**
 * Simplified E2E Test to verify MCP API basic functionality
 */

describe("MCP API Simple E2E Test", () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testPort: number;

  beforeAll(async () => {
    // Use fixed port for simple test
    testPort = 8099;
    console.log(`Using port ${testPort} for simple E2E test`);
  });

  beforeEach(async () => {
    // Setup MCP client with real server process
    const serverPath = path.join(__dirname, "../dist/src/mcp-server.js");

    transport = new StdioClientTransport({
      command: "node",
      args: [serverPath],
      env: { ...process.env, WEB_PORT: testPort.toString() },
    });

    client = new Client(
      {
        name: "mcp-simple-e2e-tester",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    await client.connect(transport);
  }, 15000);

  afterEach(async () => {
    if (client) {
      await client.close();
    }

    if (transport) {
      await transport.close();
    }
  }, 10000);

  test("should list all expected MCP tools", async () => {
    const result = await client.listTools();

    // Verify all expected tools are present
    const expectedTools = [
      "ssh_connect",
      "ssh_exec",
      "ssh_list_sessions",
      "ssh_disconnect",
      "ssh_get_monitoring_url",
    ];

    const availableTools = result.tools.map((t) => t.name);
    expect(availableTools).toEqual(expect.arrayContaining(expectedTools));
    expect(availableTools).toHaveLength(expectedTools.length);

    console.log("✅ All MCP tools are available");
  });

  test("should establish SSH connection and list sessions", async () => {
    const sessionName = `simple-test-${Date.now()}`;

    // Connect
    const connectResult = await client.callTool({
      name: "ssh_connect",
      arguments: {
        name: sessionName,
        host: "localhost",
        username: "test_user",
        password: "password123",
      },
    });

    const connectData = JSON.parse((connectResult as any).content[0].text);
    expect(connectData.success).toBe(true);
    expect(connectData.connection.name).toBe(sessionName);
    expect(connectData.connection.status).toBe("connected");

    console.log("✅ SSH connection established");

    // List sessions
    const listResult = await client.callTool({
      name: "ssh_list_sessions",
      arguments: {},
    });

    const listData = JSON.parse((listResult as any).content[0].text);
    expect(listData.success).toBe(true);
    expect(listData.sessions).toHaveLength(1);
    expect(listData.sessions[0].name).toBe(sessionName);

    console.log("✅ Session listing works");

    // Cleanup
    const disconnectResult = await client.callTool({
      name: "ssh_disconnect",
      arguments: { sessionName: sessionName },
    });

    const disconnectData = JSON.parse(
      (disconnectResult as any).content[0].text,
    );
    expect(disconnectData.success).toBe(true);

    console.log("✅ Session disconnect works");
  }, 30000);

  test("should execute command via SSH", async () => {
    const sessionName = `exec-test-${Date.now()}`;

    // Connect first
    await client.callTool({
      name: "ssh_connect",
      arguments: {
        name: sessionName,
        host: "localhost",
        username: "test_user",
        password: "password123",
      },
    });

    // Execute command
    const execResult = await client.callTool({
      name: "ssh_exec",
      arguments: {
        sessionName: sessionName,
        command: "whoami",
      },
    });

    const execData = JSON.parse((execResult as any).content[0].text);
    expect(execData.success).toBe(true);
    expect(execData.result.stdout.trim()).toBe("test_user");
    expect(execData.result.exitCode).toBe(0);

    console.log("✅ Command execution works");

    // Cleanup
    await client.callTool({
      name: "ssh_disconnect",
      arguments: { sessionName: sessionName },
    });
  }, 30000);

  test("should generate monitoring URL", async () => {
    const sessionName = `url-test-${Date.now()}`;

    // Connect first
    await client.callTool({
      name: "ssh_connect",
      arguments: {
        name: sessionName,
        host: "localhost",
        username: "test_user",
        password: "password123",
      },
    });

    // Get monitoring URL
    const urlResult = await client.callTool({
      name: "ssh_get_monitoring_url",
      arguments: { sessionName: sessionName },
    });

    const urlData = JSON.parse((urlResult as any).content[0].text);
    expect(urlData.success).toBe(true);
    expect(urlData.sessionName).toBe(sessionName);
    expect(urlData.monitoringUrl).toBe(
      `http://localhost:${testPort}/session/${sessionName}`,
    );

    console.log("✅ Monitoring URL generation works");

    // Test URL is accessible
    const response = await fetch(urlData.monitoringUrl);
    expect(response.status).toBe(200);

    console.log("✅ Monitoring URL is accessible");

    // Cleanup
    await client.callTool({
      name: "ssh_disconnect",
      arguments: { sessionName: sessionName },
    });
  }, 30000);
});
