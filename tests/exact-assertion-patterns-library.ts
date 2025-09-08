/**
 * EXACT ASSERTION PATTERNS LIBRARY
 * 
 * This library solves the critical challenge of implementing TRUE exact assertions
 * (using only toBe()) for non-deterministic terminal output that varies between
 * double prompts, triple prompts, and other patterns.
 * 
 * APPROACH: Define all valid complete output patterns and use toBe() with OR logic
 * USER REQUIREMENT: "assertions expecting the EXACT output, not just finding one piece of text here and there, the entire text to be returned"
 */

import { TestEnvironmentConfig } from './test-environment-config';

export class ExactAssertionPatterns {
  
  /**
   * Validates entire output against known valid patterns using only toBe()
   * This meets the user requirement for EXACT output validation
   */
  static validateCompleteOutput(actualOutput: string, commandType: string, command?: string): void {
    const patterns = this.getValidPatternsForCommand(commandType, command);
    
    // Try each valid pattern with toBe() - this is TRUE exact assertion
    let matchFound = false;
    let lastError = '';
    
    for (const pattern of patterns) {
      try {
        expect(actualOutput).toBe(pattern);
        matchFound = true;
        console.log(`✅ EXACT ASSERTION PASSED: Command '${commandType}' matches valid pattern`);
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        continue;
      }
    }
    
    if (!matchFound) {
      console.log(`❌ EXACT ASSERTION FAILED: No valid pattern matched`);
      console.log(`📋 Actual output:`, JSON.stringify(actualOutput));
      console.log(`📋 Valid patterns for '${commandType}':`);
      patterns.forEach((pattern, i) => {
        console.log(`   Pattern ${i + 1}:`, JSON.stringify(pattern));
      });
      console.log(`📋 Last error:`, lastError);
      
      // Fail with clear message - this maintains toBe() requirement
      expect(actualOutput).toBe(patterns[0]); // Will show diff with first pattern
    }
  }
  
  /**
   * Get all valid complete output patterns for a specific command
   * Based on observed non-deterministic behavior from actual terminal testing
   */
  private static getValidPatternsForCommand(commandType: string, command?: string): string[] {
    const username = TestEnvironmentConfig.getTestUsername();
    const homeDir = TestEnvironmentConfig.getTestHomeDirectory();
    const prompt = TestEnvironmentConfig.getExpectedPrompt();
    
    switch (commandType.toLowerCase()) {
      case 'whoami':
        return [
          // ONLY PERFECT BEHAVIOR: Single prompt + command + result + final prompt (NO COMMAND ECHO)
          `${prompt} whoami\r\n${username}\r\n${prompt} `
        ];
        
      case 'pwd':
        return [
          // ONLY PERFECT BEHAVIOR: Single prompt + command + result + final prompt (NO COMMAND ECHO)
          `${prompt} pwd\r\n${homeDir}\r\n${prompt} `
        ];
        
      case 'echo':
        if (command === 'echo test') {
          return [
            // ONLY PERFECT BEHAVIOR: Single prompt + command + result + final prompt (NO COMMAND ECHO)
            `${prompt} echo test\r\ntest\r\n${prompt} `
          ];
        } else if (command === 'echo "testing terminal fix"') {
          return [
            // ONLY PERFECT BEHAVIOR: Single prompt + command + result + final prompt (NO COMMAND ECHO)
            `${prompt} echo "testing terminal fix"\r\ntesting terminal fix\r\n${prompt} `
          ];
        } else if (command && command.includes('echo')) {
          // Generic echo command pattern
          const echoResult = command.replace(/echo\s+["']?([^"']*)["']?/, '$1');
          return [
            // ONLY PERFECT BEHAVIOR: Single prompt + command + result + final prompt (NO COMMAND ECHO)
            `${prompt} ${command}\r\n${echoResult}\r\n${prompt} `
          ];
        }
        return [];
        
      case 'multi-command':
        return [
          // ONLY PERFECT BEHAVIOR - whoami + pwd sequence (NO COMMAND ECHOES, NO DOUBLE PROMPTS)
          `${prompt} whoami\r\n${username}\r\n${prompt} pwd\r\n${homeDir}\r\n${prompt} `,
          // ONLY PERFECT BEHAVIOR - pwd + whoami sequence (NO COMMAND ECHOES, NO DOUBLE PROMPTS) - for post-WebSocket test
          `${prompt} pwd\r\n${homeDir}\r\n${prompt} whoami\r\n${username}\r\n${prompt} `,
          // ONLY PERFECT BEHAVIOR - pwd + whoami + echo stable-output sequence (NO COMMAND ECHOES, NO DOUBLE PROMPTS)  
          `${prompt} pwd\r\n${homeDir}\r\n${prompt} whoami\r\n${username}\r\n${prompt} echo stable-output\r\nstable-output\r\n${prompt} `,
          // ONLY PERFECT BEHAVIOR - pwd + whoami + echo test sequence (matches terminal-history-validation test)
          `${prompt} pwd\r\n${homeDir}\r\n${prompt} whoami\r\n${username}\r\n${prompt} echo test\r\ntest\r\n${prompt} `
        ];
        
      case 'ls':
        return [
          // SPECIAL CASE: ls output is variable, so we validate prefix pattern only
          // ONLY PERFECT BEHAVIOR: Single prompt + command + results + final prompt (NO COMMAND ECHO)
          `${prompt} ls\r\n` // Partial pattern - ls results vary by directory
        ];
        
      default:
        throw new Error(`No patterns defined for command type: ${commandType}`);
    }
  }
  
  /**
   * Alternative approach: Create exact assertion with custom error messages
   * This still uses toBe() but provides better diagnostics
   */
  static assertExactOutput(actualOutput: string, expectedPatterns: string[], commandType: string): void {
    for (let i = 0; i < expectedPatterns.length; i++) {
      try {
        expect(actualOutput).toBe(expectedPatterns[i]);
        console.log(`✅ EXACT ASSERTION PASSED: Pattern ${i + 1} matched for ${commandType}`);
        return; // Success - exit early
      } catch (error) {
        // Continue trying other patterns
        continue;
      }
    }
    
    // All patterns failed - provide detailed failure info
    console.log(`❌ EXACT ASSERTION FAILED: No valid pattern matched for ${commandType}`);
    console.log(`📋 Actual (length ${actualOutput.length}):`, JSON.stringify(actualOutput));
    console.log(`📋 Expected patterns (${expectedPatterns.length}):`);
    expectedPatterns.forEach((pattern, i) => {
      console.log(`   ${i + 1}. (length ${pattern.length}):`, JSON.stringify(pattern));
    });
    
    // Final assertion that will fail with clear diff
    expect(actualOutput).toBe(expectedPatterns[0]);
  }
}

/**
 * USAGE EXAMPLES:
 * 
 * // Replace partial matching assertions like toContain(), toMatch()
 * ExactAssertionPatterns.validateCompleteOutput(result.concatenatedResponses, 'whoami');
 * 
 * // For custom commands
 * ExactAssertionPatterns.validateCompleteOutput(result.concatenatedResponses, 'echo', 'echo test');
 * 
 * // Multi-command sequences  
 * ExactAssertionPatterns.validateCompleteOutput(result.concatenatedResponses, 'multi-command');
 */