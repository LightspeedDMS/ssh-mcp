import { SSHConnectionManager } from "../src/ssh-connection-manager";
import { WebServerManager } from "../src/web-server-manager";
import { SSHConnectionConfig } from "../src/types";
import WebSocket from 'ws';

describe("Story 2: WebSocket Response Format - AC2.3", () => {
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

  describe("AC2.3: WebSocket Response Format", () => {
    it("should include source identification in terminal_output responses", async () => {
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
            commandId: 'cmd_response_format_1'
          };
          
          ws.send(JSON.stringify(testMessage));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'terminal_output' && message.commandId === 'cmd_response_format_1') {
            // Verify response format includes source identification
            expect(message.source).toBeDefined();
            expect(message.source).toBe('user');
            expect(message.data).toBeDefined();
            expect(message.commandId).toBe('cmd_response_format_1');
            
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
          reject(new Error('Test timeout: response format not matching expected structure'));
        }, 8000);
      });
    }, 15000);

    it("should include user-initiated flag when source is user", async () => {
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
            command: 'pwd',
            commandId: 'cmd_user_flag_1'
          };
          
          ws.send(JSON.stringify(testMessage));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'terminal_output' && message.commandId === 'cmd_user_flag_1') {
            expect(message["user-initiated"]).toBe(true);
            expect(message.source).toBe('user');
            
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
          reject(new Error('Test timeout: user-initiated flag not present'));
        }, 8000);
      });
    }, 15000);

    it("should exclude command echo from terminal output response", async () => {
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost",
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      const ws = new WebSocket(`ws://localhost:${webPort}/ws/session/${testSessionName}`);
      
      return new Promise<void>((resolve, reject) => {
        const testCommand = 'echo "unique_output_12345"';
        
        ws.on('open', () => {
          const testMessage = {
            type: 'terminal_input',
            sessionName: testSessionName,
            command: testCommand,
            commandId: 'cmd_no_echo_1'
          };
          
          ws.send(JSON.stringify(testMessage));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'terminal_output' && message.commandId === 'cmd_no_echo_1') {
            // Response should contain command output but not command echo
            expect(message.data).toContain('unique_output_12345');
            expect(message.data).not.toContain(testCommand); // Command should not be echoed
            
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
          reject(new Error('Test timeout: command echo filtering not working'));
        }, 8000);
      });
    }, 15000);

    it("should include output content in data field", async () => {
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
            command: 'echo "test output content"',
            commandId: 'cmd_output_content_1'
          };
          
          ws.send(JSON.stringify(testMessage));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'terminal_output' && message.commandId === 'cmd_output_content_1') {
            expect(message.data).toBeDefined();
            expect(typeof message.data).toBe('string');
            expect(message.data.length).toBeGreaterThan(0);
            expect(message.data).toContain('test output content');
            
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
          reject(new Error('Test timeout: output content not present in data field'));
        }, 8000);
      });
    }, 15000);

    it("should preserve commandId in response for request correlation", async () => {
      const sshConfig: SSHConnectionConfig = {
        name: testSessionName,
        host: "localhost",
        username: "test_user",
        password: "password123"
      };
      await sshManager.createConnection(sshConfig);

      const ws = new WebSocket(`ws://localhost:${webPort}/ws/session/${testSessionName}`);
      
      return new Promise<void>((resolve, reject) => {
        const uniqueCommandId = `cmd_correlation_${Date.now()}`;
        
        ws.on('open', () => {
          const testMessage = {
            type: 'terminal_input',
            sessionName: testSessionName,
            command: 'echo "correlation test"',
            commandId: uniqueCommandId
          };
          
          ws.send(JSON.stringify(testMessage));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'terminal_output' && message.commandId === uniqueCommandId) {
            expect(message.commandId).toBe(uniqueCommandId);
            
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
          reject(new Error('Test timeout: commandId correlation not working'));
        }, 8000);
      });
    }, 15000);

    it("should format response as valid JSON with all required fields", async () => {
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
            command: 'echo "json validation test"',
            commandId: 'cmd_json_validation_1'
          };
          
          ws.send(JSON.stringify(testMessage));
        });

        ws.on('message', (data) => {
          let message: any;
          
          try {
            message = JSON.parse(data.toString());
          } catch (error) {
            ws.close();
            reject(new Error('Response is not valid JSON'));
            return;
          }
          
          if (message.type === 'terminal_output' && message.commandId === 'cmd_json_validation_1') {
            // Validate all required fields are present
            expect(message.type).toBe('terminal_output');
            expect(message.source).toBeDefined();
            expect(message.data).toBeDefined();
            expect(message.commandId).toBe('cmd_json_validation_1');
            expect(message["user-initiated"]).toBeDefined();
            
            // Validate field types
            expect(typeof message.type).toBe('string');
            expect(typeof message.source).toBe('string');
            expect(typeof message.data).toBe('string');
            expect(typeof message.commandId).toBe('string');
            expect(typeof message["user-initiated"]).toBe('boolean');
            
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
          reject(new Error('Test timeout: JSON validation failed'));
        }, 8000);
      });
    }, 15000);
  });
});