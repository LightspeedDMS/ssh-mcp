/**
 * AC 2.1 Basic Test - Development Workflow Scenario Testing
 * 
 * Simple test to validate the ProductionScenarioValidator works for AC 2.1
 * This is a focused test to confirm our implementation works before running the full suite
 */

import { TestEnvironmentConfig } from './test-environment-config';

describe('AC 2.1 Basic Test - Development Workflow', () => {
  const username = TestEnvironmentConfig.getTestUsername();
  const sshKeyPath = TestEnvironmentConfig.getTestSSHKeyPath();

  it('should successfully instantiate ProductionScenarioValidator and run AC 2.1 scenario', async () => {
    try {
      // Import the ProductionScenarioValidator
      const { ProductionScenarioValidator } = require('../src/production-scenario-validator');
      
      // Create the validator instance
      const validator = new ProductionScenarioValidator({
        username,
        sshKeyPath,
        enableProfessionalDisplayValidation: true,
        enablePerformanceMonitoring: true,
        enableDetailedLogging: true
      });

      console.log('✅ ProductionScenarioValidator instantiated successfully');

      // Define a simple development workflow scenario
      const developmentScenario = {
        name: 'basic-development-workflow',
        description: 'Basic git and code exploration commands',
        commands: [
          { initiator: 'browser', command: 'pwd' },
          { initiator: 'browser', command: 'whoami' },
          { initiator: 'browser', command: 'git status || echo not_a_git_repo' },
          { initiator: 'browser', command: 'ls -la' },
        ],
        expectedDuration: 30000,
        performanceThresholds: {
          maxExecutionTime: 45000,
          minResponseTime: 100
        }
      };

      console.log('🚀 Starting development workflow scenario execution...');

      // Execute the scenario
      const result = await validator.executeProductionScenario(developmentScenario);

      console.log('📊 Production scenario result:', {
        success: result.success,
        scenarioName: result.scenarioName,
        executionTime: result.executionTime,
        professionalDisplay: result.professionalDisplay,
        echoQuality: result.echoQuality,
        terminalFormatting: result.terminalFormatting,
        userExperience: result.userExperience,
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      });

      if (result.performanceMetrics) {
        console.log('📈 Performance metrics:', result.performanceMetrics);
      }

      if (result.errors.length > 0) {
        console.log('❌ Errors:', result.errors);
      }

      if (result.warnings.length > 0) {
        console.log('⚠️ Warnings:', result.warnings);
      }

      // Validate that the scenario executed successfully
      expect(result.success).toBe(true);
      expect(result.scenarioName).toBe('basic-development-workflow');
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.professionalDisplay).toBe(true);
      expect(['excellent', 'good', 'poor']).toContain(result.echoQuality);
      expect(['clean', 'acceptable', 'poor']).toContain(result.terminalFormatting);
      expect(['professional', 'acceptable', 'poor']).toContain(result.userExperience);

      console.log('✅ AC 2.1 Development workflow scenario executed successfully!');
      console.log(`📊 Final assessment: ${result.userExperience} user experience with ${result.echoQuality} echo quality`);

    } catch (error) {
      console.error('❌ AC 2.1 Test failed:', error);
      throw error;
    }
  }, 60000); // 60-second timeout for this test
});