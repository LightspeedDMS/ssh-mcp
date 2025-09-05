/**
 * Story 7: Flexible Command Configuration Unit Tests
 * 
 * Unit tests for FlexibleCommandConfiguration class that supports JSON-based
 * command configuration with validation and error handling.
 * 
 * Tests follow TDD red-green-refactor cycle:
 * 1. Write failing test (red)
 * 2. Implement minimal code to pass (green)
 * 3. Refactor for clean code
 * 
 * CRITICAL: No mocks in production code - tests use real configuration validation
 */

import { FlexibleCommandConfiguration, ConfigurationValidationError } from './flexible-command-configuration';

describe('FlexibleCommandConfiguration', () => {
  describe('constructor validation', () => {
    test('should throw error for invalid workflowTimeout', () => {
      const invalidConfig = {
        preWebSocketCommands: [],
        postWebSocketCommands: [],
        workflowTimeout: -1000
      };

      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow('workflowTimeout must be positive');
    });

    test('should throw error for zero workflowTimeout', () => {
      const invalidConfig = {
        preWebSocketCommands: [],
        postWebSocketCommands: [],
        workflowTimeout: 0
      };

      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow('workflowTimeout must be positive');
    });

    test('should throw error for empty sessionName', () => {
      const invalidConfig = {
        preWebSocketCommands: [],
        postWebSocketCommands: [],
        sessionName: ''
      };

      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow('sessionName cannot be empty');
    });

    test('should throw error for whitespace-only sessionName', () => {
      const invalidConfig = {
        preWebSocketCommands: [],
        postWebSocketCommands: [],
        sessionName: '   '
      };

      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow('sessionName cannot be empty');
    });

    test('should accept valid minimal configuration', () => {
      const validConfig = {
        preWebSocketCommands: [],
        postWebSocketCommands: []
      };

      expect(() => new FlexibleCommandConfiguration(validConfig))
        .not.toThrow();
    });

    test('should accept valid full configuration', () => {
      const validConfig = {
        preWebSocketCommands: [
          'ssh_connect {"host": "localhost", "username": "test_user"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"command": "whoami"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'test-session'
      };

      expect(() => new FlexibleCommandConfiguration(validConfig))
        .not.toThrow();
    });
  });

  describe('command syntax validation', () => {
    test('should reject malformed JSON in preWebSocketCommands', () => {
      const invalidConfig = {
        preWebSocketCommands: [
          'ssh_connect {invalid json}'
        ],
        postWebSocketCommands: []
      };

      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow('Invalid JSON in preWebSocketCommand at index 0: ssh_connect {invalid json}');
    });

    test('should reject malformed JSON in postWebSocketCommands', () => {
      const invalidConfig = {
        preWebSocketCommands: [],
        postWebSocketCommands: [
          'ssh_exec {malformed: json'
        ]
      };

      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow('Invalid JSON in postWebSocketCommand at index 0: ssh_exec {malformed: json');
    });

    test('should reject commands without JSON parameters', () => {
      const invalidConfig = {
        preWebSocketCommands: [
          'ssh_connect'
        ],
        postWebSocketCommands: []
      };

      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow('Command must have JSON parameters: ssh_connect');
    });

    test('should reject commands with only tool name', () => {
      const invalidConfig = {
        preWebSocketCommands: [],
        postWebSocketCommands: [
          'ssh_exec'
        ]
      };

      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow('Command must have JSON parameters: ssh_exec');
    });

    test('should accept valid MCP tool commands', () => {
      const validConfig = {
        preWebSocketCommands: [
          'ssh_connect {"host": "localhost", "username": "test_user"}',
          'ssh_exec {"command": "pwd"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"command": "whoami"}',
          'ssh_disconnect {}'
        ]
      };

      expect(() => new FlexibleCommandConfiguration(validConfig))
        .not.toThrow();
    });

    test('should accept commands with empty JSON object', () => {
      const validConfig = {
        preWebSocketCommands: [
          'ssh_disconnect {}'
        ],
        postWebSocketCommands: [
          'ssh_status {}'
        ]
      };

      expect(() => new FlexibleCommandConfiguration(validConfig))
        .not.toThrow();
    });
  });

  describe('configuration conversion', () => {
    test('should convert JSON string commands to PreWebSocketCommand objects', () => {
      const config = new FlexibleCommandConfiguration({
        preWebSocketCommands: [
          'ssh_connect {"host": "localhost", "username": "test_user"}',
          'ssh_exec {"command": "pwd"}'
        ],
        postWebSocketCommands: []
      });

      const preCommands = config.getPreWebSocketCommands();

      expect(preCommands).toHaveLength(2);
      expect(preCommands[0]).toEqual({
        tool: 'ssh_connect',
        args: { host: 'localhost', username: 'test_user' }
      });
      expect(preCommands[1]).toEqual({
        tool: 'ssh_exec',
        args: { command: 'pwd' }
      });
    });

    test('should convert JSON string commands with empty objects', () => {
      const config = new FlexibleCommandConfiguration({
        preWebSocketCommands: [
          'ssh_disconnect {}'
        ],
        postWebSocketCommands: []
      });

      const preCommands = config.getPreWebSocketCommands();

      expect(preCommands).toHaveLength(1);
      expect(preCommands[0]).toEqual({
        tool: 'ssh_disconnect',
        args: {}
      });
    });

    test('should handle empty command arrays', () => {
      const config = new FlexibleCommandConfiguration({
        preWebSocketCommands: [],
        postWebSocketCommands: []
      });

      expect(config.getPreWebSocketCommands()).toHaveLength(0);
      expect(config.getPostWebSocketCommands()).toHaveLength(0);
    });

    test('should preserve postWebSocketCommands as strings', () => {
      const config = new FlexibleCommandConfiguration({
        preWebSocketCommands: [],
        postWebSocketCommands: [
          'ssh_exec {"command": "whoami"}',
          'ssh_disconnect {}'
        ]
      });

      const postCommands = config.getPostWebSocketCommands();

      expect(postCommands).toHaveLength(2);
      expect(postCommands[0]).toBe('ssh_exec {"command": "whoami"}');
      expect(postCommands[1]).toBe('ssh_disconnect {}');
    });
  });

  describe('configuration properties', () => {
    test('should provide default values for optional properties', () => {
      const config = new FlexibleCommandConfiguration({
        preWebSocketCommands: [],
        postWebSocketCommands: []
      });

      expect(config.getWorkflowTimeout()).toBe(10000);
      expect(config.getSessionName()).toBe('flexible-config-session');
    });

    test('should use provided values for optional properties', () => {
      const config = new FlexibleCommandConfiguration({
        preWebSocketCommands: [],
        postWebSocketCommands: [],
        workflowTimeout: 25000,
        sessionName: 'custom-session'
      });

      expect(config.getWorkflowTimeout()).toBe(25000);
      expect(config.getSessionName()).toBe('custom-session');
    });

    test('should provide comprehensive response collector config', () => {
      const config = new FlexibleCommandConfiguration({
        preWebSocketCommands: [
          'ssh_connect {"host": "localhost", "username": "test_user"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"command": "whoami"}'
        ],
        workflowTimeout: 20000,
        sessionName: 'integration-test'
      });

      const collectorConfig = config.getComprehensiveResponseCollectorConfig();

      expect(collectorConfig.workflowTimeout).toBe(20000);
      expect(collectorConfig.sessionName).toBe('integration-test');
      expect(collectorConfig.preWebSocketCommands).toHaveLength(1);
      expect(collectorConfig.preWebSocketCommands![0]).toEqual({
        tool: 'ssh_connect',
        args: { host: 'localhost', username: 'test_user' }
      });
      expect(collectorConfig.postWebSocketCommands).toHaveLength(1);
      expect(collectorConfig.postWebSocketCommands![0]).toBe('ssh_exec {"command": "whoami"}');
    });
  });

  describe('complex scenarios', () => {
    test('should handle multiple SSH session commands', () => {
      const config = new FlexibleCommandConfiguration({
        preWebSocketCommands: [
          'ssh_create_session {"sessionName": "session1"}',
          'ssh_connect {"host": "host1", "username": "user1"}',
          'ssh_exec {"command": "pwd"}',
          'ssh_create_session {"sessionName": "session2"}',
          'ssh_connect {"host": "host2", "username": "user2"}',
          'ssh_exec {"command": "ls -la"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"command": "whoami"}',
          'ssh_disconnect {}',
          'ssh_switch_session {"sessionName": "session1"}',
          'ssh_exec {"command": "date"}',
          'ssh_disconnect {}'
        ],
        workflowTimeout: 45000,
        sessionName: 'multi-session-test'
      });

      const preCommands = config.getPreWebSocketCommands();
      const postCommands = config.getPostWebSocketCommands();

      expect(preCommands).toHaveLength(6);
      expect(postCommands).toHaveLength(5);

      // Verify first session commands
      expect(preCommands[0]).toEqual({
        tool: 'ssh_create_session',
        args: { sessionName: 'session1' }
      });
      expect(preCommands[1]).toEqual({
        tool: 'ssh_connect',
        args: { host: 'host1', username: 'user1' }
      });

      // Verify second session commands
      expect(preCommands[3]).toEqual({
        tool: 'ssh_create_session',
        args: { sessionName: 'session2' }
      });
      expect(preCommands[4]).toEqual({
        tool: 'ssh_connect',
        args: { host: 'host2', username: 'user2' }
      });

      // Verify post commands
      expect(postCommands[2]).toBe('ssh_switch_session {"sessionName": "session1"}');
    });

    test('should validate all commands in complex scenarios', () => {
      const invalidConfig = {
        preWebSocketCommands: [
          'ssh_create_session {"sessionName": "session1"}',
          'ssh_connect {invalid json}', // Invalid JSON
          'ssh_exec {"command": "pwd"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"command": "whoami"}',
          'ssh_disconnect'  // Missing JSON parameters
        ]
      };

      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow('Invalid JSON in preWebSocketCommand at index 1: ssh_connect {invalid json}');
    });
  });
});