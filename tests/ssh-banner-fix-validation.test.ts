/**
 * SSH Banner Fix Validation Test
 * 
 * This test validates the fixes for SSH banner filtering and command positioning issues.
 * It uses the Terminal History Testing Framework to verify that:
 * 1. SSH login banners are filtered out of browser terminal history
 * 2. Commands appear inline with prompts (not on separate lines)
 * 3. ANSI control sequences are properly cleaned for browser display
 * 4. Terminal functionality remains intact after filtering
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

// Extend Jest with custom matchers
JestTestUtilities.extendJestMatchers();

describe('SSH Banner Fix Validation', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('ssh-banner-fix-validation');
  
  beforeAll(() => {
    // Enable detailed logging for validation
    testUtils.setDetailedLogging(true);
  });

  test('should filter SSH banners from WebSocket messages after fix', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "validation-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "validation-test", "command": "whoami"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "validation-test", "command": "pwd"}',
        'ssh_exec {"sessionName": "validation-test", "command": "date"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'validation-test'
    };

    console.log('[VALIDATION] Testing SSH banner filtering after fix...');
    
    const result = await testUtils.runTerminalHistoryTest(config);
    
    console.log('[VALIDATION] Test completed, analyzing filtered WebSocket messages...');
    console.log('[VALIDATION] Success:', result.success);
    console.log('[VALIDATION] Response length:', result.concatenatedResponses.length);
    
    // Log the cleaned WebSocket content
    console.log('\n=== FILTERED WEBSOCKET MESSAGES ===');
    console.log(result.concatenatedResponses);
    console.log('=== END FILTERED MESSAGES ===\n');
    
    // Test that SSH banners are filtered out
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
        console.log(`[VALIDATION] ❌ SSH banner still found: "${pattern}"`);
      } else {
        console.log(`[VALIDATION] ✅ SSH banner successfully filtered: "${pattern}"`);
      }
    });
    
    // Test that ANSI control sequences are cleaned
    const ansiControlPatterns = [
      /\[?\?2004[lh]/g, // Bracketed paste mode sequences
      /\[?\?1[lh]/g,    // Cursor application mode
      /\[?\?25[lh]/g,   // Cursor visibility
    ];
    
    let foundAnsiSequences = 0;
    ansiControlPatterns.forEach((pattern, index) => {
      const matches = [...result.concatenatedResponses.matchAll(pattern)];
      if (matches.length > 0) {
        foundAnsiSequences += matches.length;
        console.log(`[VALIDATION] ❌ ANSI control sequence ${index + 1} still found: ${matches.length} occurrences`);
      } else {
        console.log(`[VALIDATION] ✅ ANSI control sequence ${index + 1} successfully cleaned`);
      }
    });
    
    // Test for proper command positioning - commands should be inline with prompts
    const inlinePromptCommandPattern = /\[([a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+)\]\$\s*(\w+)/g;
    const inlineMatches = [...result.concatenatedResponses.matchAll(inlinePromptCommandPattern)];
    
    console.log(`[VALIDATION] Found ${inlineMatches.length} inline prompt-command pairs`);
    
    inlineMatches.forEach((match, index) => {
      const prompt = match[1];
      const command = match[2];
      console.log(`[VALIDATION] ✅ Inline Command ${index + 1}: [${prompt}]$ ${command}`);
    });
    
    // Test for commands on separate lines (should be zero after fix)
    const separateLinePattern = /\]\$\s*\r?\n\s*(\w+)/g;
    const separateLineMatches = [...result.concatenatedResponses.matchAll(separateLinePattern)];
    
    if (separateLineMatches.length > 0) {
      console.log(`[VALIDATION] ❌ Still found ${separateLineMatches.length} commands on separate lines`);
      separateLineMatches.forEach((match, index) => {
        console.log(`[VALIDATION] Separate line command ${index + 1}: "${match[1]}"`);
      });
    } else {
      console.log(`[VALIDATION] ✅ No commands found on separate lines - positioning fixed!`);
    }
    
    // Use framework assertions
    testUtils.expectWebSocketMessages(result.concatenatedResponses)
      .toContainCRLF()
      .toHavePrompts()
      .toMatchCommandSequence(['whoami', 'pwd', 'date'])
      .toHaveMinimumLength(10)
      .toNotContain('Activate the web console with')
      .toNotContain('systemctl enable --now cockpit.socket')
      .toNotContain('Last login:')
      .toNotContain('from ::1')
      .validate();
    
    // Final validation assertions
    expect(result.success).toBe(true);
    expect(foundBanners.length).toBe(0); // No SSH banners should remain
    expect(foundAnsiSequences).toBe(0); // No problematic ANSI sequences should remain
    expect(separateLineMatches.length).toBe(0); // No commands on separate lines
    expect(inlineMatches.length).toBeGreaterThan(0); // Should have properly positioned commands
    
    console.log(`[VALIDATION] ✅ All fixes validated successfully!`);
  }, 60000);

  test('should preserve essential terminal functionality after filtering', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "functionality-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "functionality-test", "command": "echo \\"Hello World\\""}',
        'ssh_exec {"sessionName": "functionality-test", "command": "ls -la | head -5"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'functionality-test'
    };

    console.log('[VALIDATION] Testing terminal functionality preservation...');
    
    const result = await testUtils.runTerminalHistoryTest(config);
    
    console.log('[VALIDATION] Functionality test completed');
    console.log('[VALIDATION] Response contains "Hello World":', result.concatenatedResponses.includes('Hello World'));
    console.log('[VALIDATION] Response contains directory listing:', result.concatenatedResponses.includes('total'));
    
    // Verify essential content is preserved
    testUtils.expectWebSocketMessages(result.concatenatedResponses)
      .toContainCRLF()
      .toHavePrompts()
      .toContainText('Hello World') // Echo command result should be preserved
      .toMatchCommandSequence(['echo', 'ls'])
      .validate();
    
    expect(result.success).toBe(true);
    expect(result.concatenatedResponses.includes('Hello World')).toBe(true);
    
    console.log('[VALIDATION] ✅ Terminal functionality preserved after filtering!');
  }, 30000);
});