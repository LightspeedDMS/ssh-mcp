/**
 * Test the problematic find command with quote escaping fix
 */

import { TestEnvironmentConfig } from './test-environment-config';

describe('Test Find Command Quote Escaping Fix', () => {
  const username = TestEnvironmentConfig.getTestUsername();
  const sshKeyPath = TestEnvironmentConfig.getTestSSHKeyPath();

  it('should handle find command with quotes correctly', async () => {
    try {
      const { ProductionScenarioValidator } = require('../src/production-scenario-validator');
      const validator = new ProductionScenarioValidator({
        username,
        sshKeyPath,
        enableDetailedLogging: true
      });

      const scenario = {
        name: 'test-find-command',
        description: 'Test find command with quotes',
        commands: [
          { initiator: 'browser', command: 'find . -name "*.ts" | head -10 || echo no_ts_files' }
        ],
        expectedDuration: 20000
      };

      console.log('🔍 Testing find command with quotes...');
      const result = await validator.executeProductionScenario(scenario);

      console.log('📊 Find command result:', {
        success: result.success,
        professionalDisplay: result.professionalDisplay,
        echoQuality: result.echoQuality,
        userExperience: result.userExperience,
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      });

      if (result.errors.length > 0) {
        console.log('❌ Errors:', result.errors);
      }

      expect(result.success).toBe(true);
      expect(result.professionalDisplay).toBe(true);
      
      console.log('✅ Find command with quotes executed successfully!');

    } catch (error) {
      console.error('❌ Find command test failed:', (error as Error).message);
      throw error;
    }
  }, 30000);
});