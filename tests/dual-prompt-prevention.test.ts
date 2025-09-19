/**
 * TEST-DRIVEN DEVELOPMENT: Dual Prompt Prevention Tests
 * These tests MUST fail initially to drive the implementation of proper shell initialization.
 * 
 * ROOT CAUSE: SSH shell initialization causes dual prompt generation:
 * 1. Shell starts with default prompt: jsbattig@localhost:~$  
 * 2. .bashrc changes PS1 to bracket format: [jsbattig@localhost ~]$
 * 3. Both prompts appear in stream: jsbattig@localhost:~[jsbattig@localhost ~]$
 *
 * SOLUTION: Configure SSH shell with consistent PS1 from initialization start
 */

import { SSHConnectionManager } from '../src/ssh-connection-manager.js';

describe('Dual Prompt Prevention - Root Cause Fix', () => {
  let manager: SSHConnectionManager;
  const sessionName = 'dual-prompt-test';

  beforeEach(() => {
    manager = new SSHConnectionManager();
  });

  afterEach(async () => {
    if (manager.hasSession(sessionName)) {
      await manager.disconnectSession(sessionName);
    }
    manager.cleanup();
  });

  test('MUST fail initially: Shell initialization should produce only bracket format prompt', async () => {
    // This test MUST fail with current implementation that allows dual prompts
    const connection = await manager.createConnection({
      name: sessionName,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '~/.ssh/id_ed25519'
    });

    expect(connection.name).toBe(sessionName);

    // Wait for shell to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get complete terminal history from initialization
    const history = await manager.getTerminalHistory(sessionName);
    const allOutput = history.map(entry => entry.output).join('');
    
    console.log('Raw shell initialization output:', JSON.stringify(allOutput));

    // CRITICAL ASSERTION: Should NEVER contain dual prompt patterns
    // This will FAIL with current implementation showing we need to fix the source
    expect(allOutput).not.toMatch(/jsbattig@localhost:~\[jsbattig@localhost ~\]\$/);
    
    // POSITIVE ASSERTION: Should only contain clean bracket format
    const bracketPrompts = allOutput.match(/\[jsbattig@localhost [^\]]+\]\$/g) || [];
    const oldPrompts = allOutput.match(/jsbattig@localhost:~\$/g) || [];
    
    console.log('Bracket prompts found:', bracketPrompts.length);
    console.log('Old prompts found:', oldPrompts.length);
    
    // Should have bracket prompts (the desired format)
    expect(bracketPrompts.length).toBeGreaterThan(0);
    
    // Should have ZERO old format prompts (they should be suppressed during initialization)
    expect(oldPrompts.length).toBe(0);
  });

  test('MUST fail initially: Commands should only show bracket format prompts', async () => {
    // This test ensures the fix works for ongoing command execution
    await manager.createConnection({
      name: sessionName,
      host: 'localhost', 
      username: 'jsbattig',
      keyFilePath: '~/.ssh/id_ed25519'
    });

    // Wait for shell to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Clear initial history to focus on command execution
    const initialHistory = await manager.getTerminalHistory(sessionName);
    console.log('Initial history length:', initialHistory.length);

    // Execute a simple command
    const result = await manager.executeCommand(sessionName, 'echo test-command', { timeout: 5000 });
    
    expect(result.stdout).toBe('test-command');

    // Get history from command execution
    const commandHistory = await manager.getTerminalHistory(sessionName);
    const recentOutput = commandHistory
      .slice(initialHistory.length) // Only new entries since command
      .map(entry => entry.output)
      .join('');
    
    console.log('Command execution output:', JSON.stringify(recentOutput));

    // CRITICAL: Command execution should not introduce dual prompts
    expect(recentOutput).not.toMatch(/jsbattig@localhost:~\[jsbattig@localhost ~\]\$/);
    
    // Should only contain bracket format prompts if any
    const dualPatterns = recentOutput.match(/[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+:[^[]*\[[^]]+\]\$/g) || [];
    expect(dualPatterns.length).toBe(0);
  });

  test('MUST fail initially: Generic user/host should not have dual prompt corruption', async () => {
    // Test that our fix is generic and not hardcoded to specific usernames
    // This verifies we're fixing the shell initialization process, not just filtering specific patterns
    
    // Note: This test uses localhost/jsbattig but validates against generic patterns
    await manager.createConnection({
      name: sessionName,
      host: 'localhost',
      username: 'jsbattig', 
      keyFilePath: '~/.ssh/id_ed25519'
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const history = await manager.getTerminalHistory(sessionName);
    const allOutput = history.map(entry => entry.output).join('');

    // Generic dual prompt pattern: any_user@any_host:path[any_user@any_host dir]$
    const genericDualPattern = /([a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+:[~\w/.[\]-]*)(\[[a-zA-Z0-9_.\s-]+@[a-zA-Z0-9_.-]+\s+[^\]]+\]\$)/g;
    
    const dualPromptMatches = allOutput.match(genericDualPattern) || [];
    
    console.log('Generic dual prompt matches:', dualPromptMatches);
    
    // Should have ZERO dual prompt patterns for any user@host combination
    expect(dualPromptMatches.length).toBe(0);
    
    // Should only have clean bracket format prompts 
    const cleanBracketPrompts = allOutput.match(/\[[a-zA-Z0-9_.\s-]+@[a-zA-Z0-9_.-]+\s+[^\]]+\]\$/g) || [];
    expect(cleanBracketPrompts.length).toBeGreaterThan(0);
  });

  test('MUST fail initially: No prompt corruption in prepareOutputForBrowser should be needed', async () => {
    // This test validates that we fix the source so prepareOutputForBrowser doesn't need corruption fixes
    await manager.createConnection({
      name: sessionName,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '~/.ssh/id_ed25519'
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get raw output (before prepareOutputForBrowser processing)
    const history = await manager.getTerminalHistory(sessionName);
    const output = history.map(entry => entry.output).join('');
    
    console.log('Raw output for corruption analysis:', JSON.stringify(output));

    // The raw output itself should be clean - no corruption filtering should be needed
    // If shell initialization is fixed, raw output won't contain dual prompts
    expect(output).not.toContain('jsbattig@localhost:~[jsbattig@localhost ~]$');
    
    // Verify that the issue is fixed at the source, not hidden by filtering
    const corruptionPatterns = [
      /jsbattig@localhost:~\[jsbattig@localhost ~\]\$/g,
      /([a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+:[~\w/.[\]-]*)(\[[a-zA-Z0-9_.\s-]+@[a-zA-Z0-9_.-]+\s+[^\]]+\]\$)/g
    ];
    
    for (const pattern of corruptionPatterns) {
      const matches = output.match(pattern) || [];
      expect(matches.length).toBe(0);
    }
  });
});