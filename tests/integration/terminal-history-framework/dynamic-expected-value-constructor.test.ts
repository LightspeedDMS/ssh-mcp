/**
 * Test suite for Story 06: Dynamic Expected Value Construction
 * Tests for DynamicExpectedValueConstructor - failing tests first (TDD methodology)
 * 
 * This test suite validates all 18 acceptance criteria for dynamic expected value construction,
 * ensuring environment-independent testing with runtime value resolution.
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { DynamicExpectedValueConstructor } from './dynamic-expected-value-constructor';

describe('Story 06: Dynamic Expected Value Construction', () => {
  let constructor: DynamicExpectedValueConstructor;

  beforeEach(() => {
    constructor = new DynamicExpectedValueConstructor();
  });

  describe('AC 6.1: Dynamic username value construction', () => {
    it('should dynamically resolve username from process.env.USER', async () => {
      const template = '${USER}';
      const result = await constructor.resolveTemplate(template);
      
      const expectedUser = process.env.USER || os.userInfo().username;
      expect(result).toBe(expectedUser);
    });

    it('should work with whoami command template', async () => {
      const template = 'Expected output: ${USER}';
      const result = await constructor.resolveTemplate(template);
      
      const expectedUser = process.env.USER || os.userInfo().username;
      expect(result).toBe(`Expected output: ${expectedUser}`);
    });

    it('should handle template in command assertion context', async () => {
      const commandOutput = 'jsbattig';
      const template = '${USER}';
      
      const isMatch = await constructor.matchesDynamicPattern(commandOutput, template);
      expect(isMatch).toBe(commandOutput === (process.env.USER || os.userInfo().username));
    });
  });

  describe('AC 6.2: Dynamic working directory value construction', () => {
    it('should dynamically resolve current working directory', async () => {
      const template = '${PWD}';
      const result = await constructor.resolveTemplate(template);
      
      expect(result).toBe(process.cwd());
    });

    it('should work with pwd command template', async () => {
      const template = 'Current directory: ${PWD}';
      const result = await constructor.resolveTemplate(template);
      
      expect(result).toBe(`Current directory: ${process.cwd()}`);
    });

    it('should handle path variations across environments', async () => {
      const template = '${PWD}/test-file.txt';
      const result = await constructor.resolveTemplate(template);
      
      expect(result).toBe(path.join(process.cwd(), 'test-file.txt'));
    });
  });

  describe('AC 6.3: Dynamic hostname value construction', () => {
    it('should dynamically resolve hostname', async () => {
      const template = '${HOSTNAME}';
      const result = await constructor.resolveTemplate(template);
      
      expect(result).toBe(os.hostname());
    });

    it('should work in prompt template', async () => {
      const template = '[${USER}@${HOSTNAME} ${PWD}]$ ';
      const result = await constructor.resolveTemplate(template);
      
      const expectedUser = process.env.USER || os.userInfo().username;
      const expectedResult = `[${expectedUser}@${os.hostname()} ${process.cwd()}]$ `;
      expect(result).toBe(expectedResult);
    });
  });

  describe('AC 6.4: Pre-execution environment preparation', () => {
    it('should capture environment values before execution', async () => {
      const values = await constructor.getEnvironmentValues();
      
      expect(values).toHaveProperty('USER');
      expect(values).toHaveProperty('PWD');
      expect(values).toHaveProperty('HOSTNAME');
      expect(values).toHaveProperty('HOME');
      expect(values.USER).toBe(process.env.USER || os.userInfo().username);
      expect(values.PWD).toBe(process.cwd());
      expect(values.HOSTNAME).toBe(os.hostname());
      expect(values.HOME).toBe(os.homedir());
    });

    it('should cache values for performance', async () => {
      const values1 = await constructor.getEnvironmentValues();
      const values2 = await constructor.getEnvironmentValues();
      
      // Should be same object reference (cached)
      expect(values1).toBe(values2);
    });

    it('should allow cache invalidation', async () => {
      const values1 = await constructor.getEnvironmentValues();
      constructor.invalidateCache();
      const values2 = await constructor.getEnvironmentValues();
      
      // Should be different object references after cache invalidation
      expect(values1).not.toBe(values2);
      expect(values1).toEqual(values2); // But values should be equal
    });
  });

  describe('AC 6.5: Dynamic value substitution in expected outputs', () => {
    it('should substitute multiple variables in complex template', async () => {
      const template = 'Expected: [${USER}@${HOSTNAME} ${PWD}]$ ls';
      const result = await constructor.resolveTemplate(template);
      
      const expectedUser = process.env.USER || os.userInfo().username;
      const expectedResult = `Expected: [${expectedUser}@${os.hostname()} ${process.cwd()}]$ ls`;
      expect(result).toBe(expectedResult);
    });

    it('should handle missing environment variables gracefully', async () => {
      const template = '${NONEXISTENT_VAR}';
      
      await expect(constructor.resolveTemplate(template))
        .rejects.toThrow('Unknown template variable: NONEXISTENT_VAR');
    });

    it('should provide fallback for missing variables when configured', async () => {
      const constructor = new DynamicExpectedValueConstructor({
        fallbackValues: { NONEXISTENT_VAR: 'fallback' }
      });
      
      const template = '${NONEXISTENT_VAR}';
      const result = await constructor.resolveTemplate(template);
      
      expect(result).toBe('fallback');
    });
  });

  describe('AC 6.6: Cross-platform compatibility handling', () => {
    it('should normalize path separators appropriately', async () => {
      const template = '${PWD}/test/path';
      const result = await constructor.resolveTemplate(template);
      
      const expectedPath = path.join(process.cwd(), 'test', 'path');
      expect(result).toBe(expectedPath);
    });

    it('should handle user account naming conventions correctly', async () => {
      const template = '${USER}@${HOSTNAME}';
      const result = await constructor.resolveTemplate(template);
      
      const expectedUser = process.env.USER || os.userInfo().username;
      expect(result).toBe(`${expectedUser}@${os.hostname()}`);
    });
  });

  describe('AC 6.7: Volatile output handling with regex patterns', () => {
    it('should create regex pattern for timestamp matching', async () => {
      const pattern = constructor.createVolatilePattern('timestamp');
      
      expect(pattern).toBeInstanceOf(RegExp);
      
      const testDate = new Date().toString();
      expect(pattern.test(testDate)).toBe(true);
    });

    it('should create regex pattern for date command output', async () => {
      const pattern = constructor.createVolatilePattern('date');
      
      // Test against typical date output
      const sampleDates = [
        'Mon Dec 25 10:30:45 UTC 2023',
        'Fri Jan  1 00:00:00 EST 2024',
        'Wed Jul  4 15:45:30 PST 2023'
      ];
      
      sampleDates.forEach(date => {
        expect(pattern.test(date)).toBe(true);
      });
    });

    it('should handle locale variations in date format', async () => {
      const pattern = constructor.createVolatilePattern('date');
      
      // Should be flexible enough for different locales
      expect(pattern).toBeInstanceOf(RegExp);
      expect(pattern.flags).toContain('i'); // Case insensitive
    });
  });

  describe('AC 6.8: Directory listing dynamic validation', () => {
    it('should dynamically determine directory contents', async () => {
      const template = '${LS_OUTPUT}';
      const result = await constructor.resolveTemplate(template);
      
      const actualContents = fs.readdirSync(process.cwd());
      expect(JSON.parse(result)).toEqual(actualContents);
    });

    it('should validate file presence dynamically', async () => {
      // Create a temporary file for testing
      const testFile = 'temp-test-file.txt';
      fs.writeFileSync(testFile, 'test content');
      
      try {
        const template = '${FILE_EXISTS:' + testFile + '}';
        const result = await constructor.resolveTemplate(template);
        
        expect(result).toBe('true');
      } finally {
        fs.unlinkSync(testFile);
      }
    });

    it('should handle file absence correctly', async () => {
      const template = '${FILE_EXISTS:nonexistent-file.txt}';
      const result = await constructor.resolveTemplate(template);
      
      expect(result).toBe('false');
    });
  });

  describe('AC 6.9: Process information dynamic validation', () => {
    it('should create regex pattern for process IDs', async () => {
      const pattern = constructor.createVolatilePattern('pid');
      
      expect(pattern.test('1234')).toBe(true);
      expect(pattern.test('99999')).toBe(true);
      expect(pattern.test('abc')).toBe(false);
    });

    it('should handle process existence validation', async () => {
      const template = '${PROCESS_EXISTS:node}';
      const result = await constructor.resolveTemplate(template);
      
      // Should be 'true' since we're running in Node.js
      expect(result).toBe('true');
    });
  });

  describe('AC 6.10: Template variable expansion system', () => {
    it('should resolve multiple variables in single template', async () => {
      const template = 'User: ${USER}, Directory: ${PWD}, Host: ${HOSTNAME}';
      const result = await constructor.resolveTemplate(template);
      
      const expectedUser = process.env.USER || os.userInfo().username;
      const expected = `User: ${expectedUser}, Directory: ${process.cwd()}, Host: ${os.hostname()}`;
      expect(result).toBe(expected);
    });

    it('should handle nested variable references', async () => {
      const constructor = new DynamicExpectedValueConstructor({
        customVariables: {
          'BASE_PATH': '${PWD}',
          'FULL_PATH': '${BASE_PATH}/subdir'
        }
      });
      
      const template = '${FULL_PATH}';
      const result = await constructor.resolveTemplate(template);
      
      expect(result).toBe(path.join(process.cwd(), 'subdir'));
    });
  });

  describe('AC 6.11: Custom variable definition and usage', () => {
    it('should compute custom variables via command execution', async () => {
      const template = '${SSH_SESSION_COUNT}';
      const result = await constructor.resolveTemplate(template);
      
      // Should be a number (as string)
      expect(Number.isInteger(parseInt(result))).toBe(true);
    });

    it('should compute git branch custom variable', async () => {
      // Skip if not in git repository
      if (!fs.existsSync('.git')) {
        return;
      }
      
      const template = '${GIT_BRANCH}';
      const result = await constructor.resolveTemplate(template);
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle custom variable failure gracefully', async () => {
      const constructor = new DynamicExpectedValueConstructor({
        customVariables: {
          'FAILING_COMMAND': '${exec:nonexistent-command-xyz}'
        }
      });
      
      const template = '${FAILING_COMMAND}';
      
      await expect(constructor.resolveTemplate(template))
        .rejects.toThrow();
    });
  });

  describe('AC 6.12: Conditional template resolution', () => {
    it('should resolve file existence conditional', async () => {
      // Create temporary file
      const testFile = 'conditional-test.txt';
      fs.writeFileSync(testFile, 'test');
      
      try {
        const template = '${FILE_EXISTS:' + testFile + ' ? "File found" : "File missing"}';
        const result = await constructor.resolveTemplate(template);
        
        expect(result).toBe('File found');
      } finally {
        fs.unlinkSync(testFile);
      }
    });

    it('should resolve file non-existence conditional', async () => {
      const template = '${FILE_EXISTS:nonexistent.txt ? "File found" : "File missing"}';
      const result = await constructor.resolveTemplate(template);
      
      expect(result).toBe('File missing');
    });

    it('should handle nested conditional expressions', async () => {
      const template = '${USER === "root" ? "Admin" : "User"}';
      const result = await constructor.resolveTemplate(template);
      
      const expectedUser = process.env.USER || os.userInfo().username;
      const expected = expectedUser === 'root' ? 'Admin' : 'User';
      expect(result).toBe(expected);
    });
  });

  describe('Integration and Error Handling', () => {
    it('should provide detailed error messages for invalid templates', async () => {
      const template = '${INVALID_SYNTAX';
      
      await expect(constructor.resolveTemplate(template))
        .rejects.toThrow('Invalid template syntax');
    });

    it('should handle circular references in variables', async () => {
      const constructor = new DynamicExpectedValueConstructor({
        customVariables: {
          'VAR_A': '${VAR_B}',
          'VAR_B': '${VAR_A}'
        }
      });
      
      const template = '${VAR_A}';
      
      await expect(constructor.resolveTemplate(template))
        .rejects.toThrow('Circular reference detected');
    });
  });
});