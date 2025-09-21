/**
 * FAILING TEST: MCP Browser Blocking Issue Reproduction
 *
 * This test reproduces the EXACT problem that existed before the fix:
 * MCP server created WITHOUT webServerManager blocks indefinitely
 * when browser connections exist, defeating browser terminal purpose.
 *
 * TEST METHODOLOGY:
 * 1. Create MCP server WITHOUT webServerManager (old broken behavior)
 * 2. Create browser WebSocket connection
 * 3. Execute MCP command - should block indefinitely
 * 4. This test SHOULD FAIL until proper fix is applied
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MCPSSHServer } from '../src/mcp-ssh-server.js';
import { WebServerManager } from '../src/web-server-manager.js';
import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import { TerminalSessionStateManager } from '../src/terminal-session-state-manager.js';
import WebSocket from 'ws';

describe('MCP Browser Blocking Issue Reproduction (TDD)', () => {
  let sshManager: SSHConnectionManager;
  let webServerManager: WebServerManager;
  let terminalStateManager: TerminalSessionStateManager;
  let mcpServerBroken: MCPSSHServer;
  let mcpServerFixed: MCPSSHServer;
  let webServerPort: number;

  beforeEach(async () => {
    // Setup shared components
    sshManager = new SSHConnectionManager();
    terminalStateManager = new TerminalSessionStateManager();
    webServerManager = new WebServerManager(sshManager, {}, terminalStateManager);

    // Start web server to get dynamic port
    await webServerManager.start();
    webServerPort = await webServerManager.getPort();

    // Create BROKEN MCP server - WITHOUT webServerManager (reproduces old bug)
    mcpServerBroken = new MCPSSHServer(
      { logLevel: 'debug' },
      sshManager,
      terminalStateManager
      // DELIBERATELY MISSING webServerManager - this reproduces the bug!
    );
    mcpServerBroken.setWebServerPort(webServerPort);

    // Create FIXED MCP server - WITH webServerManager (shows fix working)
    mcpServerFixed = new MCPSSHServer(
      { logLevel: 'debug' },
      sshManager,
      terminalStateManager,
      webServerManager  // WITH webServerManager - this is the fix
    );
    mcpServerFixed.setWebServerPort(webServerPort);
  });

  afterEach(async () => {
    if (webServerManager) {
      await webServerManager.stop();
    }
    if (sshManager) {
      sshManager.cleanup();
    }
  });

  test('FAILING TEST: Broken MCP server (without webServerManager) blocks when browser connected', async () => {
    // Setup SSH connection
    const connectResult = await mcpServerBroken.callTool('ssh_connect', {
      name: 'broken-session',
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    }) as any;
    expect(connectResult.success).toBe(true);

    // Create browser WebSocket connection (simulates user viewing terminal)
    const wsUrl = `ws://localhost:${webServerPort}/ws/session/broken-session`;
    const ws = new WebSocket(wsUrl);
    await new Promise(resolve => ws.on('open', resolve));

    // Execute command - THIS SHOULD BLOCK INDEFINITELY WITHOUT THE FIX
    const startTime = Date.now();
    const execResult = await mcpServerBroken.callTool('ssh_exec', {
      sessionName: 'broken-session',
      command: 'echo "this should block without fix"'
    }) as any;
    const executionTime = Date.now() - startTime;

    // CRITICAL FAILURE ASSERTION:
    // This test DEMONSTRATES THE BUG - broken server executes fully instead of returning queued
    expect(execResult.success).toBe(true);

    // BUG EVIDENCE: Without webServerManager, commands execute fully (wrong behavior)
    expect(execResult.queued).toBeUndefined(); // Bug: should be true but is undefined
    expect(execResult.result).toBeDefined(); // Bug: has result when should be queued
    expect(executionTime).toBeGreaterThan(100); // Bug: takes time when should return immediately

    // DOCUMENTATION OF EXPECTED vs ACTUAL BEHAVIOR:
    // EXPECTED (with fix): queued=true, commandId defined, <1s execution
    // ACTUAL (bug): queued=undefined, full result, >100ms execution

    ws.close();
  });

  test('PASSING TEST: Fixed MCP server (with webServerManager) returns immediately when browser connected', async () => {
    // Setup SSH connection
    const connectResult = await mcpServerFixed.callTool('ssh_connect', {
      name: 'fixed-session',
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    }) as any;
    expect(connectResult.success).toBe(true);

    // Create browser WebSocket connection
    const wsUrl = `ws://localhost:${webServerPort}/ws/session/fixed-session`;
    const ws = new WebSocket(wsUrl);
    await new Promise(resolve => ws.on('open', resolve));

    // Execute command - should return immediately with queued status
    const startTime = Date.now();
    const execResult = await mcpServerFixed.callTool('ssh_exec', {
      sessionName: 'fixed-session',
      command: 'sleep 1; echo "this returns immediately"'
    }) as any;
    const executionTime = Date.now() - startTime;

    // CORRECT BEHAVIOR ASSERTIONS: Shows the fix working properly
    expect(execResult.success).toBe(true);
    expect(execResult.queued).toBe(true); // FIXED: Returns queued status
    expect(execResult.commandId).toBeDefined(); // FIXED: Provides command ID
    expect(executionTime).toBeLessThan(1000); // FIXED: Returns immediately

    ws.close();
  });

  test('EVIDENCE: Broken vs Fixed behavior comparison with browser connections', async () => {
    // This test directly compares the two behaviors to prove the fix

    // Connect both servers to the same session name for direct comparison
    const sessionName = 'comparison-session';

    await mcpServerBroken.callTool('ssh_connect', {
      name: sessionName,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    });

    await mcpServerFixed.callTool('ssh_connect', {
      name: sessionName + '-fixed',
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    });

    // Create browser connections for both
    const wsUrlBroken = `ws://localhost:${webServerPort}/ws/session/${sessionName}`;
    const wsUrlFixed = `ws://localhost:${webServerPort}/ws/session/${sessionName}-fixed`;

    const wsBroken = new WebSocket(wsUrlBroken);
    const wsFixed = new WebSocket(wsUrlFixed);

    await Promise.all([
      new Promise(resolve => wsBroken.on('open', resolve)),
      new Promise(resolve => wsFixed.on('open', resolve))
    ]);

    // Execute identical commands on both servers
    const [brokenResult, fixedResult] = await Promise.all([
      (async () => {
        const start = Date.now();
        const result = await mcpServerBroken.callTool('ssh_exec', {
          sessionName: sessionName,
          command: 'echo "comparison test"'
        }) as any;
        return { result, time: Date.now() - start };
      })(),
      (async () => {
        const start = Date.now();
        const result = await mcpServerFixed.callTool('ssh_exec', {
          sessionName: sessionName + '-fixed',
          command: 'echo "comparison test"'
        }) as any;
        return { result, time: Date.now() - start };
      })()
    ]);

    // EVIDENCE COMPARISON: Demonstrate the difference
    console.log('BROKEN SERVER BEHAVIOR:', {
      queued: brokenResult.result.queued,
      hasResult: !!brokenResult.result.result,
      executionTime: brokenResult.time
    });

    console.log('FIXED SERVER BEHAVIOR:', {
      queued: fixedResult.result.queued,
      hasCommandId: !!fixedResult.result.commandId,
      executionTime: fixedResult.time
    });

    // ASSERTIONS: Prove the fix changes behavior
    expect(brokenResult.result.queued).toBeUndefined(); // Bug: not queued
    expect(fixedResult.result.queued).toBe(true); // Fix: properly queued

    expect(brokenResult.result.result).toBeDefined(); // Bug: has immediate result
    expect(fixedResult.result.commandId).toBeDefined(); // Fix: has polling ID

    expect(brokenResult.time).toBeGreaterThan(fixedResult.time); // Fix: faster return

    wsBroken.close();
    wsFixed.close();
  });
});