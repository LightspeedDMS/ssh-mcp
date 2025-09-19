import { SSHConnectionManager, TerminalOutputEntry } from "../src/ssh-connection-manager";
import { EventEmitter } from "events";
import {
  SSHConnectionConfig,
} from "../src/types";

// Mock SSH2 Client and related classes
jest.mock("ssh2", () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    exec: jest.fn(),
    destroy: jest.fn(),
    on: jest.fn().mockReturnThis(),
  })),
}));

// Mock for Stream (SSH exec stream)
class MockStream extends EventEmitter {
  stderr = new EventEmitter();

  destroy() {
    this.emit('close', 0);
  }

  // Simulate stream data and completion
  simulateCommand(stdout: string, stderr: string = '', exitCode: number = 0) {
    // Emit stdout data
    if (stdout) {
      this.emit('data', Buffer.from(stdout));
    }

    // Emit stderr data
    if (stderr) {
      this.stderr.emit('data', Buffer.from(stderr));
    }

    // Emit completion
    setTimeout(() => {
      this.emit('close', exitCode);
    }, 10);
  }
}

describe("SSH Command Echo Simple Tests", () => {
  let connectionManager: SSHConnectionManager;
  let mockClient: any;
  let capturedWebSocketOutput: string;
  let outputListenerCallback: (entry: TerminalOutputEntry) => void;

  const testConfig: SSHConnectionConfig = {
    name: "test-session",
    host: "localhost",
    username: "jsbattig",
    password: "test123",
  };

  // Helper function to set up mock SSH client with proper command responses
  const setupMockCommands = (commandResponses: Record<string, string>) => {
    mockClient.exec.mockImplementation((command: string, callback: (err: Error | undefined, stream: any) => void) => {
      const stream = new MockStream();
      setTimeout(() => {
        callback(undefined, stream);
        // Simulate command output after the stream is provided to the SSH manager
        setTimeout(() => {
          const response = commandResponses[command] || `unknown command: ${command}`;
          stream.simulateCommand(response);
        }, 20); // Give time for event listeners to be set up
      }, 10);
      return mockClient;
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedWebSocketOutput = "";

    connectionManager = new SSHConnectionManager();

    // Get the mocked Client constructor
    const { Client } = require("ssh2");
    mockClient = {
      connect: jest.fn(),
      exec: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn().mockReturnThis(),
    };

    Client.mockImplementation(() => mockClient);

    // Capture WebSocket output by mocking the terminal output listener
    outputListenerCallback = (entry: TerminalOutputEntry) => {
      capturedWebSocketOutput += entry.output;
    };

    // Mock successful SSH connection
    mockClient.on.mockImplementation((event: string, callback: (...args: any[]) => void) => {
      if (event === 'ready') {
        setTimeout(() => callback(), 10);
      }
      return mockClient;
    });
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  describe("Command Echo Functionality", () => {
    it("should generate command echo for user source commands", async () => {
      // Create connection
      await connectionManager.createConnection(testConfig);

      // Add WebSocket listener to capture output
      connectionManager.addTerminalOutputListener("test-session", outputListenerCallback);

      // Set up mock commands
      setupMockCommands({
        'pwd': '/home/jsbattig',
        'id': 'uid=1000(jsbattig) gid=1000(jsbattig) groups=1000(jsbattig)'
      });

      // Execute command with user source
      await connectionManager.executeCommand("test-session", "id", { source: "user" });

      // EXACT assertion - should include command echo for user source
      const expectedOutput = "[jsbattig@localhost ~]$ id\r\nuid=1000(jsbattig) gid=1000(jsbattig) groups=1000(jsbattig)";
      expect(capturedWebSocketOutput).toBe(expectedOutput);
    });

    it("should generate command echo for claude source commands", async () => {
      // Create connection
      await connectionManager.createConnection(testConfig);

      // Add WebSocket listener to capture output
      connectionManager.addTerminalOutputListener("test-session", outputListenerCallback);

      // Set up mock commands
      setupMockCommands({
        'pwd': '/home/jsbattig',
        'hostname': 'localhost'
      });

      // Execute command with claude source
      await connectionManager.executeCommand("test-session", "hostname", { source: "claude" });

      // EXACT assertion - should include command echo for claude source
      const expectedOutput = "[jsbattig@localhost ~]$ hostname\r\nlocalhost";
      expect(capturedWebSocketOutput).toBe(expectedOutput);
    });

    it("should NOT generate command echo for system source commands", async () => {
      // Create connection
      await connectionManager.createConnection(testConfig);

      // Add WebSocket listener to capture output
      connectionManager.addTerminalOutputListener("test-session", outputListenerCallback);

      // Set up mock commands
      setupMockCommands({
        'uptime': '10:30:45 up 1 day,  2:15,  1 user,  load average: 0.15, 0.10, 0.08'
      });

      // Execute command with system source
      await connectionManager.executeCommand("test-session", "uptime", { source: "system" });

      // EXACT assertion - should NOT include command echo for system source
      const expectedOutput = "10:30:45 up 1 day,  2:15,  1 user,  load average: 0.15, 0.10, 0.08";
      expect(capturedWebSocketOutput).toBe(expectedOutput);
    });

    it("should use exact CRLF formatting for xterm.js compatibility", async () => {
      // Create connection
      await connectionManager.createConnection(testConfig);

      // Add WebSocket listener to capture output
      connectionManager.addTerminalOutputListener("test-session", outputListenerCallback);

      // Set up mock commands
      setupMockCommands({
        'pwd': '/home/jsbattig',
        'echo test': 'test'
      });

      // Execute echo command
      await connectionManager.executeCommand("test-session", "echo test", { source: "claude" });

      // EXACT assertion - verify CRLF line endings (\\r\\n)
      const expectedOutput = "[jsbattig@localhost ~]$ echo test\r\ntest";
      expect(capturedWebSocketOutput).toBe(expectedOutput);

      // Verify it contains proper CRLF sequences
      expect(capturedWebSocketOutput).toContain('\r\n');
      expect(capturedWebSocketOutput.split('\r\n')).toHaveLength(2);
    });

    it("should generate exact WebSocket output for multi-column output (ls -la)", async () => {
      // Create connection
      await connectionManager.createConnection(testConfig);

      // Add WebSocket listener to capture output
      connectionManager.addTerminalOutputListener("test-session", outputListenerCallback);

      // Set up mock commands
      setupMockCommands({
        'pwd': '/home/jsbattig',
        'ls -la': `total 32
drwxr-xr-x  4 jsbattig jsbattig  4096 Jan 15 10:30 .
drwxr-xr-x  3 root     root      4096 Jan 14 09:15 ..
-rw-r--r--  1 jsbattig jsbattig   220 Jan 14 09:15 .bash_logout
-rw-r--r--  1 jsbattig jsbattig  3771 Jan 14 09:15 .bashrc
drwx------  2 jsbattig jsbattig  4096 Jan 15 10:30 .ssh`
      });

      // Execute ls -la command
      await connectionManager.executeCommand("test-session", "ls -la", { source: "user" });

      // EXACT assertion - match the entire WebSocket output string with multi-column formatting
      const expectedOutput = `[jsbattig@localhost ~]$ ls -la\r\ntotal 32
drwxr-xr-x  4 jsbattig jsbattig  4096 Jan 15 10:30 .
drwxr-xr-x  3 root     root      4096 Jan 14 09:15 ..
-rw-r--r--  1 jsbattig jsbattig   220 Jan 14 09:15 .bash_logout
-rw-r--r--  1 jsbattig jsbattig  3771 Jan 14 09:15 .bashrc
drwx------  2 jsbattig jsbattig  4096 Jan 15 10:30 .ssh`;
      expect(capturedWebSocketOutput).toBe(expectedOutput);
    });
  });
});