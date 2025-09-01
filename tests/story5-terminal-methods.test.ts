import { SSHConnectionManager } from '../src/ssh-connection-manager';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Story 5: Terminal Interaction Methods - Simple Unit Tests', () => {
  let sshManager: SSHConnectionManager;

  beforeEach(() => {
    sshManager = new SSHConnectionManager(8080);
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

    it('should throw error when shell not ready', () => {
      // Create session data but don't mark shell as ready
      const sessionData = {
        isShellReady: false,
        shellChannel: null,
        connection: { lastActivity: new Date() },
        client: { destroy: jest.fn() },
        config: {},
        outputBuffer: [],
        outputListeners: [],
        startTime: new Date(),
        commandsExecuted: 0
      };
      (sshManager as any).connections.set('not-ready', sessionData);

      expect(() => {
        sshManager.sendTerminalInput('not-ready', 'test');
      }).toThrow("Shell session not ready for connection 'not-ready'");
    });

    it('should call write on shell channel when ready', () => {
      const mockChannel = { write: jest.fn(), end: jest.fn() };
      const sessionData = {
        isShellReady: true,
        shellChannel: mockChannel,
        connection: { lastActivity: new Date() },
        client: { destroy: jest.fn() },
        config: {},
        outputBuffer: [],
        outputListeners: [],
        startTime: new Date(),
        commandsExecuted: 0
      };
      (sshManager as any).connections.set('ready-session', sessionData);

      sshManager.sendTerminalInput('ready-session', 'echo hello\n');

      expect(mockChannel.write).toHaveBeenCalledWith('echo hello\n');
    });
  });

  describe('sendTerminalSignal method', () => {
    let mockChannel: any;
    let sessionData: any;

    beforeEach(() => {
      mockChannel = { write: jest.fn(), end: jest.fn() };
      sessionData = {
        isShellReady: true,
        shellChannel: mockChannel,
        connection: { lastActivity: new Date() },
        client: { destroy: jest.fn() },
        config: {},
        outputBuffer: [],
        outputListeners: [],
        startTime: new Date(),
        commandsExecuted: 0
      };
      (sshManager as any).connections.set('signal-test', sessionData);
    });

    it('should send SIGINT as Ctrl+C character (\\x03)', () => {
      sshManager.sendTerminalSignal('signal-test', 'SIGINT');
      expect(mockChannel.write).toHaveBeenCalledWith('\x03');
    });

    it('should send SIGTERM as Ctrl+D character (\\x04)', () => {
      sshManager.sendTerminalSignal('signal-test', 'SIGTERM');
      expect(mockChannel.write).toHaveBeenCalledWith('\x04');
    });

    it('should send SIGQUIT as Ctrl+D character (\\x04)', () => {
      sshManager.sendTerminalSignal('signal-test', 'SIGQUIT');
      expect(mockChannel.write).toHaveBeenCalledWith('\x04');
    });

    it('should send SIGTSTP as Ctrl+Z character (\\x1A)', () => {
      sshManager.sendTerminalSignal('signal-test', 'SIGTSTP');
      expect(mockChannel.write).toHaveBeenCalledWith('\x1A');
    });

    it('should be case insensitive for signal names', () => {
      sshManager.sendTerminalSignal('signal-test', 'sigint');
      expect(mockChannel.write).toHaveBeenCalledWith('\x03');

      mockChannel.write.mockClear();
      sshManager.sendTerminalSignal('signal-test', 'SigTerm');
      expect(mockChannel.write).toHaveBeenCalledWith('\x04');
    });

    it('should throw error for unsupported signal', () => {
      expect(() => {
        sshManager.sendTerminalSignal('signal-test', 'UNSUPPORTED');
      }).toThrow('Unsupported signal: UNSUPPORTED');
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        sshManager.sendTerminalSignal('nonexistent', 'SIGINT');
      }).toThrow("Session 'nonexistent' not found");
    });
  });

  describe('resizeTerminal method', () => {
    let mockChannel: any;
    let sessionData: any;

    beforeEach(() => {
      mockChannel = { setWindow: jest.fn(), end: jest.fn() };
      sessionData = {
        isShellReady: true,
        shellChannel: mockChannel,
        connection: { lastActivity: new Date() },
        client: { destroy: jest.fn() },
        config: {},
        outputBuffer: [],
        outputListeners: [],
        startTime: new Date(),
        commandsExecuted: 0
      };
      (sshManager as any).connections.set('resize-test', sessionData);
    });

    it('should call setWindow with correct parameters (rows, cols, 0, 0)', () => {
      sshManager.resizeTerminal('resize-test', 80, 24);
      expect(mockChannel.setWindow).toHaveBeenCalledWith(24, 80, 0, 0);
    });

    it('should validate minimum dimensions', () => {
      expect(() => {
        sshManager.resizeTerminal('resize-test', 0, 24);
      }).toThrow('Invalid terminal dimensions: cols and rows must be between 1 and 1000');

      expect(() => {
        sshManager.resizeTerminal('resize-test', 80, 0);
      }).toThrow('Invalid terminal dimensions: cols and rows must be between 1 and 1000');
    });

    it('should validate maximum dimensions', () => {
      expect(() => {
        sshManager.resizeTerminal('resize-test', 1001, 24);
      }).toThrow('Invalid terminal dimensions: cols and rows must be between 1 and 1000');

      expect(() => {
        sshManager.resizeTerminal('resize-test', 80, 1001);
      }).toThrow('Invalid terminal dimensions: cols and rows must be between 1 and 1000');
    });

    it('should handle resize errors and wrap them', () => {
      mockChannel.setWindow.mockImplementation(() => {
        throw new Error('SSH resize failed');
      });

      expect(() => {
        sshManager.resizeTerminal('resize-test', 80, 24);
      }).toThrow('Failed to resize terminal: SSH resize failed');
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        sshManager.resizeTerminal('nonexistent', 80, 24);
      }).toThrow("Session 'nonexistent' not found");
    });

    it('should accept various valid dimensions', () => {
      // Test minimum valid dimensions
      sshManager.resizeTerminal('resize-test', 1, 1);
      expect(mockChannel.setWindow).toHaveBeenCalledWith(1, 1, 0, 0);

      // Test maximum valid dimensions
      mockChannel.setWindow.mockClear();
      sshManager.resizeTerminal('resize-test', 1000, 1000);
      expect(mockChannel.setWindow).toHaveBeenCalledWith(1000, 1000, 0, 0);

      // Test typical terminal dimensions
      mockChannel.setWindow.mockClear();
      sshManager.resizeTerminal('resize-test', 120, 40);
      expect(mockChannel.setWindow).toHaveBeenCalledWith(40, 120, 0, 0);
    });
  });

  describe('Interface compliance', () => {
    it('should implement all required terminal interaction methods', () => {
      expect(typeof sshManager.sendTerminalInput).toBe('function');
      expect(typeof sshManager.sendTerminalSignal).toBe('function');
      expect(typeof sshManager.resizeTerminal).toBe('function');
    });

    it('should maintain existing interface methods', () => {
      expect(typeof sshManager.getTerminalHistory).toBe('function');
      expect(typeof sshManager.addTerminalOutputListener).toBe('function');
      expect(typeof sshManager.removeTerminalOutputListener).toBe('function');
      // Dashboard functionality removed per spec compliance
      expect(typeof sshManager.hasSession).toBe('function');
    });
  });
});