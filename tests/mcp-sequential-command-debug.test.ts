/**
 * MCP Sequential Command Debug Test
 * 
 * PURPOSE: Test MCP server's ability to handle sequential SSH commands
 * to identify if the issue is at the MCP protocol level, not browser level.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';
import { MCPServerManager } from './integration/terminal-history-framework/mcp-server-manager';
import { MCPClient } from './integration/terminal-history-framework/mcp-client';

describe('MCP Sequential Command Debug', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('mcp-sequential-debug');

  /**
   * TEST: Direct MCP client command execution without WebSocket interference
   */
  describe('Direct MCP Command Execution', () => {
    it('should execute sequential MCP commands directly via MCP client', async () => {
      // Test MCP commands directly without WebSocket to isolate the issue
      let serverManager: MCPServerManager | undefined;
      let mcpClient: MCPClient | undefined;

      try {
        // Start MCP server directly
        serverManager = new MCPServerManager();
        await serverManager.start();
        
        // Create MCP client
        const serverProcess = serverManager.getProcess();
        if (!serverProcess) throw new Error('Server process not available');
        mcpClient = new MCPClient(serverProcess as any);
        
        // Test sequential commands directly via MCP
        console.log('=== DIRECT MCP COMMAND TEST ===');
        
        // Command 1: Connect SSH
        console.log('Executing ssh_connect...');
        const connectResult = await mcpClient.callTool('ssh_connect', {
          name: 'mcp-direct-test',
          host: 'localhost',
          username: 'jsbattig',
          keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
        });
        
        console.log('ssh_connect result:', connectResult);
        expect(connectResult.success).toBe(true);
        
        // Command 2: First ssh_exec
        console.log('Executing first ssh_exec...');
        const firstExecResult = await mcpClient.callTool('ssh_exec', {
          sessionName: 'mcp-direct-test',
          command: 'echo first-direct-command'
        });
        
        console.log('First ssh_exec result:', firstExecResult);
        expect(firstExecResult.success).toBe(true);
        
        // Command 3: Second ssh_exec (this is where the issue likely occurs)
        console.log('Executing second ssh_exec...');
        const secondExecResult = await mcpClient.callTool('ssh_exec', {
          sessionName: 'mcp-direct-test',
          command: 'echo second-direct-command'
        });
        
        console.log('Second ssh_exec result:', secondExecResult);
        expect(secondExecResult.success).toBe(true);
        
        // Command 4: Third ssh_exec (to test if pattern continues)
        console.log('Executing third ssh_exec...');
        const thirdExecResult = await mcpClient.callTool('ssh_exec', {
          sessionName: 'mcp-direct-test',
          command: 'echo third-direct-command'
        });
        
        console.log('Third ssh_exec result:', thirdExecResult);
        expect(thirdExecResult.success).toBe(true);
        
        // Clean up SSH session
        await mcpClient.callTool('ssh_disconnect', {
          sessionName: 'mcp-direct-test'
        });
        
      } finally {
        if (mcpClient) {
          await mcpClient.disconnect();
        }
        if (serverManager && serverManager.isRunning()) {
          await serverManager.stop();
        }
      }
    }, 60000); // 60-second timeout for debug
  });

  /**
   * TEST: Test with timing delays between commands
   */
  describe('MCP Command Timing Analysis', () => {
    it('should test if delays between MCP commands resolve the issue', async () => {
      let serverManager: MCPServerManager | undefined;
      let mcpClient: MCPClient | undefined;

      try {
        serverManager = new MCPServerManager();
        await serverManager.start();
        const serverProcess = serverManager.getProcess();
        if (!serverProcess) throw new Error('Server process not available');
        mcpClient = new MCPClient(serverProcess as any);
        
        console.log('=== MCP COMMAND TIMING TEST ===');
        
        // Connect SSH
        const connectResult = await mcpClient.callTool('ssh_connect', {
          name: 'mcp-timing-test',
          host: 'localhost',
          username: 'jsbattig',
          keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
        });
        expect(connectResult.success).toBe(true);
        
        // First command
        console.log('Executing first command...');
        const first = await mcpClient.callTool('ssh_exec', {
          sessionName: 'mcp-timing-test',
          command: 'echo timing-first && sleep 1'
        });
        console.log('First result:', first);
        
        // Wait between commands
        console.log('Waiting 2 seconds between commands...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Second command  
        console.log('Executing second command...');
        const second = await mcpClient.callTool('ssh_exec', {
          sessionName: 'mcp-timing-test',
          command: 'echo timing-second && sleep 1'
        });
        console.log('Second result:', second);
        
        // Wait between commands
        console.log('Waiting 2 seconds between commands...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Third command
        console.log('Executing third command...');
        const third = await mcpClient.callTool('ssh_exec', {
          sessionName: 'mcp-timing-test',
          command: 'echo timing-third'
        });
        console.log('Third result:', third);
        
        // All should succeed
        expect(first.success).toBe(true);
        expect(second.success).toBe(true);
        expect(third.success).toBe(true);
        
        // Clean up
        await mcpClient.callTool('ssh_disconnect', {
          sessionName: 'mcp-timing-test'
        });
        
      } finally {
        if (mcpClient) {
          await mcpClient.disconnect();
        }
        if (serverManager && serverManager.isRunning()) {
          await serverManager.stop();
        }
      }
    }, 90000); // 90-second timeout
  });

  /**
   * TEST: Compare direct MCP vs framework execution
   */
  describe('Framework vs Direct MCP Comparison', () => {
    it('should compare framework execution with direct MCP execution', async () => {
      // Test the same commands through the framework
      console.log('=== FRAMEWORK EXECUTION TEST ===');
      
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "framework-compare", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "framework-compare", "command": "echo framework-first"}',
          'ssh_exec {"sessionName": "framework-compare", "command": "echo framework-second"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'framework-compare'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      console.log('Framework result success:', result.success);
      console.log('Framework responses:', result.concatenatedResponses);
      console.log('Framework post-WebSocket results:', result.postWebSocketResults);
      
      // Analyze the results
      if (result.postWebSocketResults && result.postWebSocketResults.length > 0) {
        result.postWebSocketResults.forEach((cmdResult, index) => {
          console.log(`Command ${index + 1}:`, {
            command: cmdResult.command,
            success: cmdResult.success,
            error: cmdResult.error,
            mcpResponse: cmdResult.mcpResponse
          });
        });
      }
      
      // The framework version likely fails while direct MCP succeeds
      // This will help us identify if the issue is in the framework or MCP
      console.log('=== COMPARISON COMPLETE ===');
    });
  });
});