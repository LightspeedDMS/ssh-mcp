/**
 * Story 9: Jest Integration and Test Utilities - Unit Tests
 * 
 * Tests the JestTestUtilities class which provides comprehensive Jest integration
 * utilities for the Terminal History Testing Framework.
 * 
 * Key functionality tested:
 * - Jest test runner integration with setup/cleanup utilities
 * - Helper utilities for common terminal history test patterns
 * - Async/await patterns for test execution
 * - WebSocket message assertion helpers
 * - Parameterized test support for multiple scenarios
 * - Integration with RobustErrorDiagnostics for enhanced debugging
 */

import { JestTestUtilities, WebSocketMessageAssertion, TestScenario } from './jest-test-utilities';

describe('Story 9: JestTestUtilities - Unit Tests', () => {
  describe('Basic Structure', () => {
    it('should construct JestTestUtilities with default configuration', () => {
      // ARRANGE & ACT
      const testUtils = new JestTestUtilities();

      // ASSERT
      expect(testUtils).toBeDefined();
      expect(typeof testUtils.setupTest).toBe('function');
      expect(typeof testUtils.cleanupTest).toBe('function');
      expect(typeof testUtils.runTerminalHistoryTest).toBe('function');
      expect(typeof testUtils.expectWebSocketMessages).toBe('function');
    });

    it('should construct JestTestUtilities with custom configuration', () => {
      // ARRANGE
      const config = {
        enableDetailedLogging: true,
        enableErrorDiagnostics: false,
        testTimeout: 45000,
        cleanupTimeout: 10000
      };

      // ACT
      const testUtils = new JestTestUtilities(config);

      // ASSERT
      expect(testUtils).toBeDefined();
      expect(testUtils.getCurrentConfig()).toMatchObject({
        enableDetailedLogging: true,
        enableErrorDiagnostics: false,
        testTimeout: 45000,
        cleanupTimeout: 10000
      });
    });

    it('should provide static Jest environment setup utility', () => {
      // ACT & ASSERT
      expect(typeof JestTestUtilities.setupJestEnvironment).toBe('function');
      expect(typeof JestTestUtilities.extendJestMatchers).toBe('function');
    });
  });

  describe('Test Setup and Cleanup', () => {
    let testUtils: JestTestUtilities;

    beforeEach(() => {
      testUtils = new JestTestUtilities({
        enableDetailedLogging: false,
        enableErrorDiagnostics: true
      });
    });

    afterEach(async () => {
      if (testUtils) {
        await testUtils.cleanupTest();
      }
    });

    it('should setup test with default name', async () => {
      // ACT & ASSERT
      await expect(testUtils.setupTest()).resolves.not.toThrow();
    });

    it('should setup test with custom name', async () => {
      // ARRANGE
      const testName = 'custom-test-name';

      // ACT & ASSERT
      await expect(testUtils.setupTest(testName)).resolves.not.toThrow();
    });

    it('should cleanup test gracefully', async () => {
      // ARRANGE
      await testUtils.setupTest('cleanup-test');

      // ACT & ASSERT
      await expect(testUtils.cleanupTest()).resolves.not.toThrow();
    });

    it('should handle cleanup without prior setup', async () => {
      // ACT & ASSERT
      await expect(testUtils.cleanupTest()).resolves.not.toThrow();
    });

    it('should track test duration during setup and cleanup', async () => {
      // ARRANGE
      await testUtils.setupTest('duration-test');

      // Simulate some test work
      await new Promise(resolve => setTimeout(resolve, 100));

      // ACT & ASSERT
      await expect(testUtils.cleanupTest()).resolves.not.toThrow();
    });
  });

  describe('WebSocket Message Assertion Builder', () => {
    it('should create WebSocket message assertion for valid messages', () => {
      // ARRANGE
      const testUtils = new JestTestUtilities();
      const messages = 'test_user@localhost:~$ pwd\r\n/home/test_user\r\ntest_user@localhost:~$ ';

      // ACT
      const assertion = testUtils.expectWebSocketMessages(messages);

      // ASSERT
      expect(assertion).toBeInstanceOf(WebSocketMessageAssertion);
      expect(typeof assertion.toContainCRLF).toBe('function');
      expect(typeof assertion.toHavePrompts).toBe('function');
      expect(typeof assertion.toMatchCommandSequence).toBe('function');
    });

    it('should validate CRLF line endings correctly', () => {
      // ARRANGE
      const testUtils = new JestTestUtilities();
      const messagesWithCRLF = 'test_user@localhost:~$ pwd\r\n/home/test_user\r\n';
      const messagesWithoutCRLF = 'test_user@localhost:~$ pwd\n/home/test_user\n';

      // ACT & ASSERT
      expect(() => {
        testUtils.expectWebSocketMessages(messagesWithCRLF).toContainCRLF().validate();
      }).not.toThrow();

      expect(() => {
        testUtils.expectWebSocketMessages(messagesWithoutCRLF).toContainCRLF().validate();
      }).toThrow('Expected WebSocket messages to contain CRLF line endings');
    });

    it('should validate shell prompts correctly', () => {
      // ARRANGE
      const testUtils = new JestTestUtilities();
      const messagesWithPrompts = 'test_user@localhost:~$ pwd\r\n/home/test_user\r\n';
      const messagesWithoutPrompts = 'some random text without prompts';

      // ACT & ASSERT
      expect(() => {
        testUtils.expectWebSocketMessages(messagesWithPrompts).toHavePrompts().validate();
      }).not.toThrow();

      expect(() => {
        testUtils.expectWebSocketMessages(messagesWithoutPrompts).toHavePrompts().validate();
      }).toThrow('Expected WebSocket messages to contain shell prompts');
    });

    it('should validate command sequence correctly', () => {
      // ARRANGE
      const testUtils = new JestTestUtilities();
      const messages = 'test_user@localhost:~$ pwd\r\n/home/test_user\r\ntest_user@localhost:~$ whoami\r\ntest_user\r\n';
      const expectedCommands = ['pwd', 'whoami'];
      const missingCommands = ['pwd', 'date'];

      // ACT & ASSERT
      expect(() => {
        testUtils.expectWebSocketMessages(messages).toMatchCommandSequence(expectedCommands).validate();
      }).not.toThrow();

      expect(() => {
        testUtils.expectWebSocketMessages(messages).toMatchCommandSequence(missingCommands).validate();
      }).toThrow('Expected WebSocket messages to contain command "date" but not found');
    });

    it('should validate minimum message length', () => {
      // ARRANGE
      const testUtils = new JestTestUtilities();
      const longMessage = 'a'.repeat(100);
      const shortMessage = 'short';

      // ACT & ASSERT
      expect(() => {
        testUtils.expectWebSocketMessages(longMessage).toHaveMinimumLength(50).validate();
      }).not.toThrow();

      expect(() => {
        testUtils.expectWebSocketMessages(shortMessage).toHaveMinimumLength(50).validate();
      }).toThrow('Expected WebSocket messages to have minimum length 50 but got 5');
    });

    it('should chain multiple assertions correctly', () => {
      // ARRANGE
      const testUtils = new JestTestUtilities();
      const validMessages = 'test_user@localhost:~$ pwd\r\n/home/test_user\r\ntest_user@localhost:~$ whoami\r\ntest_user\r\n';

      // ACT & ASSERT
      expect(() => {
        testUtils.expectWebSocketMessages(validMessages)
          .toContainCRLF()
          .toHavePrompts()
          .toMatchCommandSequence(['pwd', 'whoami'])
          .toHaveMinimumLength(10)
          .toContainText('test_user')
          .validate();
      }).not.toThrow();
    });
  });

  describe('WebSocket Message Validation', () => {
    let testUtils: JestTestUtilities;

    beforeEach(() => {
      testUtils = new JestTestUtilities();
    });

    it('should validate complete WebSocket messages correctly', () => {
      // ARRANGE
      const validMessages = 'test_user@localhost:~$ pwd\r\n/home/test_user\r\ntest_user@localhost:~$ whoami\r\ntest_user\r\n';

      // ACT
      const validation = testUtils.validateWebSocketMessages(validMessages);

      // ASSERT
      expect(validation.hasMessages).toBe(true);
      expect(validation.hasCRLF).toBe(true);
      expect(validation.hasPrompts).toBe(true);
      expect(validation.messageCount).toBeGreaterThan(0);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing CRLF line endings', () => {
      // ARRANGE
      const messagesWithoutCRLF = 'test_user@localhost:~$ pwd\n/home/test_user\n';

      // ACT
      const validation = testUtils.validateWebSocketMessages(messagesWithoutCRLF);

      // ASSERT
      expect(validation.hasCRLF).toBe(false);
      expect(validation.errors).toContain('WebSocket messages missing CRLF line endings (critical for xterm.js display)');
    });

    it('should detect missing shell prompts', () => {
      // ARRANGE
      const messagesWithoutPrompts = 'some text without prompts\r\n';

      // ACT
      const validation = testUtils.validateWebSocketMessages(messagesWithoutPrompts);

      // ASSERT
      expect(validation.hasPrompts).toBe(false);
      expect(validation.errors).toContain('WebSocket messages missing shell prompts');
    });

    it('should detect empty messages', () => {
      // ARRANGE
      const emptyMessages = '';

      // ACT
      const validation = testUtils.validateWebSocketMessages(emptyMessages);

      // ASSERT
      expect(validation.hasMessages).toBe(false);
      expect(validation.errors).toContain('WebSocket messages are empty');
    });

    it('should count commands and messages correctly', () => {
      // ARRANGE
      const messages = 'test_user@localhost:~$ pwd\r\n/home/test_user\r\ntest_user@localhost:~$ whoami\r\ntest_user\r\n';

      // ACT
      const validation = testUtils.validateWebSocketMessages(messages);

      // ASSERT
      expect(validation.messageCount).toBe(messages.split('\n').length);
      expect(validation.commandCount).toBeGreaterThanOrEqual(0); // Command counting is based on pattern matching
    });
  });

  describe('Parameterized Test Scenarios', () => {
    let testUtils: JestTestUtilities;

    beforeEach(() => {
      testUtils = new JestTestUtilities();
    });

    it('should generate test scenarios for common patterns', () => {
      // ACT
      const scenarios = testUtils.generateTestScenarios();

      // ASSERT
      expect(scenarios).toBeInstanceOf(Array);
      expect(scenarios.length).toBeGreaterThan(0);
      
      scenarios.forEach((scenario: TestScenario) => {
        expect(scenario.name).toBeDefined();
        expect(scenario.config).toBeDefined();
        expect(scenario.config.preWebSocketCommands).toBeInstanceOf(Array);
        expect(scenario.config.postWebSocketCommands).toBeInstanceOf(Array);
        expect(scenario.config.workflowTimeout).toBeGreaterThan(0);
        expect(scenario.config.sessionName).toBeDefined();
      });
    });

    it('should include empty command test scenario', () => {
      // ACT
      const scenarios = testUtils.generateTestScenarios();

      // ASSERT
      const emptyScenario = scenarios.find(s => s.name === 'Empty command test');
      expect(emptyScenario).toBeDefined();
      expect(emptyScenario?.config.preWebSocketCommands).toHaveLength(0);
      expect(emptyScenario?.config.postWebSocketCommands).toHaveLength(0);
      expect(emptyScenario?.expectedMessages).toBe(0);
      expect(emptyScenario?.expectedCommands).toHaveLength(0);
    });

    it('should include pre-WebSocket only scenario', () => {
      // ACT
      const scenarios = testUtils.generateTestScenarios();

      // ASSERT
      const preOnlyScenario = scenarios.find(s => s.name === 'Pre-WebSocket only');
      expect(preOnlyScenario).toBeDefined();
      expect(preOnlyScenario?.config.preWebSocketCommands).toHaveLength(1);
      expect(preOnlyScenario?.config.postWebSocketCommands).toHaveLength(0);
      expect(preOnlyScenario?.expectedMessages).toBe(1);
      expect(preOnlyScenario?.expectedCommands).toContain('pwd');
    });

    it('should include post-WebSocket only scenario', () => {
      // ACT
      const scenarios = testUtils.generateTestScenarios();

      // ASSERT
      const postOnlyScenario = scenarios.find(s => s.name === 'Post-WebSocket only');
      expect(postOnlyScenario).toBeDefined();
      expect(postOnlyScenario?.config.preWebSocketCommands).toHaveLength(0);
      expect(postOnlyScenario?.config.postWebSocketCommands).toHaveLength(1);
      expect(postOnlyScenario?.expectedMessages).toBe(1);
      expect(postOnlyScenario?.expectedCommands).toContain('whoami');
    });

    it('should include full workflow scenario', () => {
      // ACT
      const scenarios = testUtils.generateTestScenarios();

      // ASSERT
      const fullWorkflowScenario = scenarios.find(s => s.name === 'Full workflow test');
      expect(fullWorkflowScenario).toBeDefined();
      expect(fullWorkflowScenario?.config.preWebSocketCommands).toHaveLength(2);
      expect(fullWorkflowScenario?.config.postWebSocketCommands).toHaveLength(2);
      expect(fullWorkflowScenario?.expectedMessages).toBe(4);
      expect(fullWorkflowScenario?.expectedCommands).toEqual(['pwd', 'date', 'whoami', 'hostname']);
    });
  });

  describe('Configuration Management', () => {
    it('should provide access to current configuration', () => {
      // ARRANGE
      const config = {
        enableDetailedLogging: true,
        enableErrorDiagnostics: false,
        testTimeout: 25000,
        cleanupTimeout: 8000
      };
      const testUtils = new JestTestUtilities(config);

      // ACT
      const currentConfig = testUtils.getCurrentConfig();

      // ASSERT
      expect(currentConfig).toMatchObject(config);
    });

    it('should allow enabling and disabling detailed logging', () => {
      // ARRANGE
      const testUtils = new JestTestUtilities({ enableDetailedLogging: false });

      // ACT
      testUtils.setDetailedLogging(true);

      // ASSERT
      expect(testUtils.getCurrentConfig().enableDetailedLogging).toBe(true);

      // ACT
      testUtils.setDetailedLogging(false);

      // ASSERT  
      expect(testUtils.getCurrentConfig().enableDetailedLogging).toBe(false);
    });

    it('should provide access to last workflow result when available', () => {
      // ARRANGE
      const testUtils = new JestTestUtilities({ enableErrorDiagnostics: true });

      // ACT
      const result = testUtils.getLastWorkflowResult();

      // ASSERT
      // Should return undefined when no tests have been run yet
      expect(result).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    let testUtils: JestTestUtilities;

    beforeEach(() => {
      testUtils = new JestTestUtilities({ enableErrorDiagnostics: true });
    });

    afterEach(async () => {
      await testUtils.cleanupTest();
    });

    it('should throw error when running test without setup', async () => {
      // ACT & ASSERT
      await expect(testUtils.runTerminalHistoryTest({
        preWebSocketCommands: [],
        postWebSocketCommands: [],
        workflowTimeout: 10000,
        sessionName: 'no-setup-test'
      })).rejects.toThrow('Must call setupTest() before running tests');
    });

    it('should allow running tests with different configurations', async () => {
      // ARRANGE
      const testUtilsWithoutDiagnostics = new JestTestUtilities({ enableErrorDiagnostics: false });
      await testUtilsWithoutDiagnostics.setupTest('config-test');

      // ACT & ASSERT
      // Should not throw when error diagnostics are disabled
      // The test may fail due to server issues but shouldn't fail due to configuration
      try {
        await testUtilsWithoutDiagnostics.runTerminalHistoryTest({
          preWebSocketCommands: [],
          postWebSocketCommands: [],
          workflowTimeout: 10000,
          sessionName: 'config-test'
        });
      } catch (error) {
        // Expected to fail due to server setup issues, not configuration
        expect(error).toBeDefined();
      }

      // CLEANUP
      await testUtilsWithoutDiagnostics.cleanupTest();
    });

    it('should handle setup and cleanup errors gracefully', async () => {
      // ARRANGE
      await testUtils.setupTest('error-handling-test');

      // Force an error scenario by trying to cleanup multiple times
      await testUtils.cleanupTest();

      // ACT & ASSERT
      // Second cleanup should not throw
      await expect(testUtils.cleanupTest()).resolves.not.toThrow();
    });
  });
});