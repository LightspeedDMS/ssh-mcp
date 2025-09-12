/**
 * Story 7: Flexible Command Configuration - Acceptance Criteria Validation
 * 
 * Tests validate all acceptance criteria from Story 7 specification:
 * 
 * Given I want to test different terminal scenarios
 * When I configure the testing framework
 * Then it should accept JSON configuration with preWebSocketCommands and postWebSocketCommands arrays
 * And support empty arrays for either phase
 * And validate command syntax before execution
 * And provide clear error messages for invalid configurations
 * And support complex command scenarios like multiple SSH sessions
 * 
 * Tests follow TDD principles with comprehensive validation and no mocks in production code.
 */

import { FlexibleCommandConfiguration, CommandConfigurationJSON, ConfigurationValidationError } from './flexible-command-configuration';
import { ComprehensiveResponseCollector } from './comprehensive-response-collector';

describe('Story 7: Flexible Command Configuration - Acceptance Criteria', () => {

  describe('AC1: Accept JSON configuration with preWebSocketCommands and postWebSocketCommands arrays', () => {
    test('Given I want to test different terminal scenarios, When I provide JSON configuration with command arrays, Then it should accept the configuration', () => {
      const jsonConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_connect {"host": "localhost", "username": "testuser"}',
          'ssh_exec {"command": "pwd"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"command": "whoami"}'},
          {initiator: 'mcp-client', command: 'ssh_disconnect {}'}
        ],
        workflowTimeout: 30000,
        sessionName: 'acceptance-test-session'
      };

      // Should not throw any errors
      expect(() => new FlexibleCommandConfiguration(jsonConfig)).not.toThrow();

      const config = new FlexibleCommandConfiguration(jsonConfig);
      
      // Verify arrays are parsed correctly
      expect(config.getPreWebSocketCommands()).toHaveLength(2);
      expect(config.getPostWebSocketCommands()).toHaveLength(2);
      
      // Verify pre-commands converted to PreWebSocketCommand objects
      expect(config.getPreWebSocketCommands()[0]).toEqual({
        tool: 'ssh_connect',
        args: { host: 'localhost', username: 'testuser' }
      });
      
      // Verify post-commands remain as strings
      expect(config.getPostWebSocketCommands()[0]).toBe('ssh_exec {"command": "whoami"}');
    });

    test('Given I configure JSON with complex command structures, When I initialize FlexibleCommandConfiguration, Then it should handle nested parameters correctly', () => {
      const complexConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_connect {"host": "localhost", "port": 22, "options": {"compression": true, "timeout": 30000}}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"command": "ls", "options": {"env": {"PATH": "/usr/bin:/bin"}, "timeout": 5000}}'}
        ]
      };

      const config = new FlexibleCommandConfiguration(complexConfig);
      const preCommands = config.getPreWebSocketCommands();
      
      expect(preCommands[0]).toEqual({
        tool: 'ssh_connect',
        args: {
          host: 'localhost',
          port: 22,
          options: { compression: true, timeout: 30000 }
        }
      });
    });
  });

  describe('AC2: Support empty arrays for either phase', () => {
    test('Given I want to skip pre-WebSocket phase, When I provide empty preWebSocketCommands array, Then it should be accepted', () => {
      const configWithEmptyPre: CommandConfigurationJSON = {
        preWebSocketCommands: [],  // Empty pre-WebSocket phase
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"command": "echo test"}'},
          {initiator: 'mcp-client', command: 'ssh_disconnect {}'}
        ]
      };

      expect(() => new FlexibleCommandConfiguration(configWithEmptyPre)).not.toThrow();
      
      const config = new FlexibleCommandConfiguration(configWithEmptyPre);
      expect(config.getPreWebSocketCommands()).toHaveLength(0);
      expect(config.getPostWebSocketCommands()).toHaveLength(2);
    });

    test('Given I want to skip post-WebSocket phase, When I provide empty postWebSocketCommands array, Then it should be accepted', () => {
      const configWithEmptyPost: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_connect {"host": "localhost", "username": "testuser"}'
        ],
        postWebSocketCommands: []  // Empty post-WebSocket phase
      };

      expect(() => new FlexibleCommandConfiguration(configWithEmptyPost)).not.toThrow();
      
      const config = new FlexibleCommandConfiguration(configWithEmptyPost);
      expect(config.getPreWebSocketCommands()).toHaveLength(1);
      expect(config.getPostWebSocketCommands()).toHaveLength(0);
    });

    test('Given I want to test only WebSocket connection, When I provide both arrays empty, Then it should be accepted', () => {
      const configWithBothEmpty: CommandConfigurationJSON = {
        preWebSocketCommands: [],   // Empty pre-WebSocket phase
        postWebSocketCommands: []   // Empty post-WebSocket phase
      };

      expect(() => new FlexibleCommandConfiguration(configWithBothEmpty)).not.toThrow();
      
      const config = new FlexibleCommandConfiguration(configWithBothEmpty);
      expect(config.getPreWebSocketCommands()).toHaveLength(0);
      expect(config.getPostWebSocketCommands()).toHaveLength(0);
    });
  });

  describe('AC3: Validate command syntax before execution', () => {
    test('Given I provide commands with valid MCP tool format, When FlexibleCommandConfiguration validates them, Then no errors should occur', () => {
      const validConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_create_session {"sessionName": "test"}',
          'ssh_connect {"host": "localhost", "username": "user"}',
          'ssh_exec {"command": "ls -la"}',
          'ssh_disconnect {}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_status {}'},
          {initiator: 'mcp-client', command: 'ssh_list_sessions {}'}
        ]
      };

      expect(() => new FlexibleCommandConfiguration(validConfig)).not.toThrow();
      
      const config = new FlexibleCommandConfiguration(validConfig);
      expect(config.getPreWebSocketCommands()).toHaveLength(4);
      expect(config.getPostWebSocketCommands()).toHaveLength(2);
    });

    test('Given I provide commands with invalid JSON syntax, When FlexibleCommandConfiguration validates them, Then it should reject them before execution', () => {
      const invalidJsonConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_connect {invalid json syntax}'  // Invalid JSON
        ],
        postWebSocketCommands: []
      };

      expect(() => new FlexibleCommandConfiguration(invalidJsonConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(invalidJsonConfig))
        .toThrow('Invalid JSON in preWebSocketCommand at index 0');
    });

    test('Given I provide commands without JSON parameters, When FlexibleCommandConfiguration validates them, Then it should reject them before execution', () => {
      const missingParamsConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_connect'  // Missing JSON parameters
        ],
        postWebSocketCommands: []
      };

      expect(() => new FlexibleCommandConfiguration(missingParamsConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(missingParamsConfig))
        .toThrow('Command must have JSON parameters: ssh_connect');
    });
  });

  describe('AC4: Provide clear error messages for invalid configurations', () => {
    test('Given I provide invalid workflow timeout, When FlexibleCommandConfiguration validates it, Then it should provide clear error message', () => {
      const invalidTimeoutConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [],
        postWebSocketCommands: [],
        workflowTimeout: -5000  // Invalid negative timeout
      };

      expect(() => new FlexibleCommandConfiguration(invalidTimeoutConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(invalidTimeoutConfig))
        .toThrow('workflowTimeout must be positive');
    });

    test('Given I provide empty session name, When FlexibleCommandConfiguration validates it, Then it should provide clear error message', () => {
      const emptySessionConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [],
        postWebSocketCommands: [],
        sessionName: '   '  // Whitespace-only session name
      };

      expect(() => new FlexibleCommandConfiguration(emptySessionConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(emptySessionConfig))
        .toThrow('sessionName cannot be empty');
    });

    test('Given I provide malformed JSON in commands, When FlexibleCommandConfiguration validates them, Then it should provide specific error with command index', () => {
      const malformedConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_connect {"host": "localhost"}',   // Valid command
          'ssh_exec {malformed: json syntax}',   // Invalid JSON at index 1
          'ssh_disconnect {}'                    // Valid command
        ],
        postWebSocketCommands: []
      };

      expect(() => new FlexibleCommandConfiguration(malformedConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(malformedConfig))
        .toThrow('Invalid JSON in preWebSocketCommand at index 1');
    });

    test('Given I provide invalid JSON in post-WebSocket commands, When FlexibleCommandConfiguration validates them, Then it should provide specific error with command index and phase', () => {
      const invalidPostConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [],
        postWebSocketCommands: [
          'ssh_exec {"command": "whoami"}',     // Valid command
          'ssh_disconnect {invalid json}'      // Invalid JSON at index 1
        ]
      };

      expect(() => new FlexibleCommandConfiguration(invalidPostConfig))
        .toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(invalidPostConfig))
        .toThrow('Invalid JSON in postWebSocketCommand at index 1');
    });
  });

  describe('AC5: Support complex command scenarios like multiple SSH sessions', () => {
    test('Given I want to test multiple SSH sessions workflow, When I configure complex scenario, Then it should handle all session management commands', () => {
      const multiSessionConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_create_session {"sessionName": "server1"}',
          'ssh_connect {"host": "server1.example.com", "port": 22, "username": "admin"}',
          'ssh_exec {"command": "uptime"}',
          'ssh_create_session {"sessionName": "server2"}',
          'ssh_connect {"host": "server2.example.com", "port": 2222, "username": "deploy"}',
          'ssh_exec {"command": "ps aux | grep nginx"}',
          'ssh_create_session {"sessionName": "database"}',
          'ssh_connect {"host": "db.example.com", "port": 22, "username": "dbadmin", "keyfile": "/keys/db.pem"}',
          'ssh_exec {"command": "mysql -u root -e \'SHOW PROCESSLIST\'"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_switch_session {"sessionName": "server1"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"command": "tail -n 10 /var/log/nginx/access.log"}'},
          {initiator: 'mcp-client', command: 'ssh_disconnect {}'},
          {initiator: 'mcp-client', command: 'ssh_switch_session {"sessionName": "server2"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"command": "systemctl status nginx"}'},
          {initiator: 'mcp-client', command: 'ssh_disconnect {}'},
          {initiator: 'mcp-client', command: 'ssh_switch_session {"sessionName": "database"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"command": "mysqladmin status"}'},
          {initiator: 'mcp-client', command: 'ssh_disconnect {}'}
        ],
        workflowTimeout: 120000,  // 2 minutes for complex workflow
        sessionName: 'multi-server-monitoring'
      };

      expect(() => new FlexibleCommandConfiguration(multiSessionConfig)).not.toThrow();
      
      const config = new FlexibleCommandConfiguration(multiSessionConfig);
      
      // Verify complex scenario is parsed correctly
      expect(config.getPreWebSocketCommands()).toHaveLength(9);
      expect(config.getPostWebSocketCommands()).toHaveLength(9);
      expect(config.getWorkflowTimeout()).toBe(120000);
      expect(config.getSessionName()).toBe('multi-server-monitoring');
      
      // Verify specific commands are parsed correctly
      const preCommands = config.getPreWebSocketCommands();
      expect(preCommands[0]).toEqual({
        tool: 'ssh_create_session',
        args: { sessionName: 'server1' }
      });
      
      expect(preCommands[7]).toEqual({
        tool: 'ssh_connect',
        args: { 
          host: 'db.example.com', 
          port: 22, 
          username: 'dbadmin', 
          keyfile: '/keys/db.pem' 
        }
      });
      
      // Verify post commands preserved as strings
      const postCommands = config.getPostWebSocketCommands();
      expect(postCommands[0]).toBe('ssh_switch_session {"sessionName": "server1"}');
      expect(postCommands[6]).toBe('ssh_switch_session {"sessionName": "database"}');
    });

    test('Given I configure complex workflow with mixed command types, When FlexibleCommandConfiguration processes it, Then it should integrate with ComprehensiveResponseCollector correctly', async () => {
      const complexWorkflowConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_create_session {"sessionName": "load-test"}',
          'ssh_connect {"host": "loadtest.example.com", "username": "testrunner"}',
          'ssh_exec {"command": "ab -n 1000 -c 10 http://target.example.com/"}',
          'ssh_create_session {"sessionName": "monitor"}',
          'ssh_connect {"host": "monitor.example.com", "username": "monitor"}',
          'ssh_exec {"command": "top -b -n 1"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_switch_session {"sessionName": "load-test"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"command": "ps aux | grep ab"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"command": "netstat -an | grep :80"}'},
          {initiator: 'mcp-client', command: 'ssh_disconnect {}'},
          {initiator: 'mcp-client', command: 'ssh_switch_session {"sessionName": "monitor"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"command": "free -h"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"command": "df -h"}'},
          {initiator: 'mcp-client', command: 'ssh_disconnect {}'}
        ],
        workflowTimeout: 180000,
        sessionName: 'load-test-monitoring'
      };

      const flexibleConfig = new FlexibleCommandConfiguration(complexWorkflowConfig);
      
      // Test integration with ComprehensiveResponseCollector
      const collector = new ComprehensiveResponseCollector(
        flexibleConfig.getComprehensiveResponseCollectorConfig()
      );
      
      const collectorConfig = collector.getConfig();
      expect(collectorConfig.preWebSocketCommands).toHaveLength(6);
      expect(collectorConfig.postWebSocketCommands).toHaveLength(8);
      expect(collectorConfig.workflowTimeout).toBe(180000);
      expect(collectorConfig.sessionName).toBe('load-test-monitoring');
      
      // Cleanup
      await collector.cleanup();
    });
  });

  describe('Full Integration: All Acceptance Criteria Together', () => {
    test('Given I want comprehensive terminal scenario testing, When I use all FlexibleCommandConfiguration features together, Then all acceptance criteria should work in harmony', async () => {
      // Comprehensive scenario that exercises all acceptance criteria
      const comprehensiveConfig: CommandConfigurationJSON = {
        // AC1 & AC5: JSON configuration with complex commands and multiple sessions
        preWebSocketCommands: [
          'ssh_create_session {"sessionName": "web-server"}',
          'ssh_connect {"host": "web.example.com", "port": 22, "username": "webadmin", "options": {"compression": true}}',
          'ssh_exec {"command": "nginx -t"}',
          'ssh_create_session {"sessionName": "app-server"}',
          'ssh_connect {"host": "app.example.com", "username": "appuser"}',
          'ssh_exec {"command": "pm2 status"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_switch_session {"sessionName": "web-server"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"command": "tail -f /var/log/nginx/error.log"}'},
          {initiator: 'mcp-client', command: 'ssh_disconnect {}'},
          {initiator: 'mcp-client', command: 'ssh_switch_session {"sessionName": "app-server"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"command": "pm2 logs --lines 50"}'},
          {initiator: 'mcp-client', command: 'ssh_disconnect {}'}
        ],
        // AC3: Valid configuration parameters
        workflowTimeout: 90000,
        sessionName: 'comprehensive-monitoring-test'
      };

      // AC3: Syntax validation should pass
      expect(() => new FlexibleCommandConfiguration(comprehensiveConfig)).not.toThrow();
      
      const config = new FlexibleCommandConfiguration(comprehensiveConfig);
      
      // AC1: Verify JSON configuration is parsed correctly
      expect(config.getPreWebSocketCommands()).toHaveLength(6);
      expect(config.getPostWebSocketCommands()).toHaveLength(6);
      
      // AC5: Verify complex multi-session commands are handled
      const preCommands = config.getPreWebSocketCommands();
      expect(preCommands[1]).toEqual({
        tool: 'ssh_connect',
        args: { 
          host: 'web.example.com', 
          port: 22, 
          username: 'webadmin', 
          options: { compression: true }
        }
      });
      
      const postCommands = config.getPostWebSocketCommands();
      expect(postCommands[0]).toBe('ssh_switch_session {"sessionName": "web-server"}');
      
      // Verify integration with ComprehensiveResponseCollector
      const collector = new ComprehensiveResponseCollector(
        config.getComprehensiveResponseCollectorConfig()
      );
      
      const collectorConfig = collector.getConfig();
      expect(collectorConfig.sessionName).toBe('comprehensive-monitoring-test');
      expect(collectorConfig.workflowTimeout).toBe(90000);
      expect(collectorConfig.preWebSocketCommands).toHaveLength(6);
      expect(collectorConfig.postWebSocketCommands).toHaveLength(6);
      
      // Cleanup
      await collector.cleanup();
    });

    test('Given I test error scenarios in comprehensive workflow, When invalid configurations are provided, Then clear error messages should be provided for all cases', () => {
      // Test AC4: Clear error messages for various invalid configurations
      
      // Invalid syntax in complex command
      const invalidSyntaxConfig: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_create_session {"sessionName": "test"}',
          'ssh_connect {host: localhost, invalid json}',  // Invalid JSON syntax
          'ssh_exec {"command": "test"}'
        ],
        postWebSocketCommands: []
      };

      expect(() => new FlexibleCommandConfiguration(invalidSyntaxConfig))
        .toThrow('Invalid JSON in preWebSocketCommand at index 1');

      // Invalid configuration parameter with complex setup
      const invalidConfigParam: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_create_session {"sessionName": "test1"}',
          'ssh_create_session {"sessionName": "test2"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_disconnect {}'},
          {initiator: 'mcp-client', command: 'ssh_disconnect {}'}
        ],
        workflowTimeout: 0,  // Invalid timeout
        sessionName: 'test-session'
      };

      expect(() => new FlexibleCommandConfiguration(invalidConfigParam))
        .toThrow('workflowTimeout must be positive');
    });
  });
});