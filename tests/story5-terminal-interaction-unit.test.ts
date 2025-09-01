import { SSHConnectionManager } from '../src/ssh-connection-manager';
import { SSHConnectionConfig } from '../src/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock the SSH2 client for unit testing
jest.mock('ssh2', () => {
  const mockChannel = {
    write: jest.fn(),
    setWindow: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    end: jest.fn()
  };

  const mockClient = {
    connect: jest.fn(),
    shell: jest.fn((callback) => {
      // Simulate successful shell creation
      setTimeout(() => callback(null, mockChannel), 10);
    }),
    destroy: jest.fn(),
    on: jest.fn()
  };

  return {
    Client: jest.fn(() => mockClient),
    ClientChannel: jest.fn()
  };
});

describe('Story 5: Terminal Interaction - Unit Tests', () => {
  let sshManager: SSHConnectionManager;
  let mockClient: any;
  let mockChannel: any;

  beforeEach(() => {
    jest.clearAllMocks();
    sshManager = new SSHConnectionManager(8080);
    
    // Get references to mocked objects
    const ClientMock = require('ssh2').Client;
    mockClient = new ClientMock();
    mockChannel = {
      write: jest.fn(),
      setWindow: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
      end: jest.fn()
    };
    
    // Configure mock shell method
    mockClient.shell.mockImplementation((callback: any) => {
      setTimeout(() => callback(null, mockChannel), 10);
    });
  });

  afterEach(() => {
    sshManager.cleanup();
  });

  describe('sendTerminalInput method', () => {
    it('should throw error for non-existent session', () => {
      expect(() => {
        sshManager.sendTerminalInput('nonexistent', 'test command');
      }).toThrow("Session 'nonexistent' not found");
    });

    it('should send input to shell channel when session exists', async () => {
      // Create a mock session manually
      const config: SSHConnectionConfig = {
        name: 'test-session',
        host: 'localhost',
        username: 'test',
        password: 'test'
      };

      // Mock the client ready event
      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(callback, 10);
        }
      });

      // Create connection
      const connectionPromise = sshManager.createConnection(config);
      
      // Trigger ready event
      const readyCallback = mockClient.on.mock.calls.find((call: any) => call[0] === 'ready')[1];
      readyCallback();

      await connectionPromise;

      // Wait for shell to be ready
      await new Promise(resolve => setTimeout(resolve, 20));

      // Mock that shell is ready
      const sessionData = (sshManager as any).connections.get('test-session');
      if (sessionData) {
        sessionData.isShellReady = true;
        sessionData.shellChannel = mockChannel;
      }

      // Test sending input
      sshManager.sendTerminalInput('test-session', 'echo hello\n');

      expect(mockChannel.write).toHaveBeenCalledWith('echo hello\n');
    });
  });

  describe('sendTerminalSignal method', () => {
    beforeEach(async () => {
      // Setup a test session
      const config: SSHConnectionConfig = {
        name: 'signal-test',
        host: 'localhost',
        username: 'test',
        password: 'test'
      };

      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(callback, 10);
        }
      });

      const connectionPromise = sshManager.createConnection(config);
      const readyCallback = mockClient.on.mock.calls.find((call: any) => call[0] === 'ready')[1];
      readyCallback();
      await connectionPromise;
      await new Promise(resolve => setTimeout(resolve, 20));

      // Mock ready state
      const sessionData = (sshManager as any).connections.get('signal-test');
      if (sessionData) {
        sessionData.isShellReady = true;
        sessionData.shellChannel = mockChannel;
      }
    });

    it('should send SIGINT as Ctrl+C character', () => {
      sshManager.sendTerminalSignal('signal-test', 'SIGINT');
      expect(mockChannel.write).toHaveBeenCalledWith('\x03');
    });

    it('should send SIGTERM as Ctrl+D character', () => {
      sshManager.sendTerminalSignal('signal-test', 'SIGTERM');
      expect(mockChannel.write).toHaveBeenCalledWith('\x04');
    });

    it('should send SIGTSTP as Ctrl+Z character', () => {
      sshManager.sendTerminalSignal('signal-test', 'SIGTSTP');
      expect(mockChannel.write).toHaveBeenCalledWith('\x1A');
    });

    it('should throw error for unsupported signal', () => {
      expect(() => {
        sshManager.sendTerminalSignal('signal-test', 'UNSUPPORTED');
      }).toThrow('Unsupported signal: UNSUPPORTED');
    });
  });

  describe('resizeTerminal method', () => {
    beforeEach(async () => {
      // Setup a test session
      const config: SSHConnectionConfig = {
        name: 'resize-test',
        host: 'localhost',
        username: 'test',
        password: 'test'
      };

      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(callback, 10);
        }
      });

      const connectionPromise = sshManager.createConnection(config);
      const readyCallback = mockClient.on.mock.calls.find((call: any) => call[0] === 'ready')[1];
      readyCallback();
      await connectionPromise;
      await new Promise(resolve => setTimeout(resolve, 20));

      // Mock ready state
      const sessionData = (sshManager as any).connections.get('resize-test');
      if (sessionData) {
        sessionData.isShellReady = true;
        sessionData.shellChannel = mockChannel;
      }
    });

    it('should call setWindow with correct dimensions', () => {
      sshManager.resizeTerminal('resize-test', 80, 24);
      expect(mockChannel.setWindow).toHaveBeenCalledWith(24, 80, 0, 0);
    });

    it('should validate terminal dimensions', () => {
      expect(() => {
        sshManager.resizeTerminal('resize-test', 0, 24);
      }).toThrow('Invalid terminal dimensions: cols and rows must be between 1 and 1000');

      expect(() => {
        sshManager.resizeTerminal('resize-test', 1001, 24);
      }).toThrow('Invalid terminal dimensions: cols and rows must be between 1 and 1000');

      expect(() => {
        sshManager.resizeTerminal('resize-test', 80, 0);
      }).toThrow('Invalid terminal dimensions: cols and rows must be between 1 and 1000');

      expect(() => {
        sshManager.resizeTerminal('resize-test', 80, 1001);
      }).toThrow('Invalid terminal dimensions: cols and rows must be between 1 and 1000');
    });

    it('should handle resize errors gracefully', () => {
      mockChannel.setWindow.mockImplementation(() => {
        throw new Error('Resize failed');
      });

      expect(() => {
        sshManager.resizeTerminal('resize-test', 80, 24);
      }).toThrow('Failed to resize terminal: Resize failed');
    });
  });

  describe('Error handling', () => {
    it('should throw error when shell not ready', () => {
      // Create session data but don't mark shell as ready
      const sessionData = {
        isShellReady: false,
        shellChannel: null,
        connection: { lastActivity: new Date() }
      };
      (sshManager as any).connections.set('not-ready', sessionData);

      expect(() => {
        sshManager.sendTerminalInput('not-ready', 'test');
      }).toThrow("Shell session not ready for connection 'not-ready'");

      expect(() => {
        sshManager.sendTerminalSignal('not-ready', 'SIGINT');
      }).toThrow("Shell session not ready for connection 'not-ready'");

      expect(() => {
        sshManager.resizeTerminal('not-ready', 80, 24);
      }).toThrow("Shell session not ready for connection 'not-ready'");
    });
  });
});