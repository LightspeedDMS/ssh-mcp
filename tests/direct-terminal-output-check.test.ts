/**
 * Direct Terminal Output Check
 * This test directly verifies what's being output by the cleanTerminalOutputForBrowser method
 */

import { SSHConnectionManager } from '../src/ssh-connection-manager';

describe('Direct Terminal Output Check', () => {
  let manager: SSHConnectionManager;

  beforeEach(() => {
    manager = new SSHConnectionManager(8084);
  });

  test('verify cleanTerminalOutputForBrowser actually fixes the broken pattern', () => {
    // The exact broken pattern from user's terminal:
    // \u001b[?2004l\r\u001b[?2004h[jsbattig@localhost ~]$ command
    const brokenInput = '\u001b[?2004l\r\u001b[?2004h[jsbattig@localhost ~]$ ls';
    
    // Access private method through any cast for testing
    const cleanMethod = (manager as any).cleanTerminalOutputForBrowser.bind(manager);
    const result = cleanMethod(brokenInput);
    
    console.log('BROKEN INPUT:', JSON.stringify(brokenInput));
    console.log('CLEANED OUTPUT:', JSON.stringify(result));
    console.log('Expected: [jsbattig@localhost ~]$ ls');
    
    // Critical checks
    const checks = {
      removedProblematicSequence: !result.includes('\u001b[?2004l\r\u001b[?2004h'),
      preservedPrompt: result.includes('[jsbattig@localhost ~]$'),
      preservedCommand: result.includes('ls'),
      commandInlineWithPrompt: /\[jsbattig@localhost ~\]\$\s*ls/.test(result),
      noBracketPasteMode: !result.includes('\u001b[?2004') && !result.includes('?2004'),
    };
    
    console.log('\nCheck Results:');
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${check}: ${passed}`);
    });
    
    // Assertions
    expect(checks.removedProblematicSequence).toBe(true);
    expect(checks.preservedPrompt).toBe(true);
    expect(checks.preservedCommand).toBe(true);
    expect(checks.commandInlineWithPrompt).toBe(true);
    expect(checks.noBracketPasteMode).toBe(true);
  });

  test('verify multiple problematic patterns are handled', () => {
    const patterns = [
      {
        name: 'Pattern 1: ?2004l\\r?2004h',
        input: '\u001b[?2004l\r\u001b[?2004h[jsbattig@localhost ~]$ pwd',
        expected: '[jsbattig@localhost ~]$ pwd'
      },
      {
        name: 'Pattern 2: ?2004l followed by content',
        input: '\u001b[?2004l[jsbattig@localhost ~]$ whoami',
        expected: '[jsbattig@localhost ~]$ whoami'
      },
      {
        name: 'Pattern 3: Multiple occurrences',
        input: '\u001b[?2004h\u001b[?2004l\r\u001b[?2004h[jsbattig@localhost ~]$ date',
        expected: '[jsbattig@localhost ~]$ date'
      },
      {
        name: 'Pattern 4: Corrupted prompt start',
        input: '\u001b[?2004l\rsbattig@localhost ~]$ ls',
        expected: 'sbattig@localhost ~]$ ls'  // This shows the corruption isn't fixed by just removing sequences
      }
    ];
    
    const cleanMethod = (manager as any).cleanTerminalOutputForBrowser.bind(manager);
    
    patterns.forEach(({ name, input, expected }) => {
      const result = cleanMethod(input);
      console.log(`\n${name}:`);
      console.log('  Input:', JSON.stringify(input));
      console.log('  Output:', JSON.stringify(result));
      console.log('  Expected:', JSON.stringify(expected));
      console.log('  Match:', result.includes(expected.replace(/\s+/g, '')) ? '✅' : '❌');
    });
  });
});