/**
 * CI Environment Diagnostic Test
 * 
 * Purpose: Identify why regression tests fail quickly (26ms) in GitHub Actions CI
 * versus working locally (21+ seconds). This test performs focused checks to
 * pinpoint the exact failure point in CI environments.
 * 
 * Problem Analysis:
 * - Local: Test runs 21+ seconds, reaches WebSocket phase, gets "Expected: 1, Received: 2"
 * - CI: Test fails in 26ms with "Expected: 1, Received: 0" - never gets to WebSocket phase
 */

import { execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import * as path from 'path';
import WebSocket from 'ws';
import { MCPServerManager } from './integration/terminal-history-framework/mcp-server-manager';
import { MCPClient } from './integration/terminal-history-framework/mcp-client';
import { WebSocketConnectionDiscovery } from './integration/terminal-history-framework/websocket-connection-discovery';

interface DiagnosticResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  duration: number;
}

class CIEnvironmentDiagnostic {
  private results: DiagnosticResult[] = [];

  private async runCheck(name: string, checkFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    try {
      await checkFn();
      this.results.push({
        name,
        status: 'PASS',
        details: 'Check completed successfully',
        duration: Date.now() - startTime
      });
    } catch (error) {
      this.results.push({
        name,
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }

  async checkSSHService(): Promise<void> {
    await this.runCheck('SSH Service Running', async () => {
      try {
        const result = execSync('ps aux | grep -E "[s]shd|[s]sh-agent"', { });
        if (!result.toString().trim()) {
          throw new Error('No SSH service processes found');
        }
        console.log(`SSH processes: ${result.toString().trim()}`);
      } catch (error) {
        throw new Error(`SSH service check failed: ${error}`);
      }
    });
  }

  async checkSSHKeyPermissions(): Promise<void> {
    await this.runCheck('SSH Key Permissions', async () => {
      const keyPath = path.join(process.env.HOME || '/home/jsbattig', '.ssh/id_ed25519');
      
      if (!existsSync(keyPath)) {
        throw new Error(`SSH key not found at ${keyPath}`);
      }

      const stats = statSync(keyPath);
      const permissions = (stats.mode & parseInt('777', 8)).toString(8);
      
      if (permissions !== '600') {
        throw new Error(`SSH key has incorrect permissions: ${permissions} (expected: 600)`);
      }

      console.log(`SSH key found with correct permissions: ${permissions}`);
    });
  }

  async checkSSHLocalhostConnectivity(): Promise<void> {
    await this.runCheck('SSH Localhost Connectivity', async () => {
      try {
        const result = execSync('ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no localhost echo "SSH_TEST_SUCCESS"', { 
          
          timeout: 10000 
        });
        
        if (!result.includes('SSH_TEST_SUCCESS')) {
          throw new Error(`SSH test command failed. Output: ${result}`);
        }
        
        console.log('SSH localhost connectivity confirmed');
      } catch (error) {
        throw new Error(`SSH localhost connection failed: ${error}`);
      }
    });
  }

  async checkMCPServerExists(): Promise<void> {
    await this.runCheck('MCP Server File Exists', async () => {
      const serverPath = path.join(process.cwd(), 'dist/src/mcp-ssh-server.js');
      
      if (!existsSync(serverPath)) {
        throw new Error(`MCP server not found at ${serverPath}`);
      }

      const stats = statSync(serverPath);
      console.log(`MCP server found: ${serverPath} (${stats.size} bytes)`);
    });
  }

  async checkMCPServerStartup(): Promise<void> {
    await this.runCheck('MCP Server Startup', async () => {
      const manager = new MCPServerManager();
      
      try {
        await manager.start();
        console.log('MCP server started successfully');
        
        // Create MCP client to test server responsiveness
        const rawProcess = manager.getRawProcess();
        if (!rawProcess) {
          throw new Error('No server process available for testing');
        }
        
        const client = new MCPClient(rawProcess);
        const testResponse = await client.callTool('ssh_list_sessions', {});
        console.log(`MCP server responds to requests: ${JSON.stringify(testResponse)}`);
        
        await client.disconnect();
      } finally {
        await manager.stop();
      }
    });
  }

  async checkPortAllocation(): Promise<void> {
    await this.runCheck('Port Allocation', async () => {
      const manager = new MCPServerManager();
      
      try {
        await manager.start();
        
        const rawProcess = manager.getRawProcess();
        if (!rawProcess) {
          throw new Error('No server process available');
        }
        
        const client = new MCPClient(rawProcess);
        
        // Try to get monitoring URL which involves port discovery
        const connectResponse = await client.callTool('ssh_connect', {
          name: 'diagnostic-test',
          host: 'localhost',
          username: process.env.USER || 'jsbattig',
          keyFilePath: `${process.env.HOME}/.ssh/id_ed25519`
        });
        
        console.log(`SSH connection response: ${JSON.stringify(connectResponse)}`);
        
        const urlResponse = await client.callTool('ssh_get_monitoring_url', {
          sessionName: 'diagnostic-test'
        });
        
        if (!urlResponse.success) {
          throw new Error(`Failed to get monitoring URL: ${urlResponse.error || 'Unknown error'}`);
        }
        
        // The monitoring URL is directly in the response, not in a nested result
        const monitoringUrl = (urlResponse as any).monitoringUrl;
        if (!monitoringUrl) {
          throw new Error('No monitoring URL in response');
        }
        
        console.log(`Monitoring URL obtained: ${monitoringUrl}`);
        
        // Extract port from URL
        const portMatch = monitoringUrl.match(/:(\d+)/);
        if (!portMatch) {
          throw new Error(`Invalid monitoring URL format: ${monitoringUrl}`);
        }
        
        const port = parseInt(portMatch[1]);
        console.log(`Dynamic port allocated: ${port}`);
        
        await client.disconnect();
      } finally {
        await manager.stop();
      }
    });
  }

  async checkWebSocketConnection(): Promise<void> {
    await this.runCheck('WebSocket Connection', async () => {
      const manager = new MCPServerManager();
      
      try {
        await manager.start();
        
        const rawProcess = manager.getRawProcess();
        if (!rawProcess) {
          throw new Error('No server process available');
        }
        
        const client = new MCPClient(rawProcess);
        
        // Establish SSH session
        await client.callTool('ssh_connect', {
          name: 'websocket-test',
          host: 'localhost',
          username: process.env.USER || 'jsbattig',
          keyFilePath: `${process.env.HOME}/.ssh/id_ed25519`
        });
        
        const urlResponse = await client.callTool('ssh_get_monitoring_url', {
          sessionName: 'websocket-test'
        });
        
        if (!urlResponse.success) {
          throw new Error(`Failed to get monitoring URL: ${urlResponse.error || 'Unknown error'}`);
        }
        
        // The monitoring URL is directly in the response, not in a nested result
        const monitoringUrl = (urlResponse as any).monitoringUrl;
        if (!monitoringUrl) {
          throw new Error('No monitoring URL in response');
        }
        
        // Test WebSocket connection
        const discovery = new WebSocketConnectionDiscovery(client);
        const wsUrl = discovery.parseMonitoringUrl(monitoringUrl);
        
        console.log(`WebSocket URL discovered: ${wsUrl}`);
        
        // Test actual WebSocket connection
        const ws = new WebSocket(wsUrl);
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('WebSocket connection timeout'));
          }, 5000);
          
          ws.on('open', () => {
            clearTimeout(timeout);
            console.log('WebSocket connection established successfully');
            ws.close();
            resolve(void 0);
          });
          
          ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`WebSocket connection error: ${error.message}`));
          });
        });
        
        await client.disconnect();
      } finally {
        await manager.stop();
      }
    });
  }

  async checkEnvironmentVariables(): Promise<void> {
    await this.runCheck('Environment Variables', async () => {
      const requiredEnvVars = ['HOME', 'USER', 'PATH'];
      const missingVars: string[] = [];
      
      requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
          missingVars.push(varName);
        }
      });
      
      if (missingVars.length > 0) {
        throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
      }
      
      console.log('All required environment variables present:');
      requiredEnvVars.forEach(varName => {
        console.log(`  ${varName}=${process.env[varName]}`);
      });
    });
  }

  async checkNodeVersion(): Promise<void> {
    await this.runCheck('Node.js Version', async () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion < 16) {
        throw new Error(`Node.js version too old: ${nodeVersion} (minimum: 16)`);
      }
      
      console.log(`Node.js version: ${nodeVersion} ✓`);
    });
  }

  printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('CI ENVIRONMENT DIAGNOSTIC RESULTS');
    console.log('='.repeat(80));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warned = this.results.filter(r => r.status === 'WARN').length;
    
    console.log(`Summary: ${passed} PASSED, ${failed} FAILED, ${warned} WARNINGS\n`);
    
    this.results.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${statusIcon} ${result.name} (${result.duration}ms)`);
      if (result.status !== 'PASS') {
        console.log(`   └── ${result.details}`);
      }
      console.log();
    });
    
    if (failed > 0) {
      console.log('🔍 TROUBLESHOOTING GUIDANCE:');
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`\n❌ ${result.name}:`);
        console.log(`   Error: ${result.details}`);
        this.printTroubleshootingGuidance(result.name);
      });
    }
  }

  private printTroubleshootingGuidance(checkName: string): void {
    const guidance: Record<string, string[]> = {
      'SSH Service Running': [
        'Install SSH server: sudo apt-get install openssh-server',
        'Start SSH service: sudo systemctl start ssh',
        'Enable SSH service: sudo systemctl enable ssh'
      ],
      'SSH Key Permissions': [
        'Generate SSH key: ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519',
        'Set correct permissions: chmod 600 ~/.ssh/id_ed25519',
        'Add to authorized_keys: cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys'
      ],
      'SSH Localhost Connectivity': [
        'Add key to authorized_keys: ssh-copy-id localhost',
        'Test manually: ssh localhost',
        'Check SSH config: cat ~/.ssh/config'
      ],
      'MCP Server File Exists': [
        'Build the project: npm run build',
        'Check TypeScript compilation: tsc --noEmit',
        'Verify dist directory: ls -la dist/src/'
      ],
      'MCP Server Startup': [
        'Check for port conflicts: netstat -tlnp | grep :8080',
        'Verify dependencies: npm ls',
        'Check server logs for specific error messages'
      ],
      'WebSocket Connection': [
        'Check firewall settings',
        'Verify WebSocket URL format',
        'Test with curl: curl -v -H "Connection: Upgrade" -H "Upgrade: websocket" [WS_URL]'
      ]
    };

    const steps = guidance[checkName] || ['No specific guidance available'];
    steps.forEach((step, index) => {
      console.log(`   ${index + 1}. ${step}`);
    });
  }
}

describe('CI Environment Diagnostic', () => {
  const diagnostic = new CIEnvironmentDiagnostic();

  test('Environment Diagnostic Suite', async () => {
    console.log('🔍 Starting CI Environment Diagnostic...\n');
    
    // Run all diagnostic checks
    await diagnostic.checkNodeVersion();
    await diagnostic.checkEnvironmentVariables();
    await diagnostic.checkSSHService();
    await diagnostic.checkSSHKeyPermissions();
    await diagnostic.checkSSHLocalhostConnectivity();
    await diagnostic.checkMCPServerExists();
    await diagnostic.checkMCPServerStartup();
    await diagnostic.checkPortAllocation();
    await diagnostic.checkWebSocketConnection();
    
    // Print comprehensive results
    diagnostic.printResults();
    
    // The test itself should not fail - we want to see all results
    // But we can provide a summary
    const failedChecks = diagnostic['results'].filter(r => r.status === 'FAIL');
    if (failedChecks.length > 0) {
      console.log(`\n🚨 CRITICAL: ${failedChecks.length} checks failed in CI environment`);
      console.log('This explains why the regression test fails quickly (26ms) in CI vs working locally');
    } else {
      console.log('\n✅ All diagnostic checks passed - investigate test framework timing or assertions');
    }
  }, 60000); // 60 second timeout for comprehensive checks
});