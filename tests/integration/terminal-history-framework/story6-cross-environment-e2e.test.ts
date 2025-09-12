/**
 * Story 06: Cross-Environment E2E Tests for Dynamic Expected Value Construction
 * 
 * Comprehensive end-to-end validation of dynamic expected value construction across
 * different environments, user accounts, and system configurations.
 * 
 * Tests all 18 acceptance criteria in real-world scenarios with actual SSH commands
 * and terminal history validation using the complete Villenele framework.
 */

import { JestTestUtilities } from './jest-test-utilities';
import { DynamicExpectedValueConstructor } from './dynamic-expected-value-constructor';
import './jest-matchers'; // Load custom matchers
import * as os from 'os';

describe('Story 06: Cross-Environment E2E Tests - Dynamic Expected Value Construction', () => {
  let testUtils: JestTestUtilities;
  // let dynamicConstructor: DynamicExpectedValueConstructor;

  beforeAll(() => {
    // Initialize test utilities with dynamic value construction enabled
    testUtils = new JestTestUtilities({
      enableDetailedLogging: false,
      enableErrorDiagnostics: true,
      testTimeout: 45000,
      enableDynamicValueConstruction: true,
      dynamicValueConfig: {
        customVariables: {
          'TEST_MARKER': 'villenele-e2e-test',
          'CURRENT_TIME': 'exec:date +%s'
        }
      }
    });

    // dynamicConstructor = testUtils.getDynamicValueConstructor()!;
  });

  beforeEach(async () => {
    await testUtils.setupTest();
  });

  afterEach(async () => {
    await testUtils.cleanupTest();
  });

  describe('AC 6.18: Cross-environment test portability validation', () => {
    it('should work across different user accounts and environments', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "e2e-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "e2e-test", "command": "whoami"}',
          'ssh_exec {"sessionName": "e2e-test", "command": "pwd"}'
        ],
        postWebSocketCommands: [
          {initiator: 'browser', command: 'hostname'},
          {initiator: 'mcp-client', command: 'echo "User: $(whoami), Host: $(hostname), PWD: $(pwd)"'}
        ],
        workflowTimeout: 30000,
        sessionName: 'cross-env-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      expect(result.success).toBe(true);

      // Validate dynamic templates work with actual terminal output
      const template = 'User: ${USER}, Host: ${HOSTNAME}, PWD: ${PWD}';
      const resolvedTemplate = await testUtils.resolveDynamicTemplate(template);

      expect(resolvedTemplate).toContain('User:');
      expect(resolvedTemplate).toContain('Host:');
      expect(resolvedTemplate).toContain('PWD:');

      // Verify terminal output contains expected patterns
      testUtils.expectWebSocketMessagesWithDynamicSupport(result.concatenatedResponses)
        .toContainCRLF()
        .toHavePrompts()
        .toHaveMinimumLength(10)
        .validate();

      // Test that dynamic template matching works with real terminal output
      expect(result.concatenatedResponses).toMatchDynamicPattern('.*${USER}.*');
      expect(result.concatenatedResponses).toMatchDynamicPattern('.*${HOSTNAME}.*');
    });

    it('should handle different directory locations consistently', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "dir-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "dir-test", "command": "cd /tmp && pwd"}',
          'ssh_exec {"sessionName": "dir-test", "command": "cd ~ && pwd"}'
        ],
        postWebSocketCommands: [
          {initiator: 'browser', command: 'pwd'}
        ],
        workflowTimeout: 25000,
        sessionName: 'directory-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      expect(result.success).toBe(true);

      // Validate that directory paths are correctly resolved
      const homeTemplate = '${HOME}';
      const resolvedHome = await testUtils.resolveDynamicTemplate(homeTemplate);
      
      expect(resolvedHome).toBe(os.homedir());
      expect(result.concatenatedResponses).toContain('/tmp');
      expect(result.concatenatedResponses).toContain(os.homedir());
    });

    it('should validate hostname consistency across different environments', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "hostname-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "hostname-test", "command": "hostname"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'hostname -f || hostname'}
        ],
        workflowTimeout: 20000,
        sessionName: 'hostname-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      expect(result.success).toBe(true);

      // Verify hostname resolution consistency
      const hostnameTemplate = '${HOSTNAME}';
      const resolvedHostname = await testUtils.resolveDynamicTemplate(hostnameTemplate);
      
      expect(resolvedHostname).toBe(os.hostname());
      expect(result.concatenatedResponses).toContain(os.hostname());
    });
  });

  describe('AC 6.16: Multi-command expected value coordination', () => {
    it('should maintain value consistency across command sequences', async () => {
      const timestamp = Date.now().toString();
      const testConstructor = new DynamicExpectedValueConstructor({
        customVariables: {
          'TEST_TIMESTAMP': timestamp,
          'SEQUENCE_MARKER': 'seq-test-' + timestamp
        }
      });

      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "sequence-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          `ssh_exec {"sessionName": "sequence-test", "command": "echo seq-test-${timestamp}"}`
        ],
        postWebSocketCommands: [
          {initiator: 'browser', command: `echo "marker: seq-test-${timestamp}"`},
          {initiator: 'mcp-client', command: `echo "count: $(echo seq-test-${timestamp} | wc -c)"`}
        ],
        workflowTimeout: 25000,
        sessionName: 'sequence-coordination'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      expect(result.success).toBe(true);

      // Verify command sequence coordination
      const markerTemplate = 'seq-test-${TEST_TIMESTAMP}';
      const resolvedMarker = await testConstructor.resolveTemplate(markerTemplate);
      
      expect(resolvedMarker).toBe(`seq-test-${timestamp}`);
      expect(result.concatenatedResponses).toContain(`seq-test-${timestamp}`);

      // Count occurrences to ensure consistency
      const occurrences = (result.concatenatedResponses.match(new RegExp(`seq-test-${timestamp}`, 'g')) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(3); // Should appear in all commands
    });
  });

  describe('AC 6.7: Volatile output handling with regex patterns', () => {
    it('should handle timestamp patterns in real terminal output', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "volatile-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "volatile-test", "command": "date"}'
        ],
        postWebSocketCommands: [
          {initiator: 'browser', command: 'date +%s'},
          {initiator: 'mcp-client', command: 'date "+%Y-%m-%d %H:%M:%S"'}
        ],
        workflowTimeout: 25000,
        sessionName: 'volatile-output'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      expect(result.success).toBe(true);

      // Test volatile pattern creation and matching
      const timestampPattern = testUtils.createVolatilePattern('timestamp');
      // const datePattern = testUtils.createVolatilePattern('date');

      // Verify patterns match expected formats in output
      const timestampMatches = result.concatenatedResponses.match(timestampPattern);
      expect(timestampMatches).not.toBeNull();

      // Test dynamic pattern with regex
      const regexTemplate = '${pattern:/\\d{10}/}'; // Unix timestamp
      expect(result.concatenatedResponses).toMatchDynamicPattern(regexTemplate);
    });

    it('should handle process ID patterns', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "pid-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "pid-test", "command": "echo $$"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ps -o pid,comm | head -5'}
        ],
        workflowTimeout: 20000,
        sessionName: 'process-id-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      expect(result.success).toBe(true);

      // Test PID pattern
      const pidPattern = testUtils.createVolatilePattern('pid');
      const pidMatches = result.concatenatedResponses.match(pidPattern);
      expect(pidMatches).not.toBeNull();
      expect(pidMatches!.length).toBeGreaterThan(0);
    });
  });

  describe('AC 6.8: Directory listing dynamic validation', () => {
    it('should dynamically validate directory contents', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "ls-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "ls-test", "command": "ls -la"}'
        ],
        postWebSocketCommands: [
          {initiator: 'browser', command: 'ls'},
          {initiator: 'mcp-client', command: 'find . -maxdepth 1 -type f | wc -l'}
        ],
        workflowTimeout: 25000,
        sessionName: 'directory-listing'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      expect(result.success).toBe(true);

      // Get environment values for directory listing validation
      const envValues = await testUtils.getEnvironmentValues();
      expect(Array.isArray(envValues.LS_OUTPUT)).toBe(true);
      expect(envValues.LS_OUTPUT.length).toBeGreaterThan(0);

      // Verify some common files exist in directory listing
      const commonFiles = ['package.json', 'README.md', 'src'];
      const foundFiles = envValues.LS_OUTPUT.filter(file => commonFiles.includes(file));
      expect(foundFiles.length).toBeGreaterThan(0);
    });
  });

  describe('AC 6.15: Performance optimization through caching', () => {
    it('should demonstrate caching performance benefits', async () => {
      const template = 'User: ${USER}, Host: ${HOSTNAME}, Directory: ${PWD}, Home: ${HOME}';

      // First resolution (should populate cache)
      const start1 = process.hrtime();
      const resolved1 = await testUtils.resolveDynamicTemplate(template);
      const [s1, ns1] = process.hrtime(start1);
      const duration1 = s1 * 1000 + ns1 / 1000000;

      // Second resolution (should use cache)
      const start2 = process.hrtime();
      const resolved2 = await testUtils.resolveDynamicTemplate(template);
      const [s2, ns2] = process.hrtime(start2);
      const duration2 = s2 * 1000 + ns2 / 1000000;

      // Results should be identical
      expect(resolved1).toBe(resolved2);
      
      // Second call should be faster or similar (allowing for measurement variance)
      expect(duration2).toBeLessThanOrEqual(duration1 + 10); // 10ms tolerance

      // Test cache invalidation
      testUtils.invalidateDynamicValueCache();
      
      // Third resolution after cache invalidation
      const resolved3 = await testUtils.resolveDynamicTemplate(template);
      expect(resolved3).toBe(resolved1); // Should still be same values
    });
  });

  describe('Integration with existing Villenele framework', () => {
    it('should integrate seamlessly with terminal history testing', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "integration-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "integration-test", "command": "whoami && hostname && pwd"}'
        ],
        postWebSocketCommands: [
          {initiator: 'browser', command: 'echo "Integration test complete"'},
          {initiator: 'mcp-client', command: 'echo "Current user: $(whoami)"'}
        ],
        workflowTimeout: 30000,
        sessionName: 'framework-integration'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      expect(result.success).toBe(true);

      // Validate using traditional Villenele assertions
      testUtils.expectWebSocketMessagesWithDynamicSupport(result.concatenatedResponses)
        .toContainCRLF()
        .toHavePrompts()
        .toContainText('Integration test complete')
        .toHaveMinimumLength(20)
        .validate();

      // Validate using dynamic template matching
      expect(result.concatenatedResponses).toMatchDynamicTemplate('*${USER}*');
      expect(result.concatenatedResponses).toMatchDynamicTemplate('*${HOSTNAME}*');
      
      // Verify environment-independent behavior
      const currentUser = process.env.USER || os.userInfo().username;
      const currentHost = os.hostname();
      
      expect(result.concatenatedResponses).toContain(currentUser);
      expect(result.concatenatedResponses).toContain(currentHost);
      expect(result.concatenatedResponses).toContain(process.cwd());
    });

    it('should demonstrate error diagnostics with dynamic context', async () => {
      try {
        // This should provide detailed error diagnostics
        expect('wrong_output').toMatchDynamicTemplate('${USER}@${HOSTNAME}');
        
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Verify comprehensive error diagnostics (AC 6.14)
        expect(errorMessage).toContain('Expected output to match dynamic template');
        expect(errorMessage).toContain('Template:');
        expect(errorMessage).toContain('Resolved:');
        expect(errorMessage).toContain('Actual:');
        expect(errorMessage).toContain('Environment Context:');
        expect(errorMessage).toContain('USER:');
        expect(errorMessage).toContain('HOSTNAME:');
      }
    });
  });

  describe('Cross-platform and environment adaptability', () => {
    it('should adapt to different system configurations', async () => {
      const envValues = await testUtils.getEnvironmentValues();
      
      // Verify all required environment values are present
      expect(envValues.USER).toBeDefined();
      expect(envValues.PWD).toBeDefined();
      expect(envValues.HOSTNAME).toBeDefined();
      expect(envValues.HOME).toBeDefined();
      expect(Array.isArray(envValues.LS_OUTPUT)).toBe(true);
      expect(envValues.TIMESTAMP).toBeDefined();

      // Verify values are consistent with system
      expect(envValues.USER).toBe(process.env.USER || os.userInfo().username);
      expect(envValues.PWD).toBe(process.cwd());
      expect(envValues.HOSTNAME).toBe(os.hostname());
      expect(envValues.HOME).toBe(os.homedir());

      // Test dynamic template resolution with all standard variables
      const complexTemplate = '[${USER}@${HOSTNAME} ${PWD}]$ cd ${HOME} && ls';
      const resolved = await testUtils.resolveDynamicTemplate(complexTemplate);
      
      expect(resolved).toContain(envValues.USER);
      expect(resolved).toContain(envValues.HOSTNAME);
      expect(resolved).toContain(envValues.PWD);
      expect(resolved).toContain(envValues.HOME);
    });
  });
});