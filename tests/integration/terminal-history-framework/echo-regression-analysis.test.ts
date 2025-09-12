/**
 * Story 01: Echo Regression Analysis Test Suite
 * 
 * This test suite implements comprehensive analysis of the double echo regression
 * using enhanced Villenele testing infrastructure. It identifies the exact source
 * of command duplication and understands the interaction between echo handling
 * and Command State Synchronization functionality.
 * 
 * CRITICAL: All tests are written TDD-style with failing tests first, then implementation
 * to make them pass. Uses real MCP server, SSH connections, and WebSocket communications.
 */

import { JestTestUtilities } from './jest-test-utilities';
import { CommandConfigurationJSON } from './flexible-command-configuration';

// Import the production EchoRegressionAnalyzer from src/
import { EchoRegressionAnalyzer } from '../../../src/echo-regression-analyzer';

describe('Echo Regression Analysis', () => {
  let testUtils: JestTestUtilities;
  let analyzer: EchoRegressionAnalyzer;

  beforeAll(() => {
    // Setup test environment synchronously before any tests run
  });

  beforeEach(async () => {
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true,
      testTimeout: 30000
    });
    await testUtils.setupTest('echo-regression-analysis');
    analyzer = new EchoRegressionAnalyzer(); // Production class doesn't take testUtils in constructor
  });

  afterEach(async () => {
    if (testUtils) {
      await testUtils.cleanupTest();
    }
  });

  describe('AC 1.1: Baseline Echo Behavior Documentation', () => {
    it('should document pre-Command State Sync echo behavior showing single command display', async () => {
      // Use production class method
      const currentBehavior = await analyzer.analyzeCurrentEchoBehavior();
      
      expect(currentBehavior.mcpCommandEcho.isDuplicated).toBe(false);
      expect(currentBehavior.mcpCommandEcho.webSocketMessages.length).toBeGreaterThan(0);
    });
  });

  describe('AC 1.2: Current Regression Behavior Characterization', () => {
    it('should capture exact duplication pattern in browser commands via WebSocket', async () => {
      const currentBehavior = await analyzer.analyzeCurrentEchoBehavior();
      
      expect(currentBehavior.browserCommandEcho.isDuplicated).toBe(true);
      expect(currentBehavior.duplicationPattern.affectedCommands).toContain('browser-initiated');
    });
  });

  describe('AC 1.3: Regression Scope and Impact Analysis', () => {
    it('should validate regression impact across different command types using enhanced Villenele', async () => {
      const scope = await analyzer.analyzeRegressionScope();
      
      expect(scope.simpleCommands.length).toBeGreaterThan(0);
      expect(scope.complexCommands.length).toBeGreaterThan(0);
      expect(scope.analysisTimestamp).toBeGreaterThan(0);
    });
  });

  describe('AC 1.4-1.6: Source Code Analysis and Change Detection', () => {
    it('should identify Command State Sync implementation impact on echo handling', async () => {
      const impact = await analyzer.analyzeCodeChanges();
      
      expect(impact.sshConnectionManagerChanges).toBeDefined();
      expect(impact.webServerManagerChanges).toBeDefined();
      expect(Array.isArray(impact.potentialEchoAffectingChanges)).toBe(true);
    });
  });

  describe('AC 1.7: Browser Command Echo Pattern Analysis using Villenele', () => {
    it('should capture exact WebSocket response pattern for browser commands', async () => {
      const config: CommandConfigurationJSON = {
        sessionName: 'echo-analysis-browser',
        workflowTimeout: 30000,
        preWebSocketCommands: [
          'ssh_connect {"name": "echo-analysis-browser", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          {initiator: 'browser', command: 'pwd'},
          {initiator: 'browser', command: 'whoami'},
          {initiator: 'browser', command: 'echo "test browser command"'}
        ]
      };

      // Test will use actual WebSocket communication to analyze echo patterns
      await testUtils.runTerminalHistoryTest(config);
      const patterns = await analyzer.analyzeBrowserCommandEchoPatterns();
      
      expect(patterns.pwdCommand).toBeDefined();
      expect(patterns.whoamiCommand).toBeDefined();
      expect(typeof patterns.duplicationTimingMs).toBe('number');
    });
  });

  describe('AC 1.8: MCP Command Echo Pattern Validation using Villenele', () => {
    it('should validate that MCP commands display correctly without duplication', async () => {
      const config: CommandConfigurationJSON = {
        sessionName: 'echo-analysis-mcp',
        workflowTimeout: 30000,
        preWebSocketCommands: [
          'ssh_connect {"name": "echo-analysis-mcp", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'pwd'},
          {initiator: 'mcp-client', command: 'whoami'},
          {initiator: 'mcp-client', command: 'echo "test mcp command"'}
        ]
      };

      // Test will verify MCP commands show no duplication
      await testUtils.runTerminalHistoryTest(config);
      const validation = await analyzer.analyzeMCPCommandEchoPatterns();
      
      expect(validation.pwdCommand.isDuplicated).toBe(false);
      expect(validation.whoamiCommand.isDuplicated).toBe(false);
      expect(validation.consistencyScore).toBe(1.0);
    });
  });

  describe('AC 1.9: Mixed Command Scenario Echo Analysis using Villenele', () => {
    it('should validate echo behavior consistency across command type switches', async () => {
      const config: CommandConfigurationJSON = {
        sessionName: 'echo-analysis-mixed',
        workflowTimeout: 30000,
        preWebSocketCommands: [
          'ssh_connect {"name": "echo-analysis-mixed", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          {initiator: 'browser', command: 'pwd'},
          {initiator: 'mcp-client', command: 'whoami'},
          {initiator: 'browser', command: 'echo "browser"'},
          {initiator: 'mcp-client', command: 'echo "mcp"'}
        ]
      };

      // Test will analyze mixed browser/MCP command scenarios
      await testUtils.runTerminalHistoryTest(config);
      const analysis = await analyzer.analyzeMixedCommandScenarios();
      
      expect(analysis.echoConsistency).toBe(true);
      expect(Array.isArray(analysis.transitionEffects)).toBe(true);
      expect(Array.isArray(analysis.commandSequence)).toBe(true);
    });
  });

  describe('AC 1.10-1.12: Command State Synchronization Impact Assessment', () => {
    it('should validate that Command State Sync features do not affect echo behavior', async () => {
      const gatingAnalysis = await analyzer.analyzeCommandGatingEchoBehavior();
      const cancellationAnalysis = await analyzer.analyzeCommandCancellationEchoBehavior();
      const fallbackAnalysis = await analyzer.analyzeNuclearFallbackEchoBehavior();
      
      expect(gatingAnalysis.browserCommandsInBuffer.isDuplicated).toBe(true);
      expect(gatingAnalysis.gatedMCPCommands.isDuplicated).toBe(false);
      expect(cancellationAnalysis.cancelledBrowserCommands.isDuplicated).toBe(true);
      expect(fallbackAnalysis.fallbackProcess.introducesEchoDuplication).toBe(false);
    });
  });

  describe('AC 1.13: Echo Duplication Mechanism Hypothesis Development', () => {
    it('should develop specific hypothesis about duplication mechanism with evidence', async () => {
      const hypothesis = await analyzer.developRootCauseHypothesis();
      
      expect(hypothesis.duplicationMechanism.codePath.length).toBeGreaterThan(0);
      expect(hypothesis.browserVsMCPDifference).toBeTruthy();
      expect(Array.isArray(hypothesis.supportingEvidence)).toBe(true);
      expect(hypothesis.supportingEvidence.length).toBeGreaterThan(0);
    });
  });

  describe('AC 1.14: Fix Complexity Assessment and Risk Analysis', () => {
    it('should evaluate fix implementation complexity and assess risks', async () => {
      const complexity = await analyzer.assessFixComplexityAndRisk();
      
      expect(['minimal', 'moderate', 'major']).toContain(complexity.complexityLevel);
      expect(['low', 'medium', 'high']).toContain(complexity.riskLevel);
      expect(Array.isArray(complexity.testingRequirements)).toBe(true);
    });
  });

  describe('AC 1.15: Analysis Documentation and Validation', () => {
    it('should provide comprehensive analysis report for fix implementation', async () => {
      const documentation = await analyzer.generateComprehensiveAnalysisReport();
      
      expect(documentation.beforeAfterBehavior).toBeDefined();
      expect(documentation.rootCauseIdentification).toBeDefined();
      expect(documentation.detailedHypothesis).toBeTruthy();
      expect(documentation.fixApproachRecommendation).toBeDefined();
    });
  });
});