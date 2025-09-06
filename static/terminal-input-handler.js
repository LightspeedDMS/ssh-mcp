/**
 * Terminal Input Handler - Real Production Code
 *
 * This module provides secure, validated terminal input handling with proper
 * command tracking to prevent race conditions and security vulnerabilities.
 *
 * NO MOCKING OR SIMULATION - This is real production code that handles actual terminal input.
 */
/**
 * Production Terminal Input Handler
 * Handles real terminal input with security, validation, and proper state management
 */
class TerminalInputHandler {
    constructor(terminal, webSocket, sessionName, config = {}) {
        this.commandCounter = 0;
        this.terminal = terminal;
        this.webSocket = webSocket;
        this.sessionName = sessionName;
        this.config = Object.assign({ validateInput: true, maxLineLength: 1000 }, config);
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
     * CRITICAL FIX: No local echo - SSH server handles all terminal output
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
        // DOUBLE ECHO FIX: Remove local character echo - SSH server provides all terminal output
        // this.terminal.write(char); // REMOVED: This was causing double command echo
    }
    /**
     * Handle backspace with proper boundary checking
     * CRITICAL FIX: No local echo - SSH server handles all terminal output
     */
    handleBackspace() {
        if (this.state.cursorPosition > 0) {
            // Remove character before cursor
            this.state.currentLine =
                this.state.currentLine.slice(0, this.state.cursorPosition - 1) +
                    this.state.currentLine.slice(this.state.cursorPosition);
            this.state.cursorPosition--;
            // DOUBLE ECHO FIX: Remove local backspace echo - SSH server handles all terminal feedback  
            // this.terminal.write('\x08 \x08'); // REMOVED: This was causing double backspace feedback
        }
    }
    /**
     * Handle escape sequences (arrow keys, home, end, etc.)
     * CRITICAL FIX: No local echo - SSH server handles all terminal output
     */
    handleEscapeSequence(sequence) {
        switch (sequence) {
            case '\x1b[D': // Left arrow
                if (this.state.cursorPosition > 0) {
                    this.state.cursorPosition--;
                    // DOUBLE ECHO FIX: Remove local cursor movement echo
                    // this.terminal.write('\x1b[D'); // REMOVED: SSH server handles cursor movement
                }
                break;
            case '\x1b[C': // Right arrow
                if (this.state.cursorPosition < this.state.currentLine.length) {
                    this.state.cursorPosition++;
                    // DOUBLE ECHO FIX: Remove local cursor movement echo
                    // this.terminal.write('\x1b[C'); // REMOVED: SSH server handles cursor movement
                }
                break;
            case '\x1b[H': // Home key
            case '\x1b[1~':
                const movesToStart = this.state.cursorPosition;
                this.state.cursorPosition = 0;
                // DOUBLE ECHO FIX: Remove local cursor movement echo
                // if (movesToStart > 0) {
                //     this.terminal.write('\x1b[' + movesToStart + 'D');
                // }
                break;
            case '\x1b[F': // End key
            case '\x1b[4~':
                const movesToEnd = this.state.currentLine.length - this.state.cursorPosition;
                this.state.cursorPosition = this.state.currentLine.length;
                // DOUBLE ECHO FIX: Remove local cursor movement echo
                // if (movesToEnd > 0) {
                //     this.terminal.write('\x1b[' + movesToEnd + 'C');
                // }
                break;
            // Ignore other escape sequences to prevent terminal manipulation
        }
    }
    /**
     * Submit command with natural flow - no artificial locking
     */
    submitCommand() {
        try {
            const command = this.state.currentLine.trim();
            // Generate unique command ID for tracking
            this.commandCounter++;
            const commandId = `cmd_${Date.now()}_${this.commandCounter}`;
            // Move to new line
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
     * Natural flow - no artificial locking or unlocking
     */
    handleTerminalOutput(message) {
        try {
            if (message.type === 'terminal_output' && message.data) {
                // Write output to terminal - natural terminal behavior
                this.terminal.write(message.data);
            }
        }
        catch (error) {
            console.error('Error handling terminal output:', error);
            this.showError('Terminal output error');
        }
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
