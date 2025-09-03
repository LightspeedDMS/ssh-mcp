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
    source?: string;
    commandId?: string;
    timestamp?: string;
}
/**
 * Production Terminal Input Handler
 * Handles real terminal input with security, validation, and proper state management
 */
export declare class TerminalInputHandler {
    private terminal;
    private webSocket;
    private sessionName;
    private config;
    private state;
    private commandCounter;
    constructor(terminal: any, webSocket: WebSocket, sessionName: string, config?: TerminalInputHandlerConfig);
    private initializeTerminalHandlers;
    /**
     * Handle terminal input with validation and security checks
     * @param data Raw input data from terminal
     */
    handleInput(data: string): void;
    /**
     * Validate input for security - prevent XSS and malicious sequences
     * @param data Input data to validate
     * @returns true if input is safe
     */
    private validateInput;
    /**
     * Handle printable character input with proper cursor management
     */
    private handlePrintableCharacter;
    /**
     * Handle backspace with proper boundary checking
     */
    private handleBackspace;
    /**
     * Handle escape sequences (arrow keys, home, end, etc.)
     */
    private handleEscapeSequence;
    /**
     * Submit command with proper tracking and locking
     */
    private submitCommand;
    /**
     * Lock terminal during command execution
     */
    private lockTerminal;
    /**
     * Unlock terminal after command completion
     */
    private unlockTerminal;
    /**
     * Handle terminal output messages from WebSocket
     * This determines when to unlock the terminal based on prompt detection
     */
    handleTerminalOutput(message: TerminalMessage): void;
    /**
     * Detect shell prompt patterns with improved specificity
     * @param output Terminal output to check
     * @returns true if output contains a shell prompt
     */
    private isPromptLine;
    /**
     * Show error message to user
     */
    private showError;
    getCurrentLine(): string;
    getCursorPosition(): number;
    isLocked(): boolean;
    getCommandId(): string | null;
    getState(): Readonly<TerminalState>;
}
