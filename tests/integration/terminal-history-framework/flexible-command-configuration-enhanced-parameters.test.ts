/**
 * FlexibleCommandConfiguration Enhanced Parameter Support Tests
 * 
 * Tests FlexibleCommandConfiguration's ability to handle enhanced parameter objects
 * alongside legacy string format for postWebSocketCommands.
 */

import { FlexibleCommandConfiguration, ConfigurationValidationError } from './flexible-command-configuration';

describe('FlexibleCommandConfiguration Enhanced Parameter Support', () => {
  describe('Enhanced parameter validation', () => {
    it('should accept enhanced parameter objects in postWebSocketCommands', () => {
      // Given: Configuration with enhanced parameters
      const config = {
        preWebSocketCommands: ['ssh_connect {"name": "test", "host": "localhost"}'],
        postWebSocketCommands: [
          { initiator: 'browser', command: 'pwd' },
          { initiator: 'mcp-client', command: 'date', cancel: true }
        ]
      };

      // When: Creating configuration
      const flexConfig = new FlexibleCommandConfiguration(config);

      // Then: Should accept without errors
      const postCommands = flexConfig.getPostWebSocketCommands();
      expect(postCommands).toHaveLength(2);
      expect(postCommands[0]).toEqual({ initiator: 'browser', command: 'pwd' });
      expect(postCommands[1]).toEqual({ initiator: 'mcp-client', command: 'date', cancel: true });
    });

    it('should accept mixed string and enhanced parameter formats', () => {
      // Given: Mixed formats configuration
      const config = {
        preWebSocketCommands: ['ssh_connect {"name": "test", "host": "localhost"}'],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "test", "command": "pwd"}', // Legacy string (proper MCP format)
          { initiator: 'browser', command: 'date', cancel: true }, // Enhanced
          'ssh_exec {"sessionName": "test", "command": "whoami"}' // Another legacy string (proper MCP format)
        ]
      };

      // When: Creating configuration
      const flexConfig = new FlexibleCommandConfiguration(config);

      // Then: Should handle both formats
      const postCommands = flexConfig.getPostWebSocketCommands();
      expect(postCommands).toHaveLength(3);
      expect(postCommands[0]).toBe('ssh_exec {"sessionName": "test", "command": "pwd"}'); // String preserved
      expect(postCommands[1]).toEqual({ initiator: 'browser', command: 'date', cancel: true }); // Object preserved
      expect(postCommands[2]).toBe('ssh_exec {"sessionName": "test", "command": "whoami"}'); // String preserved
    });

    it('should validate enhanced parameter object structure', () => {
      // Given: Invalid enhanced parameter (missing initiator)
      const config = {
        preWebSocketCommands: [],
        postWebSocketCommands: [
          { command: 'pwd' } // Missing initiator
        ]
      };

      // When: Creating configuration
      // Then: Should throw validation error
      expect(() => new FlexibleCommandConfiguration(config)).toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(config)).toThrow('missing required field \'initiator\'');
    });

    it('should validate initiator values', () => {
      // Given: Invalid initiator value
      const config = {
        preWebSocketCommands: [],
        postWebSocketCommands: [
          { initiator: 'invalid-initiator', command: 'pwd' } as any
        ]
      };

      // When: Creating configuration
      // Then: Should throw validation error
      expect(() => new FlexibleCommandConfiguration(config)).toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(config)).toThrow('initiator must be \'browser\' or \'mcp-client\'');
    });

    it('should validate command field is present', () => {
      // Given: Missing command field
      const config = {
        preWebSocketCommands: [],
        postWebSocketCommands: [
          { initiator: 'browser' } as any // Missing command
        ]
      };

      // When: Creating configuration
      // Then: Should throw validation error
      expect(() => new FlexibleCommandConfiguration(config)).toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(config)).toThrow('missing required field \'command\'');
    });

    it('should validate command field is non-empty string', () => {
      // Given: Empty command string
      const config = {
        preWebSocketCommands: [],
        postWebSocketCommands: [
          { initiator: 'browser', command: '   ' } // Empty/whitespace command
        ]
      };

      // When: Creating configuration
      // Then: Should throw validation error
      expect(() => new FlexibleCommandConfiguration(config)).toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(config)).toThrow('command must be non-empty string');
    });

    it('should validate cancel field is boolean if provided', () => {
      // Given: Invalid cancel type
      const config = {
        preWebSocketCommands: [],
        postWebSocketCommands: [
          { initiator: 'browser', command: 'pwd', cancel: 'maybe' } as any // Invalid cancel type
        ]
      };

      // When: Creating configuration
      // Then: Should throw validation error
      expect(() => new FlexibleCommandConfiguration(config)).toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(config)).toThrow('cancel must be boolean if provided');
    });

    it('should validate waitToCancelMs is positive number if provided', () => {
      // Given: Invalid waitToCancelMs
      const config = {
        preWebSocketCommands: [],
        postWebSocketCommands: [
          { initiator: 'browser', command: 'pwd', waitToCancelMs: -100 } as any // Negative timeout
        ]
      };

      // When: Creating configuration
      // Then: Should throw validation error
      expect(() => new FlexibleCommandConfiguration(config)).toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(config)).toThrow('waitToCancelMs must be positive number');
    });

    it('should validate waitToCancelMs is number type if provided', () => {
      // Given: Invalid waitToCancelMs type
      const config = {
        preWebSocketCommands: [],
        postWebSocketCommands: [
          { initiator: 'browser', command: 'pwd', waitToCancelMs: 'soon' } as any // String instead of number
        ]
      };

      // When: Creating configuration
      // Then: Should throw validation error
      expect(() => new FlexibleCommandConfiguration(config)).toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(config)).toThrow('waitToCancelMs must be number if provided');
    });

    it('should reject non-object, non-string postWebSocketCommand entries', () => {
      // Given: Invalid command types (cast to bypass TypeScript checking for testing runtime validation)
      const config = {
        preWebSocketCommands: [],
        postWebSocketCommands: [
          123, // Number
          null, // Null
          ['array'], // Array
          true // Boolean
        ]
      } as any;

      // When/Then: Should throw validation error for each invalid type
      expect(() => new FlexibleCommandConfiguration(config)).toThrow(ConfigurationValidationError);
      expect(() => new FlexibleCommandConfiguration(config)).toThrow('must be string or object');
    });

    it('should accept complete enhanced parameter objects with all optional fields', () => {
      // Given: Complete enhanced parameter configuration
      const config = {
        preWebSocketCommands: ['ssh_connect {"name": "test", "host": "localhost"}'],
        postWebSocketCommands: [
          {
            initiator: 'browser',
            command: 'nano /tmp/test',
            cancel: true,
            waitToCancelMs: 5000
          },
          {
            initiator: 'mcp-client', 
            command: 'sleep 30',
            cancel: false
          }
        ]
      };

      // When: Creating configuration
      const flexConfig = new FlexibleCommandConfiguration(config);

      // Then: Should preserve all parameter fields
      const postCommands = flexConfig.getPostWebSocketCommands();
      expect(postCommands).toHaveLength(2);
      
      expect(postCommands[0]).toEqual({
        initiator: 'browser',
        command: 'nano /tmp/test',
        cancel: true,
        waitToCancelMs: 5000
      });
      
      expect(postCommands[1]).toEqual({
        initiator: 'mcp-client',
        command: 'sleep 30',
        cancel: false
      });
    });
  });

  describe('Integration with ComprehensiveResponseCollector', () => {
    it('should provide enhanced parameters to ComprehensiveResponseCollector config', () => {
      // Given: Enhanced parameter configuration
      const config = {
        preWebSocketCommands: ['ssh_connect {"name": "test", "host": "localhost"}'],
        postWebSocketCommands: [
          { initiator: 'browser', command: 'pwd' },
          'ssh_exec {"sessionName": "test", "command": "date"}' // Mixed with legacy (proper MCP format)
        ],
        workflowTimeout: 15000,
        sessionName: 'enhanced-test'
      };

      // When: Getting ComprehensiveResponseCollector config
      const flexConfig = new FlexibleCommandConfiguration(config);
      const collectorConfig = flexConfig.getComprehensiveResponseCollectorConfig();

      // Then: Should provide enhanced parameters correctly
      expect(collectorConfig.postWebSocketCommands).toHaveLength(2);
      expect(collectorConfig.postWebSocketCommands![0]).toEqual({ initiator: 'browser', command: 'pwd' });
      expect(collectorConfig.postWebSocketCommands![1]).toBe('ssh_exec {"sessionName": "test", "command": "date"}');
      expect(collectorConfig.workflowTimeout).toBe(15000);
      expect(collectorConfig.sessionName).toBe('enhanced-test');
    });
  });
});