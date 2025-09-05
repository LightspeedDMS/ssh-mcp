/**
 * Story 7: Flexible Command Configuration Integration Tests
 * 
 * Integration tests for FlexibleCommandConfiguration with ComprehensiveResponseCollector.
 * Tests demonstrate real integration between JSON configuration and framework workflow execution.
 * 
 * Tests follow TDD integration patterns:
 * 1. Focus on configuration conversion and integration points
 * 2. Test actual JSON configuration workflows
 * 3. Verify complex scenarios with multiple sessions
 * 4. Validate configuration compatibility
 * 
 * CRITICAL: Tests focus on FlexibleCommandConfiguration integration without full infrastructure
 */

import { FlexibleCommandConfiguration, CommandConfigurationJSON } from './flexible-command-configuration';
import { ComprehensiveResponseCollector } from './comprehensive-response-collector';

describe('FlexibleCommandConfiguration Integration', () => {

  describe('basic JSON configuration integration', () => {
    test('should create working configuration for simple SSH workflow', async () => {
      const jsonConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_create_session {"sessionName": "integration-test-session"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"command": "echo test"}',
          'ssh_disconnect {}'
        ],
        workflowTimeout: 15000,
        sessionName: 'integration-test-session'
      };

      const flexibleConfig = new FlexibleCommandConfiguration(jsonConfig);
      
      // Verify configuration conversion
      expect(flexibleConfig.getPreWebSocketCommands()).toHaveLength(1);
      expect(flexibleConfig.getPreWebSocketCommands()[0]).toEqual({
        tool: 'ssh_create_session',
        args: { sessionName: 'integration-test-session' }
      });

      expect(flexibleConfig.getPostWebSocketCommands()).toHaveLength(2);
      expect(flexibleConfig.getPostWebSocketCommands()[0]).toBe('ssh_exec {"command": "echo test"}');
      expect(flexibleConfig.getPostWebSocketCommands()[1]).toBe('ssh_disconnect {}');

      // Verify integration with ComprehensiveResponseCollector
      const collectorConfig = flexibleConfig.getComprehensiveResponseCollectorConfig();
      expect(collectorConfig.sessionName).toBe('integration-test-session');
      expect(collectorConfig.workflowTimeout).toBe(15000);
    });

    test('should support empty command arrays configuration', async () => {
      const jsonConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [],
        postWebSocketCommands: [],
        workflowTimeout: 8000,
        sessionName: 'empty-commands-test'
      };

      const flexibleConfig = new FlexibleCommandConfiguration(jsonConfig);
      
      // Verify empty arrays are preserved
      expect(flexibleConfig.getPreWebSocketCommands()).toHaveLength(0);
      expect(flexibleConfig.getPostWebSocketCommands()).toHaveLength(0);

      // Verify CollectorConfig integration with empty arrays
      const collectorConfig = flexibleConfig.getComprehensiveResponseCollectorConfig();
      expect(collectorConfig.preWebSocketCommands).toHaveLength(0);
      expect(collectorConfig.postWebSocketCommands).toHaveLength(0);
      expect(collectorConfig.sessionName).toBe('empty-commands-test');
      expect(collectorConfig.workflowTimeout).toBe(8000);
    });
  });

  describe('complex multi-session workflow integration', () => {
    test('should configure multiple SSH session workflow', async () => {
      const jsonConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_create_session {"sessionName": "session1"}',
          'ssh_connect {"host": "localhost", "port": 22, "username": "testuser1"}',
          'ssh_exec {"command": "pwd"}',
          'ssh_create_session {"sessionName": "session2"}',
          'ssh_connect {"host": "localhost", "port": 22, "username": "testuser2"}',
          'ssh_exec {"command": "whoami"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"command": "date"}',
          'ssh_switch_session {"sessionName": "session1"}',
          'ssh_exec {"command": "ls -la"}',
          'ssh_disconnect {}',
          'ssh_switch_session {"sessionName": "session2"}',
          'ssh_disconnect {}'
        ],
        workflowTimeout: 45000,
        sessionName: 'multi-session-test'
      };

      const flexibleConfig = new FlexibleCommandConfiguration(jsonConfig);
      
      // Verify pre-WebSocket commands parsed correctly
      const preCommands = flexibleConfig.getPreWebSocketCommands();
      expect(preCommands).toHaveLength(6);
      
      expect(preCommands[0]).toEqual({
        tool: 'ssh_create_session',
        args: { sessionName: 'session1' }
      });
      
      expect(preCommands[1]).toEqual({
        tool: 'ssh_connect',
        args: { host: 'localhost', port: 22, username: 'testuser1' }
      });
      
      expect(preCommands[3]).toEqual({
        tool: 'ssh_create_session',
        args: { sessionName: 'session2' }
      });

      // Verify post-WebSocket commands preserved as strings
      const postCommands = flexibleConfig.getPostWebSocketCommands();
      expect(postCommands).toHaveLength(6);
      expect(postCommands[1]).toBe('ssh_switch_session {"sessionName": "session1"}');
      expect(postCommands[4]).toBe('ssh_switch_session {"sessionName": "session2"}');

      // Verify collector configuration
      const collectorConfig = flexibleConfig.getComprehensiveResponseCollectorConfig();
      expect(collectorConfig.sessionName).toBe('multi-session-test');
      expect(collectorConfig.workflowTimeout).toBe(45000);
      expect(collectorConfig.preWebSocketCommands).toHaveLength(6);
      expect(collectorConfig.postWebSocketCommands).toHaveLength(6);
    });
  });

  describe('ComprehensiveResponseCollector integration workflow', () => {
    test('should configure ComprehensiveResponseCollector from JSON', async () => {
      const jsonConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_create_session {"sessionName": "collector-integration-test"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"command": "echo integration test"}',
          'ssh_disconnect {}'
        ],
        workflowTimeout: 20000,
        sessionName: 'collector-integration-test'
      };

      const flexibleConfig = new FlexibleCommandConfiguration(jsonConfig);
      
      // Create new collector with FlexibleCommandConfiguration
      const testCollector = new ComprehensiveResponseCollector(
        flexibleConfig.getComprehensiveResponseCollectorConfig()
      );

      // Verify collector configuration integration
      const config = testCollector.getConfig();
      expect(config.sessionName).toBe('collector-integration-test');
      expect(config.workflowTimeout).toBe(20000);
      expect(config.preWebSocketCommands).toHaveLength(1);
      expect(config.postWebSocketCommands).toHaveLength(2);

      // Verify components are not initialized by default
      expect(testCollector.areComponentsInitialized()).toBe(false);

      // Cleanup
      await testCollector.cleanup();
    });
  });

  describe('configuration validation and error scenarios', () => {
    test('should validate JSON configuration during integration setup', async () => {
      // Test invalid JSON configuration
      const invalidConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_connect {invalid json syntax}'  // Invalid JSON
        ],
        postWebSocketCommands: [],
        workflowTimeout: 10000
      };

      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow('Invalid JSON in preWebSocketCommand at index 0');
    });

    test('should handle configuration with missing parameters', async () => {
      const invalidConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_connect'  // Missing JSON parameters
        ],
        postWebSocketCommands: []
      };

      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow('Command must have JSON parameters: ssh_connect');
    });

    test('should validate timeout constraints during integration', async () => {
      const invalidConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [],
        postWebSocketCommands: [],
        workflowTimeout: -5000  // Invalid timeout
      };

      expect(() => new FlexibleCommandConfiguration(invalidConfig))
        .toThrow('workflowTimeout must be positive');
    });
  });

  describe('default values and optional parameters', () => {
    test('should provide sensible defaults for ComprehensiveResponseCollector integration', async () => {
      const minimalConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [],
        postWebSocketCommands: []
      };

      const flexibleConfig = new FlexibleCommandConfiguration(minimalConfig);
      const collectorConfig = flexibleConfig.getComprehensiveResponseCollectorConfig();

      // Verify defaults are applied
      expect(collectorConfig.workflowTimeout).toBe(10000);
      expect(collectorConfig.sessionName).toBe('flexible-config-session');
      expect(collectorConfig.preWebSocketCommands).toHaveLength(0);
      expect(collectorConfig.postWebSocketCommands).toHaveLength(0);
    });

    test('should override defaults when values are provided', async () => {
      const customConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_create_session {"sessionName": "custom-session"}'
        ],
        postWebSocketCommands: [
          'ssh_disconnect {}'
        ],
        workflowTimeout: 25000,
        sessionName: 'custom-session'
      };

      const flexibleConfig = new FlexibleCommandConfiguration(customConfig);
      const collectorConfig = flexibleConfig.getComprehensiveResponseCollectorConfig();

      // Verify custom values are used
      expect(collectorConfig.workflowTimeout).toBe(25000);
      expect(collectorConfig.sessionName).toBe('custom-session');
      expect(collectorConfig.preWebSocketCommands).toHaveLength(1);
      expect(collectorConfig.postWebSocketCommands).toHaveLength(1);
    });
  });

  describe('edge cases and boundary conditions', () => {
    test('should handle complex JSON parameter structures', async () => {
      const complexConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_connect {"host": "localhost", "port": 22, "options": {"compression": true, "timeout": 30000}}',
          'ssh_exec {"command": "ls", "options": {"env": {"PATH": "/usr/bin:/bin"}, "timeout": 5000}}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"command": "echo", "args": ["hello", "world"], "options": {"shell": "/bin/bash"}}'
        ]
      };

      const flexibleConfig = new FlexibleCommandConfiguration(complexConfig);
      const preCommands = flexibleConfig.getPreWebSocketCommands();
      
      expect(preCommands[0]).toEqual({
        tool: 'ssh_connect',
        args: {
          host: 'localhost',
          port: 22,
          options: { compression: true, timeout: 30000 }
        }
      });

      expect(preCommands[1]).toEqual({
        tool: 'ssh_exec',
        args: {
          command: 'ls',
          options: { env: { PATH: '/usr/bin:/bin' }, timeout: 5000 }
        }
      });

      const postCommands = flexibleConfig.getPostWebSocketCommands();
      expect(postCommands[0]).toBe('ssh_exec {"command": "echo", "args": ["hello", "world"], "options": {"shell": "/bin/bash"}}');
    });

    test('should handle empty JSON object parameters', async () => {
      const emptyParamsConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_status {}',
          'ssh_list_sessions {}'
        ],
        postWebSocketCommands: [
          'ssh_disconnect {}'
        ]
      };

      const flexibleConfig = new FlexibleCommandConfiguration(emptyParamsConfig);
      const preCommands = flexibleConfig.getPreWebSocketCommands();
      
      expect(preCommands[0]).toEqual({
        tool: 'ssh_status',
        args: {}
      });

      expect(preCommands[1]).toEqual({
        tool: 'ssh_list_sessions',
        args: {}
      });
    });
  });
});