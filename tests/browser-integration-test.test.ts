/**
 * Browser integration test - sets up MCP and provides URL for manual testing
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Browser Integration Test', () => {
  test('Setup MCP server and get monitoring URL for manual browser testing', async () => {
    console.log('\n🚀 Starting MCP server and SSH connection for browser testing...\n');

    try {
      // Connect via MCP
      console.log('1. Connecting to SSH via MCP...');
      const connectCmd = `echo '{"jsonrpc": "2.0", "id": 1, "method": "mcp__ssh__ssh_connect", "params": {"name": "browser-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}}' | npm run mcp-server 2>/dev/null`;

      await execAsync(connectCmd, { timeout: 10000 });
      console.log('✅ SSH connection established');

      // Execute a test command
      console.log('2. Executing test command via MCP...');
      const execCmd = `echo '{"jsonrpc": "2.0", "id": 2, "method": "mcp__ssh__ssh_exec", "params": {"sessionName": "browser-test", "command": "whoami"}}' | npm run mcp-server 2>/dev/null`;

      await execAsync(execCmd, { timeout: 10000 });
      console.log('✅ Command executed successfully');

      // Get monitoring URL
      console.log('3. Getting monitoring URL...');
      const urlCmd = `echo '{"jsonrpc": "2.0", "id": 3, "method": "mcp__ssh__ssh_get_monitoring_url", "params": {"sessionName": "browser-test"}}' | npm run mcp-server 2>/dev/null`;

      const urlResult = await execAsync(urlCmd, { timeout: 10000 });

      // Parse the JSON response to get the URL
      const response = JSON.parse(urlResult.stdout.trim());
      const monitoringUrl = response.result?.monitoringUrl;

      if (monitoringUrl) {
        console.log('\n🌐 BROWSER TEST URL:');
        console.log(`${monitoringUrl}`);
        console.log('\n📋 To test the terminal display fix:');
        console.log('1. Open the URL above in your browser');
        console.log('2. Check that the terminal shows:');
        console.log('   - Proper command echoes (whoami command visible)');
        console.log('   - Clean terminal formatting (no double prompts)');
        console.log('   - Correct line endings (no scattered text)');
        console.log('3. Try typing new commands to verify input works');
        console.log('\n⏰ Server will run for 30 seconds for manual testing...\n');

        // Keep server running for manual testing
        await new Promise(resolve => setTimeout(resolve, 30000));

        console.log('✅ Browser integration test setup completed');
      } else {
        throw new Error('Failed to get monitoring URL from MCP response');
      }

    } catch (error) {
      console.error('❌ Browser integration test failed:', error);
      throw error;
    }
  }, 45000); // 45 second timeout
});