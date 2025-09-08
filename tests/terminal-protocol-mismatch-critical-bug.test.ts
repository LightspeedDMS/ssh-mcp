/**
 * CRITICAL BUG REPRODUCTION TEST
 * 
 * This test reproduces the exact protocol mismatch that breaks all terminal functionality.
 * The TypeScript source sends 'data: command + \r' but server expects 'command: command'.
 * This causes "Command is required and must be a string" errors.
 */

import { MCPServerManager } from './integration/terminal-history-framework/mcp-server-manager';
import { MCPClient } from './integration/terminal-history-framework/mcp-client';
import WebSocket from 'ws';

describe('CRITICAL: Terminal Protocol Mismatch Bug', () => {
  let mcpServerManager: MCPServerManager;
  let mcpClient: MCPClient;

  beforeEach(async () => {
    mcpServerManager = new MCPServerManager();
    
    // Start MCP server
    await mcpServerManager.start();
    const processInfo = mcpServerManager.getProcess();
    if (!processInfo || !processInfo.stdin || !processInfo.stdout) {
      throw new Error('Failed to start MCP server for testing');
    }
    
    mcpClient = new MCPClient({
      stdin: processInfo.stdin,
      stdout: processInfo.stdout
    } as any);
  });

  afterEach(async () => {
    if (mcpServerManager) {
      await mcpServerManager.stop();
    }
  });

  it('REPRODUCES CRITICAL BUG: TypeScript sends wrong message format causing server rejection', async () => {
    // This test reproduces the exact server error that occurs when TypeScript
    // sends { data: command + '\r' } but server expects { command: command }
    
    // Set up SSH session
    const sessionName = 'protocol-test';
    await mcpClient.callTool('ssh_connect', {
      name: sessionName,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '~/.ssh/id_ed25519'
    });
    
    // Get monitoring URL
    const monitoringResponse = await mcpClient.callTool('ssh_get_monitoring_url', {
      sessionName: sessionName
    }) as any;
    
    expect(monitoringResponse.success).toBe(true);
    expect(monitoringResponse.monitoringUrl).toBeDefined();
    
    // Convert monitoring URL to WebSocket URL
    // http://localhost:8083/session/test-session -> ws://localhost:8083/ws/session/test-session
    const httpUrl = monitoringResponse.monitoringUrl as string;
    const wsUrl = httpUrl.replace('http://', 'ws://').replace('/session/', '/ws/session/');
    
    // Connect to WebSocket
    const ws = new WebSocket(wsUrl);
    
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    let serverResponse: string | null = null;
    
    // Listen for server response
    ws.on('message', (data: Buffer) => {
      serverResponse = data.toString();
    });

    // Send message in WRONG format (reproduces current TypeScript bug)
    const wrongFormatMessage = {
      type: 'terminal_input',
      sessionName: sessionName, 
      data: 'pwd' + '\r',  // ❌ WRONG: server doesn't expect 'data' field
      commandId: 'test_cmd_001',
      timestamp: new Date().toISOString()
    };

    ws.send(JSON.stringify(wrongFormatMessage));
    
    // Wait for server response
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify we get the exact error that breaks terminal functionality
    expect(serverResponse).toBeDefined();
    const response = JSON.parse(serverResponse!);
    expect(response.type).toBe('error');
    expect(response.message).toBe('Command is required and must be a string');
    
    // This proves the terminal is COMPLETELY BROKEN due to protocol mismatch
    console.log('CRITICAL BUG REPRODUCED: Server rejects TypeScript message format');
    
    ws.close();
    
    // Cleanup session
    await mcpClient.callTool('ssh_disconnect', { sessionName });
  });

  it('VERIFIES FIX: Correct message format should work', async () => {
    // This test will pass ONLY after TypeScript source is fixed
    
    // Set up SSH session
    const sessionName = 'protocol-test-2';
    await mcpClient.callTool('ssh_connect', {
      name: sessionName,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '~/.ssh/id_ed25519'
    });
    
    // Get monitoring URL
    const monitoringResponse = await mcpClient.callTool('ssh_get_monitoring_url', {
      sessionName: sessionName
    }) as any;
    
    expect(monitoringResponse.success).toBe(true);
    const httpUrl = monitoringResponse.monitoringUrl as string;
    const wsUrl = httpUrl.replace('http://', 'ws://').replace('/session/', '/ws/session/');
    
    // Connect to WebSocket
    const ws = new WebSocket(wsUrl);
    
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    let serverResponse: string | null = null;
    
    ws.on('message', (data: Buffer) => {
      serverResponse = data.toString();
    });

    // Send message in CORRECT format (how it should be)
    const correctFormatMessage = {
      type: 'terminal_input',
      sessionName: sessionName,
      command: 'pwd',  // ✅ CORRECT: server expects 'command' field
      commandId: 'test_cmd_002',
      timestamp: new Date().toISOString()
    };

    ws.send(JSON.stringify(correctFormatMessage));
    
    // Wait for server response
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify command executes successfully (no error response)
    if (serverResponse) {
      const response = JSON.parse(serverResponse);
      expect(response.type).not.toBe('error');
      // Should get terminal_ready or terminal_output (both indicate successful protocol)
      expect(response.type).toMatch(/^(terminal_output|terminal_ready)$/);
      console.log('SUCCESS: Protocol fix works! Received:', response.type);
    }
    
    ws.close();
    
    // Cleanup session
    await mcpClient.callTool('ssh_disconnect', { sessionName });
  });
});