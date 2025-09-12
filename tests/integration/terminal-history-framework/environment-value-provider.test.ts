/**
 * Test suite for EnvironmentValueProvider
 * Tests for AC 6.4, 6.15 - Environment preparation and performance optimization
 * 
 * TDD methodology: Failing tests first for environment value collection and caching
 */

import * as os from 'os';
import * as fs from 'fs';
import { EnvironmentValueProvider } from './environment-value-provider';

describe('EnvironmentValueProvider', () => {
  let provider: EnvironmentValueProvider;

  beforeEach(() => {
    provider = new EnvironmentValueProvider();
  });

  describe('Basic Environment Value Collection', () => {
    it('should collect all standard environment values', async () => {
      const values = await provider.getValues();
      
      expect(values).toHaveProperty('USER');
      expect(values).toHaveProperty('PWD');
      expect(values).toHaveProperty('HOSTNAME');
      expect(values).toHaveProperty('HOME');
      expect(values).toHaveProperty('LS_OUTPUT');
      expect(values).toHaveProperty('TIMESTAMP');
      
      expect(typeof values.USER).toBe('string');
      expect(typeof values.PWD).toBe('string');
      expect(typeof values.HOSTNAME).toBe('string');
      expect(typeof values.HOME).toBe('string');
      expect(Array.isArray(values.LS_OUTPUT)).toBe(true);
      expect(typeof values.TIMESTAMP).toBe('string');
    });

    it('should resolve USER correctly from environment or os.userInfo', async () => {
      const values = await provider.getValues();
      const expected = process.env.USER || os.userInfo().username;
      
      expect(values.USER).toBe(expected);
    });

    it('should resolve PWD as current working directory', async () => {
      const values = await provider.getValues();
      
      expect(values.PWD).toBe(process.cwd());
    });

    it('should resolve HOSTNAME from os.hostname()', async () => {
      const values = await provider.getValues();
      
      expect(values.HOSTNAME).toBe(os.hostname());
    });

    it('should resolve HOME from os.homedir()', async () => {
      const values = await provider.getValues();
      
      expect(values.HOME).toBe(os.homedir());
    });

    it('should provide directory listing in LS_OUTPUT', async () => {
      const values = await provider.getValues();
      const actualFiles = fs.readdirSync(process.cwd());
      
      expect(values.LS_OUTPUT).toEqual(actualFiles);
    });

    it('should provide valid timestamp', async () => {
      const values = await provider.getValues();
      
      expect(Number.isInteger(parseInt(values.TIMESTAMP))).toBe(true);
      expect(parseInt(values.TIMESTAMP)).toBeGreaterThan(0);
    });
  });

  describe('Performance Optimization and Caching (AC 6.15)', () => {
    it('should cache values for performance', async () => {
      const values1 = await provider.getValues();
      const values2 = await provider.getValues();
      
      // Should return same object (cached)
      expect(values1).toBe(values2);
    });

    it('should allow cache invalidation', async () => {
      const values1 = await provider.getValues();
      provider.invalidateCache();
      const values2 = await provider.getValues();
      
      // Should be different objects after cache invalidation
      expect(values1).not.toBe(values2);
      // But values should be equal
      expect(values1.USER).toBe(values2.USER);
      expect(values1.PWD).toBe(values2.PWD);
    });

    it('should measure and optimize expensive operations', async () => {
      // First call (should populate cache)
      const start1 = process.hrtime();
      await provider.getValues();
      const [s1, ns1] = process.hrtime(start1);
      const firstCallTime = s1 * 1000 + ns1 / 1000000;
      
      // Second call (should use cache)
      const start2 = process.hrtime();
      await provider.getValues();
      const [s2, ns2] = process.hrtime(start2);
      const secondCallTime = s2 * 1000 + ns2 / 1000000;
      
      // Cached call should be significantly faster (or at least not slower)
      expect(secondCallTime).toBeLessThanOrEqual(firstCallTime + 1); // Allow 1ms tolerance
    });

    it('should handle cache expiration if configured', async () => {
      const provider = new EnvironmentValueProvider({ cacheTimeoutMs: 100 });
      
      const values1 = await provider.getValues();
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const values2 = await provider.getValues();
      
      // Should be different objects after cache expiration
      expect(values1).not.toBe(values2);
    });
  });

  describe('Custom Variable Support', () => {
    it('should support custom variable definitions', async () => {
      const provider = new EnvironmentValueProvider({
        customVariables: {
          'CUSTOM_VAR': 'custom_value'
        }
      });
      
      const values = await provider.getValues();
      
      expect(values.CUSTOM_VAR).toBe('custom_value');
    });

    it('should execute command-based custom variables', async () => {
      const provider = new EnvironmentValueProvider({
        customVariables: {
          'NODE_VERSION': 'exec:node --version'
        }
      });
      
      const values = await provider.getValues();
      
      expect(values.NODE_VERSION).toMatch(/^v\d+\.\d+\.\d+/);
    });

    it('should handle git branch custom variable', async () => {
      if (!fs.existsSync('.git')) {
        return; // Skip if not in git repository
      }
      
      const provider = new EnvironmentValueProvider({
        customVariables: {
          'GIT_BRANCH': 'exec:git branch --show-current'
        }
      });
      
      const values = await provider.getValues();
      
      expect(typeof values.GIT_BRANCH).toBe('string');
      expect(values.GIT_BRANCH.length).toBeGreaterThan(0);
    });

    it('should handle command execution failures gracefully', async () => {
      const provider = new EnvironmentValueProvider({
        customVariables: {
          'FAILING_COMMAND': 'exec:nonexistent-command-xyz'
        },
        failOnCommandError: false
      });
      
      const values = await provider.getValues();
      
      expect(values.FAILING_COMMAND).toBe(''); // Should default to empty string on failure
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle path separators correctly across platforms', async () => {
      const values = await provider.getValues();
      
      // PWD should use platform-appropriate separators
      expect(values.PWD).toBe(process.cwd());
    });

    it('should handle user account naming conventions', async () => {
      const values = await provider.getValues();
      
      // Should work on Windows, Linux, and macOS
      expect(values.USER).toBeDefined();
      expect(values.USER.length).toBeGreaterThan(0);
    });

    it('should provide consistent results across different environments', async () => {
      const values = await provider.getValues();
      
      // All required values should be present regardless of platform
      const requiredKeys = ['USER', 'PWD', 'HOSTNAME', 'HOME', 'LS_OUTPUT', 'TIMESTAMP'];
      requiredKeys.forEach(key => {
        expect(values).toHaveProperty(key);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing environment variables gracefully', async () => {
      // Temporarily remove USER from environment
      const originalUser = process.env.USER;
      delete process.env.USER;
      
      try {
        const values = await provider.getValues();
        // Should fall back to os.userInfo().username
        expect(values.USER).toBe(os.userInfo().username);
      } finally {
        if (originalUser) {
          process.env.USER = originalUser;
        }
      }
    });

    it('should handle directory listing errors', async () => {
      const provider = new EnvironmentValueProvider({
        targetDirectory: '/nonexistent/directory'
      });
      
      await expect(provider.getValues()).rejects.toThrow();
    });

    it('should validate required environment values', async () => {
      const values = await provider.getValues();
      
      expect(values.USER).toBeTruthy();
      expect(values.PWD).toBeTruthy();
      expect(values.HOSTNAME).toBeTruthy();
      expect(values.HOME).toBeTruthy();
    });
  });
});