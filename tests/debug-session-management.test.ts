/**
 * Debug Session Management Test
 * 
 * This test helps debug why WebSocket discovery fails with "Session not found" 
 * even when ssh_connect executes successfully.
 */

import { MCPServerManager } from './integration/terminal-history-framework/mcp-server-manager';
import { MCPClient } from './integration/terminal-history-framework/mcp-client';

describe('Debug Session Management', () => {
  let serverManager: MCPServerManager;
  let mcpClient: MCPClient;

  beforeEach(async () => {
    serverManager = new MCPServerManager();
    await serverManager.start();
    
    const serverProcess = serverManager.getRawProcess();
    if (!serverProcess) {
      throw new Error('Failed to get MCP server process');
    }
    mcpClient = new MCPClient(serverProcess);
  });

  afterEach(async () => {
    if (serverManager) {
      await serverManager.stop();
    }
  });

  it('should debug session creation and discovery workflow', async () => {
    const sessionName = 'debug-workflow-session';
    
    console.log('🔍 DEBUGGING SESSION MANAGEMENT WORKFLOW');
    console.log('==========================================');
    
    try {
      // Step 1: Test ssh_connect
      console.log(`1. Testing ssh_connect with session: ${sessionName}`);
      const connectResult = await mcpClient.callTool('ssh_connect', {
        name: sessionName,
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '~/.ssh/id_ed25519'
      });
      console.log('✅ ssh_connect result:', JSON.stringify(connectResult, null, 2));
      
      // Step 2: List sessions to see if session exists
      console.log('\n2. Testing ssh_list_sessions to verify session creation');
      const listResult = await mcpClient.callTool('ssh_list_sessions', {});
      console.log('📋 ssh_list_sessions result:', JSON.stringify(listResult, null, 2));
      
      // Step 3: Try to get monitoring URL
      console.log(`\n3. Testing ssh_get_monitoring_url for session: ${sessionName}`);
      const monitoringResult = await mcpClient.callTool('ssh_get_monitoring_url', {
        sessionName: sessionName
      });
      console.log('📡 ssh_get_monitoring_url result:', JSON.stringify(monitoringResult, null, 2));
      
      // Step 4: Try executing a command on the session
      console.log(`\n4. Testing ssh_exec on session: ${sessionName}`);
      const execResult = await mcpClient.callTool('ssh_exec', {
        sessionName: sessionName,
        command: 'pwd'
      });
      console.log('⚡ ssh_exec result:', JSON.stringify(execResult, null, 2));
      
      console.log('\n✅ ALL STEPS COMPLETED SUCCESSFULLY');
      
    } catch (error) {
      console.log('\n❌ ERROR ENCOUNTERED:');
      console.log('Error message:', error instanceof Error ? error.message : String(error));
      console.log('Full error:', error);
      
      // Try to get more debugging information
      try {
        console.log('\n🔍 ADDITIONAL DEBUG INFO:');
        const listResult = await mcpClient.callTool('ssh_list_sessions', {});
        console.log('Current sessions:', JSON.stringify(listResult, null, 2));
      } catch (debugError) {
        console.log('Could not get debug info:', debugError);
      }
      
      throw error;
    }
  }, 15000);

  it('should test if session names vs session IDs cause the issue', async () => {
    console.log('🔍 TESTING SESSION NAME VS ID CONFUSION');
    console.log('=======================================');
    
    try {
      // Step 1: Create session
      const connectResult = await mcpClient.callTool('ssh_connect', {
        name: 'name-vs-id-test',
        host: 'localhost', 
        username: 'jsbattig',
        keyFilePath: '~/.ssh/id_ed25519'
      });
      console.log('Connect result:', JSON.stringify(connectResult, null, 2));
      
      // Step 2: Get the list to see actual session info
      const listResult = await mcpClient.callTool('ssh_list_sessions', {});
      console.log('List result:', JSON.stringify(listResult, null, 2));
      
      // Try multiple variations for getting monitoring URL
      const variations = [
        'name-vs-id-test',  // What we used as name
      ];
      
      // If there are sessions in the list, try their IDs too
      const listData = listResult as any;
      if (listData && Array.isArray(listData.sessions)) {
        listData.sessions.forEach((session: any) => {
          if (session.id) variations.push(session.id);
          if (session.name) variations.push(session.name);
          if (session.sessionId) variations.push(session.sessionId);
        });
      }
      
      for (const variation of variations) {
        try {
          console.log(`\n🧪 Trying monitoring URL with identifier: ${variation}`);
          const monitoringResult = await mcpClient.callTool('ssh_get_monitoring_url', {
            sessionName: variation
          });
          console.log(`✅ SUCCESS with "${variation}":`, JSON.stringify(monitoringResult, null, 2));
          break; // Success - stop trying
        } catch (error) {
          console.log(`❌ Failed with "${variation}": ${error instanceof Error ? error.message : error}`);
        }
      }
      
    } catch (error) {
      console.log('Overall test failed:', error);
      throw error;
    }
  }, 15000);
});