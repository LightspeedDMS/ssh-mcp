/**
 * Real Browser Terminal Validation Test
 * 
 * This test validates the terminal behavior by connecting to the real server
 * and testing WebSocket-based terminal interactions that simulate browser usage.
 * Tests the critical fix for double echo issues.
 */

import WebSocket from 'ws';

describe('Real Browser Terminal Validation', () => {
  let webSocket: WebSocket;
  const serverPort = 8094;
  const testTimeoutMs = 30000;

  beforeEach(() => {
    // Create WebSocket connection to running server
    webSocket = new WebSocket(`ws://localhost:${serverPort}`);
  });

  afterEach(() => {
    if (webSocket) {
      webSocket.close();
    }
  });

  /**
   * Critical test: Validate real-time terminal interaction
   * Tests that SSH session works properly without double echo
   */
  test('should handle real terminal session without double echo', async () => {
    return new Promise<void>((resolve, reject) => {
      const responses: string[] = [];
      // let connectionEstablished = false;
      let sessionCreated = false;
      let commandExecuted = false;

      const timeout = setTimeout(() => {
        reject(new Error('Test timeout - real terminal validation failed'));
      }, testTimeoutMs);

      webSocket.on('open', () => {
        console.log('✅ WebSocket connection established');
        // connectionEstablished = true;
        
        // Create SSH session
        const connectMessage = {
          type: 'terminal_input',
          sessionName: 'real-test-session',
          command: 'ssh_connect {"name": "real-test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          timestamp: new Date().toISOString()
        };
        
        webSocket.send(JSON.stringify(connectMessage));
      });

      webSocket.on('message', (data) => {
        const response = data.toString();
        responses.push(response);
        console.log('Received:', response.substring(0, 100) + (response.length > 100 ? '...' : ''));

        try {
          const message = JSON.parse(response);
          
          if (message.type === 'terminal_output' && message.data) {
            // Check for connection success
            if (!sessionCreated && message.data.includes('successfully')) {
              sessionCreated = true;
              console.log('✅ SSH session created successfully');
              
              // Execute a simple command
              const commandMessage = {
                type: 'terminal_input',
                sessionName: 'real-test-session',
                command: 'ssh_exec {"sessionName": "real-test-session", "command": "echo testing123"}',
                timestamp: new Date().toISOString()
              };
              
              webSocket.send(JSON.stringify(commandMessage));
            }
            
            // Check for command execution success
            if (sessionCreated && !commandExecuted && message.data.includes('testing123')) {
              commandExecuted = true;
              console.log('✅ Command executed successfully');
              
              // Validate no double echo
              const allResponses = responses.join(' ');
              
              // Count occurrences of our test string
              const testStringCount = (allResponses.match(/testing123/g) || []).length;
              
              if (testStringCount <= 2) { // Command + result = acceptable
                console.log(`✅ Double echo validation passed: "testing123" appears ${testStringCount} times`);
                clearTimeout(timeout);
                resolve();
              } else {
                clearTimeout(timeout);
                reject(new Error(`Double echo detected: "testing123" appears ${testStringCount} times (expected ≤ 2)`));
              }
            }
          }
        } catch (error) {
          // Non-JSON response - that's ok for some messages
        }
      });

      webSocket.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${error.message}`));
      });

      webSocket.on('close', () => {
        if (!commandExecuted) {
          clearTimeout(timeout);
          reject(new Error('WebSocket closed before test completion'));
        }
      });
    });
  }, testTimeoutMs);

  /**
   * Validate proper CRLF line ending handling
   */
  test('should handle CRLF line endings properly', async () => {
    return new Promise<void>((resolve, reject) => {
      const responses: string[] = [];
      // let crlfFound = false;

      const timeout = setTimeout(() => {
        reject(new Error('Test timeout - CRLF validation failed'));
      }, testTimeoutMs);

      webSocket.on('open', () => {
        // Create SSH session and execute command
        const connectMessage = {
          type: 'terminal_input',
          sessionName: 'crlf-test-session',
          command: 'ssh_connect {"name": "crlf-test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          timestamp: new Date().toISOString()
        };
        
        webSocket.send(JSON.stringify(connectMessage));
      });

      webSocket.on('message', (data) => {
        const response = data.toString();
        responses.push(response);

        try {
          const message = JSON.parse(response);
          
          if (message.type === 'terminal_output' && message.data) {
            // Check for CRLF line endings (critical for xterm.js compatibility)
            if (message.data.includes('\\r\\n')) {
              // crlfFound = true;
              console.log('✅ CRLF line endings found in terminal output');
              clearTimeout(timeout);
              resolve();
            }
          }
        } catch (error) {
          // Non-JSON response - check raw content
          if (response.includes('\\r\\n')) {
            // crlfFound = true;
            console.log('✅ CRLF line endings found in raw response');
            clearTimeout(timeout);
            resolve();
          }
        }
      });

      webSocket.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${error.message}`));
      });
    });
  }, testTimeoutMs);
});