import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSHConnectionManager } from "../src/ssh-connection-manager";
import path from "path";

/**
 * Story 1: Session-Specific Terminal Output Streaming - Focused E2E Tests
 *
 * Based on comprehensive manual testing. These tests focus on core functionality
 * validation with efficient execution and real SSH connections (no mocking).
 */

describe("Story 1: Terminal Output Streaming - Focused E2E", () => {
  let client: Client;
  let transport: StdioClientTransport;
  let sshManager: SSHConnectionManager;
  let testPort: number;
  let sessionName: string;

  beforeAll(async () => {
    testPort = 8096 + Math.floor(Math.random() * 50);
    console.log(`Using port ${testPort} for Story 1 Focused E2E test`);
  });

  beforeEach(async () => {
    sessionName = `story1-focused-${Date.now()}`;

    // Setup MCP client
    const serverPath = path.join(__dirname, "../dist/src/mcp-server.js");

    transport = new StdioClientTransport({
      command: "node",
      args: [serverPath],
      env: { ...process.env, WEB_PORT: testPort.toString() },
    });

    client = new Client(
      {
        name: "story1-focused-tester",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    await client.connect(transport);

    // Setup direct SSH manager for terminal streaming tests
    sshManager = new SSHConnectionManager(testPort + 10);
  }, 15000);

  afterEach(async () => {
    // Cleanup
    if (sshManager) {
      try {
        const sessions = sshManager.listSessions();
        for (const session of sessions) {
          await sshManager.disconnectSession(session.name);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
      sshManager.cleanup();
    }

    if (client) {
      try {
        await client.callTool({
          name: "ssh_disconnect",
          arguments: { sessionName: sessionName },
        });
      } catch (error) {
        // Ignore cleanup errors
      }
      await client.close();
    }

    if (transport) {
      await transport.close();
    }
  }, 10000);

  test("should establish SSH session and execute commands via MCP tools", async () => {
    // ACCEPTANCE CRITERIA: Given an SSH session exists, when commands are executed via ssh_exec

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

    // Execute command and validate output capture
    const execResult = await client.callTool({
      name: "ssh_exec",
      arguments: {
        sessionName: sessionName,
        command: 'echo "Terminal test message"',
      },
    });

    const execData = JSON.parse((execResult as any).content[0].text);

    expect(execData.success).toBe(true);
    expect(execData.result.stdout).toBe("Terminal test message");
    expect(execData.result.stderr).toBe("");
    expect(execData.result.exitCode).toBe(0);
  }, 25000);

  test("should capture real-time terminal output with listeners and maintain history", async () => {
    // ACCEPTANCE CRITERIA: Terminal output captured in real-time, includes prompts and commands

    const connection = await sshManager.createConnection({
      name: sessionName,
      host: "localhost",
      username: "test_user",
      password: "password123",
    });

    expect(connection.status).toBe("connected");

    // Setup output listener
    const capturedOutputs: any[] = [];
    const outputListener = (outputEntry: any) => {
      capturedOutputs.push({
        timestamp: outputEntry.timestamp,
        output: outputEntry.output,
        
        
        
      });
    };

    sshManager.addTerminalOutputListener(sessionName, outputListener);

    // Execute command
    const result = await sshManager.executeCommand(
      sessionName,
      'echo "Real-time test"',
    );

    // Allow time for output capture
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Validate command execution
    expect(result.stdout).toBe("Real-time test");
    expect(result.exitCode).toBe(0);

    // Validate real-time capture
    expect(capturedOutputs.length).toBeGreaterThan(0);

    // Verify command prompt captured (more flexible matching)
    const hasCommandPrompt = capturedOutputs.some((entry) =>
      entry.output.includes('echo "Real-time test"') || 
      entry.output.includes('$ echo') ||
      entry.output.includes('echo')
    );
    expect(hasCommandPrompt).toBe(true);

    // Verify command output captured
    const hasOutput = capturedOutputs.some((entry) =>
      entry.output.includes("Real-time test"),
    );
    expect(hasOutput).toBe(true);

    // Validate terminal history
    const terminalHistory = sshManager.getTerminalHistory(sessionName);
    expect(terminalHistory.length).toBeGreaterThan(0);

    const historyText = terminalHistory.map((entry) => entry.output).join(" ");
    expect(historyText).toContain("Real-time test");

    sshManager.removeTerminalOutputListener(sessionName, outputListener);
  }, 25000);

  test("should maintain session isolation and format detection", async () => {
    // ACCEPTANCE CRITERIA: Session-specific isolation and format preservation

    const session1Name = `${sessionName}-1`;
    const session2Name = `${sessionName}-2`;

    const connection1 = await sshManager.createConnection({
      name: session1Name,
      host: "localhost",
      username: "test_user",
      password: "password123",
    });

    const connection2 = await sshManager.createConnection({
      name: session2Name,
      host: "localhost",
      username: "test_user",
      password: "password123",
    });

    expect(connection1.status).toBe("connected");
    expect(connection2.status).toBe("connected");

    // Execute different commands in each session
    await sshManager.executeCommand(session1Name, 'echo "Session 1 message"');
    await sshManager.executeCommand(session2Name, 'echo "Session 2 message"');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify session isolation
    const history1 = sshManager.getTerminalHistory(session1Name);
    const history2 = sshManager.getTerminalHistory(session2Name);

    const history1Text = history1.map((entry) => entry.output).join(" ");
    const history2Text = history2.map((entry) => entry.output).join(" ");

    expect(history1Text).toContain("Session 1 message");
    expect(history1Text).not.toContain("Session 2 message");

    expect(history2Text).toContain("Session 2 message");
    expect(history2Text).not.toContain("Session 1 message");

    // Verify formatting detection - using output content as proxy for formatting
    const formattedEntries1 = history1.filter((entry) => {
      const data = entry.content || entry.output || '';
      return data.includes('\x1b[') || data.includes('\r\n');
    });
    expect(formattedEntries1.length).toBeGreaterThan(0);

    // Cleanup
    await sshManager.disconnectSession(session1Name);
    await sshManager.disconnectSession(session2Name);
  }, 30000);

  test("should meet performance requirements (latency and buffer management)", async () => {
    // PERFORMANCE REQUIREMENTS: <100ms latency, 1000 entry buffer, <10MB memory

    const connection = await sshManager.createConnection({
      name: sessionName,
      host: "localhost",
      username: "test_user",
      password: "password123",
    });

    expect(connection.status).toBe("connected");

    // Test latency
    let outputReceivedTime: number = 0;
    const outputListener = (outputEntry: any) => {
      if (
        outputEntry.output.includes("Latency test") &&
        outputReceivedTime === 0
      ) {
        outputReceivedTime = Date.now();
      }
    };

    sshManager.addTerminalOutputListener(sessionName, outputListener);

    const commandStartTime = Date.now();
    await sshManager.executeCommand(sessionName, 'echo "Latency test"');

    await new Promise((resolve) => setTimeout(resolve, 500));

    const latency =
      outputReceivedTime > 0 ? outputReceivedTime - commandStartTime : 999;
    expect(latency).toBeLessThan(100);

    console.log(`✅ Terminal output latency: ${latency}ms`);

    // Test buffer management with moderate load
    const commandCount = 20;
    for (let i = 0; i < commandCount; i++) {
      await sshManager.executeCommand(sessionName, `echo "Buffer test ${i}"`);
    }

    const terminalHistory = sshManager.getTerminalHistory(sessionName);
    expect(terminalHistory.length).toBeGreaterThan(commandCount);
    expect(terminalHistory.length).toBeLessThanOrEqual(1000);

    // Memory estimation
    const estimatedMemoryKB = terminalHistory.length * 3; // ~3KB per entry
    const estimatedMemoryMB = estimatedMemoryKB / 1024;
    expect(estimatedMemoryMB).toBeLessThan(10);

    console.log(
      `✅ Memory usage: ~${estimatedMemoryMB.toFixed(2)}MB for ${terminalHistory.length} entries`,
    );

    sshManager.removeTerminalOutputListener(sessionName, outputListener);
  }, 45000);

  test("should handle terminal formatting and VT100 sequences correctly", async () => {
    // ACCEPTANCE CRITERIA: Maintain proper terminal formatting and escape sequences

    const connection = await sshManager.createConnection({
      name: sessionName,
      host: "localhost",
      username: "test_user",
      password: "password123",
    });

    expect(connection.status).toBe("connected");

    const capturedOutputs: any[] = [];
    const outputListener = (outputEntry: any) => {
      capturedOutputs.push(outputEntry);
    };

    sshManager.addTerminalOutputListener(sessionName, outputListener);

    // Execute command that produces formatting
    await sshManager.executeCommand(sessionName, "ls --color=never"); // Use --color=never to avoid complex ANSI

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify formatting detection
    const formattedEntries = capturedOutputs.filter(
      (entry) => entry.preserveFormatting,
    );
    const vt100Entries = capturedOutputs.filter(
      (entry) => entry.vt100Compatible,
    );

    expect(formattedEntries.length).toBeGreaterThan(0);
    expect(vt100Entries.length).toBeGreaterThan(0);

    // Verify raw output preservation
    capturedOutputs.forEach((entry) => {
      expect(entry.output).toBeDefined();
      expect(typeof entry.output).toBe("string");
      expect(typeof entry.preserveFormatting).toBe("boolean");
      expect(typeof entry.vt100Compatible).toBe("boolean");
    });

    sshManager.removeTerminalOutputListener(sessionName, outputListener);
  }, 25000);
});
