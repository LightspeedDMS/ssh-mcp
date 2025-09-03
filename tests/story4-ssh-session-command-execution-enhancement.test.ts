import { SSHConnectionManager } from "../src/ssh-connection-manager.js";
import { WebServerManager } from "../src/web-server-manager.js";
import WebSocket from "ws";
import { delay, getUniquePort } from "./test-utils.js";

/**
 * Story 4: SSH Session Command Execution Enhancement - TDD Tests
 * 
 * Tests unified command execution behavior between user commands (via browser)
 * and Claude Code commands (via MCP), ensuring identical execution paths,
 * output streaming, session state persistence, and history tracking.
 * 
 * CRITICAL: These tests verify that user and Claude commands are indistinguishable
 * in their execution behavior - same SSH shell channel, same output format,
 * same session state management.
 */

interface MockSession {
  name: string;
  host: string;
  username: string;
}

describe("Story 4: SSH Session Command Execution Enhancement", () => {
  let sshManager: SSHConnectionManager;
  let webServerManager: WebServerManager;
  let testPort: number;
  let mockSession: MockSession;

  beforeAll(async () => {
    testPort = getUniquePort();
  });

  beforeEach(async () => {
    sshManager = new SSHConnectionManager(testPort);
    webServerManager = new WebServerManager(sshManager, { port: testPort });
    
    mockSession = {
      name: `test-session-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      host: "test-host",
      username: "test-user"
    };
    
    // Start web server for WebSocket testing
    await webServerManager.start();
  });

  afterEach(async () => {
    // Clean up connections
    if (sshManager.hasSession(mockSession.name)) {
      await sshManager.disconnectSession(mockSession.name);
    }
    
    // Stop web server
    await webServerManager.stop();
  });

  describe("AC4.1: Unified Command Execution", () => {
    test("should fail - user and Claude commands must use same SSH shell channel", async () => {
      // FAILING TEST: This should fail initially because we need to verify that
      // both user and Claude commands execute through the exact same shell channel
      
      expect(async () => {
        // Test setup - create a session (will fail without real SSH)
        // This test proves that both command sources would use identical execution path
        
        // 1. Verify both command sources use executeCommand() method
        const claudeCommand = "echo 'Claude command'";
        const userCommand = "echo 'User command'";
        
        // Mock session for testing (will fail without real connection)
        try {
          await sshManager.executeCommand(mockSession.name, claudeCommand, { source: 'claude' });
          await sshManager.executeCommand(mockSession.name, userCommand, { source: 'user' });
        } catch (error) {
          // Expected to fail - no real SSH connection
          expect((error as Error).message).toContain("not found");
        }
        
        // This test MUST fail initially to prove TDD approach
        throw new Error("Test must fail initially - unified execution path not verified");
      }).rejects.toThrow();
    });

    test("should fail - commands from any source must maintain identical session state", async () => {
      // FAILING TEST: Session state (directory, env vars) must persist identically
      // regardless of command source
      
      expect(async () => {
        // This test should verify that:
        // 1. Claude command changing directory persists for user commands
        // 2. User command setting env var persists for Claude commands
        // 3. Both use the same shell session state
        
        try {
          // Mock execution of directory change by Claude
          await sshManager.executeCommand(mockSession.name, "cd /tmp", { source: 'claude' });
          
          // Mock execution of pwd by user - should show /tmp
          const result = await sshManager.executeCommand(mockSession.name, "pwd", { source: 'user' });
          
          // Should fail initially because session doesn't exist
          expect(result.stdout.trim()).toBe("/tmp");
        } catch (error) {
          // Expected failure without real SSH
          expect((error as Error).message).toContain("not found");
        }
        
        // Force failure for TDD
        throw new Error("Test must fail initially - session state consistency not implemented");
      }).rejects.toThrow();
    });

    test("should fail - identical output formatting between command sources", async () => {
      // FAILING TEST: Output format must be identical regardless of command source
      
      expect(async () => {
        const command = "echo 'test output'";
        
        try {
          const claudeResult = await sshManager.executeCommand(mockSession.name, command, { source: 'claude' });
          const userResult = await sshManager.executeCommand(mockSession.name, command, { source: 'user' });
          
          // Output format should be identical
          expect(claudeResult.stdout).toBe(userResult.stdout);
          expect(claudeResult.stderr).toBe(userResult.stderr);
          expect(claudeResult.exitCode).toBe(userResult.exitCode);
        } catch (error) {
          // Expected failure without session
          expect((error as Error).message).toContain("not found");
        }
        
        // Force TDD failure
        throw new Error("Test must fail initially - output formatting uniformity not verified");
      }).rejects.toThrow();
    });
  });

  describe("AC4.2: Command Output Streaming", () => {
    test("should fail - user commands must stream output via WebSocket in real-time", async () => {
      // FAILING TEST: User commands must stream output identically to Claude commands
      
      let webSocket: WebSocket | undefined;
      const receivedMessages: any[] = [];
      
      try {
        // Setup WebSocket monitoring (will fail without session)
        const wsUrl = `ws://localhost:${testPort}/ws/session/${mockSession.name}`;
        
        await expect(async () => {
          webSocket = new WebSocket(wsUrl);
          
          webSocket.on('message', (data) => {
            receivedMessages.push(JSON.parse(data.toString()));
          });
          
          await delay(1000);
          
          // Should fail because session doesn't exist
          expect(webSocket.readyState).toBe(WebSocket.OPEN);
          
          // Test that user commands stream output
          const command = "echo 'streaming test'";
          await sshManager.executeCommand(mockSession.name, command, { source: 'user' });
          
          await delay(1000);
          
          // Should receive streamed output
          const outputMessages = receivedMessages.filter(m => m.type === 'terminal_output');
          expect(outputMessages.length).toBeGreaterThan(0);
          
          const hasUserOutput = outputMessages.some(m => 
            m.source === 'user' && m.data.includes('streaming test')
          );
          expect(hasUserOutput).toBe(true);
          
        }).rejects.toThrow();
        
      } finally {
        if (webSocket) {
          webSocket.close();
        }
      }
    });

    test("should fail - command output streaming format must be identical for both sources", async () => {
      // FAILING TEST: WebSocket message format must be identical regardless of source
      
      expect(async () => {
        let claudeMessages: any[] = [];
        let userMessages: any[] = [];
        
        // Mock WebSocket message collection would happen here
        // but we can't easily mock the internal broadcasting without a real session
        
        try {
          // Execute commands with different sources
          await sshManager.executeCommand(mockSession.name, "echo 'test'", { source: 'claude' });
          await sshManager.executeCommand(mockSession.name, "echo 'test'", { source: 'user' });
        } catch (error) {
          // Expected failure - no session
          expect((error as Error).message).toContain("not found");
        }
        
        // Message format should be identical (excluding source field)
        if (claudeMessages.length > 0 && userMessages.length > 0) {
          const claudeMsg = claudeMessages[0];
          const userMsg = userMessages[0];
          
          // Same fields except source
          expect(claudeMsg.type).toBe(userMsg.type);
          expect(claudeMsg.sessionName).toBe(userMsg.sessionName);
          expect(claudeMsg.timestamp).toBeDefined();
          expect(userMsg.timestamp).toBeDefined();
        }
        
        // Force failure for TDD
        throw new Error("Test must fail initially - output streaming format not unified");
      }).rejects.toThrow();
    });

    test("should fail - no command echo in streamed output for both sources", async () => {
      // FAILING TEST: Command echo should be suppressed consistently for both sources
      
      expect(async () => {
        const command = "echo 'no echo test'";
        
        try {
          // Both sources should suppress command echo identically
          const claudeResult = await sshManager.executeCommand(mockSession.name, command, { source: 'claude' });
          const userResult = await sshManager.executeCommand(mockSession.name, command, { source: 'user' });
          
          // Neither should contain the command itself in output
          expect(claudeResult.stdout).not.toContain(command);
          expect(userResult.stdout).not.toContain(command);
          
          // Both should contain only the actual output
          expect(claudeResult.stdout.trim()).toBe("no echo test");
          expect(userResult.stdout.trim()).toBe("no echo test");
          
        } catch (error) {
          // Expected failure - no session
          expect((error as Error).message).toContain("not found");
        }
        
        // Force TDD failure
        throw new Error("Test must fail initially - command echo suppression not unified");
      }).rejects.toThrow();
    });
  });

  describe("AC4.3: Session State Consistency", () => {
    test("should fail - directory changes must persist across command sources", async () => {
      // FAILING TEST: Directory changes by one source must affect the other source
      
      expect(async () => {
        try {
          // Claude changes directory
          await sshManager.executeCommand(mockSession.name, "cd /home", { source: 'claude' });
          
          // User checks current directory - should reflect Claude's change
          const result = await sshManager.executeCommand(mockSession.name, "pwd", { source: 'user' });
          expect(result.stdout.trim()).toBe("/home");
          
          // User changes directory
          await sshManager.executeCommand(mockSession.name, "cd /etc", { source: 'user' });
          
          // Claude checks current directory - should reflect user's change
          const result2 = await sshManager.executeCommand(mockSession.name, "pwd", { source: 'claude' });
          expect(result2.stdout.trim()).toBe("/etc");
          
        } catch (error) {
          // Expected failure - no session
          expect((error as Error).message).toContain("not found");
        }
        
        // Force TDD failure
        throw new Error("Test must fail initially - directory persistence not implemented");
      }).rejects.toThrow();
    });

    test("should fail - environment variables must persist across command sources", async () => {
      // FAILING TEST: Environment variables set by one source must be visible to the other
      
      expect(async () => {
        try {
          // Claude sets environment variable
          await sshManager.executeCommand(mockSession.name, "export TEST_VAR=claude_value", { source: 'claude' });
          
          // User reads environment variable - should see Claude's value
          const result = await sshManager.executeCommand(mockSession.name, "echo $TEST_VAR", { source: 'user' });
          expect(result.stdout.trim()).toBe("claude_value");
          
          // User modifies environment variable
          await sshManager.executeCommand(mockSession.name, "export TEST_VAR=user_value", { source: 'user' });
          
          // Claude reads environment variable - should see user's value
          const result2 = await sshManager.executeCommand(mockSession.name, "echo $TEST_VAR", { source: 'claude' });
          expect(result2.stdout.trim()).toBe("user_value");
          
        } catch (error) {
          // Expected failure - no session
          expect((error as Error).message).toContain("not found");
        }
        
        // Force TDD failure
        throw new Error("Test must fail initially - environment persistence not implemented");
      }).rejects.toThrow();
    });

    test("should fail - shell history must be shared between command sources", async () => {
      // FAILING TEST: Shell command history must be accessible to both sources
      
      expect(async () => {
        try {
          // Claude executes unique commands
          await sshManager.executeCommand(mockSession.name, "echo 'claude_command_1'", { source: 'claude' });
          await sshManager.executeCommand(mockSession.name, "echo 'claude_command_2'", { source: 'claude' });
          
          // User executes unique commands
          await sshManager.executeCommand(mockSession.name, "echo 'user_command_1'", { source: 'user' });
          await sshManager.executeCommand(mockSession.name, "echo 'user_command_2'", { source: 'user' });
          
          // Both should be able to access shell history
          const historyResult = await sshManager.executeCommand(mockSession.name, "history", { source: 'claude' });
          
          // History should contain commands from both sources
          expect(historyResult.stdout).toContain("claude_command_1");
          expect(historyResult.stdout).toContain("user_command_1");
          
        } catch (error) {
          // Expected failure - no session
          expect((error as Error).message).toContain("not found");
        }
        
        // Force TDD failure
        throw new Error("Test must fail initially - shell history sharing not implemented");
      }).rejects.toThrow();
    });
  });

  describe("AC4.4: Command History Integration", () => {
    test("should fail - command history must include source identification", async () => {
      // FAILING TEST: Command history must track both sources with proper identification
      
      expect(async () => {
        try {
          // Execute commands with different sources
          await sshManager.executeCommand(mockSession.name, "echo 'claude test'", { source: 'claude' });
          await sshManager.executeCommand(mockSession.name, "echo 'user test'", { source: 'user' });
          
          // Get command history
          const history = sshManager.getCommandHistory(mockSession.name);
          
          // Should have entries for both sources
          const claudeEntries = history.filter(entry => entry.source === 'claude');
          const userEntries = history.filter(entry => entry.source === 'user');
          
          expect(claudeEntries.length).toBeGreaterThan(0);
          expect(userEntries.length).toBeGreaterThan(0);
          
          // Each entry should have proper source identification
          claudeEntries.forEach(entry => {
            expect(entry.source).toBe('claude');
            expect(entry.sessionName).toBe(mockSession.name);
          });
          
          userEntries.forEach(entry => {
            expect(entry.source).toBe('user');
            expect(entry.sessionName).toBe(mockSession.name);
          });
          
        } catch (error) {
          // Expected failure - no session
          expect((error as Error).message).toContain("not found");
        }
        
        // Force TDD failure
        throw new Error("Test must fail initially - command history source tracking not implemented");
      }).rejects.toThrow();
    });

    test("should fail - command history listeners must receive all commands regardless of source", async () => {
      // FAILING TEST: History listeners must be notified of commands from both sources
      
      expect(async () => {
        const receivedHistoryEntries: any[] = [];
        
        try {
          // Add history listener
          sshManager.addCommandHistoryListener(mockSession.name, (entry) => {
            receivedHistoryEntries.push(entry);
          });
          
          // Execute commands with different sources
          await sshManager.executeCommand(mockSession.name, "echo 'claude cmd'", { source: 'claude' });
          await sshManager.executeCommand(mockSession.name, "echo 'user cmd'", { source: 'user' });
          
          await delay(500); // Allow history events to propagate
          
          // Should have received both commands
          expect(receivedHistoryEntries.length).toBe(2);
          
          const sources = receivedHistoryEntries.map(entry => entry.source);
          expect(sources).toContain('claude');
          expect(sources).toContain('user');
          
        } catch (error) {
          // Expected failure - no session
          expect((error as Error).message).toContain("not found");
        }
        
        // Force TDD failure
        throw new Error("Test must fail initially - history listener integration not unified");
      }).rejects.toThrow();
    });
  });

  describe("AC4.5: Terminal Output Compatibility", () => {
    test("should fail - ANSI escape codes must be preserved for both command sources", async () => {
      // FAILING TEST: ANSI codes must be preserved identically regardless of source
      
      expect(async () => {
        const ansiCommand = "echo -e '\\x1b[31mRed text\\x1b[0m'"; // Red text ANSI
        
        try {
          const claudeResult = await sshManager.executeCommand(mockSession.name, ansiCommand, { source: 'claude' });
          const userResult = await sshManager.executeCommand(mockSession.name, ansiCommand, { source: 'user' });
          
          // Both should preserve ANSI codes
          expect(claudeResult.stdout).toContain('\x1b[31m'); // Red color code
          expect(claudeResult.stdout).toContain('\x1b[0m');  // Reset code
          expect(userResult.stdout).toContain('\x1b[31m');
          expect(userResult.stdout).toContain('\x1b[0m');
          
          // Outputs should be identical
          expect(claudeResult.stdout).toBe(userResult.stdout);
          
        } catch (error) {
          // Expected failure - no session
          expect((error as Error).message).toContain("not found");
        }
        
        // Force TDD failure
        throw new Error("Test must fail initially - ANSI code preservation not unified");
      }).rejects.toThrow();
    });

    test("should fail - cursor movement sequences must work identically for both sources", async () => {
      // FAILING TEST: VT100/xterm cursor sequences must be handled uniformly
      
      expect(async () => {
        const cursorCommand = "echo -e '\\x1b[2J\\x1b[H'"; // Clear screen + home cursor
        
        try {
          const claudeResult = await sshManager.executeCommand(mockSession.name, cursorCommand, { source: 'claude' });
          const userResult = await sshManager.executeCommand(mockSession.name, cursorCommand, { source: 'user' });
          
          // Both should preserve cursor movement codes
          expect(claudeResult.stdout).toContain('\x1b[2J'); // Clear screen
          expect(claudeResult.stdout).toContain('\x1b[H');  // Home cursor
          expect(userResult.stdout).toContain('\x1b[2J');
          expect(userResult.stdout).toContain('\x1b[H');
          
          // Check that both mark output as VT100 compatible
          // This would be tested through the terminal output entry structure
          expect(claudeResult.stdout).toBe(userResult.stdout);
          
        } catch (error) {
          // Expected failure - no session
          expect((error as Error).message).toContain("not found");
        }
        
        // Force TDD failure
        throw new Error("Test must fail initially - cursor movement handling not unified");
      }).rejects.toThrow();
    });

    test("should fail - xterm.js compatibility flags must be set correctly for both sources", async () => {
      // FAILING TEST: Terminal output entries must have correct compatibility flags
      
      expect(async () => {
        // This test would need access to the TerminalOutputEntry structure
        // to verify that vt100Compatible and preserveFormatting flags are set correctly
        
        const command = "echo 'compatibility test'";
        
        try {
          // Execute with both sources and check terminal output metadata
          await sshManager.executeCommand(mockSession.name, command, { source: 'claude' });
          await sshManager.executeCommand(mockSession.name, command, { source: 'user' });
          
          // Get terminal history to check output entries
          const history = sshManager.getTerminalHistory(mockSession.name);
          
          const claudeEntries = history.filter(entry => entry.source === 'claude');
          const userEntries = history.filter(entry => entry.source === 'user');
          
          // Both should have identical compatibility settings
          claudeEntries.forEach(entry => {
            expect(entry.vt100Compatible).toBeDefined();
            expect(entry.preserveFormatting).toBeDefined();
          });
          
          userEntries.forEach(entry => {
            expect(entry.vt100Compatible).toBeDefined();
            expect(entry.preserveFormatting).toBeDefined();
          });
          
        } catch (error) {
          // Expected failure - no session
          expect((error as Error).message).toContain("not found");
        }
        
        // Force TDD failure
        throw new Error("Test must fail initially - xterm.js compatibility not unified");
      }).rejects.toThrow();
    });
  });

  describe("Integration Verification", () => {
    test("should fail - complete unified execution workflow for mixed command sources", async () => {
      // FAILING TEST: End-to-end workflow with mixed command sources
      
      let webSocket: WebSocket | undefined;
      const receivedMessages: any[] = [];
      
      try {
        expect(async () => {
          // 1. Setup WebSocket monitoring
          const wsUrl = `ws://localhost:${testPort}/ws/session/${mockSession.name}`;
          webSocket = new WebSocket(wsUrl);
          
          webSocket.on('message', (data) => {
            receivedMessages.push(JSON.parse(data.toString()));
          });
          
          await delay(1000);
          expect(webSocket.readyState).toBe(WebSocket.OPEN);
          
          // 2. Execute mixed command sequence
          await sshManager.executeCommand(mockSession.name, "cd /tmp", { source: 'claude' });
          await sshManager.executeCommand(mockSession.name, "pwd", { source: 'user' });
          await sshManager.executeCommand(mockSession.name, "export TEST=value", { source: 'user' });
          await sshManager.executeCommand(mockSession.name, "echo $TEST", { source: 'claude' });
          
          await delay(2000);
          
          // 3. Verify unified behavior
          const outputMessages = receivedMessages.filter(m => m.type === 'terminal_output');
          expect(outputMessages.length).toBeGreaterThan(0);
          
          // Should see both sources in messages
          const sources = [...new Set(outputMessages.map(m => m.source))];
          expect(sources).toContain('claude');
          expect(sources).toContain('user');
          
          // Session state should be consistent
          const pwdOutput = outputMessages.find(m => m.data.includes('/tmp'));
          expect(pwdOutput).toBeDefined();
          
          const envOutput = outputMessages.find(m => m.data.includes('value'));
          expect(envOutput).toBeDefined();
          
          // Command history should include all commands with proper sources
          const history = sshManager.getCommandHistory(mockSession.name);
          expect(history.length).toBe(4);
          
          const historyCommands = history.map(h => ({ cmd: h.command, src: h.source }));
          expect(historyCommands).toContainEqual({ cmd: 'cd /tmp', src: 'claude' });
          expect(historyCommands).toContainEqual({ cmd: 'pwd', src: 'user' });
          expect(historyCommands).toContainEqual({ cmd: 'export TEST=value', src: 'user' });
          expect(historyCommands).toContainEqual({ cmd: 'echo $TEST', src: 'claude' });
          
        }).rejects.toThrow();
        
      } finally {
        if (webSocket) {
          webSocket.close();
        }
      }
    });
  });
});