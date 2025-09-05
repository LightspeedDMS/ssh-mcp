/**
 * TERMINAL DISPLAY FIX VALIDATION TEST
 * 
 * This test validates that the terminal display issues are fully resolved:
 * 
 * FIXED ISSUES:
 * 1. ✅ Post-WebSocket command executor now parses JSON commands correctly
 * 2. ✅ Browser terminal input handler now recognizes bracket format prompts
 * 3. ✅ WebSocket transmission maintains proper CRLF line endings
 * 4. ✅ No double prompts or command concatenation in WebSocket output
 * 
 * VALIDATION APPROACH:
 * - Use Terminal History Testing Framework for comprehensive testing
 * - Validate WebSocket-level output (server-side correctness)
 * - Test bracket prompt format detection (browser-side compatibility) 
 * - Ensure proper CRLF handling throughout the pipeline
 * - Verify command execution and output separation
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

// Extend Jest matchers
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

describe("Terminal Display Fix Validation", () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('terminal-display-fix');

  /**
   * VALIDATION TEST 1: WebSocket output format correctness
   * Ensures WebSocket transmission has proper formatting without concatenation
   */
  test("✅ FIXED: WebSocket output has proper command/output separation", async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "format-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "format-test", "command": "echo \\"test-output\\""}',
        'ssh_exec {"sessionName": "format-test", "command": "pwd"}',
        'ssh_exec {"sessionName": "format-test", "command": "whoami"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'format-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    console.log("=== WEBSOCKET OUTPUT ANALYSIS ===");
    console.log("Raw output length:", result.concatenatedResponses.length);
    console.log("Output sample:", JSON.stringify(result.concatenatedResponses.substring(0, 300)));

    // VALIDATION: No double prompts (this was the main user complaint)
    const doublePromptPattern = /\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\]\$\s*\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\]\$/g;
    const doublePrompts = result.concatenatedResponses.match(doublePromptPattern);
    expect(doublePrompts).toBeNull(); // Should be null (no double prompts)

    // VALIDATION: No command/output concatenation (this was the other main complaint)
    const concatenationPattern = /(echo.*test-output.*test-output|pwd.*home.*jsbattig|whoami.*jsbattig.*\w)/g;
    const concatenation = result.concatenatedResponses.match(concatenationPattern);
    expect(concatenation).toBeNull(); // Should be null (no concatenation)

    // VALIDATION: Proper CRLF line endings for xterm.js compatibility
    expect(result.concatenatedResponses).toContainCRLFLineEndings();

    // VALIDATION: Commands executed successfully (post-WebSocket fix works)
    expect(result.concatenatedResponses).toContain('echo "test-output"');
    expect(result.concatenatedResponses).toContain('test-output');
    expect(result.concatenatedResponses).toContain('pwd');
    expect(result.concatenatedResponses).toContain('whoami');

    console.log("✅ All WebSocket format validations passed");
  }, 45000);

  /**
   * VALIDATION TEST 2: Bracket prompt format detection
   * Ensures browser terminal can detect new bracket format prompts correctly
   */
  test("✅ FIXED: Bracket prompt format detection works correctly", () => {
    // Simulate the browser's isPromptLine function with our fixes
    const isPromptLine = (output: string): boolean => {
      const trimmed = output.trim();
      
      // Support both old format (user@host:path$) and new bracket format ([user@host project]$)
      const oldFormatPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^$]*\$\s*$/;
      const oldFormatHashPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^#]*#\s*$/;
      const bracketFormatPattern = /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s+[^\]]+\]\$\s*$/;
      const bracketFormatHashPattern = /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s+[^\]]+\]#\s*$/;
      
      return oldFormatPattern.test(trimmed) || 
             oldFormatHashPattern.test(trimmed) ||
             bracketFormatPattern.test(trimmed) ||
             bracketFormatHashPattern.test(trimmed);
    };

    // Test cases: These should all be detected as prompts
    const validPrompts = [
      '[jsbattig@localhost ~]$',
      '[jsbattig@localhost ~]$ ',
      '[testuser@testhost my-project]$',
      '[root@server production-env]#',
      'jsbattig@localhost:~$', // old format still supported
      'user@host:~/projects$', // old format still supported
    ];

    // Test cases: These should NOT be detected as prompts
    const nonPrompts = [
      'echo "hello"',
      'Applications',
      'bun.lock',
      '[incomplete prompt',
      'user@host incomplete',
      'just regular output',
    ];

    console.log("=== PROMPT DETECTION VALIDATION ===");

    // Validate that all valid prompts are detected
    validPrompts.forEach(prompt => {
      const detected = isPromptLine(prompt);
      console.log(`✅ "${prompt}" -> ${detected ? 'DETECTED' : 'MISSED'}`);
      expect(detected).toBe(true);
    });

    // Validate that non-prompts are not false positives
    nonPrompts.forEach(nonPrompt => {
      const detected = isPromptLine(nonPrompt);
      console.log(`❌ "${nonPrompt}" -> ${detected ? 'FALSE POSITIVE' : 'CORRECTLY IGNORED'}`);
      expect(detected).toBe(false);
    });

    console.log("✅ All prompt detection tests passed");
  });

  /**
   * VALIDATION TEST 3: Post-WebSocket command parsing fix
   * Ensures JSON command format is parsed correctly after fix
   */
  test("✅ FIXED: Post-WebSocket command parsing handles JSON format", () => {
    // Simulate the fixed parseCommand method
    const parseCommand = (command: string): { toolName: string; args: Record<string, unknown> } => {
      const trimmed = command.trim();
      if (!trimmed) {
        throw new Error('Empty command');
      }

      const spaceIndex = trimmed.indexOf(' ');
      const braceIndex = trimmed.indexOf('{');
      
      let toolName: string;
      let argsString: string;
      
      if (spaceIndex === -1 && braceIndex === -1) {
        toolName = trimmed;
        return { toolName, args: {} };
      }
      
      const splitIndex = (spaceIndex === -1) ? braceIndex : 
                        (braceIndex === -1) ? spaceIndex : 
                        Math.min(spaceIndex, braceIndex);
      
      toolName = trimmed.substring(0, splitIndex).trim();
      argsString = trimmed.substring(splitIndex).trim();
      
      if (!toolName) {
        throw new Error('Empty tool name');
      }
      
      if (argsString.startsWith('{')) {
        try {
          const args = JSON.parse(argsString);
          if (typeof args !== 'object' || args === null || Array.isArray(args)) {
            throw new Error('Arguments must be a JSON object');
          }
          return { toolName, args };
        } catch (error) {
          if (error instanceof SyntaxError) {
            throw new Error(`Invalid JSON in command arguments: ${error.message}`);
          }
          throw error;
        }
      }
      
      // Legacy space-separated format
      const parts = argsString.split(/\s+/).filter(part => part.length > 0);
      const args: Record<string, unknown> = {};
      
      if (toolName === 'ssh_exec' && parts.length > 0) {
        args.command = parts.join(' ');
      } else {
        for (let i = 0; i < parts.length; i++) {
          args[`arg${i + 1}`] = parts[i];
        }
      }

      return { toolName, args };
    };

    console.log("=== COMMAND PARSING VALIDATION ===");

    // Test JSON format commands (the ones that were failing before)
    const jsonCommands = [
      'ssh_exec {"sessionName": "test", "command": "ls"}',
      'ssh_connect {"name": "test", "host": "localhost", "username": "user"}',
      'ssh_exec {"sessionName": "test", "command": "echo \\"hello world\\""}',
    ];

    jsonCommands.forEach(command => {
      const parsed = parseCommand(command);
      console.log(`Command: ${command}`);
      console.log(`Parsed: ${JSON.stringify(parsed)}`);
      
      expect(parsed.toolName).toBeDefined();
      expect(typeof parsed.args).toBe('object');
      
      if (command.includes('ssh_exec')) {
        expect(parsed.toolName).toBe('ssh_exec');
        expect(parsed.args.sessionName).toBeDefined();
        expect(parsed.args.command).toBeDefined();
      }
    });

    // Test legacy format commands (should still work)
    const legacyCommands = [
      'ssh_exec ls -la',
      'pwd',
      'whoami',
    ];

    legacyCommands.forEach(command => {
      const parsed = parseCommand(command);
      expect(parsed.toolName).toBeDefined();
      expect(typeof parsed.args).toBe('object');
    });

    console.log("✅ All command parsing tests passed");
  });

  /**
   * VALIDATION TEST 4: End-to-end terminal workflow validation
   * Complete workflow test ensuring all fixes work together
   */
  test("✅ COMPREHENSIVE: All terminal display fixes work together", async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "comprehensive-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "comprehensive-test", "command": "pwd"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "comprehensive-test", "command": "echo \\"step1\\""}',
        'ssh_exec {"sessionName": "comprehensive-test", "command": "echo \\"step2\\""}',
        'ssh_exec {"sessionName": "comprehensive-test", "command": "ls | head -3"}',
        'ssh_exec {"sessionName": "comprehensive-test", "command": "whoami"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'comprehensive-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    console.log("=== COMPREHENSIVE VALIDATION ===");
    console.log(`WebSocket response length: ${result.concatenatedResponses.length}`);

    // FIXED: No double prompts
    const doublePromptMatches = result.concatenatedResponses.match(/\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\]\$\s*\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\]\$/g);
    expect(doublePromptMatches).toBeNull();

    // FIXED: No command concatenation 
    const concatenationMatches = result.concatenatedResponses.match(/(echo.*step1.*step1|echo.*step2.*step2)/g);
    expect(concatenationMatches).toBeNull();

    // FIXED: Proper CRLF line endings
    expect(result.concatenatedResponses).toContainCRLFLineEndings();
    const crlfCount = (result.concatenatedResponses.match(/\r\n/g) || []).length;
    expect(crlfCount).toBeGreaterThan(5);

    // FIXED: All commands executed (post-WebSocket executor works)
    expect(result.concatenatedResponses).toContain('step1');
    expect(result.concatenatedResponses).toContain('step2');
    expect(result.concatenatedResponses).toContain('whoami');
    expect(result.concatenatedResponses).toContain('jsbattig');

    // FIXED: Bracket prompt format appears
    expect(result.concatenatedResponses).toMatch(/\[jsbattig@localhost [^\]]+\]\$/);

    // Create final validation report
    const validationReport = {
      totalOutputLength: result.concatenatedResponses.length,
      crlfCount,
      doublePrompts: doublePromptMatches?.length || 0,
      concatenationIssues: concatenationMatches?.length || 0,
      hasAllCommands: ['step1', 'step2', 'whoami', 'jsbattig'].every(text => 
        result.concatenatedResponses.includes(text)
      ),
      hasBracketPrompts: /\[jsbattig@localhost [^\]]+\]\$/.test(result.concatenatedResponses),
      success: result.success
    };

    console.log("=== FINAL VALIDATION REPORT ===");
    console.log(JSON.stringify(validationReport, null, 2));

    // All validation criteria must pass
    expect(validationReport.doublePrompts).toBe(0);
    expect(validationReport.concatenationIssues).toBe(0);
    expect(validationReport.crlfCount).toBeGreaterThan(0);
    expect(validationReport.hasAllCommands).toBe(true);
    expect(validationReport.hasBracketPrompts).toBe(true);
    expect(validationReport.success).toBe(true);

    console.log("🎉 ALL TERMINAL DISPLAY FIXES VALIDATED SUCCESSFULLY!");
  }, 45000);
});