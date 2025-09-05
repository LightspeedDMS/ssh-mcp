/**
 * REPRODUCTION TEST FOR CRITICAL TERMINAL OUTPUT BUGS
 * 
 * This test uses the Terminal History Testing Framework to reproduce the exact
 * issues observed in the browser terminal:
 * 
 * BUG 1: Double prompts
 * ```
 * [jsbattig@localhost ~]$ [jsbattig@localhost ~]$ ls
 * ```
 * 
 * BUG 2: Command/output concatenation 
 * ```
 * [jsbattig@localhost ~]$ lsApplications                  package.json
 * ```
 * 
 * BUG 3: Missing CRLF separation
 * Commands and outputs get concatenated without proper line breaks
 * 
 * EXPECTED BEHAVIOR:
 * ```
 * [jsbattig@localhost ~]$ ls
 * Applications                  package.json
 * bun.lock                      package-lock.json
 * [jsbattig@localhost ~]$ echo "hello"
 * hello
 * [jsbattig@localhost ~]$ 
 * ```
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

// Extend Jest matchers for terminal validation
JestTestUtilities.extendJestMatchers();

// Type declarations for custom Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveValidTerminalHistory(): R;
      toContainCRLFLineEndings(): R;
    }
  }
}

describe("Double Prompt and Concatenation Bug Reproduction", () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('double-prompt-repro');

  /**
   * REPRODUCTION TEST 1: Double prompt detection
   * This test reproduces the exact scenario where double prompts appear
   */
  test("REPRODUCE BUG: Double prompt issue with WebSocket capture", async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "double-prompt-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "double-prompt-test", "command": "echo \\"test1\\""}',
        'ssh_exec {"sessionName": "double-prompt-test", "command": "echo \\"test2\\""}',
        'ssh_exec {"sessionName": "double-prompt-test", "command": "ls | head -3"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'double-prompt-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    console.log("=== RAW WEBSOCKET MESSAGES FOR BUG REPRODUCTION ===");
    console.log("Concatenated responses length:", result.concatenatedResponses.length);
    console.log("Raw content (first 1000 chars):", JSON.stringify(result.concatenatedResponses.substring(0, 1000)));

    // CRITICAL ASSERTION: Detect double prompt pattern
    const doublePromptPattern = /\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\]\$\s*\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\]\$/g;
    const doublePromptMatches = result.concatenatedResponses.match(doublePromptPattern);

    console.log("=== DOUBLE PROMPT DETECTION ===");
    console.log("Double prompt matches found:", doublePromptMatches?.length || 0);
    if (doublePromptMatches) {
      doublePromptMatches.forEach((match, index) => {
        console.log(`Double prompt ${index + 1}:`, JSON.stringify(match));
      });
    }

    // FAILING ASSERTION: This should fail if double prompts exist (reproducing the bug)
    expect(doublePromptMatches).toBeNull(); // This will fail and show us the double prompts
  }, 45000);

  /**
   * REPRODUCTION TEST 2: Command/output concatenation detection  
   * This test captures the exact concatenation behavior seen in browser
   */
  test("REPRODUCE BUG: Command/output concatenation with ls command", async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "concat-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "concat-test", "command": "ls | head -2"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'concat-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    console.log("=== COMMAND/OUTPUT CONCATENATION ANALYSIS ===");
    console.log("Raw WebSocket output (first 500 chars):", JSON.stringify(result.concatenatedResponses.substring(0, 500)));

    // DETECT CONCATENATION: Look for patterns like "lsApplications" or "echo "hello"hello"
    const concatenationPattern = /(ls[A-Za-z]|echo\s+"[^"]*"[^"\r\n])/g;
    const concatenationMatches = result.concatenatedResponses.match(concatenationPattern);

    console.log("Concatenation matches found:", concatenationMatches?.length || 0);
    if (concatenationMatches) {
      concatenationMatches.forEach((match, index) => {
        console.log(`Concatenation ${index + 1}:`, JSON.stringify(match));
      });
    }

    // LOOK FOR PROPER SEPARATION: Commands should be followed by CRLF before output
    const hasProperSeparation = /ls\r\n[A-Za-z]/.test(result.concatenatedResponses);
    console.log("Has proper command/output separation:", hasProperSeparation);

    // FAILING ASSERTION: This should pass if concatenation is fixed
    expect(concatenationMatches).toBeNull(); // This will fail if concatenation exists
    expect(hasProperSeparation).toBe(true); // This will fail if no proper separation
  }, 45000);

  /**
   * REPRODUCTION TEST 3: CRLF line ending validation
   * This test ensures WebSocket messages have proper CRLF for xterm.js compatibility
   */
  test("REPRODUCE BUG: Missing CRLF line endings validation", async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "crlf-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "crlf-test", "command": "echo \\"line1\\""}',
        'ssh_exec {"sessionName": "crlf-test", "command": "echo \\"line2\\""}'
      ],
      workflowTimeout: 30000,
      sessionName: 'crlf-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    console.log("=== CRLF LINE ENDING ANALYSIS ===");

    // DETAILED CRLF ANALYSIS
    const hasCRLF = result.concatenatedResponses.includes('\r\n');
    const hasLFOnly = result.concatenatedResponses.includes('\n') && !result.concatenatedResponses.includes('\r\n');
    const hasCROnly = result.concatenatedResponses.includes('\r') && !result.concatenatedResponses.includes('\n');

    console.log("Has CRLF (\\r\\n):", hasCRLF);
    console.log("Has LF only (\\n):", hasLFOnly);
    console.log("Has CR only (\\r):", hasCROnly);

    // Count line ending types
    const crlfCount = (result.concatenatedResponses.match(/\r\n/g) || []).length;
    const lfOnlyCount = (result.concatenatedResponses.match(/(?<!\r)\n/g) || []).length;

    console.log("CRLF count:", crlfCount);
    console.log("LF-only count:", lfOnlyCount);

    // CRITICAL ASSERTION: Should have CRLF for xterm.js compatibility
    expect(hasCRLF).toBe(true);
    expect(crlfCount).toBeGreaterThan(0);

    // Use framework assertion helpers
    testUtils.expectWebSocketMessages(result.concatenatedResponses)
      .toContainCRLF()
      .validate();
  }, 45000);

  /**
   * COMPREHENSIVE BUG REPRODUCTION TEST
   * This test captures all issues in one comprehensive scenario
   */
  test("COMPREHENSIVE: All terminal display bugs in one scenario", async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "comprehensive-bug-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "comprehensive-bug-test", "command": "pwd"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "comprehensive-bug-test", "command": "echo \\"hello\\""}',
        'ssh_exec {"sessionName": "comprehensive-bug-test", "command": "ls | head -2"}',
        'ssh_exec {"sessionName": "comprehensive-bug-test", "command": "whoami"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'comprehensive-bug-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    console.log("=== COMPREHENSIVE BUG ANALYSIS ===");
    console.log("Full WebSocket response length:", result.concatenatedResponses.length);
    
    // Save full output for detailed analysis
    console.log("=== FIRST 1500 CHARACTERS OF WEBSOCKET OUTPUT ===");
    console.log(JSON.stringify(result.concatenatedResponses.substring(0, 1500)));

    // VALIDATION 1: Double prompt detection
    const doublePromptMatches = result.concatenatedResponses.match(/\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\]\$\s*\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\]\$/g);
    console.log("🐛 Double prompt instances found:", doublePromptMatches?.length || 0);

    // VALIDATION 2: Command concatenation detection
    const concatenationMatches = result.concatenatedResponses.match(/(echo\s+"[^"]*"[^"\r\n]|ls[A-Za-z]|pwd[A-Za-z]|whoami[A-Za-z])/g);
    console.log("🐛 Command concatenation instances found:", concatenationMatches?.length || 0);

    // VALIDATION 3: CRLF presence
    const crlfCount = (result.concatenatedResponses.match(/\r\n/g) || []).length;
    console.log("✅ CRLF line endings found:", crlfCount);

    // Create comprehensive validation report
    const bugReport = {
      doublePrompts: doublePromptMatches?.length || 0,
      concatenationIssues: concatenationMatches?.length || 0, 
      crlfLineEndings: crlfCount,
      totalOutputLength: result.concatenatedResponses.length,
      hasProperLineEndings: result.concatenatedResponses.includes('\r\n')
    };

    console.log("=== COMPREHENSIVE BUG REPORT ===", bugReport);

    // EXPECTED BEHAVIOR ASSERTION: This defines what should happen after fix
    // These assertions will fail initially (reproducing bugs) and pass after fix
    expect(bugReport.doublePrompts).toBe(0); // No double prompts
    expect(bugReport.concatenationIssues).toBe(0); // No command/output concatenation
    expect(bugReport.crlfLineEndings).toBeGreaterThan(0); // Proper CRLF endings
    expect(bugReport.hasProperLineEndings).toBe(true); // CRLF compatibility

    // Framework validation using custom matchers
    expect(result.concatenatedResponses).toHaveValidTerminalHistory();
    expect(result.concatenatedResponses).toContainCRLFLineEndings();
  }, 45000);
});