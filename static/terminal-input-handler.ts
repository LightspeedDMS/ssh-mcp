/**
 * Terminal Input Handler - Real Production Code
 * 
 * This module provides secure, validated terminal input handling with proper
 * command tracking to prevent race conditions and security vulnerabilities.
 * 
 * NO MOCKING OR SIMULATION - This is real production code that handles actual terminal input.
 */

export interface TerminalInputHandlerConfig {
  validateInput?: boolean;
  maxLineLength?: number;
  commandTimeout?: number;
}

export interface TerminalState {
  currentLine: string;
  cursorPosition: number;
  isLocked: boolean;
  commandId: string | null;
}

export interface TerminalMessage {
  type: 'terminal_output' | 'terminal_input' | 'error';
  sessionName?: string;
  data?: string;
  command?: string;
  source?: string;
  commandId?: string;
  timestamp?: string;
}

/**
 * Production Terminal Input Handler
 * Handles real terminal input with security, validation, and proper state management
 */
export class TerminalInputHandler {
  private terminal: any; // xterm.js Terminal instance
  private webSocket: WebSocket;
  private sessionName: string;
  private config: TerminalInputHandlerConfig;
  private state: TerminalState;
  private commandCounter: number = 0;

  constructor(
    terminal: any, 
    webSocket: WebSocket, 
    sessionName: string, 
    config: TerminalInputHandlerConfig = {}
  ) {
    this.terminal = terminal;
    this.webSocket = webSocket;
    this.sessionName = sessionName;
    this.config = {
      validateInput: true,
      maxLineLength: 1000,
      commandTimeout: 30000,
      ...config
    };
    
    this.state = {
      currentLine: '',
      cursorPosition: 0,
      isLocked: false,
      commandId: null
    };

    this.initializeTerminalHandlers();
  }

  private initializeTerminalHandlers(): void {
    // Set up terminal data handler for real input
    this.terminal.onData((data: string) => {
      this.handleInput(data);
    });
  }

  /**
   * Handle terminal input with validation and security checks
   * @param data Raw input data from terminal
   */
  public handleInput(data: string): void {
    try {
      // Block input if terminal is locked during command execution
      if (this.state.isLocked) {
        return;
      }

      // Validate input for security
      if (this.config.validateInput && !this.validateInput(data)) {
        this.showError('Invalid input detected');
        return;
      }

      const charCode = data.charCodeAt(0);
      
      if (charCode === 13) { // Enter key - submit command
        this.submitCommand();
      } else if (charCode === 8 || charCode === 127) { // Backspace/Delete
        this.handleBackspace();
      } else if (charCode === 27 && data.length > 1) { // Escape sequences (arrow keys, etc.)
        this.handleEscapeSequence(data);
      } else if (charCode >= 32 && charCode < 127) { // Printable characters
        this.handlePrintableCharacter(data);
      }
      // Ignore other control characters

    } catch (error) {
      console.error('Error handling terminal input:', error);
      this.showError('Terminal input error');
    }
  }

  /**
   * Validate input for security - prevent XSS and malicious sequences
   * @param data Input data to validate
   * @returns true if input is safe
   */
  private validateInput(data: string): boolean {
    // Prevent overly long input that could cause DoS
    if (this.state.currentLine.length + data.length > this.config.maxLineLength!) {
      return false;
    }

    // Basic XSS prevention - block HTML-like content in terminal input
    if (data.includes('<') || data.includes('>') || data.includes('&')) {
      return false;
    }

    // Block null bytes and other dangerous characters
    if (data.includes('\0') || data.includes('\x1b[6n')) { // CSI Device Status Report
      return false;
    }

    return true;
  }

  /**
   * Handle printable character input with proper cursor management
   */
  private handlePrintableCharacter(char: string): void {
    // Check boundary conditions
    if (this.state.cursorPosition < 0) {
      this.state.cursorPosition = 0;
    }
    if (this.state.cursorPosition > this.state.currentLine.length) {
      this.state.cursorPosition = this.state.currentLine.length;
    }

    // Insert character at cursor position
    this.state.currentLine = 
      this.state.currentLine.slice(0, this.state.cursorPosition) + 
      char + 
      this.state.currentLine.slice(this.state.cursorPosition);
    
    this.state.cursorPosition++;
    
    // Echo character to terminal
    this.terminal.write(char);
  }

  /**
   * Handle backspace with proper boundary checking
   */
  private handleBackspace(): void {
    if (this.state.cursorPosition > 0) {
      // Remove character before cursor
      this.state.currentLine = 
        this.state.currentLine.slice(0, this.state.cursorPosition - 1) + 
        this.state.currentLine.slice(this.state.cursorPosition);
      
      this.state.cursorPosition--;
      
      // Send backspace sequence to terminal: backspace, space, backspace
      this.terminal.write('\x08 \x08');
    }
  }

  /**
   * Handle escape sequences (arrow keys, home, end, etc.)
   */
  private handleEscapeSequence(sequence: string): void {
    switch (sequence) {
      case '\x1b[D': // Left arrow
        if (this.state.cursorPosition > 0) {
          this.state.cursorPosition--;
          this.terminal.write('\x1b[D');
        }
        break;
        
      case '\x1b[C': // Right arrow
        if (this.state.cursorPosition < this.state.currentLine.length) {
          this.state.cursorPosition++;
          this.terminal.write('\x1b[C');
        }
        break;
        
      case '\x1b[H': // Home key
      case '\x1b[1~':
        const movesToStart = this.state.cursorPosition;
        this.state.cursorPosition = 0;
        if (movesToStart > 0) {
          this.terminal.write('\x1b[' + movesToStart + 'D');
        }
        break;
        
      case '\x1b[F': // End key
      case '\x1b[4~':
        const movesToEnd = this.state.currentLine.length - this.state.cursorPosition;
        this.state.cursorPosition = this.state.currentLine.length;
        if (movesToEnd > 0) {
          this.terminal.write('\x1b[' + movesToEnd + 'C');
        }
        break;
        
      // Ignore other escape sequences to prevent terminal manipulation
    }
  }

  /**
   * Submit command with proper tracking and locking
   */
  private submitCommand(): void {
    try {
      const command = this.state.currentLine.trim();
      
      // Generate unique command ID to track completion
      this.commandCounter++;
      const commandId = `cmd_${Date.now()}_${this.commandCounter}`;
      
      // Move to new line
      this.terminal.write('\r\n');
      
      // Lock terminal during command execution
      this.lockTerminal(commandId);
      
      // Send command via WebSocket if connection is open
      if (this.webSocket.readyState === WebSocket.OPEN) {
        const message: TerminalMessage = {
          type: 'terminal_input',
          sessionName: this.sessionName,
          command: command,
          commandId: commandId,
          timestamp: new Date().toISOString()
        };
        
        this.webSocket.send(JSON.stringify(message));
      } else {
        // WebSocket not available - show error and unlock
        this.showError('Connection lost');
        this.unlockTerminal();
        return;
      }
      
      // Reset current line state
      this.state.currentLine = '';
      this.state.cursorPosition = 0;
      
      // Set timeout to unlock terminal if command doesn't complete
      if (this.config.commandTimeout) {
        setTimeout(() => {
          if (this.state.isLocked && this.state.commandId === commandId) {
            this.showError('Command timeout');
            this.unlockTerminal();
          }
        }, this.config.commandTimeout);
      }
      
    } catch (error) {
      console.error('Error submitting command:', error);
      this.showError('Command submission failed');
      this.unlockTerminal();
    }
  }

  /**
   * Lock terminal during command execution
   */
  private lockTerminal(commandId: string): void {
    this.state.isLocked = true;
    this.state.commandId = commandId;
    
    const terminalElement = document.getElementById('terminal');
    if (terminalElement) {
      terminalElement.classList.add('terminal-locked');
    }
  }

  /**
   * Unlock terminal after command completion
   */
  private unlockTerminal(): void {
    this.state.isLocked = false;
    this.state.commandId = null;
    
    const terminalElement = document.getElementById('terminal');
    if (terminalElement) {
      terminalElement.classList.remove('terminal-locked');
    }
  }

  /**
   * Handle terminal output messages from WebSocket
   * This determines when to unlock the terminal based on prompt detection
   */
  public handleTerminalOutput(message: TerminalMessage): void {
    try {
      if (message.type === 'terminal_output' && message.data) {
        // Write output to terminal
        this.terminal.write(message.data);
        
        // Check if this output indicates command completion
        // Only unlock for user commands, not Claude Code commands
        if (message.source !== 'claude_code' && this.isPromptLine(message.data)) {
          this.unlockTerminal();
        }
      }
    } catch (error) {
      console.error('Error handling terminal output:', error);
      this.showError('Terminal output error');
    }
  }

  /**
   * Detect shell prompt patterns with improved specificity
   * @param output Terminal output to check
   * @returns true if output contains a shell prompt
   */
  private isPromptLine(output: string): boolean {
    const trimmedOutput = output.trim();
    
    // More specific prompt patterns to reduce false positives
    const promptPatterns = [
      /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^$]*\$\s*$/, // user@host:path$ 
      /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^#]*#\s*$/, // user@host:path# (root)
      /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s+[^\]]+\]\$\s*$/, // [user@host project]$ (bracket format)
      /^\[\d{2}:\d{2}:\d{2}\][^$]*\$\s*$/,                // [HH:MM:SS]...$ (with timestamp)
      /^[>]\s*$/                                           // Simple > prompt (minimal)
    ];
    
    return promptPatterns.some(pattern => pattern.test(trimmedOutput));
  }

  /**
   * Show error message to user
   */
  private showError(message: string): void {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.innerHTML = `⚠️ Error: ${message}`;
      statusElement.style.color = '#ff6b6b';
    }
    
    console.error('Terminal Handler Error:', message);
  }

  // Public API methods for testing and external access

  public getCurrentLine(): string {
    return this.state.currentLine;
  }

  public getCursorPosition(): number {
    return this.state.cursorPosition;
  }

  public isLocked(): boolean {
    return this.state.isLocked;
  }

  public getCommandId(): string | null {
    return this.state.commandId;
  }

  public getState(): Readonly<TerminalState> {
    return { ...this.state };
  }
}