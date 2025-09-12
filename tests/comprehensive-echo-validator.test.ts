/**
 * Comprehensive Echo Validator Test Suite
 * 
 * Tests covering all 18 acceptance criteria from 04_Story_ComprehensiveEchoValidation.md
 * Uses enhanced Villenele testing infrastructure with real SSH connections and WebSocket testing.
 * 
 * CRITICAL: Zero mocks - all tests use real system integration
 * Tests should PASS to demonstrate echo fix effectiveness
 */

import { ComprehensiveEchoValidator, ComprehensiveValidationReport } from '../src/comprehensive-echo-validator';

describe('Comprehensive Echo Validation - Story 04', () => {
  let validator: ComprehensiveEchoValidator;
  let validationReport: ComprehensiveValidationReport;

  beforeAll(async () => {
    validator = new ComprehensiveEchoValidator({
      enablePerformanceMonitoring: true,
      enableStresstesting: true,
      maxConcurrentSessions: 2,
      extendedOperationCount: 25, // Reduced for test performance
      sessionName: 'comprehensive-echo-test',
      timeout: 120000
    });
  }, 150000);

  afterAll(async () => {
    // Cleanup handled by validator internally
  });

  describe('Complete Validation Execution', () => {
    /**
     * Execute comprehensive validation covering all 18 acceptance criteria
     */
    test('Execute comprehensive echo validation', async () => {
      validationReport = await validator.executeComprehensiveValidation();
      
      // Basic validation execution success
      expect(validationReport).toBeDefined();
      expect(validationReport.validationTimestamp).toBeGreaterThan(0);
      expect(validationReport.overallValid).toBe(true);
      
      // Ensure all validation categories were executed
      expect(Object.keys(validationReport.commandTypeValidation)).toHaveLength(6);
      expect(validationReport.crossProtocolValidation.browserOnly).toBeDefined();
      expect(validationReport.crossProtocolValidation.mcpOnly).toBeDefined();
      expect(validationReport.crossProtocolValidation.interleaved).toBeDefined();
      expect(validationReport.edgeCaseValidation.rapidExecution).toBeDefined();
      expect(validationReport.edgeCaseValidation.longRunning).toBeDefined();
      expect(validationReport.edgeCaseValidation.interactive).toBeDefined();
      
      console.log('Comprehensive Echo Validation Report:');
      console.log('=====================================');
      console.log(`Overall Valid: ${validationReport.overallValid}`);
      console.log(`Total Tests: ${validationReport.summary.totalTestsRun}`);
      console.log(`Tests Passed: ${validationReport.summary.totalTestsPassed}`);
      console.log(`Success Rate: ${(validationReport.summary.successRate * 100).toFixed(2)}%`);
      console.log(`Critical Issues: ${validationReport.summary.criticalIssues.length}`);
      console.log(`Regression Issues: ${validationReport.summary.regressionIssues.length}`);
    }, 180000);
  });

  describe('AC 4.1-4.3: Comprehensive Echo Fix Validation', () => {
    /**
     * AC 4.1: All command types echo validation
     */
    test('AC 4.1: All command types should display exactly once', () => {
      expect(validationReport).toBeDefined();
      
      const commandTypes = ['basic', 'fileOperations', 'textProcessing', 'system'];
      
      for (const commandType of commandTypes) {
        const typeResult = validationReport.commandTypeValidation[commandType];
        expect(typeResult).toBeDefined();
        expect(typeResult.overallValid).toBe(true);
        
        // Verify browser commands show single echo
        const browserCommands = typeResult.commandResults.filter(r => r.initiator === 'browser');
        for (const cmd of browserCommands) {
          expect(cmd.echoCount).toBe(1);
          expect(cmd.isValid).toBe(true);
          if (!cmd.isValid) {
            console.log(`❌ Browser command failed: ${cmd.command} - ${cmd.errorMessage}`);
          }
        }
        
        console.log(`✅ AC 4.1: Command type '${commandType}' - ${browserCommands.length} browser commands validated`);
      }
    });

    /**
     * AC 4.2: Command complexity echo validation
     */
    test('AC 4.2: Command complexity should not affect echo fix', () => {
      expect(validationReport).toBeDefined();
      
      const complexResult = validationReport.commandTypeValidation['complex'];
      expect(complexResult).toBeDefined();
      expect(complexResult.overallValid).toBe(true);
      
      // Verify complex commands work correctly
      const browserComplexCommands = complexResult.commandResults.filter(r => r.initiator === 'browser');
      for (const cmd of browserComplexCommands) {
        expect(cmd.echoCount).toBe(1);
        expect(cmd.isValid).toBe(true);
        if (!cmd.isValid) {
          console.log(`❌ Complex browser command failed: ${cmd.command} - ${cmd.errorMessage}`);
        }
      }
      
      console.log(`✅ AC 4.2: ${browserComplexCommands.length} complex browser commands validated`);
    });

    /**
     * AC 4.3: Special character and formatting echo validation
     */
    test('AC 4.3: Special characters should display correctly', () => {
      expect(validationReport).toBeDefined();
      
      const specialResult = validationReport.commandTypeValidation['specialCharacters'];
      expect(specialResult).toBeDefined();
      expect(specialResult.overallValid).toBe(true);
      
      // Verify special character commands work correctly
      const browserSpecialCommands = specialResult.commandResults.filter(r => r.initiator === 'browser');
      for (const cmd of browserSpecialCommands) {
        expect(cmd.echoCount).toBe(1);
        expect(cmd.isValid).toBe(true);
        if (!cmd.isValid) {
          console.log(`❌ Special character browser command failed: ${cmd.command} - ${cmd.errorMessage}`);
        }
      }
      
      console.log(`✅ AC 4.3: ${browserSpecialCommands.length} special character browser commands validated`);
    });
  });

  describe('AC 4.4-4.6: Cross-Protocol Echo Validation', () => {
    /**
     * AC 4.4: Browser-only command sequences validation
     */
    test('AC 4.4: Browser-only sequence should maintain echo fix throughout', () => {
      expect(validationReport).toBeDefined();
      
      const browserOnlyResult = validationReport.crossProtocolValidation.browserOnly;
      expect(browserOnlyResult).toBeDefined();
      expect(browserOnlyResult.overallValid).toBe(true);
      expect(browserOnlyResult.totalCommands).toBe(8);
      
      // All commands should be browser commands
      const browserCommands = browserOnlyResult.commandResults.filter(r => r.initiator === 'browser');
      expect(browserCommands).toHaveLength(8);
      
      // All browser commands should display exactly once
      for (const cmd of browserCommands) {
        expect(cmd.echoCount).toBe(1);
        expect(cmd.isValid).toBe(true);
        if (!cmd.isValid) {
          console.log(`❌ Browser sequence command failed: ${cmd.command} - ${cmd.errorMessage}`);
        }
      }
      
      console.log(`✅ AC 4.4: Browser-only sequence - 8 commands validated successfully`);
    });

    /**
     * AC 4.5: MCP-only command sequences validation
     */
    test('AC 4.5: MCP-only sequence should maintain baseline behavior', () => {
      expect(validationReport).toBeDefined();
      
      const mcpOnlyResult = validationReport.crossProtocolValidation.mcpOnly;
      expect(mcpOnlyResult).toBeDefined();
      expect(mcpOnlyResult.overallValid).toBe(true);
      expect(mcpOnlyResult.totalCommands).toBe(7);
      
      // All commands should be MCP commands
      const mcpCommands = mcpOnlyResult.commandResults.filter(r => r.initiator === 'mcp-client');
      expect(mcpCommands).toHaveLength(7);
      
      // All MCP commands should maintain baseline behavior
      for (const cmd of mcpCommands) {
        expect(cmd.echoCount).toBe(1);
        expect(cmd.isValid).toBe(true);
        if (!cmd.isValid) {
          console.log(`❌ MCP sequence command failed: ${cmd.command} - ${cmd.errorMessage}`);
        }
      }
      
      console.log(`✅ AC 4.5: MCP-only sequence - 7 commands validated successfully`);
    });

    /**
     * AC 4.6: Interleaved browser-MCP command sequences validation
     */
    test('AC 4.6: Interleaved sequence should handle mixed protocols correctly', () => {
      expect(validationReport).toBeDefined();
      
      const interleavedResult = validationReport.crossProtocolValidation.interleaved;
      expect(interleavedResult).toBeDefined();
      expect(interleavedResult.overallValid).toBe(true);
      expect(interleavedResult.totalCommands).toBe(9);
      
      // Verify mixed command initiators
      const browserCommands = interleavedResult.commandResults.filter(r => r.initiator === 'browser');
      const mcpCommands = interleavedResult.commandResults.filter(r => r.initiator === 'mcp-client');
      
      expect(browserCommands.length).toBeGreaterThan(0);
      expect(mcpCommands.length).toBeGreaterThan(0);
      expect(browserCommands.length + mcpCommands.length).toBe(9);
      
      // All commands should display correctly regardless of interleaving
      for (const cmd of interleavedResult.commandResults) {
        expect(cmd.echoCount).toBe(1);
        expect(cmd.isValid).toBe(true);
        if (!cmd.isValid) {
          console.log(`❌ Interleaved command failed: ${cmd.command} (${cmd.initiator}) - ${cmd.errorMessage}`);
        }
      }
      
      console.log(`✅ AC 4.6: Interleaved sequence - ${browserCommands.length} browser + ${mcpCommands.length} MCP commands validated`);
    });
  });

  describe('AC 4.7-4.9: Edge Case and Stress Testing', () => {
    /**
     * AC 4.7: Rapid command execution echo validation
     */
    test('AC 4.7: Rapid execution should not affect echo fix', () => {
      expect(validationReport).toBeDefined();
      
      const rapidResult = validationReport.edgeCaseValidation.rapidExecution;
      expect(rapidResult).toBeDefined();
      expect(rapidResult.overallValid).toBe(true);
      
      // Verify rapid execution maintains echo fix
      const browserCommands = rapidResult.commandResults.filter(r => r.initiator === 'browser');
      for (const cmd of browserCommands) {
        expect(cmd.echoCount).toBe(1);
        expect(cmd.isValid).toBe(true);
        if (!cmd.isValid) {
          console.log(`❌ Rapid execution command failed: ${cmd.command} - ${cmd.errorMessage}`);
        }
      }
      
      // Performance check
      expect(rapidResult.performanceMetrics.averageCommandTime).toBeLessThan(10000); // 10s max per command
      
      console.log(`✅ AC 4.7: Rapid execution - ${browserCommands.length} commands validated`);
    });

    /**
     * AC 4.8: Long-running command echo validation
     */
    test('AC 4.8: Long-running commands should maintain echo fix', () => {
      expect(validationReport).toBeDefined();
      
      const longRunningResult = validationReport.edgeCaseValidation.longRunning;
      expect(longRunningResult).toBeDefined();
      expect(longRunningResult.overallValid).toBe(true);
      
      // Verify long-running commands maintain echo fix
      for (const cmd of longRunningResult.commandResults) {
        expect(cmd.echoCount).toBe(1);
        expect(cmd.isValid).toBe(true);
        if (!cmd.isValid) {
          console.log(`❌ Long-running command failed: ${cmd.command} - ${cmd.errorMessage}`);
        }
      }
      
      console.log(`✅ AC 4.8: Long-running commands - ${longRunningResult.totalCommands} commands validated`);
    });

    /**
     * AC 4.9: Interactive command scenario validation
     */
    test('AC 4.9: Interactive scenarios should maintain echo fix', () => {
      expect(validationReport).toBeDefined();
      
      const interactiveResult = validationReport.edgeCaseValidation.interactive;
      expect(interactiveResult).toBeDefined();
      expect(interactiveResult.overallValid).toBe(true);
      
      // Verify interactive scenarios maintain echo fix
      for (const cmd of interactiveResult.commandResults) {
        expect(cmd.echoCount).toBe(1);
        expect(cmd.isValid).toBe(true);
        if (!cmd.isValid) {
          console.log(`❌ Interactive command failed: ${cmd.command} - ${cmd.errorMessage}`);
        }
      }
      
      console.log(`✅ AC 4.9: Interactive scenarios - ${interactiveResult.totalCommands} commands validated`);
    });
  });

  describe('AC 4.10-4.12: Command State Sync Integration Testing', () => {
    /**
     * AC 4.10: Echo validation with command gating scenarios
     */
    test('AC 4.10: Command gating should not affect echo fix', () => {
      expect(validationReport).toBeDefined();
      
      const gatingResult = validationReport.commandStateSyncValidation.gatingScenarios;
      expect(gatingResult).toBeDefined();
      expect(gatingResult.overallValid).toBe(true);
      
      // Verify gating scenarios maintain echo fix
      const browserCommands = gatingResult.commandResults.filter(r => r.initiator === 'browser');
      for (const cmd of browserCommands) {
        expect(cmd.echoCount).toBe(1);
        expect(cmd.isValid).toBe(true);
        if (!cmd.isValid) {
          console.log(`❌ Gating scenario command failed: ${cmd.command} - ${cmd.errorMessage}`);
        }
      }
      
      console.log(`✅ AC 4.10: Command gating scenarios - ${browserCommands.length} browser commands validated`);
    });

    /**
     * AC 4.11: Echo validation with command cancellation scenarios
     */
    test('AC 4.11: Command cancellation should not affect echo fix', () => {
      expect(validationReport).toBeDefined();
      
      const cancellationResult = validationReport.commandStateSyncValidation.cancellationScenarios;
      expect(cancellationResult).toBeDefined();
      expect(cancellationResult.overallValid).toBe(true);
      
      // Verify cancellation scenarios maintain echo fix
      const browserCommands = cancellationResult.commandResults.filter(r => r.initiator === 'browser');
      for (const cmd of browserCommands) {
        expect(cmd.echoCount).toBe(1);
        expect(cmd.isValid).toBe(true);
        if (!cmd.isValid) {
          console.log(`❌ Cancellation scenario command failed: ${cmd.command} - ${cmd.errorMessage}`);
        }
      }
      
      console.log(`✅ AC 4.11: Command cancellation scenarios - ${browserCommands.length} browser commands validated`);
    });

    /**
     * AC 4.12: Echo validation with nuclear fallback scenarios
     */
    test('AC 4.12: Nuclear fallback should not affect echo fix', () => {
      expect(validationReport).toBeDefined();
      
      const nuclearResult = validationReport.commandStateSyncValidation.nuclearFallback;
      expect(nuclearResult).toBeDefined();
      expect(nuclearResult.overallValid).toBe(true);
      
      // Verify nuclear fallback scenarios maintain echo fix
      const browserCommands = nuclearResult.commandResults.filter(r => r.initiator === 'browser');
      for (const cmd of browserCommands) {
        expect(cmd.echoCount).toBe(1);
        expect(cmd.isValid).toBe(true);
        if (!cmd.isValid) {
          console.log(`❌ Nuclear fallback command failed: ${cmd.command} - ${cmd.errorMessage}`);
        }
      }
      
      console.log(`✅ AC 4.12: Nuclear fallback scenarios - ${browserCommands.length} browser commands validated`);
    });
  });

  describe('AC 4.13-4.15: Performance and Stability Validation', () => {
    /**
     * AC 4.13: Extended operation echo stability (25+ commands)
     */
    test('AC 4.13: Extended operations should maintain echo fix stability', () => {
      expect(validationReport).toBeDefined();
      
      const extendedResult = validationReport.performanceValidation.extendedOperation;
      expect(extendedResult).toBeDefined();
      expect(extendedResult.overallValid).toBe(true);
      expect(extendedResult.totalCommands).toBeGreaterThanOrEqual(25);
      
      // Verify extended operation maintains echo fix throughout
      const browserCommands = extendedResult.commandResults.filter(r => r.initiator === 'browser');
      for (const cmd of browserCommands) {
        expect(cmd.echoCount).toBe(1);
        expect(cmd.isValid).toBe(true);
        if (!cmd.isValid) {
          console.log(`❌ Extended operation command failed: ${cmd.command} - ${cmd.errorMessage}`);
        }
      }
      
      // Performance validation
      expect(extendedResult.performanceMetrics.averageCommandTime).toBeLessThan(15000); // 15s max average
      
      console.log(`✅ AC 4.13: Extended operation - ${extendedResult.totalCommands} commands, ${browserCommands.length} browser commands validated`);
      console.log(`Performance: ${extendedResult.performanceMetrics.averageCommandTime.toFixed(0)}ms average per command`);
    });

    /**
     * AC 4.14: Concurrent session echo validation
     */
    test('AC 4.14: Concurrent sessions should maintain echo fix', () => {
      expect(validationReport).toBeDefined();
      
      const concurrentResults = validationReport.performanceValidation.concurrentSessions;
      expect(concurrentResults).toBeDefined();
      expect(concurrentResults.length).toBeGreaterThan(0);
      
      // Verify each concurrent session maintains echo fix
      for (let i = 0; i < concurrentResults.length; i++) {
        const sessionResult = concurrentResults[i];
        expect(sessionResult.overallValid).toBe(true);
        
        const browserCommands = sessionResult.commandResults.filter(r => r.initiator === 'browser');
        for (const cmd of browserCommands) {
          expect(cmd.echoCount).toBe(1);
          expect(cmd.isValid).toBe(true);
          if (!cmd.isValid) {
            console.log(`❌ Concurrent session ${i + 1} command failed: ${cmd.command} - ${cmd.errorMessage}`);
          }
        }
      }
      
      console.log(`✅ AC 4.14: ${concurrentResults.length} concurrent sessions validated`);
    });

    /**
     * AC 4.15: System resource usage validation
     */
    test('AC 4.15: Resource usage should be within acceptable limits', () => {
      expect(validationReport).toBeDefined();
      
      const resourceUsage = validationReport.performanceValidation.resourceUsage;
      expect(resourceUsage).toBeDefined();
      expect(resourceUsage.connectionStability).toBe(true);
      
      // Validate resource usage
      expect(resourceUsage.memoryUsage).toBeDefined();
      expect(resourceUsage.memoryUsage!).toBeLessThan(500 * 1024 * 1024); // 500MB max
      expect(resourceUsage.errorCount).toBe(0);
      
      console.log(`✅ AC 4.15: Resource usage - Memory: ${(resourceUsage.memoryUsage! / 1024 / 1024).toFixed(2)}MB, Errors: ${resourceUsage.errorCount}`);
    });
  });

  describe('AC 4.16-4.18: Regression Prevention and Documentation', () => {
    /**
     * AC 4.16: Echo validation test suite integration
     */
    test('AC 4.16: Test suite should integrate successfully', () => {
      expect(validationReport).toBeDefined();
      expect(validationReport.overallValid).toBe(true);
      
      // This test itself proves successful test suite integration
      console.log(`✅ AC 4.16: Test suite integration successful - ${validationReport.summary.totalTestsRun} tests executed`);
    });

    /**
     * AC 4.17: Echo fix effectiveness documentation
     */
    test('AC 4.17: Echo fix effectiveness should be documented', () => {
      expect(validationReport).toBeDefined();
      
      // Verify comprehensive reporting
      expect(validationReport.summary.successRate).toBeGreaterThanOrEqual(0.95); // 95% success rate
      expect(validationReport.summary.regressionIssues).toHaveLength(0); // No regressions
      
      // Document effectiveness evidence
      const evidence = {
        totalCommandsValidated: validationReport.summary.totalTestsRun,
        successRate: `${(validationReport.summary.successRate * 100).toFixed(2)}%`,
        browserCommandsValidated: countBrowserCommands(validationReport),
        doubleEchoIssuesFound: validationReport.summary.regressionIssues.length,
        criticalIssues: validationReport.summary.criticalIssues.length
      };
      
      console.log('✅ AC 4.17: Echo Fix Effectiveness Evidence:');
      console.log(`  Total Commands Validated: ${evidence.totalCommandsValidated}`);
      console.log(`  Success Rate: ${evidence.successRate}`);
      console.log(`  Browser Commands Validated: ${evidence.browserCommandsValidated}`);
      console.log(`  Double Echo Issues Found: ${evidence.doubleEchoIssuesFound}`);
      console.log(`  Critical Issues: ${evidence.criticalIssues}`);
    });

    /**
     * AC 4.18: Long-term echo validation monitoring
     */
    test('AC 4.18: Validation framework should support long-term monitoring', () => {
      expect(validationReport).toBeDefined();
      
      // Verify comprehensive monitoring capabilities
      expect(validationReport.validationTimestamp).toBeGreaterThan(0);
      expect(validationReport.summary).toBeDefined();
      expect(validationReport.performanceValidation.resourceUsage).toBeDefined();
      
      // Framework supports monitoring by providing:
      // 1. Timestamped validation reports
      // 2. Performance metrics tracking
      // 3. Regression detection
      // 4. Resource usage monitoring
      // 5. Comprehensive command coverage
      
      console.log(`✅ AC 4.18: Long-term monitoring framework established`);
      console.log(`  Validation timestamp: ${new Date(validationReport.validationTimestamp).toISOString()}`);
      console.log(`  Monitoring categories: ${Object.keys(validationReport.commandTypeValidation).length} command types`);
      console.log(`  Regression detection: ${validationReport.summary.regressionIssues.length} issues found`);
    });
  });

});

/**
 * Helper function to count browser commands across all validation results
 */
function countBrowserCommands(report: ComprehensiveValidationReport): number {
  let count = 0;
  
  // Count from command type validation
  for (const result of Object.values(report.commandTypeValidation)) {
    count += result.commandResults.filter(r => r.initiator === 'browser').length;
  }
  
  // Count from cross-protocol validation
  if (report.crossProtocolValidation.browserOnly) {
    count += report.crossProtocolValidation.browserOnly.commandResults.filter(r => r.initiator === 'browser').length;
  }
  if (report.crossProtocolValidation.interleaved) {
    count += report.crossProtocolValidation.interleaved.commandResults.filter(r => r.initiator === 'browser').length;
  }
  
  // Count from edge case validation
  if (report.edgeCaseValidation.rapidExecution) {
    count += report.edgeCaseValidation.rapidExecution.commandResults.filter(r => r.initiator === 'browser').length;
  }
  if (report.edgeCaseValidation.interactive) {
    count += report.edgeCaseValidation.interactive.commandResults.filter(r => r.initiator === 'browser').length;
  }
  
  return count;
}