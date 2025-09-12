/**
 * Debug AC 2.3 - File Management Workflow
 * 
 * Debug test to identify why AC 2.3 is failing
 */

import { TestEnvironmentConfig } from './test-environment-config';

describe('Debug AC 2.3 - File Management Workflow', () => {
  const username = TestEnvironmentConfig.getTestUsername();
  const sshKeyPath = TestEnvironmentConfig.getTestSSHKeyPath();

  it('should debug file management workflow execution', async () => {
    try {
      const { ProductionScenarioValidator } = require('../src/production-scenario-validator');
      const validator = new ProductionScenarioValidator({
        username,
        sshKeyPath,
        enableProfessionalDisplayValidation: true,
        enablePerformanceMonitoring: true,
        enableDetailedLogging: true // Enable detailed logging
      });

      // Simplified file management scenario for debugging
      const fileManagementScenario = {
        name: 'debug-file-management',
        description: 'Debug file management workflow',
        commands: [
          { initiator: 'browser', command: 'ls -la' },
          { initiator: 'browser', command: 'pwd' },
          { initiator: 'browser', command: 'whoami' }
        ],
        expectedDuration: 20000
      };

      console.log('🔍 Starting debug of AC 2.3 file management workflow...');

      const result = await validator.executeProductionScenario(fileManagementScenario);

      console.log('📊 Debug Result Full Details:', JSON.stringify(result, null, 2));

      if (result.errors.length > 0) {
        console.log('❌ Errors found:', result.errors);
      }

      if (result.warnings.length > 0) {
        console.log('⚠️ Warnings found:', result.warnings);
      }

      if (result.rawWorkflowResult) {
        console.log('🔍 Raw workflow success:', result.rawWorkflowResult.success);
        console.log('🔍 Raw workflow error:', result.rawWorkflowResult.error);
        console.log('🔍 Raw workflow execution time:', result.rawWorkflowResult.totalExecutionTime);
        console.log('🔍 Raw workflow responses length:', result.rawWorkflowResult.concatenatedResponses.length);
        if (result.rawWorkflowResult.concatenatedResponses.length < 500) {
          console.log('🔍 Raw workflow responses preview:', JSON.stringify(result.rawWorkflowResult.concatenatedResponses.substring(0, 200)));
        }
      }

      // Don't fail the test - we're debugging
      console.log('🔍 Debug completed - analyzing results...');

    } catch (error) {
      console.error('❌ Debug test failed:', error);
      throw error;
    }
  }, 60000);
});