/**
 * DIRECT WEBSOCKET NULL OUTPUT TEST
 * 
 * This test directly captures WebSocket messages to detect "null 2>&1" stray output
 * BEFORE any cleanup filters are applied. This ensures we test the root cause fix
 * rather than just the symptom cleanup.
 * 
 * Tests the fix in ssh-connection-manager.ts where PS1 configuration was changed
 * from `export PS1='...' > /dev/null 2>&1` to `stty -echo; export PS1='...'; stty echo`
 */

import WebSocket from 'ws';

describe('DIRECT WEBSOCKET: Null Output Detection', () => {
  const testTimeout = 30000;

  test('WebSocket messages should NOT contain "null 2>&1" stray output', async () => {
    // Step 1: Connect to MCP and create SSH session
    const { execSync } = require('child_process');
    
    // Connect via MCP (this should trigger PS1 configuration)
    const connectResult = execSync(`
      echo '{"method": "ssh_connect", "params": {"name": "websocket-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}}' | npx mcp-client-stdio src/index.ts
    `, {  timeout: 15000 });
    
    expect(connectResult).toContain('"success":true');

    // Step 2: Get monitoring URL
    const urlResult = execSync(`
      echo '{"method": "ssh_get_monitoring_url", "params": {"sessionName": "websocket-test"}}' | npx mcp-client-stdio src/index.ts
    `, {  timeout: 5000 });
    
    const urlMatch = urlResult.match(/"monitoringUrl":"([^"]+)"/);
    expect(urlMatch).toBeTruthy();
    
    const monitoringUrl = urlMatch![1];
    const wsUrl = monitoringUrl.replace('http:', 'ws:').replace('/session/', '/ws/session/');
    
    // Step 3: Connect to WebSocket and capture all messages
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const receivedMessages: string[] = [];
      let timeout: NodeJS.Timeout;

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };

      timeout = setTimeout(() => {
        cleanup();
        
        // CRITICAL ASSERTION: Check all received messages for stray output
        const allData = receivedMessages.join('');
        console.log('All WebSocket messages received:', receivedMessages);
        
        // Primary assertion - should NOT contain "null 2>&1"
        expect(allData).not.toContain('null 2>&1');
        
        // Secondary assertion - should NOT contain any PS1 export commands
        expect(allData).not.toContain('export PS1');
        
        // Verify we actually received terminal output (not just empty test)
        expect(receivedMessages.length).toBeGreaterThan(0);
        
        // Cleanup MCP session
        try {
          execSync(`
            echo '{"method": "ssh_disconnect", "params": {"sessionName": "websocket-test"}}' | npx mcp-client-stdio src/index.ts
          `, {  timeout: 5000 });
        } catch (error) {
          console.warn('Cleanup warning:', error);
        }
        
        resolve();
      }, 10000);

      ws.on('open', () => {
        console.log('WebSocket connected successfully');
        
        // Execute a command to generate terminal output
        setTimeout(() => {
          execSync(`
            echo '{"method": "ssh_exec", "params": {"sessionName": "websocket-test", "command": "whoami"}}' | npx mcp-client-stdio src/index.ts
          `, {  timeout: 10000 });
        }, 1000);
      });

      ws.on('message', (data) => {
        const message = data.toString();
        receivedMessages.push(message);
        console.log('WebSocket message:', message);
      });

      ws.on('error', (error) => {
        cleanup();
        reject(new Error(`WebSocket error: ${error.message}`));
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
      });
    });
  }, testTimeout);
});