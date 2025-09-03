import { JSDOM } from "jsdom";
const { TerminalInputHandler } = require("../static/terminal-input-handler.js");

describe("Story 1: Browser Terminal Input Handling - Real Production Code Tests", () => {
  let dom: JSDOM;
  let window: Window & typeof globalThis;
  let document: Document;
  let terminalHandler: any;
  let mockTerm: any;
  let mockWebSocket: any;

  beforeEach(() => {
    // Set up DOM environment
    dom = new JSDOM(
      `<!DOCTYPE html>
      <html>
      <head><title>Terminal Test</title></head>
      <body>
          <div id="terminal-container">
              <div id="terminal"></div>
          </div>
          <div id="connection-status">🟢 Connected</div>
      </body>
      </html>`,
      { pretendToBeVisual: true, resources: "usable" }
    );

    window = dom.window as any;
    document = window.document;
    global.window = window;
    global.document = document;

    // Mock xterm.js Terminal
    mockTerm = {
      write: jest.fn(),
      onData: jest.fn(),
      element: document.getElementById('terminal')
    };

    // Mock WebSocket
    mockWebSocket = {
      readyState: 1, // OPEN
      send: jest.fn(),
      sentMessages: [] as string[]
    };

    mockWebSocket.send.mockImplementation((data: string) => {
      mockWebSocket.sentMessages.push(data);
    });

    // Initialize the real terminal handler
    terminalHandler = new TerminalInputHandler(mockTerm, mockWebSocket, 'test-session');
  });

  afterEach(() => {
    dom.window.close();
  });

  describe("AC1.1: Local Command Echo - Real Code Tests", () => {
    it("should echo characters immediately when typed", () => {
      // Type a character - this should call the real handleLocalInput method
      const testChar = 'a';
      terminalHandler.handleInput(testChar);
      
      // Should echo locally immediately
      expect(mockTerm.write).toHaveBeenCalledWith(testChar);
      expect(terminalHandler.getCurrentLine()).toBe(testChar);
      expect(terminalHandler.getCursorPosition()).toBe(1);
    });

    it("should handle cursor movement after typing", () => {
      // Type multiple characters
      'hello'.split('').forEach(char => terminalHandler.handleInput(char));
      
      // Cursor should advance
      expect(terminalHandler.getCursorPosition()).toBe(5);
      expect(terminalHandler.getCurrentLine()).toBe('hello');
    });

    it("should handle backspace correctly", () => {
      // Type some characters first
      'hello'.split('').forEach(char => terminalHandler.handleInput(char));
      
      // Clear previous write calls
      mockTerm.write.mockClear();
      
      // Simulate backspace
      terminalHandler.handleInput('\x08');
      
      // Should remove character locally
      expect(terminalHandler.getCurrentLine()).toBe('hell');
      expect(terminalHandler.getCursorPosition()).toBe(4);
      expect(mockTerm.write).toHaveBeenCalledWith('\x08 \x08');
    });
  });

  describe("AC1.2: Command Line Navigation - Real Code Tests", () => {
    it("should handle left arrow key movement", () => {
      // Type some characters first
      'hello world'.split('').forEach(char => terminalHandler.handleInput(char));
      
      // Clear previous calls
      mockTerm.write.mockClear();
      
      // Simulate left arrow key
      terminalHandler.handleInput('\x1b[D');
      
      // Cursor should move left
      expect(terminalHandler.getCursorPosition()).toBe(10);
      expect(mockTerm.write).toHaveBeenCalledWith('\x1b[D');
    });

    it("should handle Home key correctly", () => {
      // Type some characters first  
      'hello world'.split('').forEach(char => terminalHandler.handleInput(char));
      
      // Clear previous calls
      mockTerm.write.mockClear();
      
      // Simulate Home key
      terminalHandler.handleInput('\x1b[H');
      
      // Cursor should move to beginning
      expect(terminalHandler.getCursorPosition()).toBe(0);
    });

    it("should handle End key correctly", () => {
      // Type some characters first
      'hello world'.split('').forEach(char => terminalHandler.handleInput(char));
      // Move cursor to home first
      terminalHandler.handleInput('\x1b[H');
      
      // Clear previous calls
      mockTerm.write.mockClear();
      
      // Simulate End key
      terminalHandler.handleInput('\x1b[F');
      
      // Cursor should move to end
      expect(terminalHandler.getCursorPosition()).toBe(11);
    });
  });

  describe("AC1.3: Command Submission - Real Code Tests", () => {
    it("should handle Enter key submission correctly", () => {
      // Type a command first
      'ls -la'.split('').forEach(char => terminalHandler.handleInput(char));
      
      // Clear previous calls
      mockTerm.write.mockClear();
      mockWebSocket.send.mockClear();
      
      // Simulate Enter key
      terminalHandler.handleInput('\r');
      
      // Should move to new line, reset state, and send command
      expect(mockTerm.write).toHaveBeenCalledWith('\r\n');
      expect(terminalHandler.getCurrentLine()).toBe('');
      expect(terminalHandler.getCursorPosition()).toBe(0);
      expect(terminalHandler.isLocked()).toBe(true);
    });

    it("should send command via WebSocket on Enter", () => {
      const command = 'echo test';
      // Type command first
      command.split('').forEach(char => terminalHandler.handleInput(char));
      
      // Clear previous calls
      mockWebSocket.send.mockClear();
      
      // Simulate Enter key
      terminalHandler.handleInput('\r');
      
      // Should send terminal_input message
      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWebSocket.sentMessages[mockWebSocket.sentMessages.length - 1]);
      expect(sentData.type).toBe('terminal_input');
      expect(sentData.sessionName).toBe('test-session');
      expect(sentData.data).toBe(command + '\r');
    });
  });

  describe("AC1.4: Terminal Input Locking - Real Code Tests", () => {
    it("should block input when terminal is locked", () => {
      // First submit a command to lock the terminal
      'test'.split('').forEach(char => terminalHandler.handleInput(char));
      terminalHandler.handleInput('\r'); // This should lock terminal
      
      // Clear previous calls
      mockTerm.write.mockClear();
      
      // Try to input characters while locked
      terminalHandler.handleInput('b');
      terminalHandler.handleInput('l');
      terminalHandler.handleInput('o');
      
      // Input should be blocked
      expect(mockTerm.write).not.toHaveBeenCalledWith('b');
      expect(mockTerm.write).not.toHaveBeenCalledWith('l');
      expect(mockTerm.write).not.toHaveBeenCalledWith('o');
      expect(terminalHandler.getCurrentLine()).toBe('');
    });

    it("should show visual indication when locked", () => {
      // First submit a command to lock the terminal
      'test'.split('').forEach(char => terminalHandler.handleInput(char));
      terminalHandler.handleInput('\r'); // This should lock terminal
      
      // Terminal element should have locked class
      const terminalElement = document.getElementById('terminal');
      expect(terminalElement!.classList.contains('terminal-locked')).toBe(true);
    });
  });

  describe("AC1.5: Terminal Input Unlocking - Real Code Tests", () => {
    it("should unlock when user command completes", () => {
      // First submit a command to lock the terminal
      'test'.split('').forEach(char => terminalHandler.handleInput(char));
      terminalHandler.handleInput('\r'); // This should lock terminal
      
      expect(terminalHandler.isLocked()).toBe(true);
      
      // Simulate receiving command completion (not from Claude Code)
      const messageData = {
        type: 'terminal_output' as const,
        data: 'user@host:~$ '
        // Note: no source specified, which means it's NOT from claude_code
      };
      
      terminalHandler.handleTerminalOutput(messageData);
      
      // Terminal should unlock
      expect(terminalHandler.isLocked()).toBe(false);
    });

    it("should remain locked for Claude Code commands", () => {
      // First submit a command to lock the terminal
      'test'.split('').forEach(char => terminalHandler.handleInput(char));
      terminalHandler.handleInput('\r'); // This should lock terminal
      
      expect(terminalHandler.isLocked()).toBe(true);
      
      // Simulate receiving Claude Code command output (should not unlock)
      const messageData = {
        type: 'terminal_output' as const,
        data: 'some output from Claude Code command',
        source: 'claude_code'  // This indicates it's from Claude Code
      };
      
      terminalHandler.handleTerminalOutput(messageData);
      
      // Terminal should remain locked
      expect(terminalHandler.isLocked()).toBe(true);
    });
  });

  describe("Security and Validation - Real Code Tests", () => {
    it("should validate input and prevent XSS", () => {
      // Try to input malicious characters/sequences
      const maliciousInput = '<script>alert("xss")</script>';
      
      maliciousInput.split('').forEach(char => {
        terminalHandler.handleInput(char);
      });
      
      // Should sanitize and validate the input
      const currentLine = terminalHandler.getCurrentLine();
      expect(currentLine).not.toContain('<script>');
      // Should either escape or reject the malicious content
    });

    it("should validate cursor boundaries", () => {
      // Type some text
      'hello'.split('').forEach(char => terminalHandler.handleInput(char));
      
      // Try to move cursor beyond boundaries
      // Multiple left arrows to go beyond start
      for (let i = 0; i < 10; i++) {
        terminalHandler.handleInput('\x1b[D');
      }
      
      // Cursor should not go below 0
      expect(terminalHandler.getCursorPosition()).toBe(0);
      
      // Move to end and try to go beyond
      terminalHandler.handleInput('\x1b[F'); // End key
      for (let i = 0; i < 10; i++) {
        terminalHandler.handleInput('\x1b[C');
      }
      
      // Cursor should not go beyond line length
      expect(terminalHandler.getCursorPosition()).toBe(terminalHandler.getCurrentLine().length);
    });
  });

  describe("Error Handling - Real Code Tests", () => {
    it("should handle WebSocket errors gracefully", () => {
      // Set WebSocket to error state
      mockWebSocket.readyState = 3; // CLOSED
      
      // Try to submit command
      'test'.split('').forEach(char => terminalHandler.handleInput(char));
      
      // Should not throw error when trying to send
      expect(() => terminalHandler.handleInput('\r')).not.toThrow();
      
      // Should show error indication in UI
      const statusElement = document.getElementById('connection-status');
      expect(statusElement!.innerHTML).toContain('Error');
    });
  });
});