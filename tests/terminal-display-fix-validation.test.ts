/**
 * Terminal Display Fix Validation Test
 * 
 * This test validates that the OSC sequence filtering fix resolves the terminal display issues:
 * - No more double carriage returns (CR CR)
 * - Commands appear inline with prompts
 * - No corrupted prompts (missing characters)
 * 
 * Uses Villenele framework to capture real WebSocket messages and validate the fix.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';
import { CommandConfigurationJSON } from './integration/terminal-history-framework/flexible-command-configuration';

describe('Terminal Display Fix Validation', () => {
  let testUtils: JestTestUtilities;
  
  beforeAll(async () => {
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true,
      testTimeout: 45000
    });
  });

  beforeEach(async () => {
    await testUtils.setupTest('terminal-display-fix-validation');
  });

  afterEach(async () => {
    await testUtils.cleanupTest();
  });

  test('should eliminate double carriage returns and fix prompt positioning', async () => {
    console.log('\n=== TERMINAL DISPLAY FIX VALIDATION ===');
    console.log('Expected: Commands inline with prompts');
    console.log('Expected: No double carriage returns');
    console.log('Expected: Complete prompts [jsbattig@localhost ~]$');
    
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        'ssh_connect {"name": "fix-validation", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "fix-validation", "command": "echo \\"testing terminal fix\\""}',
        'ssh_exec {"sessionName": "fix-validation", "command": "pwd"}',
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "fix-validation", "command": "whoami"}',
        'ssh_exec {"sessionName": "fix-validation", "command": "date"}'
      ],
      workflowTimeout: 40000,
      sessionName: 'fix-validation'
    };

    const workflowResult = await testUtils.runTerminalHistoryTest(config);
    
    expect(workflowResult.success).toBe(true);
    expect(workflowResult.concatenatedResponses).toBeDefined();
    
    const rawMessages = workflowResult.concatenatedResponses!;
    console.log('\n=== POST-FIX WEBSOCKET MESSAGES ===');
    console.log(`Message Length: ${rawMessages.length} characters`);
    console.log('Raw messages with escaped control chars:');
    console.log(JSON.stringify(rawMessages, null, 2));
    
    // CRITICAL VALIDATIONS: The fix should have eliminated these issues
    
    console.log('\n=== DOUBLE CARRIAGE RETURN TEST ===');
    const doubleCarriageReturns = (rawMessages.match(/\r\r/g) || []).length;
    console.log(`Double carriage returns found: ${doubleCarriageReturns}`);
    expect(doubleCarriageReturns).toBe(0); // Should be ZERO after fix
    
    console.log('\n=== OSC WINDOW TITLE SEQUENCE TEST ===');
    const oscSequences = (rawMessages.match(new RegExp('\\u001b\\]0;', 'g')) || []).length;
    console.log(`OSC window title sequences found: ${oscSequences}`);
    expect(oscSequences).toBe(0); // Should be ZERO after fix
    
    console.log('\n=== ISOLATED CARRIAGE RETURN TEST ===');
    const isolatedCRs = (rawMessages.match(/\r(?!\n)/g) || []).length;
    console.log(`Isolated carriage returns found: ${isolatedCRs}`);
    expect(isolatedCRs).toBe(0); // Should be ZERO after fix
    
    console.log('\n=== PROMPT INTEGRITY TEST ===');
    const completePrompts = (rawMessages.match(/\[jsbattig@localhost [^\]]+\]\$/g) || []).length;
    console.log(`Complete prompts found: ${completePrompts}`);
    expect(completePrompts).toBeGreaterThan(0); // Should have complete prompts
    
    console.log('\n=== CRLF COMPLIANCE TEST ===');
    const hasCRLF = rawMessages.includes('\r\n');
    console.log(`Contains CRLF line endings: ${hasCRLF}`);
    expect(hasCRLF).toBe(true); // Should maintain CRLF for xterm.js compatibility
    
    console.log('\n=== COMMAND INLINE POSITIONING TEST ===');
    // Check that commands don't appear on separate lines after prompts
    const separateLineCommands = (rawMessages.match(/\]\$\s*\r\n\s*[a-zA-Z]/g) || []).length;
    console.log(`Commands on separate lines: ${separateLineCommands}`);
    expect(separateLineCommands).toBe(0); // Should be ZERO - commands should be inline
    
    console.log('\n=== TERMINAL DISPLAY FIX VALIDATION COMPLETE ===');
    if (doubleCarriageReturns === 0 && oscSequences === 0 && isolatedCRs === 0 && separateLineCommands === 0) {
      console.log('✅ SUCCESS: All terminal display issues resolved!');
      console.log('✅ No double carriage returns');
      console.log('✅ No OSC window title sequences');
      console.log('✅ No isolated carriage returns');
      console.log('✅ No commands on separate lines');
    } else {
      console.log('❌ FAILURE: Some issues remain - check the assertions above');
    }
  });
  
  test('should maintain proper terminal formatting for user commands', async () => {
    console.log('\n=== USER COMMAND FORMATTING TEST ===');
    
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        'ssh_connect {"name": "formatting-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "formatting-test", "command": "echo \\"Hello World\\""}',
        'ssh_exec {"sessionName": "formatting-test", "command": "ls -la"}',
        'ssh_exec {"sessionName": "formatting-test", "command": "echo \\"Final test command\\""}',
      ],
      workflowTimeout: 30000,
      sessionName: 'formatting-test'
    };

    const workflowResult = await testUtils.runTerminalHistoryTest(config);
    
    expect(workflowResult.success).toBe(true);
    
    const rawMessages = workflowResult.concatenatedResponses!;
    
    // Use Villenele's validation helpers
    testUtils.expectWebSocketMessages(rawMessages)
      .toContainCRLF()
      .toHavePrompts()
      .toMatchCommandSequence(['echo "Hello World"', 'ls', 'echo "Final test command"'])
      .toNotContain('\r\r') // Should NOT contain double CR
      .toNotContain('\u001b]0;') // Should NOT contain OSC sequences
      .validate();
      
    console.log('✅ User command formatting maintained correctly');
  });
});