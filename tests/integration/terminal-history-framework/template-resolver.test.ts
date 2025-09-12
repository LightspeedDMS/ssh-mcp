/**
 * Test suite for TemplateResolver
 * Tests for AC 6.10, 6.11, 6.12 - Template variable expansion and conditional logic
 * 
 * TDD methodology: Failing tests first for template resolution system
 */

import { TemplateResolver } from './template-resolver';
import { EnvironmentValues } from './environment-value-provider';

describe('TemplateResolver', () => {
  let resolver: TemplateResolver;
  let mockEnvironmentValues: EnvironmentValues;

  beforeEach(() => {
    mockEnvironmentValues = {
      USER: 'testuser',
      PWD: '/home/testuser/project',
      HOSTNAME: 'testhost',
      HOME: '/home/testuser',
      LS_OUTPUT: ['file1.txt', 'dir1', 'README.md'],
      TIMESTAMP: '1703505600000'
    };

    resolver = new TemplateResolver(mockEnvironmentValues);
  });

  describe('AC 6.10: Template variable expansion system', () => {
    it('should resolve simple variable substitution', async () => {
      const template = '${USER}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('testuser');
    });

    it('should resolve multiple variables in single template', async () => {
      const template = 'User: ${USER}, Directory: ${PWD}, Host: ${HOSTNAME}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('User: testuser, Directory: /home/testuser/project, Host: testhost');
    });

    it('should resolve array variables as JSON', async () => {
      const template = 'Files: ${LS_OUTPUT}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('Files: ["file1.txt","dir1","README.md"]');
    });

    it('should handle template with no variables', async () => {
      const template = 'No variables here';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('No variables here');
    });

    it('should handle empty template', async () => {
      const template = '';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('');
    });

    it('should handle nested variable references', async () => {
      const resolver = new TemplateResolver(mockEnvironmentValues, {
        BASE_PATH: '${PWD}',
        FULL_PATH: '${BASE_PATH}/subdir'
      });
      
      const template = '${FULL_PATH}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('/home/testuser/project/subdir');
    });

    it('should detect circular references', async () => {
      const resolver = new TemplateResolver(mockEnvironmentValues, {
        VAR_A: '${VAR_B}',
        VAR_B: '${VAR_A}'
      });
      
      const template = '${VAR_A}';
      
      await expect(resolver.resolve(template))
        .rejects.toThrow('Circular reference detected');
    });
  });

  describe('AC 6.11: Custom variable definition and usage', () => {
    it('should resolve custom variables', async () => {
      const resolver = new TemplateResolver(mockEnvironmentValues, {
        CUSTOM_VAR: 'custom_value'
      });
      
      const template = 'Value: ${CUSTOM_VAR}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('Value: custom_value');
    });

    it('should execute command-based custom variables', async () => {
      const resolver = new TemplateResolver(mockEnvironmentValues, {
        ECHO_TEST: 'exec:echo "hello world"'
      });
      
      const template = 'Output: ${ECHO_TEST}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('Output: hello world');
    });

    it('should handle command execution with complex output', async () => {
      const resolver = new TemplateResolver(mockEnvironmentValues, {
        NODE_VERSION: 'exec:node --version'
      });
      
      const template = 'Node version: ${NODE_VERSION}';
      const result = await resolver.resolve(template);
      
      expect(result).toMatch(/Node version: v\d+\.\d+\.\d+/);
    });

    it('should handle command execution failures', async () => {
      const resolver = new TemplateResolver(mockEnvironmentValues, {
        FAILING_CMD: 'exec:nonexistent-command-xyz'
      });
      
      const template = '${FAILING_CMD}';
      
      await expect(resolver.resolve(template))
        .rejects.toThrow('Command execution failed');
    });

    it('should support SSH session count variable', async () => {
      const resolver = new TemplateResolver(mockEnvironmentValues, {
        SSH_SESSION_COUNT: 'exec:who | wc -l'
      });
      
      const template = 'SSH sessions: ${SSH_SESSION_COUNT}';
      const result = await resolver.resolve(template);
      
      expect(result).toMatch(/SSH sessions: \d+/);
    });

    it('should support git branch variable when in git repo', async () => {
      const resolver = new TemplateResolver(mockEnvironmentValues, {
        GIT_BRANCH: 'exec:git branch --show-current'
      });
      
      const template = 'Branch: ${GIT_BRANCH}';
      
      try {
        const result = await resolver.resolve(template);
        expect(result).toMatch(/Branch: .+/);
      } catch (error) {
        // Skip if not in git repo or git not available
        expect(error instanceof Error ? error.message : String(error)).toContain('Command execution failed');
      }
    });
  });

  describe('AC 6.12: Conditional template resolution', () => {
    it('should resolve simple conditional expression', async () => {
      const template = '${USER === "testuser" ? "Admin" : "User"}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('Admin');
    });

    it('should resolve false conditional expression', async () => {
      const template = '${USER === "root" ? "Admin" : "User"}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('User');
    });

    it('should handle file existence conditional', async () => {
      // Mock file existence checker
      const resolver = new TemplateResolver(mockEnvironmentValues, {
        'FILE_EXISTS:package.json': 'true'
      });
      
      const template = '${FILE_EXISTS:package.json ? "Found" : "Missing"}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('Found');
    });

    it('should handle file non-existence conditional', async () => {
      const resolver = new TemplateResolver(mockEnvironmentValues, {
        'FILE_EXISTS:nonexistent.txt': 'false'
      });
      
      const template = '${FILE_EXISTS:nonexistent.txt ? "Found" : "Missing"}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('Missing');
    });

    it('should support multiple conditional operators', async () => {
      const template1 = '${USER !== "root" ? "non-root" : "root"}';
      const result1 = await resolver.resolve(template1);
      expect(result1).toBe('non-root');
      
      const template2 = '${LS_OUTPUT.length > 0 ? "has files" : "empty"}';
      const result2 = await resolver.resolve(template2);
      expect(result2).toBe('has files');
    });

    it('should handle nested conditional expressions', async () => {
      const template = '${USER === "root" ? "Root user" : (USER === "testuser" ? "Test user" : "Other user")}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('Test user');
    });

    it('should support contains operator', async () => {
      const template = '${PWD.includes("project") ? "In project dir" : "Not in project"}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('In project dir');
    });

    it('should handle complex conditional with array operations', async () => {
      const template = '${LS_OUTPUT.includes("README.md") ? "Has README" : "No README"}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('Has README');
    });
  });

  describe('Template Syntax Validation', () => {
    it('should detect invalid template syntax', async () => {
      const template = '${INVALID_SYNTAX';
      
      await expect(resolver.resolve(template))
        .rejects.toThrow('Invalid template syntax');
    });

    it('should detect unmatched braces', async () => {
      const template = '${USER} ${HOSTNAME';
      
      await expect(resolver.resolve(template))
        .rejects.toThrow('Invalid template syntax');
    });

    it('should handle escaped braces', async () => {
      const template = 'This is not a variable: \\${USER}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('This is not a variable: ${USER}');
    });

    it('should detect unknown variables', async () => {
      const template = '${UNKNOWN_VARIABLE}';
      
      await expect(resolver.resolve(template))
        .rejects.toThrow('Unknown template variable: UNKNOWN_VARIABLE');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large templates efficiently', async () => {
      const largeTemplate = Array(100).fill('${USER}').join(' ');
      
      const startTime = Date.now();
      const result = await resolver.resolve(largeTemplate);
      const endTime = Date.now();
      
      expect(result).toBe(Array(100).fill('testuser').join(' '));
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle recursive template resolution up to limit', async () => {
      const resolver = new TemplateResolver(mockEnvironmentValues, {
        LEVEL_1: '${LEVEL_2}',
        LEVEL_2: '${LEVEL_3}',
        LEVEL_3: 'final_value'
      });
      
      const template = '${LEVEL_1}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('final_value');
    });

    it('should prevent infinite recursion', async () => {
      const resolver = new TemplateResolver(mockEnvironmentValues, {
        RECURSIVE_1: '${RECURSIVE_2}',
        RECURSIVE_2: '${RECURSIVE_3}',
        RECURSIVE_3: '${RECURSIVE_1}'
      });
      
      const template = '${RECURSIVE_1}';
      
      await expect(resolver.resolve(template))
        .rejects.toThrow('Maximum recursion depth exceeded');
    });

    it('should handle special characters in variable values', async () => {
      const resolver = new TemplateResolver({
        ...mockEnvironmentValues,
        SPECIAL_CHARS: 'value with "quotes" and $pecial ch@rs'
      });
      
      const template = 'Value: ${SPECIAL_CHARS}';
      const result = await resolver.resolve(template);
      
      expect(result).toBe('Value: value with "quotes" and $pecial ch@rs');
    });
  });
});