/**
 * Echo Regression Analyzer Tests - TDD Implementation
 * 
 * CRITICAL: No mocks - tests use real EchoRegressionAnalyzer functionality
 * These tests call REAL analysis methods that perform REAL system investigation
 * 
 * Based on AC 1.1-1.15 from 01_Story_EchoRegressionAnalysis.md
 */

import { EchoRegressionAnalyzer } from '../src/echo-regression-analyzer';

describe('EchoRegressionAnalyzer', () => {
  let analyzer: EchoRegressionAnalyzer;

  beforeEach(async () => {
    // Create real analyzer instance - NO MOCKS
    analyzer = new EchoRegressionAnalyzer();
  });

  describe('Git History Analysis (AC 1.1, 1.4)', () => {
    test('should analyze pre-Command State Sync echo behavior using real git commands', async () => {
      // AC 1.1: Pre-Command State Sync echo behavior documentation
      const gitAnalysis = await analyzer.analyzeGitHistory();
      
      // Should return real git analysis results, not hardcoded values
      expect(gitAnalysis).toBeDefined();
      expect(gitAnalysis.preCommandStateSyncCommit).toBeDefined();
      expect(gitAnalysis.commandStateSyncImplementationCommit).toBeDefined();
      expect(gitAnalysis.echoRelatedChanges).toBeInstanceOf(Array);
      
      // Should have real commit hashes from actual git log
      expect(gitAnalysis.preCommandStateSyncCommit).toMatch(/^[a-f0-9]{7,40}$/);
      expect(gitAnalysis.commandStateSyncImplementationCommit).toMatch(/^[a-f0-9]{7,40}$/);
      
      // Should contain evidence of real code analysis
      expect(gitAnalysis.echoRelatedChanges.length).toBeGreaterThan(0);
    });

    test('should identify specific code changes affecting echo handling using real git diff', async () => {
      // AC 1.4: Command State Sync implementation impact analysis
      const codeChanges = await analyzer.analyzeCodeChanges();
      
      // Should return real file change analysis
      expect(codeChanges).toBeDefined();
      expect(codeChanges.sshConnectionManagerChanges).toBeDefined();
      expect(codeChanges.webServerManagerChanges).toBeDefined();
      expect(codeChanges.potentialEchoAffectingChanges).toBeInstanceOf(Array);
      
      // Should contain real line numbers and code snippets
      expect(codeChanges.potentialEchoAffectingChanges.length).toBeGreaterThan(0);
      
      // Verify changes include line numbers and actual code
      const firstChange = codeChanges.potentialEchoAffectingChanges[0];
      expect(firstChange.file).toBeDefined();
      expect(firstChange.lineNumber).toBeGreaterThan(0);
      expect(firstChange.description).toBeDefined();
    });
  });

  describe('Current Echo Regression Analysis (AC 1.2, 1.3)', () => {
    test('should characterize current double echo regression using real Villenele testing', async () => {
      // AC 1.2: Current regression behavior characterization
      const regressionAnalysis = await analyzer.analyzeCurrentEchoBehavior();
      
      // Should execute real terminal tests to gather evidence
      expect(regressionAnalysis).toBeDefined();
      expect(regressionAnalysis.browserCommandEcho).toBeDefined();
      expect(regressionAnalysis.mcpCommandEcho).toBeDefined();
      expect(regressionAnalysis.duplicationPattern).toBeDefined();
      
      // Should contain actual WebSocket message evidence
      expect(regressionAnalysis.browserCommandEcho.webSocketMessages).toBeDefined();
      expect(regressionAnalysis.browserCommandEcho.webSocketMessages.length).toBeGreaterThan(0);
      
      // Should detect actual duplication in browser commands
      expect(regressionAnalysis.browserCommandEcho.isDuplicated).toBe(true);
      expect(regressionAnalysis.mcpCommandEcho.isDuplicated).toBe(false);
    });

    test('should analyze regression scope across command types using enhanced Villenele', async () => {
      // AC 1.3: Regression scope and impact analysis
      const scopeAnalysis = await analyzer.analyzeRegressionScope();
      
      // Should test real commands with Villenele framework
      expect(scopeAnalysis).toBeDefined();
      expect(scopeAnalysis.simpleCommands).toBeDefined();
      expect(scopeAnalysis.complexCommands).toBeDefined();
      expect(scopeAnalysis.interactiveCommands).toBeDefined();
      
      // Should contain results from actual command execution
      expect(scopeAnalysis.simpleCommands.length).toBeGreaterThan(0);
      expect(scopeAnalysis.complexCommands.length).toBeGreaterThan(0);
      
      // Verify all commands show consistent duplication pattern
      const allCommands = [...scopeAnalysis.simpleCommands, ...scopeAnalysis.complexCommands];
      allCommands.forEach(cmd => {
        expect(cmd.command).toBeDefined();
        expect(cmd.isDuplicated).toBeDefined();
        expect(cmd.webSocketResponse).toBeDefined();
      });
    });
  });

  describe('Enhanced Villenele Testing (AC 1.7, 1.8, 1.9)', () => {
    test('should analyze browser command echo patterns using Feature 01 capabilities', async () => {
      // AC 1.7: Browser command echo pattern analysis using Villenele
      const browserEchoAnalysis = await analyzer.analyzeBrowserCommandEchoPatterns();
      
      // Should use real enhanced Villenele framework
      expect(browserEchoAnalysis).toBeDefined();
      expect(browserEchoAnalysis.pwdCommand).toBeDefined();
      expect(browserEchoAnalysis.whoamiCommand).toBeDefined();
      expect(browserEchoAnalysis.echoTestCommand).toBeDefined();
      
      // Should contain actual WebSocket response patterns
      browserEchoAnalysis.pwdCommand.webSocketResponses.forEach((response: any) => {
        expect(response.timestamp).toBeGreaterThan(0);
        expect(response.data).toBeDefined();
        expect(response.messageType).toMatch(/^(command_echo|command_result)$/);
      });
      
      // Should detect actual duplication timing
      expect(browserEchoAnalysis.duplicationTimingMs).toBeGreaterThan(0);
    });

    test('should validate MCP command echo patterns with no duplication', async () => {
      // AC 1.8: MCP command echo pattern validation using Villenele
      const mcpEchoAnalysis = await analyzer.analyzeMCPCommandEchoPatterns();
      
      // Should execute real MCP commands via Villenele
      expect(mcpEchoAnalysis).toBeDefined();
      expect(mcpEchoAnalysis.pwdCommand).toBeDefined();
      expect(mcpEchoAnalysis.whoamiCommand).toBeDefined();
      expect(mcpEchoAnalysis.echoTestCommand).toBeDefined();
      
      // Should confirm no duplication in MCP commands
      expect(mcpEchoAnalysis.pwdCommand.isDuplicated).toBe(false);
      expect(mcpEchoAnalysis.whoamiCommand.isDuplicated).toBe(false);
      expect(mcpEchoAnalysis.echoTestCommand.isDuplicated).toBe(false);
      
      // Should contain single display pattern evidence
      mcpEchoAnalysis.pwdCommand.webSocketResponses.forEach((response: any) => {
        expect(response.isDuplicateEcho).toBe(false);
      });
    });

    test('should analyze mixed command scenarios for echo consistency', async () => {
      // AC 1.9: Mixed command scenario echo analysis using Villenele
      const mixedScenarioAnalysis = await analyzer.analyzeMixedCommandScenarios();
      
      // Should execute real interleaved browser and MCP commands
      expect(mixedScenarioAnalysis).toBeDefined();
      expect(mixedScenarioAnalysis.commandSequence).toBeDefined();
      expect(mixedScenarioAnalysis.commandSequence.length).toBe(4); // As specified in AC 1.9
      
      // Should maintain echo behavior consistency
      const browserCommands = mixedScenarioAnalysis.commandSequence.filter((cmd: any) => cmd.initiator === 'browser');
      const mcpCommands = mixedScenarioAnalysis.commandSequence.filter((cmd: any) => cmd.initiator === 'mcp-client');
      
      browserCommands.forEach((cmd: any) => {
        expect(cmd.isDuplicated).toBe(true);
      });
      
      mcpCommands.forEach((cmd: any) => {
        expect(cmd.isDuplicated).toBe(false);
      });
    });
  });

  describe('Command State Synchronization Impact (AC 1.10, 1.11, 1.12)', () => {
    test('should analyze command gating scenario echo behavior', async () => {
      // AC 1.10: Command gating scenario echo behavior analysis
      const gatingAnalysis = await analyzer.analyzeCommandGatingEchoBehavior();
      
      // Should test real command gating scenarios
      expect(gatingAnalysis).toBeDefined();
      expect(gatingAnalysis.browserCommandsInBuffer).toBeDefined();
      expect(gatingAnalysis.gatedMCPCommands).toBeDefined();
      expect(gatingAnalysis.browserCommandEchoError).toBeDefined();
      
      // Should verify gating doesn't affect browser command echo
      expect(gatingAnalysis.browserCommandsInBuffer.isDuplicated).toBe(true);
      expect(gatingAnalysis.gatedMCPCommands.errorResponse).toContain('BROWSER_COMMANDS_EXECUTED');
    });

    test('should analyze command cancellation impact on echo behavior', async () => {
      // AC 1.11: Command cancellation impact on echo behavior
      const cancellationAnalysis = await analyzer.analyzeCommandCancellationEchoBehavior();
      
      // Should test real command cancellation scenarios
      expect(cancellationAnalysis).toBeDefined();
      expect(cancellationAnalysis.cancelledBrowserCommands).toBeDefined();
      expect(cancellationAnalysis.cancelledMCPCommands).toBeDefined();
      expect(cancellationAnalysis.postCancellationCommands).toBeDefined();
      
      // Should verify cancellation doesn't introduce additional echo issues
      expect(cancellationAnalysis.cancelledBrowserCommands.isDuplicated).toBe(true);
      expect(cancellationAnalysis.cancelledMCPCommands.isDuplicated).toBe(false);
      expect(cancellationAnalysis.postCancellationCommands.isDuplicated).toBe(true);
    });

    test('should validate nuclear fallback echo behavior', async () => {
      // AC 1.12: Nuclear fallback echo behavior validation
      const fallbackAnalysis = await analyzer.analyzeNuclearFallbackEchoBehavior();
      
      // Should test real nuclear fallback scenarios
      expect(fallbackAnalysis).toBeDefined();
      expect(fallbackAnalysis.preFallbackCommands).toBeDefined();
      expect(fallbackAnalysis.fallbackProcess).toBeDefined();
      expect(fallbackAnalysis.postFallbackCommands).toBeDefined();
      
      // Should verify fallback doesn't affect subsequent echo behavior
      expect(fallbackAnalysis.preFallbackCommands.isDuplicated).toBe(true);
      expect(fallbackAnalysis.postFallbackCommands.isDuplicated).toBe(true);
      expect(fallbackAnalysis.fallbackProcess.introducesEchoDuplication).toBe(false);
    });
  });

  describe('Root Cause Analysis and Documentation (AC 1.13, 1.14, 1.15)', () => {
    test('should develop evidence-based root cause hypothesis', async () => {
      // AC 1.13: Echo duplication mechanism hypothesis development
      const rootCauseHypothesis = await analyzer.developRootCauseHypothesis();
      
      // Should synthesize findings from all previous analysis
      expect(rootCauseHypothesis).toBeDefined();
      expect(rootCauseHypothesis.duplicationMechanism).toBeDefined();
      expect(rootCauseHypothesis.browserVsMCPDifference).toBeDefined();
      expect(rootCauseHypothesis.commandStateSyncInteraction).toBeDefined();
      expect(rootCauseHypothesis.supportingEvidence).toBeDefined();
      expect(rootCauseHypothesis.proposedCodeChanges).toBeDefined();
      
      // Should contain specific code path identification
      expect(rootCauseHypothesis.duplicationMechanism.codePath).toBeDefined();
      expect(rootCauseHypothesis.duplicationMechanism.codePath.length).toBeGreaterThan(0);
      
      // Should have evidence supporting the hypothesis
      expect(rootCauseHypothesis.supportingEvidence.length).toBeGreaterThan(0);
    });

    test('should assess fix complexity and implementation risk', async () => {
      // AC 1.14: Fix complexity assessment and risk analysis
      const fixAssessment = await analyzer.assessFixComplexityAndRisk();
      
      // Should provide real complexity analysis
      expect(fixAssessment).toBeDefined();
      expect(fixAssessment.complexityLevel).toMatch(/^(minimal|moderate|major)$/);
      expect(fixAssessment.riskLevel).toMatch(/^(low|medium|high)$/);
      expect(fixAssessment.estimatedEffort).toBeDefined();
      expect(fixAssessment.commandStateSyncRisk).toBeDefined();
      expect(fixAssessment.testingRequirements).toBeDefined();
      expect(fixAssessment.potentialSideEffects).toBeDefined();
      
      // Should have specific testing scenarios
      expect(fixAssessment.testingRequirements.length).toBeGreaterThan(0);
    });

    test('should generate comprehensive analysis documentation', async () => {
      // AC 1.15: Analysis documentation and validation
      const analysisReport = await analyzer.generateComprehensiveAnalysisReport();
      
      // Should provide complete analysis documentation
      expect(analysisReport).toBeDefined();
      expect(analysisReport.beforeAfterBehavior).toBeDefined();
      expect(analysisReport.rootCauseIdentification).toBeDefined();
      expect(analysisReport.detailedHypothesis).toBeDefined();
      expect(analysisReport.fixApproachRecommendation).toBeDefined();
      expect(analysisReport.additionalValidationResults).toBeDefined();
      
      // Should include code references
      expect(analysisReport.rootCauseIdentification.codeReferences).toBeDefined();
      expect(analysisReport.rootCauseIdentification.codeReferences.length).toBeGreaterThan(0);
      
      // Should provide surgical fix approach
      expect(analysisReport.fixApproachRecommendation.approach).toMatch(/^(surgical|refactor|redesign)$/);
      expect(analysisReport.fixApproachRecommendation.specificChanges).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should execute complete echo regression analysis workflow', async () => {
      // Full workflow test using all analysis methods
      const completeAnalysis = await analyzer.executeCompleteAnalysis();
      
      // Should return comprehensive analysis results
      expect(completeAnalysis).toBeDefined();
      expect(completeAnalysis.gitAnalysis).toBeDefined();
      expect(completeAnalysis.codeChangeAnalysis).toBeDefined();
      expect(completeAnalysis.currentBehaviorAnalysis).toBeDefined();
      expect(completeAnalysis.villeneleTestingResults).toBeDefined();
      expect(completeAnalysis.commandStateSyncImpact).toBeDefined();
      expect(completeAnalysis.rootCauseHypothesis).toBeDefined();
      expect(completeAnalysis.fixAssessment).toBeDefined();
      expect(completeAnalysis.finalReport).toBeDefined();
      
      // Should provide actionable fix guidance
      expect(completeAnalysis.finalReport.isReadyForImplementation).toBe(true);
      expect(completeAnalysis.finalReport.surgicalFixGuidance).toBeDefined();
    });
  });
});