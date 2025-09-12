import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Double Prompt Bug Reproduction', () => {
  let testUtils: JestTestUtilities;

  beforeEach(async () => {
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true
    });
    await testUtils.setupTest('double-prompt-bug');
  });

  afterEach(async () => {
    await testUtils.cleanupTest();
  });

  it('should confirm triple prompt bug is fixed', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "fixed-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "fixed-test", "command": "whoami"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "fixed-test", "command": "pwd"}'}
        ],
      workflowTimeout: 30000,
      sessionName: 'fixed-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    // FIXED BEHAVIOR (what we now get after fix):
    // whoami
    // jsbattig
    // [jsbattig@localhost ~]$ pwd
    // /home/jsbattig
    // [jsbattig@localhost ~]$
    
    console.log('=== FIXED BEHAVIOR VALIDATION ===');
    console.log('Raw WebSocket response:');
    console.log(JSON.stringify(result.concatenatedResponses, null, 2));
    console.log('================================');

    // Check for the multiple prompt bug patterns
    const responseText = result.concatenatedResponses;
    
    // Count multiple consecutive prompts (should be 0 after fix)
    const multiplePromptMatches = responseText.match(/(\[jsbattig@localhost [^\]]+\]\$ ){2,}/g);
    const multiplePromptCount = multiplePromptMatches ? multiplePromptMatches.length : 0;
    
    console.log(`Found ${multiplePromptCount} multiple prompt instances`);
    if (multiplePromptMatches) {
      console.log('Multiple prompt patterns:');
      multiplePromptMatches.forEach((match, index) => {
        const promptCount = (match.match(/\[jsbattig@localhost [^\]]+\]\$/g) || []).length;
        console.log(`${index + 1}: ${promptCount} consecutive prompts: ${JSON.stringify(match)}`);
      });
    }

    // This assertion should now PASS - we expect 0 multiple prompts after fix
    expect(multiplePromptCount).toBe(0); // SUCCESS: Fixed triple prompt bug
  });

  it('should show the exact double prompt pattern analysis', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "pattern-analysis", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "pattern-analysis", "command": "echo test"}'}
        ],
      workflowTimeout: 30000,
      sessionName: 'pattern-analysis'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    const lines = result.concatenatedResponses.split(/\r?\n/);
    
    console.log('=== LINE-BY-LINE ANALYSIS ===');
    lines.forEach((line, index) => {
      const isPrompt = line.match(/\[jsbattig@localhost [^\]]+\]\$/);
      const isEmpty = line.trim() === '';
      const isCommand = line.match(/\[jsbattig@localhost [^\]]+\]\$ \w+/);
      
      console.log(`Line ${index}: ${JSON.stringify(line)} - ${
        isCommand ? 'COMMAND' : 
        isPrompt ? 'EMPTY_PROMPT' : 
        isEmpty ? 'EMPTY_LINE' : 
        'OUTPUT'
      }`);
    });
    console.log('==============================');

    // Look for the specific pattern: empty prompt followed by command prompt
    const doublePromptPattern = /\[jsbattig@localhost [^\]]+\]\$\r?\n\[jsbattig@localhost [^\]]+\]\$ /;
    const hasDoublePrompt = doublePromptPattern.test(result.concatenatedResponses);
    
    // This should fail initially, confirming the bug
    expect(hasDoublePrompt).toBe(false); // EXPECTED: This will fail
  });

  it('should validate clean command execution without prompt artifacts', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "clean-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "clean-test", "command": "whoami"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "clean-test", "command": "pwd"}'}
        ],
      workflowTimeout: 30000,
      sessionName: 'clean-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    // CLEAN BEHAVIOR AFTER FIX:
    // whoami
    // jsbattig
    // [jsbattig@localhost ~]$ pwd
    // /home/jsbattig
    // [jsbattig@localhost ~]$
    
    // Validate expected clean patterns
    const responseText = result.concatenatedResponses;
    
    // Should have command outputs
    expect(responseText).toContain('jsbattig');
    expect(responseText).toMatch(/\/home\/jsbattig/);
    
    // Should have natural prompts between commands (not initialization artifacts)
    expect(responseText).toMatch(/\[jsbattig@localhost [^\]]+\]\$/);
    
    // Should NOT have multiple consecutive prompts (the bug we fixed)
    const multipleConsecutivePrompts = /(\[jsbattig@localhost [^\]]+\]\$ ){2,}/;
    expect(responseText).not.toMatch(multipleConsecutivePrompts); // This should now pass
  });
});