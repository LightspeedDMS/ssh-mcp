/**
 * Custom Jest Matchers for Dynamic Expected Values
 * Implementation for AC 6.13, 6.14 - Jest integration and error diagnostics
 * 
 * Extends Jest with custom matchers for dynamic template and pattern matching.
 * Provides detailed error diagnostics with environment context.
 * 
 * CRITICAL: No mocks - uses real template resolution and environment values.
 */

import { DynamicExpectedValueConstructor } from './dynamic-expected-value-constructor';

// Global constructor instance for matchers
let globalConstructor: DynamicExpectedValueConstructor | null = null;

/**
 * Get or create global constructor instance
 */
function getConstructor(): DynamicExpectedValueConstructor {
  if (!globalConstructor) {
    globalConstructor = new DynamicExpectedValueConstructor();
  }
  return globalConstructor;
}

/**
 * Custom matcher for dynamic template matching
 * AC 6.13: Dynamic expected value integration with Jest matchers
 */
async function toMatchDynamicTemplate(this: jest.MatcherContext, received: string, template: string) {
  const constructor = getConstructor();
  
  try {
    const resolved = await constructor.resolveTemplate(template);
    const pass = received === resolved;

    if (pass) {
      return {
        message: () => `Expected output NOT to match dynamic template`,
        pass: true
      };
    } else {
      // AC 6.14: Assertion error diagnostics with dynamic values
      const environmentValues = await constructor.getEnvironmentValues();
      
      const message = () => {
        let errorMsg = `Expected output to match dynamic template\n\n`;
        errorMsg += `Template: ${template}\n`;
        errorMsg += `Resolved: ${resolved}\n`;
        errorMsg += `Actual:   ${received}\n\n`;
        
        // Show mismatch details
        errorMsg += `Mismatch detected:\n`;
        if (received.length !== resolved.length) {
          errorMsg += `  Length difference: expected ${resolved.length}, received ${received.length}\n`;
        }
        
        // Find first difference
        const minLength = Math.min(received.length, resolved.length);
        for (let i = 0; i < minLength; i++) {
          if (received[i] !== resolved[i]) {
            errorMsg += `  First difference at position ${i}: expected '${resolved[i]}', received '${received[i]}'\n`;
            break;
          }
        }
        
        // Environment context
        errorMsg += `\nEnvironment Context:\n`;
        errorMsg += `  USER: ${environmentValues.USER}\n`;
        errorMsg += `  HOSTNAME: ${environmentValues.HOSTNAME}\n`;
        errorMsg += `  PWD: ${environmentValues.PWD}\n`;
        errorMsg += `  HOME: ${environmentValues.HOME}\n`;
        
        return errorMsg;
      };

      return {
        message,
        pass: false
      };
    }
  } catch (error) {
    // Handle template resolution errors
    if (error instanceof Error && error.message.includes('Unknown template variable')) {
      const environmentValues = await constructor.getEnvironmentValues();
      const availableVars = Object.keys(environmentValues).join(', ');
      
      const message = () => {
        let errorMsg = `Template resolution failed: ${error instanceof Error ? error.message : String(error)}\n\n`;
        errorMsg += `Template: ${template}\n`;
        errorMsg += `Available variables: ${availableVars}\n\n`;
        errorMsg += `Guidance: Check that all variables in the template are defined.\n`;
        errorMsg += `Use one of the available variables or define custom variables in the constructor configuration.\n`;
        
        return errorMsg;
      };

      return {
        message,
        pass: false
      };
    } else {
      throw error;
    }
  }
}

/**
 * Custom matcher for dynamic pattern matching with regex support
 * AC 6.7: Volatile output handling with regex patterns
 */
async function toMatchDynamicPattern(this: jest.MatcherContext, received: string, pattern: string) {
  const constructor = getConstructor();
  
  try {
    let resolvedPattern = pattern;
    
    // Check if pattern contains template variables
    if (pattern.includes('${')) {
      resolvedPattern = await constructor.resolveTemplate(pattern);
    }
    
    // Handle regex patterns
    if (resolvedPattern.startsWith('${pattern:') && resolvedPattern.endsWith('}')) {
      const regexMatch = resolvedPattern.match(/\$\{pattern:(.+)\}/);
      if (regexMatch) {
        const regexStr = regexMatch[1];
        // Extract regex and flags
        const regexParts = regexStr.match(/^\/(.+)\/([gimuy]*)$/);
        if (regexParts) {
          const regex = new RegExp(regexParts[1], regexParts[2]);
          const pass = regex.test(received);
          
          if (pass) {
            return {
              message: () => `Expected output NOT to match dynamic pattern`,
              pass: true
            };
          } else {
            const message = () => {
              let errorMsg = `Expected output to match dynamic pattern\n\n`;
              errorMsg += `Pattern: ${pattern}\n`;
              errorMsg += `Resolved Pattern: ${regex}\n`;
              errorMsg += `Actual: ${received}\n\n`;
              errorMsg += `The output does not match the expected regex pattern.\n`;
              
              return errorMsg;
            };

            return {
              message,
              pass: false
            };
          }
        }
      }
    }
    
    // Standard string matching
    const pass = received === resolvedPattern;

    if (pass) {
      return {
        message: () => `Expected output NOT to match dynamic pattern`,
        pass: true
      };
    } else {
      const message = () => {
        let errorMsg = `Expected output to match dynamic pattern\n\n`;
        errorMsg += `Pattern: ${pattern}\n`;
        errorMsg += `Resolved: ${resolvedPattern}\n`;
        errorMsg += `Actual:   ${received}\n`;
        
        return errorMsg;
      };

      return {
        message,
        pass: false
      };
    }
  } catch (error) {
    throw new Error(`Pattern resolution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Enhanced terminal history matcher with dynamic support
 */
function toHaveValidTerminalHistory(this: jest.MatcherContext, received: string) {
  // Basic validation for terminal history format
  const hasCRLF = received.includes('\r\n');
  const hasPrompts = /\[[^@]+@[^@]+\s[^\]]+\]\$/.test(received);
  
  const pass = hasCRLF && hasPrompts;
  
  if (pass) {
    return {
      message: () => `Expected output NOT to have valid terminal history format`,
      pass: true
    };
  } else {
    const message = () => {
      let errorMsg = `Expected output to have valid terminal history format\n\n`;
      errorMsg += `Issues found:\n`;
      if (!hasCRLF) {
        errorMsg += `  - Missing CRLF line endings (\\r\\n)\n`;
      }
      if (!hasPrompts) {
        errorMsg += `  - Missing proper prompt format [user@host directory]$\n`;
      }
      errorMsg += `\nActual output:\n${received}\n`;
      
      return errorMsg;
    };

    return {
      message,
      pass: false
    };
  }
}

/**
 * CRLF line endings matcher
 */
function toContainCRLFLineEndings(this: jest.MatcherContext, received: string) {
  const pass = received.includes('\r\n');
  
  if (pass) {
    return {
      message: () => `Expected output NOT to contain CRLF line endings`,
      pass: true
    };
  } else {
    const message = () => {
      let errorMsg = `Expected output to contain CRLF line endings (\\r\\n)\n\n`;
      errorMsg += `CRLF line endings are required for xterm.js browser terminal compatibility.\n`;
      errorMsg += `Found line ending types:\n`;
      
      if (received.includes('\n')) {
        errorMsg += `  - LF (\\n) found\n`;
      }
      if (received.includes('\r')) {
        errorMsg += `  - CR (\\r) found\n`;
      }
      
      errorMsg += `\nActual output:\n${JSON.stringify(received)}\n`;
      
      return errorMsg;
    };

    return {
      message,
      pass: false
    };
  }
}

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchDynamicTemplate(template: string): Promise<R>;
      toMatchDynamicPattern(pattern: string): Promise<R>;
      toHaveValidTerminalHistory(): R;
      toContainCRLFLineEndings(): R;
    }
  }
}

// Register matchers with Jest
expect.extend({
  toMatchDynamicTemplate,
  toMatchDynamicPattern,
  toHaveValidTerminalHistory,
  toContainCRLFLineEndings
});

// Export for explicit imports
export {
  toMatchDynamicTemplate,
  toMatchDynamicPattern,
  toHaveValidTerminalHistory,
  toContainCRLFLineEndings
};