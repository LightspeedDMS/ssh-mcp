import { SSHConnectionManager } from "../src/ssh-connection-manager";
import { WebServerManager } from "../src/web-server-manager";
import { SSHConnectionConfig } from "../src/types";
import WebSocket from 'ws';

describe("Story 2: WebSocket Message Enhancement - Terminal Input Handling", () => {
  let sshManager: SSHConnectionManager;
  let webServer: WebServerManager;
  let webPort: number;
  let testSessionName: string;

  beforeEach(async () => {
    sshManager = new SSHConnectionManager();
    webServer = new WebServerManager(sshManager);
    testSessionName = `test-session-${Date.now()}`;
    
    await webServer.start();
    webPort = await webServer.getPort();
  });

  afterEach(async () => {
    await webServer.stop();
    sshManager.cleanup();
  });

  describe("AC2.1: User Command Message Handling", () => {
    it("should receive terminal_input messages via WebSocket", async () => {
      // Arrange: Create SSH session
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost",
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      // Act & Assert: Connect to WebSocket and send terminal_input message
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${webPort}/ws/session/${testSessionName}`);
        
        ws.on('open', () => {
          const testMessage = {
            type: 'terminal_input',
            sessionName: testSessionName,
            command: 'echo "test command"',
            commandId: 'cmd_123'
          };
          
          ws.send(JSON.stringify(testMessage));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          // Should receive terminal_output response indicating command was processed
          if (message.type === 'terminal_output' && message.data) {
            ws.close();
            resolve();
          }
        });

        ws.on('error', (error) => {
          ws.close();
          reject(error);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          ws.close();
          reject(new Error('Test timeout: WebSocket terminal_input handling not working'));
        }, 10000);
      });
    }, 15000);

    it("should extract command from terminal_input message", async () => {
      // Arrange: Create SSH session
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost", 
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      // This test will fail initially because terminal_input handler doesn't exist yet
      const ws = new WebSocket(`ws://localhost:${webPort}/ws/session/${testSessionName}`);
      
      return new Promise<void>((resolve, reject) => {
        let commandExecuted = false;
        
        ws.on('open', () => {
          const testCommand = 'pwd';
          const testMessage = {
            type: 'terminal_input',
            sessionName: testSessionName,
            command: testCommand,
            commandId: 'cmd_456'
          };
          
          ws.send(JSON.stringify(testMessage));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'terminal_output') {
            // Verify the command was executed (should see pwd output)
            if (message.data && typeof message.data === 'string' && message.data.includes('/')) {
              commandExecuted = true;
              ws.close();
              resolve();
            }
          }
        });

        ws.on('close', () => {
          if (!commandExecuted) {
            reject(new Error('Command was not executed via terminal_input message'));
          }
        });

        ws.on('error', (error) => {
          reject(error);
        });

        setTimeout(() => {
          ws.close();
          if (!commandExecuted) {
            reject(new Error('Test timeout: Command extraction from terminal_input not working'));
          }
        }, 8000);
      });
    }, 15000);

    it("should forward command to SSH manager when receiving terminal_input", async () => {
      // Arrange: Create SSH session with spy on executeCommand
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost",
        username: "test_user", 
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      // Spy on executeCommand method to verify it gets called
      const executeCommandSpy = jest.spyOn(sshManager, 'executeCommand');
      
      const ws = new WebSocket(`ws://localhost:${webPort}/ws/session/${testSessionName}`);
      
      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          const testMessage = {
            type: 'terminal_input',
            sessionName: testSessionName,
            command: 'ls -la',
            commandId: 'cmd_789'
          };
          
          ws.send(JSON.stringify(testMessage));
          
          // Check if executeCommand was called after a short delay
          setTimeout(() => {
            if (executeCommandSpy.mock.calls.length > 0) {
              const [sessionName, command] = executeCommandSpy.mock.calls[0];
              expect(sessionName).toBe(testSessionName);
              expect(command).toBe('ls -la');
              ws.close();
              resolve();
            } else {
              ws.close();
              reject(new Error('executeCommand was not called when terminal_input was received'));
            }
          }, 1000);
        });

        ws.on('error', (error) => {
          reject(error);
        });

        setTimeout(() => {
          ws.close();
          reject(new Error('Test timeout: terminal_input forwarding not working'));
        }, 8000);
      });
    }, 15000);

    it("should mark commands as user-initiated when received via terminal_input", async () => {
      // This test will fail initially - we need to implement source tracking
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost",
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      const ws = new WebSocket(`ws://localhost:${webPort}/ws/session/${testSessionName}`);
      
      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          const testMessage = {
            type: 'terminal_input',
            sessionName: testSessionName,
            command: 'echo "user command"',
            commandId: 'cmd_user_1'
          };
          
          ws.send(JSON.stringify(testMessage));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'terminal_output' && message.source === 'user') {
            ws.close();
            resolve();
          }
        });

        ws.on('error', (error) => {
          ws.close();
          reject(error);
        });

        setTimeout(() => {
          ws.close();
          reject(new Error('Test timeout: user-initiated source marking not working'));
        }, 8000);
      });
    }, 15000);
  });

  describe("AC2.4: Session Validation", () => {
    it("should validate SSH session exists before processing terminal_input", async () => {
      const nonExistentSession = "non-existent-session";
      
      return new Promise<void>((resolve, reject) => {
        // Try to connect to WebSocket for non-existent session
        const ws = new WebSocket(`ws://localhost:${webPort}/ws/session/${nonExistentSession}`);
        
        ws.on('open', () => {
          // This should not happen for non-existent session
          ws.close();
          reject(new Error('WebSocket connection should have been rejected for non-existent session'));
        });

        ws.on('error', () => {
          // Expected - connection should fail for non-existent session
          resolve();
        });

        ws.on('close', (code) => {
          // Connection closed without opening - expected behavior
          if (code !== 1000) { // Not a normal close
            resolve();
          }
        });

        setTimeout(() => {
          reject(new Error('Test timeout: session validation not working'));
        }, 5000);
      });
    }, 10000);

    it("should provide clear error message when session does not exist", async () => {
      // Create a session, then connect WebSocket, then delete session to test error handling
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost",
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);
      
      const ws = new WebSocket(`ws://localhost:${webPort}/ws/session/${testSessionName}`);
      
      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          // Disconnect the SSH session to simulate session loss
          await sshManager.disconnectSession(testSessionName);
          
          // Try to send terminal_input after session is disconnected
          const testMessage = {
            type: 'terminal_input',
            sessionName: testSessionName,
            command: 'echo "test"',
            commandId: 'cmd_error_test'
          };
          
          ws.send(JSON.stringify(testMessage));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'error' && message.message) {
            expect(message.message).toContain('session');
            ws.close();
            resolve();
          }
        });

        ws.on('error', () => {
          // This could also be expected behavior
          ws.close();
          resolve();
        });

        setTimeout(() => {
          ws.close();
          reject(new Error('Test timeout: error message handling not working'));
        }, 8000);
      });
    }, 15000);

    it("should maintain session state during WebSocket communication", async () => {
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost",
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      const ws = new WebSocket(`ws://localhost:${webPort}/ws/session/${testSessionName}`);
      
      return new Promise<void>((resolve, reject) => {
        let commandCount = 0;
        const expectedCommands = 2;
        
        ws.on('open', () => {
          // Send first command
          ws.send(JSON.stringify({
            type: 'terminal_input',
            sessionName: testSessionName,
            command: 'export TEST_VAR="hello"',
            commandId: 'cmd_state_1'
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'terminal_output') {
            commandCount++;
            
            if (commandCount === 1) {
              // Send second command that depends on first
              ws.send(JSON.stringify({
                type: 'terminal_input',
                sessionName: testSessionName,
                command: 'echo $TEST_VAR',
                commandId: 'cmd_state_2'
              }));
            } else if (commandCount === expectedCommands) {
              // Verify that session state was maintained
              if (message.data && message.data.includes('hello')) {
                ws.close();
                resolve();
              } else {
                ws.close();
                reject(new Error('Session state was not maintained between commands'));
              }
            }
          }
        });

        ws.on('error', (error) => {
          ws.close();
          reject(error);
        });

        setTimeout(() => {
          ws.close();
          reject(new Error('Test timeout: session state maintenance not working'));
        }, 12000);
      });
    }, 15000);
  });
});