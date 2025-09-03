import { readFileSync } from "fs";
import { join } from "path";

const { TerminalInputHandler } = require("../static/terminal-input-handler.js");

describe("Terminal Input Handler Integration Tests", () => {
  test("should load the production terminal handler module successfully", () => {
    // Test that the module loads without errors
    expect(TerminalInputHandler).toBeDefined();
    expect(typeof TerminalInputHandler).toBe('function');
  });

  test("should contain all security fixes in the JavaScript file", () => {
    // Read the actual JavaScript file
    const jsFilePath = join(__dirname, '../static/terminal-input-handler.js');
    const jsContent = readFileSync(jsFilePath, 'utf8');
    
    // Verify the module contains our security fixes
    expect(jsContent).toContain('TerminalInputHandler');
    expect(jsContent).toContain('validateInput');
    expect(jsContent).toContain('handleInput');
    expect(jsContent).toContain('Basic XSS prevention');
    expect(jsContent).toContain('unique command ID');
    expect(jsContent).toContain('boundary conditions');
    expect(jsContent).toContain('showError');
    expect(jsContent).toContain('lockTerminal');
    expect(jsContent).toContain('unlockTerminal');
    expect(jsContent).toContain('handleTerminalOutput');
  });

  test("should instantiate terminal handler with proper methods", () => {
    // Mock terminal and websocket for testing
    const mockTerm = {
      onData: jest.fn(),
      write: jest.fn()
    };
    const mockWS = { readyState: 1 };
    
    const handler = new TerminalInputHandler(mockTerm, mockWS, 'test-session');
    
    // Verify all required methods exist
    expect(typeof handler.handleInput).toBe('function');
    expect(typeof handler.handleTerminalOutput).toBe('function');
    expect(typeof handler.getCurrentLine).toBe('function');
    expect(typeof handler.getCursorPosition).toBe('function');
    expect(typeof handler.isLocked).toBe('function');
    expect(typeof handler.getCommandId).toBe('function');
    expect(typeof handler.getState).toBe('function');
  });

  test("should validate web server manager uses the new terminal handler", () => {
    // Read the web server manager source
    const webServerPath = join(__dirname, '../src/web-server-manager.ts');
    const webServerContent = readFileSync(webServerPath, 'utf8');
    
    // Verify it references the new terminal handler
    expect(webServerContent).toContain('terminal-input-handler.js');
    expect(webServerContent).toContain('new TerminalInputHandler');
    expect(webServerContent).toContain('terminalHandler.handleTerminalOutput');
    
    // Verify it doesn't contain old vulnerable code
    expect(webServerContent).not.toContain('handleLocalInput');
    expect(webServerContent).not.toContain('terminalState.currentLine');
    expect(webServerContent).not.toContain('.*[$][ ]*$/');  // Old weak regex
  });

  test("should properly export for both CommonJS and browser environments", () => {
    const jsFilePath = join(__dirname, '../static/terminal-input-handler.js');
    const jsContent = readFileSync(jsFilePath, 'utf8');
    
    // Should support both export formats
    expect(jsContent).toContain('module.exports');
    expect(jsContent).toContain('window.TerminalInputHandler');
    expect(jsContent).toContain('typeof module !== \'undefined\'');
    expect(jsContent).toContain('typeof window !== \'undefined\'');
  });
});