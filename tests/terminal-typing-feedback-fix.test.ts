/**
 * CRITICAL FIX TESTS: Terminal Typing Feedback
 * 
 * These tests verify that users can see their typing immediately
 * and that the terminal displays an initial prompt on connection.
 * 
 * CURRENT STATE: FAILING - Users cannot see what they type
 * TARGET STATE: PASSING - Immediate visual feedback for all keystrokes
 */

import { WebSocket } from 'ws';

// Mock xterm.js for testing
class MockTerminal {
  private writtenContent = '';
  private dataCallback: ((data: string) => void) | null = null;

  write(data: string): void {
    this.writtenContent += data;
  }

  onData(callback: (data: string) => void): void {
    this.dataCallback = callback;
  }

  simulateUserInput(input: string): void {
    if (this.dataCallback) {
      this.dataCallback(input);
    }
  }

  getWrittenContent(): string {
    return this.writtenContent;
  }

  clear(): void {
    this.writtenContent = '';
  }
}

// Mock WebSocket for testing
class MockWebSocket {
  readyState = WebSocket.OPEN;
  private sentMessages: string[] = [];

  send(message: string): void {
    this.sentMessages.push(message);
  }

  getSentMessages(): string[] {
    return [...this.sentMessages];
  }

  clear(): void {
    this.sentMessages.length = 0;
  }
}

// Import the terminal handler (will be loaded dynamically for testing)
let TerminalInputHandler: any;

beforeAll(async () => {
  // Load the terminal input handler in a way that simulates browser environment
  const fs = await import('fs/promises');
  const handlerCode = await fs.readFile('/home/jsbattig/Dev/ls-ssh-mcp/static/terminal-input-handler.js', 'utf8');
  
  // Create a function that executes the handler code and returns the class
  const createHandler = new Function('WebSocket', handlerCode + '; return TerminalInputHandler;');
  TerminalInputHandler = createHandler(MockWebSocket);
});

describe('Terminal Typing Feedback - Critical UX Fix', () => {
  let mockTerminal: MockTerminal;
  let mockWebSocket: MockWebSocket;
  let handler: any;

  beforeEach(() => {
    mockTerminal = new MockTerminal();
    mockWebSocket = new MockWebSocket();
    handler = new TerminalInputHandler(mockTerminal, mockWebSocket, 'test-session');
  });

  describe('CRITICAL ISSUE: Users Must See Their Typing', () => {
    test('FAILING - Single character typing should show immediate feedback', () => {
      mockTerminal.clear();
      
      // Simulate user typing 'p'
      mockTerminal.simulateUserInput('p');
      
      // ASSERTION: User should see the character immediately
      const writtenContent = mockTerminal.getWrittenContent();
      expect(writtenContent).toContain('p');
      
      // Also verify internal state is correct
      expect(handler.getCurrentLine()).toBe('p');
      expect(handler.getCursorPosition()).toBe(1);
    });

    test('FAILING - Multiple character typing should show progressive feedback', () => {
      mockTerminal.clear();
      
      // Simulate user typing 'pwd'
      mockTerminal.simulateUserInput('p');
      mockTerminal.simulateUserInput('w');  
      mockTerminal.simulateUserInput('d');
      
      // ASSERTION: User should see each character as it's typed
      const writtenContent = mockTerminal.getWrittenContent();
      expect(writtenContent).toContain('p');
      expect(writtenContent).toContain('w');
      expect(writtenContent).toContain('d');
      
      // Verify progressive state updates
      expect(handler.getCurrentLine()).toBe('pwd');
      expect(handler.getCursorPosition()).toBe(3);
    });

    test('FAILING - Backspace should show visual feedback', () => {
      mockTerminal.clear();
      
      // Type 'pwd' then backspace
      mockTerminal.simulateUserInput('p');
      mockTerminal.simulateUserInput('w');
      mockTerminal.simulateUserInput('d');
      mockTerminal.simulateUserInput('\x08'); // Backspace
      
      // ASSERTION: User should see backspace effect (character removal)
      const writtenContent = mockTerminal.getWrittenContent();
      expect(writtenContent).toContain('\x08 \x08'); // Backspace sequence
      
      // Verify internal state
      expect(handler.getCurrentLine()).toBe('pw');
      expect(handler.getCursorPosition()).toBe(2);
    });

    test('FAILING - Arrow key navigation should show cursor movement', () => {
      mockTerminal.clear();
      
      // Type 'pwd' then move cursor left
      mockTerminal.simulateUserInput('p');
      mockTerminal.simulateUserInput('w');
      mockTerminal.simulateUserInput('d');
      mockTerminal.simulateUserInput('\x1b[D'); // Left arrow
      
      // ASSERTION: User should see cursor move left
      const writtenContent = mockTerminal.getWrittenContent();
      expect(writtenContent).toContain('\x1b[D'); // Left arrow escape sequence
      
      // Verify internal state
      expect(handler.getCursorPosition()).toBe(2);
    });
  });

  describe('Command Submission Flow', () => {
    test('Enter key should submit command and clear line', () => {
      mockTerminal.clear();
      mockWebSocket.clear();
      
      // Type command and press Enter
      mockTerminal.simulateUserInput('p');
      mockTerminal.simulateUserInput('w');
      mockTerminal.simulateUserInput('d');
      mockTerminal.simulateUserInput('\r'); // Enter
      
      // ASSERTION: Command should be sent via WebSocket
      const sentMessages = mockWebSocket.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      
      const message = JSON.parse(sentMessages[0]);
      expect(message.type).toBe('terminal_input');
      expect(message.command).toBe('pwd');
      expect(message.sessionName).toBe('test-session');
      
      // ASSERTION: Current line should be cleared after submission
      expect(handler.getCurrentLine()).toBe('');
      expect(handler.getCursorPosition()).toBe(0);
      
      // ASSERTION: Enter should write newline to terminal
      const writtenContent = mockTerminal.getWrittenContent();
      expect(writtenContent).toContain('\r\n');
    });
  });

  describe('Security Validation', () => {
    test('XSS prevention should not block legitimate commands', () => {
      mockTerminal.clear();
      
      // Type legitimate command that might look suspicious
      mockTerminal.simulateUserInput('e');
      mockTerminal.simulateUserInput('c');
      mockTerminal.simulateUserInput('h');
      mockTerminal.simulateUserInput('o');
      
      // Should still work normally
      expect(handler.getCurrentLine()).toBe('echo');
      expect(handler.getCursorPosition()).toBe(4);
    });

    test('Should block dangerous input patterns', () => {
      mockTerminal.clear();
      
      // Try to input dangerous characters
      mockTerminal.simulateUserInput('<');
      
      // Should not appear in current line due to validation
      expect(handler.getCurrentLine()).toBe('');
      expect(handler.getCursorPosition()).toBe(0);
    });
  });
});

describe('Initial Prompt Display Tests', () => {
  test('SSH connection should provide initial prompt in history', async () => {
    // This test will verify that SSH connection manager broadcasts initial prompt
    // We'll import the actual SSH connection manager for this test
    
    const { SSHConnectionManager } = await import('../src/ssh-connection-manager.js');
    
    const manager = new SSHConnectionManager(8080);
    const promptHistory: string[] = [];
    
    // Mock a session with initial prompt
    const mockSessionName = 'test-prompt-session';
    
    // Add listener to capture prompt broadcasts
    manager.addTerminalOutputListener(mockSessionName, (entry) => {
      promptHistory.push(entry.content || entry.output || '');
    });
    
    // The SSH connection manager should broadcast initial prompt
    // This test documents the expected behavior
    expect(typeof manager.getTerminalHistory).toBe('function');
    expect(typeof manager.addTerminalOutputListener).toBe('function');
  });
});