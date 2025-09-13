/**
 * COMMAND DUPLICATION FIX - TDD Test Suite
 * 
 * Tests to reproduce and verify fix for the fundamental architectural flaw:
 * Commands are executed TWICE on the same SSH session:
 * 1. MCP path: handleSSHExec() → sshManager.executeCommand()  
 * 2. Browser path: handleTerminalInputMessage() → sshManager.executeCommand()
 * 
 * This test suite follows TDD methodology to:
 * 1. Write failing tests that demonstrate duplication
 * 2. Implement state machine to prevent duplication
 * 3. Verify commands execute exactly once per invocation
 */

import { MCPSSHServer } from '../src/mcp-ssh-server.js';
import { WebServerManager } from '../src/web-server-manager.js';
import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import { beforeAll, afterAll, beforeEach, describe, it, expect, jest } from '@jest/globals';
import * as WebSocket from 'ws';

describe('Command Duplication Fix - TDD Test Suite', () => {
  let mcpServer: MCPSSHServer;
  let webServerManager: WebServerManager;
  let sshManager: SSHConnectionManager;
  let mockExecuteCommand: any;
  
  const TEST_SESSION_NAME = 'duplicate-test-session';
  const TEST_COMMAND = 'echo "test-duplication"';

  beforeAll(async () => {
    // Initialize components with shared SSH manager and state manager
    sshManager = new SSHConnectionManager();
    mcpServer = new MCPSSHServer({}, sshManager);
    
    // Share the same terminal state manager between MCP and web server
    const sharedStateManager = mcpServer.getTerminalStateManager();
    webServerManager = new WebServerManager(sshManager, {}, sharedStateManager);
    
    // Mock the executeCommand method to track invocations
    mockExecuteCommand = jest.spyOn(sshManager, 'executeCommand')
      .mockResolvedValue({
        stdout: 'test-duplication\n',
        stderr: '',
        exitCode: 0
      });
      
    // Mock hasSession to return true for our test session
    jest.spyOn(sshManager, 'hasSession').mockReturnValue(true);
    
    // Start servers
    await mcpServer.start();
    await webServerManager.start();
  });

  afterAll(async () => {
    await mcpServer.stop();
    await webServerManager.stop();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    // Clear mock invocations before each test
    mockExecuteCommand.mockClear();
  });

  describe('FAILING TESTS - Demonstrate Current Duplication Issue', () => {
    it('should demonstrate command duplication when MCP and browser both execute same command', async () => {
      // This test demonstrates concurrent command execution attempts
      // The state machine should prevent this duplication
      
      // Mock executeCommand to be slow so we can test concurrency
      mockExecuteCommand.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          stdout: 'test-duplication\n',
          stderr: '',
          exitCode: 0
        }), 50))
      );
      
      // Start MCP command execution (don't await)
      const mcpPromise = mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: TEST_COMMAND
      });

      // Immediately try browser command execution of SAME command
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        OPEN: WebSocket.OPEN
      } as unknown as WebSocket;

      const browserMessage = {
        type: 'terminal_input',
        sessionName: TEST_SESSION_NAME,
        command: TEST_COMMAND,
        commandId: 'browser-cmd-123'
      };

      // Simulate browser message (this should be rejected by state machine)
      await (webServerManager as any).handleTerminalInputMessage(
        mockWebSocket, 
        browserMessage, 
        TEST_SESSION_NAME
      );

      // Wait for MCP command to complete
      const mcpResult = await mcpPromise;
      expect(mcpResult).toHaveProperty('success', true);

      // Browser command should be rejected, only MCP should execute
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        TEST_SESSION_NAME, 
        TEST_COMMAND, 
        expect.objectContaining({ source: 'claude' })
      );

      // Browser should have received rejection message
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('Session is busy')
      );
    });

    it('should demonstrate concurrent command execution attempts', async () => {
      // This test shows what happens when MCP and browser try to execute simultaneously
      // Both should not execute - state machine should prevent overlap
      
      // Start MCP command execution (don't await)
      const mcpPromise = mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'sleep 1 && echo "mcp-command"'
      });

      // Immediately try browser command execution
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        OPEN: WebSocket.OPEN
      } as unknown as WebSocket;

      const browserMessage = {
        type: 'terminal_input',
        sessionName: TEST_SESSION_NAME,
        command: 'echo "browser-command"',
        commandId: 'browser-cmd-456'
      };

      // This should be rejected due to state machine (when implemented)
      const browserPromise = (webServerManager as any).handleTerminalInputMessage(
        mockWebSocket, 
        browserMessage, 
        TEST_SESSION_NAME
      );

      // Wait for both to complete
      await Promise.all([mcpPromise, browserPromise]);

      // CURRENT BROKEN BEHAVIOR: Both commands execute (this will FAIL)
      // After fix: Only first command should execute, second should be rejected
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1); // This will FAIL - currently called twice
    });

    it('should demonstrate session state is not tracked between command executions', async () => {
      // This test shows that sessions have no state tracking mechanism
      // Commands can be executed without checking if another command is running
      
      // Execute first command
      await mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'echo "first-command"'
      });
      
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      
      // Execute second command immediately (should work - sequential execution)
      await mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'echo "second-command"'
      });
      
      expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
      
      // The issue is that there's no coordination between MCP and browser paths
      // Both can execute simultaneously causing duplication and race conditions
      
      // This test passes but demonstrates the lack of state coordination
      // State machine will add proper session state tracking
    });
  });

  describe('STATE MACHINE REQUIREMENTS - Will Pass After Implementation', () => {
    it('should prevent browser command execution when MCP command is running', async () => {
      // This test defines expected behavior after state machine implementation
      // Currently will fail, should pass after implementation
      
      // Mock a long-running MCP command
      mockExecuteCommand.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          stdout: 'long-command-result\n',
          stderr: '',
          exitCode: 0
        }), 100))
      );
      
      // Start MCP command (don't await)
      const mcpPromise = mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'sleep 1 && echo "long-mcp-command"'
      });

      // Try browser command while MCP is running
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        OPEN: WebSocket.OPEN
      } as unknown as WebSocket;

      const browserMessage = {
        type: 'terminal_input',
        sessionName: TEST_SESSION_NAME,
        command: 'echo "should-be-rejected"',
        commandId: 'browser-cmd-789'
      };

      await (webServerManager as any).handleTerminalInputMessage(
        mockWebSocket, 
        browserMessage, 
        TEST_SESSION_NAME
      );

      // Browser command should be rejected via WebSocket error message
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('Session is busy')
      );

      // Wait for MCP command to complete
      const mcpResult = await mcpPromise;
      expect(mcpResult).toHaveProperty('success', true);
      
      // Only MCP command should have executed
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
    });

    it('should prevent MCP command execution when browser command is running', async () => {
      // This test defines expected behavior after state machine implementation
      
      // Mock browser command execution to be long-running
      mockExecuteCommand.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          stdout: 'browser-command-result\n',
          stderr: '',
          exitCode: 0
        }), 100))
      );
      
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        OPEN: WebSocket.OPEN
      } as unknown as WebSocket;

      // Start browser command (don't await)
      const browserMessage = {
        type: 'terminal_input',
        sessionName: TEST_SESSION_NAME,
        command: 'sleep 1 && echo "long-browser-command"',
        commandId: 'browser-cmd-999'
      };

      const browserPromise = (webServerManager as any).handleTerminalInputMessage(
        mockWebSocket, 
        browserMessage, 
        TEST_SESSION_NAME
      );

      // Try MCP command while browser is running
      const mcpResult = await mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'echo "should-be-rejected"'
      });

      // MCP command should be rejected
      expect(mcpResult).toHaveProperty('success', false);
      expect(mcpResult).toHaveProperty('error', 'SESSION_BUSY');

      // Wait for browser command to complete
      await browserPromise;
      
      // Only browser command should have executed
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
    });

    it('should allow sequential command execution after completion', async () => {
      // This test verifies proper state transitions
      
      // Execute MCP command and wait for completion
      await mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'echo "first-sequential"'
      });
      
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      
      // Execute browser command after MCP completion
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        OPEN: WebSocket.OPEN
      } as unknown as WebSocket;

      const browserMessage = {
        type: 'terminal_input',
        sessionName: TEST_SESSION_NAME,
        command: 'echo "second-sequential"',
        commandId: 'sequential-cmd-123'
      };

      await (webServerManager as any).handleTerminalInputMessage(
        mockWebSocket, 
        browserMessage, 
        TEST_SESSION_NAME
      );
      
      // Both commands should execute sequentially
      expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
      
      // Verify no error messages sent to browser
      expect(mockWebSocket.send).not.toHaveBeenCalledWith(
        expect.stringContaining('error')
      );
    });
  });
});