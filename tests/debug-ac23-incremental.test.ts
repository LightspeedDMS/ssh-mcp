/**
 * Debug AC 2.3 Incremental - File Management Commands One by One
 * 
 * Test each command individually to find which one is causing the failure
 */

import { TestEnvironmentConfig } from './test-environment-config';

describe('Debug AC 2.3 Incremental - File Management Commands', () => {
  const username = TestEnvironmentConfig.getTestUsername();
  const sshKeyPath = TestEnvironmentConfig.getTestSSHKeyPath();

  const commands = [
    'ls -la',
    'find . -name "*.ts" | head -10 || echo no_ts_files',
    'du -sh * | head -10 || echo no_files',
    'cat package.json | head -15',
    'wc -l *.md || echo no_md_files',
    'head -5 package.json',
    'file package.json',
    'stat package.json'
  ];

  commands.forEach((command, index) => {
    it(`should execute command ${index + 1}: ${command}`, async () => {
      try {
        const { ProductionScenarioValidator } = require('../src/production-scenario-validator');
        const validator = new ProductionScenarioValidator({
          username,
          sshKeyPath,
          enableDetailedLogging: true
        });

        const scenario = {
          name: `debug-command-${index + 1}`,
          description: `Test single command: ${command}`,
          commands: [
            { initiator: 'browser', command }
          ],
          expectedDuration: 15000
        };

        console.log(`🔍 Testing command ${index + 1}: ${command}`);
        const result = await validator.executeProductionScenario(scenario);

        console.log(`📊 Command ${index + 1} result:`, {
          success: result.success,
          professionalDisplay: result.professionalDisplay,
          echoQuality: result.echoQuality,
          userExperience: result.userExperience,
          errorCount: result.errors.length,
          warningCount: result.warnings.length
        });

        if (result.errors.length > 0) {
          console.log(`❌ Command ${index + 1} errors:`, result.errors);
        }

        if (result.warnings.length > 0) {
          console.log(`⚠️ Command ${index + 1} warnings:`, result.warnings);
        }

        // Don't fail - just log results to identify the problem
        expect(result.success).toBe(true);
        
        console.log(`✅ Command ${index + 1} completed successfully`);

      } catch (error) {
        console.error(`❌ Command ${index + 1} failed:`, (error as Error).message);
        throw error;
      }
    }, 30000);
  });
});