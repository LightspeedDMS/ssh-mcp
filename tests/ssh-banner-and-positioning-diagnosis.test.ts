/**
 * SSH Banner and Command Positioning Diagnosis Test
 * 
 * This test uses the Terminal History Testing Framework to diagnose the specific issues reported:
 * 1. SSH banners appearing in browser terminal history
 * 2. Commands appearing on separate lines from prompts instead of inline
 * 
 * The test will capture actual WebSocket messages and analyze them for:
 * - SSH connection banners like "Activate the web console with..."
 * - Command positioning relative to prompts
 * - Terminal history content filtering
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

// Extend Jest with custom matchers
JestTestUtilities.extendJestMatchers();

describe('SSH Banner and Command Positioning Diagnosis', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('ssh-banner-diagnosis');
  
  beforeAll(() => {
    // Enable detailed logging for diagnosis
    testUtils.setDetailedLogging(true);
  });

  test('should diagnose SSH banner content in WebSocket messages', async () => {
    // Use the specific session name from the user report
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "final-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "final-test", "command": "whoami"}'
      ],
      postWebSocketCommands: [
        // Test real-time command as well
        'ssh_exec {"sessionName": "final-test", "command": "pwd"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'final-test'
    };

    console.log('[DIAGNOSIS] Starting SSH banner and positioning test...');
    
    const result = await testUtils.runTerminalHistoryTest(config);
    
    console.log('[DIAGNOSIS] Test completed, analyzing WebSocket messages...');
    console.log('[DIAGNOSIS] Success:', result.success);
    console.log('[DIAGNOSIS] Concatenated responses length:', result.concatenatedResponses.length);
    
    // Log the full WebSocket content for manual analysis
    console.log('\n=== FULL WEBSOCKET MESSAGES ===');
    console.log(result.concatenatedResponses);
    console.log('=== END WEBSOCKET MESSAGES ===\n');
    
    // Test for SSH banner content that shouldn't appear in browser terminal
    const sshBannerPatterns = [
      'Activate the web console with',
      'systemctl enable --now cockpit.socket',
      'Last login:',
      'from ::1'
    ];
    
    const foundBanners: string[] = [];
    sshBannerPatterns.forEach(pattern => {
      if (result.concatenatedResponses.includes(pattern)) {
        foundBanners.push(pattern);
        console.log(`[DIAGNOSIS] ❌ Found SSH banner in WebSocket: "${pattern}"`);
      } else {
        console.log(`[DIAGNOSIS] ✅ SSH banner NOT found in WebSocket: "${pattern}"`);
      }
    });
    
    // Test for command positioning - commands should be inline with prompts
    const promptCommandPattern = /\[([a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+)\]\$\s*(\w+)/g;
    const matches = [...result.concatenatedResponses.matchAll(promptCommandPattern)];
    
    console.log(`[DIAGNOSIS] Found ${matches.length} prompt-command pairs`);
    
    matches.forEach((match, index) => {
      const prompt = match[1];
      const command = match[2];
      console.log(`[DIAGNOSIS] Prompt-Command ${index + 1}: [${prompt}]$ ${command}`);
    });
    
    // Test for commands appearing on separate lines (problematic pattern)
    const separateLinePattern = /\]\$\s*\r?\n\s*(\w+)/g;
    const separateLineMatches = [...result.concatenatedResponses.matchAll(separateLinePattern)];
    
    if (separateLineMatches.length > 0) {
      console.log(`[DIAGNOSIS] ❌ Found ${separateLineMatches.length} commands on separate lines from prompts`);
      separateLineMatches.forEach((match, index) => {
        console.log(`[DIAGNOSIS] Separate line command ${index + 1}: "${match[1]}"`);
      });
    } else {
      console.log(`[DIAGNOSIS] ✅ No commands found on separate lines from prompts`);
    }
    
    // Use the framework's built-in assertions
    testUtils.expectWebSocketMessages(result.concatenatedResponses)
      .toContainCRLF()
      .toHavePrompts()
      .toMatchCommandSequence(['whoami', 'pwd'])
      .toHaveMinimumLength(10)
      .validate();
    
    // Custom assertions for our specific issues
    if (foundBanners.length > 0) {
      console.log(`[DIAGNOSIS] ISSUE CONFIRMED: SSH banners found in WebSocket messages: ${foundBanners.join(', ')}`);
    }
    
    if (separateLineMatches.length > 0) {
      console.log(`[DIAGNOSIS] ISSUE CONFIRMED: Commands appearing on separate lines from prompts`);
    }
    
    // For now, let the test pass to gather diagnostic info
    expect(result.success).toBe(true);
    expect(result.concatenatedResponses.length).toBeGreaterThan(0);
  }, 60000);

  test('should validate current final-test session URL accessibility', async () => {
    // Test if we can connect to the specific session mentioned in the user report
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "final-test-validation", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [],
      workflowTimeout: 15000,
      sessionName: 'final-test-validation'
    };

    console.log('[VALIDATION] Testing connection to final-test session...');
    
    const result = await testUtils.runTerminalHistoryTest(config);
    
    console.log('[VALIDATION] Connection test result:', result.success);
    console.log('[VALIDATION] Response content length:', result.concatenatedResponses.length);
    
    // Check phase breakdown for WebSocket connection details
    if (result.phaseBreakdown) {
      console.log(`[VALIDATION] WebSocket connection success: ${result.phaseBreakdown.webSocketConnectionSuccess}`);
      console.log(`[VALIDATION] History message count: ${result.phaseBreakdown.historyMessageCount}`);
      console.log(`[VALIDATION] Real-time message count: ${result.phaseBreakdown.realTimeMessageCount}`);
    } else {
      console.log('[VALIDATION] No phase breakdown available');
    }
    
    expect(result.success).toBe(true);
  }, 30000);
});