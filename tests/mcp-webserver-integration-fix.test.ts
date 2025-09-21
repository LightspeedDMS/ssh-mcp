/**
 * TDD Implementation Test: MCP WebServerManager Integration Fix
 *
 * This test demonstrates the proper TDD red-green-refactor cycle for the
 * MCP browser blocking fix by showing the minimal change needed.
 *
 * ISSUE: MCPSSHServer constructor accepts webServerManager parameter but
 * mcp-server.ts was not passing it, causing browser blocking behavior.
 *
 * FIX: Pass webServerManager parameter during MCPSSHServer instantiation.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MCPSSHServer } from '../src/mcp-ssh-server.js';
import { WebServerManager } from '../src/web-server-manager.js';
import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import { TerminalSessionStateManager } from '../src/terminal-session-state-manager.js';
import WebSocket from 'ws';

describe('MCP WebServerManager Integration Fix (TDD)', () => {
  let sshManager: SSHConnectionManager;
  let webServerManager: WebServerManager;
  let terminalStateManager: TerminalSessionStateManager;
  let webServerPort: number;

  beforeEach(async () => {
    // Setup shared components (mirrors mcp-server.ts structure)
    sshManager = new SSHConnectionManager();
    terminalStateManager = new TerminalSessionStateManager();
    webServerManager = new WebServerManager(sshManager, {}, terminalStateManager);

    await webServerManager.start();
    webServerPort = await webServerManager.getPort();
  });

  afterEach(async () => {
    if (webServerManager) {
      await webServerManager.stop();
    }
    if (sshManager) {
      sshManager.cleanup();
    }
  });

  test('RED: MCPSSHServer without webServerManager blocks on browser connections', async () => {
    // Simulate the BROKEN state - MCPSSHServer created without webServerManager
    const brokenMcpServer = new MCPSSHServer(
      { logLevel: 'debug' },
      sshManager,
      terminalStateManager
      // MISSING: webServerManager parameter (this is the bug)
    );
    brokenMcpServer.setWebServerPort(webServerPort);

    // Setup SSH connection
    await brokenMcpServer.callTool('ssh_connect', {
      name: 'red-test-session',
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    });

    // Create browser connection
    const wsUrl = `ws://localhost:${webServerPort}/ws/session/red-test-session`;
    const ws = new WebSocket(wsUrl);
    await new Promise(resolve => ws.on('open', resolve));

    // Execute command - should block (RED test)
    const startTime = Date.now();
    const result = await brokenMcpServer.callTool('ssh_exec', {
      sessionName: 'red-test-session',
      command: 'echo "red test - should block"'
    }) as any;
    const executionTime = Date.now() - startTime;

    // RED assertions - demonstrate the problem
    expect(result.success).toBe(true);
    expect(result.queued).toBeUndefined(); // BUG: should be true
    expect(result.result).toBeDefined(); // BUG: should not have immediate result
    expect(executionTime).toBeGreaterThan(50); // BUG: should return immediately

    ws.close();
  });

  test('GREEN: MCPSSHServer with webServerManager returns immediately on browser connections', async () => {
    // Simulate the FIXED state - MCPSSHServer created WITH webServerManager
    const fixedMcpServer = new MCPSSHServer(
      { logLevel: 'debug' },
      sshManager,
      terminalStateManager,
      webServerManager  // FIXED: webServerManager parameter included
    );
    fixedMcpServer.setWebServerPort(webServerPort);

    // Setup SSH connection
    await fixedMcpServer.callTool('ssh_connect', {
      name: 'green-test-session',
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    });

    // Create browser connection
    const wsUrl = `ws://localhost:${webServerPort}/ws/session/green-test-session`;
    const ws = new WebSocket(wsUrl);
    await new Promise(resolve => ws.on('open', resolve));

    // Execute command - should return immediately (GREEN test)
    const startTime = Date.now();
    const result = await fixedMcpServer.callTool('ssh_exec', {
      sessionName: 'green-test-session',
      command: 'sleep 1; echo "green test - should queue"'
    }) as any;
    const executionTime = Date.now() - startTime;

    // GREEN assertions - demonstrate the fix
    expect(result.success).toBe(true);
    expect(result.queued).toBe(true); // FIXED: properly queued
    expect(result.commandId).toBeDefined(); // FIXED: has polling ID
    expect(executionTime).toBeLessThan(1000); // FIXED: returns immediately

    ws.close();
  });

  test('REFACTOR: Validate polling interface works with queued commands', async () => {
    // Test the complete workflow including polling
    const mcpServer = new MCPSSHServer(
      { logLevel: 'debug' },
      sshManager,
      terminalStateManager,
      webServerManager
    );
    mcpServer.setWebServerPort(webServerPort);

    // Setup
    await mcpServer.callTool('ssh_connect', {
      name: 'refactor-test-session',
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    });

    const wsUrl = `ws://localhost:${webServerPort}/ws/session/refactor-test-session`;
    const ws = new WebSocket(wsUrl);
    await new Promise(resolve => ws.on('open', resolve));

    // Queue command
    const execResult = await mcpServer.callTool('ssh_exec', {
      sessionName: 'refactor-test-session',
      command: 'echo "refactor test - polling workflow"'
    }) as any;

    expect(execResult.queued).toBe(true);
    const taskId = execResult.commandId;

    // Poll for completion
    let attempts = 0;
    let pollResult: any;

    do {
      await new Promise(resolve => setTimeout(resolve, 100));
      pollResult = await mcpServer.callTool('ssh_poll_task', {
        sessionName: 'refactor-test-session',
        taskId: taskId
      }) as any;
      attempts++;
    } while (pollResult.state === 'running' && attempts < 20);

    // REFACTOR assertions - complete workflow validation
    expect(pollResult.success).toBe(true);
    expect(pollResult.state).toBe('completed');
    expect(pollResult.result.stdout).toContain('refactor test - polling workflow');

    ws.close();
  });

  test('MINIMAL FIX VERIFICATION: Only webServerManager parameter addition needed', async () => {
    // This test verifies the fix is minimal - just adding one parameter

    // Demonstrate that the fix is simply adding webServerManager to constructor call
    function simulateBrokenMcpServerCreation() {
      // OLD CODE (broken):
      return new MCPSSHServer(
        { logLevel: 'debug' },
        sshManager,
        terminalStateManager
        // Missing webServerManager
      );
    }

    function simulateFixedMcpServerCreation() {
      // NEW CODE (fixed):
      return new MCPSSHServer(
        { logLevel: 'debug' },
        sshManager,
        terminalStateManager,
        webServerManager  // Added webServerManager - this is the ENTIRE fix
      );
    }

    const brokenServer = simulateBrokenMcpServerCreation();
    const fixedServer = simulateFixedMcpServerCreation();

    // Verify the fix is minimal - only difference is webServerManager presence
    expect((brokenServer as any).webServerManager).toBeUndefined();
    expect((fixedServer as any).webServerManager).toBeDefined();
    expect((fixedServer as any).webServerManager).toBe(webServerManager);

    // All other properties should be identical
    expect((brokenServer as any).sshManager).toBe((fixedServer as any).sshManager);
    expect((brokenServer as any).terminalStateManager).toBe((fixedServer as any).terminalStateManager);
  });
});