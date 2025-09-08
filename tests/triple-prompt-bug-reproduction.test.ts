import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Triple Prompt Bug Reproduction', () => {
  let testUtils: JestTestUtilities;

  beforeEach(async () => {
    testUtils = new JestTestUtilities();
    await testUtils.setupTest('triple-prompt-bug-test');
  });

  afterEach(async () => {
    await testUtils.cleanupTest();
  });

  it('should NOT generate triple empty prompts at session start', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "bug-test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "bug-test-session", "command": "whoami"}',
        'ssh_exec {"sessionName": "bug-test-session", "command": "pwd"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'bug-test-session'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    console.log('\n=== CAPTURED TERMINAL OUTPUT ===');
    console.log('Raw concatenated responses:');
    console.log(JSON.stringify(result.concatenatedResponses, null, 2));
    console.log('\n=== END OUTPUT ===\n');

    // CRITICAL BUG DETECTION: Check for the exact failing pattern
    // The bug shows: [user@host ~]$ [user@host ~]$ [user@host ~]$ 
    const triplePromptPattern = /\[.*?@.*?\s.*?\]\$\s*\[.*?@.*?\s.*?\]\$\s*\[.*?@.*?\s.*?\]\$\s*(?:\r?\n)/;
    
    // THIS SHOULD PASS now that the bug is fixed
    expect(result.concatenatedResponses).not.toMatch(triplePromptPattern);
    
    // POSITIVE ASSERTIONS: What we expect to see instead
    // Commands should execute normally with proper prompts
    expect(result.concatenatedResponses).toMatch(/whoami[\r\n]+jsbattig/);
    expect(result.concatenatedResponses).toMatch(/pwd[\r\n]+\/home\/jsbattig/);
    
    // Should NOT have three consecutive identical prompts
    const consecutivePromptsPattern = /(\[.*?@.*?\s.*?\]\$)\s*\1\s*\1/;
    expect(result.concatenatedResponses).not.toMatch(consecutivePromptsPattern);
    
    // Validate proper command execution structure
    expect(result.concatenatedResponses).toMatch(/whoami[\r\n]+jsbattig/);
    expect(result.concatenatedResponses).toMatch(/pwd[\r\n]+\/home\/jsbattig/);
  }, 60000);

  it('should show exactly what the current bug produces', async () => {
    // This test documents the current failing behavior
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "document-bug-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "document-bug-session", "command": "whoami"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'document-bug-session'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    // Document exactly what we're seeing (this will initially pass showing the bug)
    console.log('\n=== CURRENT BUG BEHAVIOR ===');
    console.log('Terminal output showing triple prompt issue:');
    console.log(result.concatenatedResponses);
    console.log('\n=== END BUG DOCUMENTATION ===\n');
    
    // This test passes initially to document current behavior
    expect(result.concatenatedResponses).toContain('whoami');
    expect(result.concatenatedResponses).toContain('jsbattig');
  }, 60000);
});