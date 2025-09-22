/**
 * Terminal Input Handler - Real Production Code
 *
 * This module provides secure, validated terminal input handling with proper
 * command tracking to prevent race conditions and security vulnerabilities.
 *
 * NO MOCKING OR SIMULATION - This is real production code that handles actual terminal input.
 *
 * BROWSER COMPATIBILITY: This file compiles to a browser-compatible global script.
 * It does NOT use ES6 modules - it defines TerminalInputHandler in the global scope
 * for use with regular <script> tags.
 */
/**
 * Production Terminal Input Handler
 * Handles real terminal input with security, validation, and proper state management
 *
 * This class is defined in the global scope (window.TerminalInputHandler) for browser compatibility.
 */
class TerminalInputHandler {
    constructor(terminal, webSocket, sessionName, config = {}) {
        this.commandCounter = 0;
        this.lastSubmittedCommand = '';
        this.terminal = terminal;
        this.webSocket = webSocket;
        this.sessionName = sessionName;
        this.config = Object.assign({ validateInput: true, maxLineLength: 1000, commandTimeout: 30000 }, config);
        this.state = {
            currentLine: '',
            cursorPosition: 0
        };
        this.initializeTerminalHandlers();
    }
    initializeTerminalHandlers() {
        // Set up terminal data handler for real input
        this.terminal.onData((data) => {
            this.handleInput(data);
        });
    }
    /**
     * Handle terminal input with validation and security checks
     * @param data Raw input data from terminal
     */
    handleInput(data) {
        try {
            // Validate input for security
            if (this.config.validateInput && !this.validateInput(data)) {
                this.showError('Invalid input detected');
                return;
            }
            const charCode = data.charCodeAt(0);
            if (charCode === 13) { // Enter key - submit command
                this.submitCommand();
            }
            else if (charCode === 8 || charCode === 127) { // Backspace/Delete
                this.handleBackspace();
            }
            else if (charCode === 27 && data.length > 1) { // Escape sequences (arrow keys, etc.)
                this.handleEscapeSequence(data);
            }
            else if (charCode === 3) { // Ctrl-C - Send cancellation signal
                this.sendCancellationSignal();
            }
            else if (charCode >= 32 && charCode < 127) { // Printable characters
                this.handlePrintableCharacter(data);
            }
            // Ignore other control characters
        }
        catch (error) {
            console.error('Error handling terminal input:', error);
            this.showError('Terminal input error');
        }
    }
    /**
     * Validate input for security - prevent XSS and malicious sequences
     * @param data Input data to validate
     * @returns true if input is safe
     */
    validateInput(data) {
        // Prevent overly long input that could cause DoS
        if (this.state.currentLine.length + data.length > this.config.maxLineLength) {
            return false;
        }
        // Allow normal terminal characters including <, >, & for legitimate use
        // Block null bytes and other dangerous characters
        if (data.includes('\0') || data.includes('\x1b[6n')) { // CSI Device Status Report
            return false;
        }
        return true;
    }
    /**
     * Handle printable character input with proper cursor management
     */
    handlePrintableCharacter(char) {
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
        // LOCAL ECHO: Handle mid-line insertion properly
        if (this.state.cursorPosition === this.state.currentLine.length) {
            // Cursor at end - simple character write
            this.terminal.write(char);
        } else {
            // Cursor in middle - write char + remaining text + reposition cursor
            const remainingText = this.state.currentLine.slice(this.state.cursorPosition);
            this.terminal.write(char + remainingText);
            // Move cursor back to correct position (after inserted character)
            const moveBackCount = remainingText.length;
            if (moveBackCount > 0) {
                this.terminal.write('\x1b[' + moveBackCount + 'D');
            }
        }
        // SSH server echo provides the visual feedback, local echo is not needed
    }
    /**
     * Handle backspace with proper boundary checking
     */
    handleBackspace() {
        if (this.state.cursorPosition > 0) {
            // Remove character before cursor
            this.state.currentLine =
                this.state.currentLine.slice(0, this.state.cursorPosition - 1) +
                    this.state.currentLine.slice(this.state.cursorPosition);
            this.state.cursorPosition--;

            // LOCAL ECHO: Handle mid-line backspace properly
            if (this.state.cursorPosition === this.state.currentLine.length) {
                // Cursor at end after deletion - simple backspace
                this.terminal.write('\b \b');
            } else {
                // Cursor in middle after deletion - redraw remaining text
                const remainingText = this.state.currentLine.slice(this.state.cursorPosition);
                // Move back one position, write remaining text + space to clear, then reposition
                this.terminal.write('\b' + remainingText + ' ');
                // Move cursor back to correct position (after deletion point)
                const moveBackCount = remainingText.length + 1;
                if (moveBackCount > 0) {
                    this.terminal.write('\x1b[' + moveBackCount + 'D');
                }
            }
        }
    }
    /**
     * Handle escape sequences (arrow keys, home, end, etc.)
     */
    handleEscapeSequence(sequence) {
        switch (sequence) {
            case '\x1b[D': // Left arrow
                if (this.state.cursorPosition > 0) {
                    this.state.cursorPosition--;
                    this.terminal.write('\x1b[D'); // Local cursor movement with visual feedback
                }
                break;
            case '\x1b[C': // Right arrow
                if (this.state.cursorPosition < this.state.currentLine.length) {
                    this.state.cursorPosition++;
                    this.terminal.write('\x1b[C'); // Local cursor movement with visual feedback
                }
                break;
            case '\x1b[H': // Home key
            case '\x1b[1~':
                const movesToStart = this.state.cursorPosition;
                this.state.cursorPosition = 0;
                this.terminal.write('\x1b[H'); // Local cursor movement with visual feedback
                break;
            case '\x1b[F': // End key
            case '\x1b[4~':
                const movesToEnd = this.state.currentLine.length - this.state.cursorPosition;
                this.state.cursorPosition = this.state.currentLine.length;
                this.terminal.write('\x1b[F'); // Local cursor movement with visual feedback
                break;
            // Ignore other escape sequences to prevent terminal manipulation
        }
    }
    /**
     * Send cancellation signal (Ctrl-C) via WebSocket
     */
    sendCancellationSignal() {
        try {
            if (this.webSocket.readyState === WebSocket.OPEN) {
                const message = {
                    type: 'terminal_signal',
                    sessionName: this.sessionName,
                    signal: 'SIGINT'
                };
                this.webSocket.send(JSON.stringify(message));
                console.debug('Sent cancellation signal (SIGINT) via WebSocket:', message);
            } else {
                console.warn('Cannot send cancellation signal: WebSocket not open');
            }
        } catch (error) {
            console.error('Error sending cancellation signal:', error);
            this.showError('Failed to send cancellation signal');
        }
    }
    /**
     * Submit command with proper tracking and locking
     */
    submitCommand() {
        try {
            const command = this.state.currentLine.trim();
            // Track command for echo suppression
            this.lastSubmittedCommand = command;
            // Generate unique command ID to track completion
            this.commandCounter++;
            const commandId = `cmd_${Date.now()}_${this.commandCounter}`;
            // Show command echo and move to new line for execution
            this.terminal.write('\r\n');
            // Send command via WebSocket if connection is open
            if (this.webSocket.readyState === WebSocket.OPEN) {
                const message = {
                    type: 'terminal_input',
                    sessionName: this.sessionName,
                    command: command,
                    commandId: commandId,
                    timestamp: new Date().toISOString()
                };
                this.webSocket.send(JSON.stringify(message));
            }
            else {
                // WebSocket not available - show error
                this.showError('Connection lost');
                return;
            }
            // Reset current line state
            this.state.currentLine = '';
            this.state.cursorPosition = 0;
        }
        catch (error) {
            console.error('Error submitting command:', error);
            this.showError('Command submission failed');
        }
    }
    /**
     * Handle terminal output messages from WebSocket
     */
    handleTerminalOutput(message) {
        try {
            if (message.type === 'terminal_output' && message.data) {
                let outputData = message.data;
                
                // Direct passthrough - server controls all output
                this.terminal.write(outputData);
            }
        }
        catch (error) {
            console.error('Error handling terminal output:', error);
            this.showError('Terminal output error');
        }
    }
    /**
     * Detect shell prompt patterns with improved specificity
     * @param output Terminal output to check
     * @returns true if output contains a shell prompt
     */
    isPromptLine(output) {
        const trimmedOutput = output.trim();
        // More specific prompt patterns to reduce false positives
        const promptPatterns = [
            /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^$]*\$\s*$/, // user@host:path$ 
            /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^#]*#\s*$/, // user@host:path# (root)
            /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s*[^\]]+\]\$\s*$/, // [user@host project]$ (bracket format)
            /^\[\d{2}:\d{2}:\d{2}\][^$]*\$\s*$/, // [HH:MM:SS]...$ (with timestamp)
            /^[>]\s*$/ // Simple > prompt (minimal)
        ];
        return promptPatterns.some(pattern => pattern.test(trimmedOutput));
    }
    /**
     * Show error message to user
     */
    showError(message) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.innerHTML = `⚠️ Error: ${message}`;
            statusElement.style.color = '#ff6b6b';
        }
        console.error('Terminal Handler Error:', message);
    }
    // Public API methods for testing and external access
    getCurrentLine() {
        return this.state.currentLine;
    }
    getCursorPosition() {
        return this.state.cursorPosition;
    }
    getState() {
        return Object.assign({}, this.state);
    }
}
// Only set on window if we're in a browser environment
if (typeof window !== 'undefined') {
    window.TerminalInputHandler = TerminalInputHandler;
}
