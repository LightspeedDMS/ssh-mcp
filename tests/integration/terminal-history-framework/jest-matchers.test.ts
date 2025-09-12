/**
 * Test suite for Custom Jest Matchers
 * Tests for AC 6.13, 6.14 - Jest integration and error diagnostics
 * 
 * TDD methodology: Failing tests first for custom matchers
 */

import './jest-matchers'; // Load custom matchers
// import { DynamicExpectedValueConstructor } from './dynamic-expected-value-constructor';

// Extend Jest matchers interface for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchDynamicTemplate(template: string): R;
      toMatchDynamicPattern(pattern: string): R;
      toHaveValidTerminalHistory(): R;
      toContainCRLFLineEndings(): R;
    }
  }
}

describe('Custom Jest Matchers for Dynamic Expected Values', () => {
  // let constructor: DynamicExpectedValueConstructor;

  beforeAll(() => {
    // constructor = new DynamicExpectedValueConstructor();
  });

  describe('AC 6.13: toMatchDynamicTemplate matcher', () => {
    it('should match simple dynamic template', async () => {
      const currentUser = process.env.USER || require('os').userInfo().username;
      const actualOutput = currentUser;
      const template = '${USER}';

      expect(actualOutput).toMatchDynamicTemplate(template);
    });

    it('should match complex prompt template', async () => {
      const currentUser = process.env.USER || require('os').userInfo().username;
      const currentHost = require('os').hostname();
      const currentDir = process.cwd();
      
      const actualOutput = `[${currentUser}@${currentHost} ${currentDir}]$ `;
      const template = '[${USER}@${HOSTNAME} ${PWD}]$ ';

      expect(actualOutput).toMatchDynamicTemplate(template);
    });

    it('should fail when template does not match', async () => {
      const actualOutput = 'different_user';
      const template = '${USER}';

      expect(() => {
        expect(actualOutput).toMatchDynamicTemplate(template);
      }).toThrow('Expected output to match dynamic template');
    });

    it('should provide clear error messages with resolved values', async () => {
      const actualOutput = 'wrong_output';
      const template = '${USER}@${HOSTNAME}';

      try {
        expect(actualOutput).toMatchDynamicTemplate(template);
        fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain('Template:');
        expect(errorMessage).toContain('Resolved:');
        expect(errorMessage).toContain('Actual:');
        expect(errorMessage).toContain('wrong_output');
      }
    });

    it('should handle templates with arrays', async () => {
      const currentDir = process.cwd();
      const files = require('fs').readdirSync(currentDir);
      const actualOutput = JSON.stringify(files);
      const template = '${LS_OUTPUT}';

      expect(actualOutput).toMatchDynamicTemplate(template);
    });

    it('should support custom variables in templates', async () => {
      const actualOutput = 'custom_value_test';
      const template = '${CUSTOM_VAR}_test';

      // This should fail since CUSTOM_VAR is not defined
      expect(() => {
        expect(actualOutput).toMatchDynamicTemplate(template);
      }).toThrow('Unknown template variable');
    });
  });

  describe('AC 6.14: toMatchDynamicPattern matcher with regex', () => {
    it('should match volatile timestamp patterns', async () => {
      const actualOutput = 'Mon Dec 25 10:30:45 UTC 2023';
      const pattern = '${pattern:/\\w{3} \\w{3}\\s+\\d{1,2} \\d{2}:\\d{2}:\\d{2} \\w{3} \\d{4}/}';

      expect(actualOutput).toMatchDynamicPattern(pattern);
    });

    it('should match date command output patterns', async () => {
      const actualOutput = 'Fri Jan  1 00:00:00 EST 2024';
      const pattern = '${pattern:/\\w{3} \\w{3}\\s+\\d{1,2} \\d{2}:\\d{2}:\\d{2} \\w{3} \\d{4}/}';

      expect(actualOutput).toMatchDynamicPattern(pattern);
    });

    it('should match process ID patterns', async () => {
      const actualOutput = 'Process ID: 12345';
      const pattern = 'Process ID: ${pattern:/\\d+/}';

      expect(actualOutput).toMatchDynamicPattern(pattern);
    });

    it('should fail when pattern does not match', async () => {
      const actualOutput = 'Invalid date format';
      const pattern = '${pattern:/\\w{3} \\w{3}\\s+\\d{1,2} \\d{2}:\\d{2}:\\d{2} \\w{3} \\d{4}/}';

      expect(() => {
        expect(actualOutput).toMatchDynamicPattern(pattern);
      }).toThrow('Expected output to match dynamic pattern');
    });

    it('should provide detailed error messages for pattern failures', async () => {
      const actualOutput = 'wrong format';
      const pattern = 'Expected format: ${pattern:/\\d{4}-\\d{2}-\\d{2}/}';

      try {
        expect(actualOutput).toMatchDynamicPattern(pattern);
        fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain('Pattern:');
        expect(errorMessage).toContain('Resolved Pattern:');
        expect(errorMessage).toContain('Actual:');
        expect(errorMessage).toContain('wrong format');
      }
    });

    it('should handle mixed template and pattern syntax', async () => {
      const currentUser = process.env.USER || require('os').userInfo().username;
      const actualOutput = `User ${currentUser} logged in at 10:30:45`;
      const pattern = 'User ${USER} logged in at ${pattern:/\\d{2}:\\d{2}:\\d{2}/}';

      expect(actualOutput).toMatchDynamicPattern(pattern);
    });
  });

  describe('AC 6.14: Error diagnostics with environmental context', () => {
    it('should include environment context in error messages', async () => {
      const actualOutput = 'unexpected_output';
      const template = 'Expected: ${USER}@${HOSTNAME}';

      try {
        expect(actualOutput).toMatchDynamicTemplate(template);
        fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain('Environment Context:');
        expect(errorMessage).toContain('USER:');
        expect(errorMessage).toContain('HOSTNAME:');
        expect(errorMessage).toContain('PWD:');
      }
    });

    it('should highlight specific mismatches', async () => {
      const actualOutput = 'wrong_user@correct_host';
      const template = '${USER}@${HOSTNAME}';

      try {
        expect(actualOutput).toMatchDynamicTemplate(template);
        fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain('Mismatch detected');
        expect(errorMessage).toContain('wrong_user');
      }
    });

    it('should provide guidance for fixing templates', async () => {
      const actualOutput = 'some output';
      const template = '${NONEXISTENT_VAR}';

      try {
        expect(actualOutput).toMatchDynamicTemplate(template);
        fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain('Unknown template variable');
        expect(errorMessage).toContain('Available variables:');
      }
    });

    it('should show available template variables in error', async () => {
      const actualOutput = 'test';
      const template = '${UNKNOWN}';

      try {
        expect(actualOutput).toMatchDynamicTemplate(template);
        fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain('USER');
        expect(errorMessage).toContain('PWD');
        expect(errorMessage).toContain('HOSTNAME');
        expect(errorMessage).toContain('HOME');
      }
    });
  });

  describe('Integration with existing terminal history matchers', () => {
    it('should work alongside toHaveValidTerminalHistory', async () => {
      const terminalOutput = `[${process.env.USER || require('os').userInfo().username}@${require('os').hostname()} ${process.cwd()}]$ pwd\r\n${process.cwd()}\r\n[${process.env.USER || require('os').userInfo().username}@${require('os').hostname()} ${process.cwd()}]$ `;

      expect(terminalOutput).toHaveValidTerminalHistory();
      expect(terminalOutput).toMatchDynamicPattern('[${USER}@${HOSTNAME} ${PWD}]$ pwd\\r\\n${PWD}\\r\\n[${USER}@${HOSTNAME} ${PWD}]$ ');
    });

    it('should work alongside toContainCRLFLineEndings', async () => {
      const terminalOutput = 'Line 1\r\nLine 2\r\nLine 3\r\n';

      expect(terminalOutput).toContainCRLFLineEndings();
      expect(terminalOutput).toMatchDynamicPattern('Line 1\\r\\nLine 2\\r\\nLine 3\\r\\n');
    });

    it('should support chaining with other matchers', async () => {
      const terminalOutput = `Command output: ${process.cwd()}\r\nSecond line\r\n`;
      
      expect(terminalOutput).toContainCRLFLineEndings();
      expect(terminalOutput).toMatchDynamicTemplate('Command output: ${PWD}\r\nSecond line\r\n');
    });
  });

  describe('Performance considerations for matchers', () => {
    it('should resolve templates efficiently for large outputs', async () => {
      const largeOutput = Array(1000).fill(`User: ${process.env.USER || require('os').userInfo().username}`).join('\n');
      const template = Array(1000).fill('User: ${USER}').join('\n');

      const startTime = Date.now();
      expect(largeOutput).toMatchDynamicTemplate(template);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should cache template resolution for repeated use', async () => {
      const actualOutput = process.env.USER || require('os').userInfo().username;
      const template = '${USER}';

      // First call
      const startTime1 = Date.now();
      expect(actualOutput).toMatchDynamicTemplate(template);
      const duration1 = Date.now() - startTime1;

      // Second call should be faster due to caching
      const startTime2 = Date.now();
      expect(actualOutput).toMatchDynamicTemplate(template);
      const duration2 = Date.now() - startTime2;

      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });

  describe('Cross-platform compatibility in matchers', () => {
    it('should handle Windows path separators in templates', async () => {
      const template = '${PWD}';
      const actualOutput = process.cwd();

      expect(actualOutput).toMatchDynamicTemplate(template);
    });

    it('should handle different username formats across platforms', async () => {
      const actualOutput = process.env.USER || require('os').userInfo().username;
      const template = '${USER}';

      expect(actualOutput).toMatchDynamicTemplate(template);
    });

    it('should handle hostname variations', async () => {
      const actualOutput = require('os').hostname();
      const template = '${HOSTNAME}';

      expect(actualOutput).toMatchDynamicTemplate(template);
    });
  });
});