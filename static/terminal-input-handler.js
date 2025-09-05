// Simple terminal input handler
class TerminalInputHandler {
    constructor(terminal, webSocket, sessionName) {
        this.terminal = terminal;
        this.webSocket = webSocket;
        this.sessionName = sessionName;
        this.currentLine = '';
        this.isLocked = false;
        this.commandCounter = 0;
        
        this.terminal.onData((data) => {
            this.handleInput(data);
        });
    }
    
    handleInput(data) {
        if (this.isLocked) return;
        
        const charCode = data.charCodeAt(0);
        
        if (charCode === 13) { // Enter
            this.submitCommand();
        } else if (charCode === 8 || charCode === 127) { // Backspace
            if (this.currentLine.length > 0) {
                this.currentLine = this.currentLine.slice(0, -1);
                this.terminal.write('\b \b');
            }
        } else if (charCode >= 32 && charCode < 127) { // Printable
            this.currentLine += data;
            this.terminal.write(data);
        }
    }
    
    submitCommand() {
        const command = this.currentLine.trim();
        
        // Generate unique command ID to track completion
        this.commandCounter++;
        const commandId = 'cmd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        this.terminal.write('\r\n');
        this.currentLine = '';
        this.isLocked = true;
        
        if (this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.send(JSON.stringify({
                type: 'terminal_input',
                sessionName: this.sessionName,
                command: command,
                commandId: commandId,
                timestamp: new Date().toISOString()
            }));
        }
    }
    
    handleTerminalOutput(message) {
        if (message.type === 'terminal_output' && message.data) {
            this.terminal.write(message.data);
            
            // Unlock on prompt detection
            if (this.isPromptLine(message.data)) {
                this.isLocked = false;
            }
        }
    }
    
    isPromptLine(output) {
        const trimmed = output.trim();
        
        // Support both old format (user@host:path$) and new bracket format ([user@host project]$)
        const oldFormatPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^$]*\$\s*$/;
        const oldFormatHashPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^#]*#\s*$/;
        const bracketFormatPattern = /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s+[^\]]+\]\$\s*$/;
        const bracketFormatHashPattern = /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s+[^\]]+\]#\s*$/;
        
        return oldFormatPattern.test(trimmed) || 
               oldFormatHashPattern.test(trimmed) ||
               bracketFormatPattern.test(trimmed) ||
               bracketFormatHashPattern.test(trimmed);
    }
}
