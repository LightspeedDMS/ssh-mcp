/**
 * AC 2.2 & AC 2.3 Tests - System Administration and File Management Workflows
 * 
 * Tests to validate system administration and file management scenarios with professional terminal display
 */

import { TestEnvironmentConfig } from './test-environment-config';

describe('AC 2.2 & AC 2.3 - System Admin and File Management Workflows', () => {
  const username = TestEnvironmentConfig.getTestUsername();
  const sshKeyPath = TestEnvironmentConfig.getTestSSHKeyPath();

  it('should execute system administration workflow with clean tabular formatting (AC 2.2)', async () => {
    try {
      const { ProductionScenarioValidator } = require('../src/production-scenario-validator');
      const validator = new ProductionScenarioValidator({
        username,
        sshKeyPath,
        enableProfessionalDisplayValidation: true,
        enablePerformanceMonitoring: true
      });

      // AC 2.2: System administration workflow scenario
      const sysadminScenario = {
        name: 'sysadmin-workflow',
        description: 'System monitoring and process management with tabular data formatting',
        commands: [
          { initiator: 'browser', command: 'ps aux | head -10' },
          { initiator: 'browser', command: 'df -h' },
          { initiator: 'browser', command: 'free -m' },
          { initiator: 'browser', command: 'uptime' },
          { initiator: 'browser', command: 'pgrep ssh || echo no_ssh_processes' },
          { initiator: 'browser', command: 'netstat -tuln | head -5 || ss -tuln | head -5' },
          { initiator: 'browser', command: 'dmesg | tail -5 || echo no_dmesg_access' },
          { initiator: 'browser', command: 'who -b || echo no_who_access' }
        ],
        expectedDuration: 40000,
        performanceThresholds: {
          maxExecutionTime: 50000,
          minResponseTime: 150
        }
      };

      console.log('🚀 Starting AC 2.2: System administration workflow scenario...');

      const result = await validator.executeProductionScenario(sysadminScenario);

      console.log('📊 AC 2.2 Result:', {
        success: result.success,
        professionalDisplay: result.professionalDisplay,
        terminalFormatting: result.terminalFormatting,
        userExperience: result.userExperience
      });

      // Validate tabular data formatting quality
      const tabularQuality = await validator.validateTabularDataFormatting(result);
      console.log('📋 Tabular data formatting quality:', tabularQuality);

      expect(result.success).toBe(true);
      expect(result.professionalDisplay).toBe(true);
      expect(result.terminalFormatting).toBe('clean');
      expect(['excellent', 'good']).toContain(tabularQuality);

      console.log('✅ AC 2.2: System administration workflow with clean tabular formatting - PASSED');

    } catch (error) {
      console.error('❌ AC 2.2 Test failed:', error);
      throw error;
    }
  }, 60000);

  it('should execute file management workflow with proper text processing display (AC 2.3)', async () => {
    try {
      const { ProductionScenarioValidator } = require('../src/production-scenario-validator');
      const validator = new ProductionScenarioValidator({
        username,
        sshKeyPath,
        enableProfessionalDisplayValidation: true,
        enablePerformanceMonitoring: true
      });

      // AC 2.3: File management workflow scenario
      const fileManagementScenario = {
        name: 'file-management-workflow',
        description: 'Directory operations and text processing with professional formatting',
        commands: [
          { initiator: 'browser', command: 'ls -la' },
          { initiator: 'browser', command: 'find . -name "*.ts" | head -10 || echo no_ts_files' },
          { initiator: 'browser', command: 'du -sh * | head -10 || echo no_files' },
          { initiator: 'browser', command: 'cat package.json | head -15' },
          { initiator: 'browser', command: 'wc -l *.md || echo no_md_files' },
          { initiator: 'browser', command: 'head -5 package.json' },
          { initiator: 'browser', command: 'file package.json' },
          { initiator: 'browser', command: 'stat package.json' }
        ],
        expectedDuration: 35000,
        performanceThresholds: {
          maxExecutionTime: 45000,
          minResponseTime: 100
        }
      };

      console.log('🚀 Starting AC 2.3: File management workflow scenario...');

      const result = await validator.executeProductionScenario(fileManagementScenario);

      console.log('📊 AC 2.3 Result:', {
        success: result.success,
        professionalDisplay: result.professionalDisplay,
        echoQuality: result.echoQuality,
        userExperience: result.userExperience
      });

      // Validate text processing formatting quality
      const textProcessingQuality = await validator.validateTextProcessingFormatting(result);
      console.log('📄 Text processing formatting quality:', textProcessingQuality);

      expect(result.success).toBe(true);
      expect(result.professionalDisplay).toBe(true);
      expect(result.echoQuality).toBe('excellent');
      expect(['excellent', 'good']).toContain(textProcessingQuality);

      console.log('✅ AC 2.3: File management workflow with proper text processing display - PASSED');

    } catch (error) {
      console.error('❌ AC 2.3 Test failed:', error);
      throw error;
    }
  }, 60000);

  afterAll(() => {
    console.log('\n📊 AC 2.2 & AC 2.3 SUMMARY:');
    console.log('✅ AC 2.2: System administration workflow with tabular formatting validation');
    console.log('✅ AC 2.3: File management workflow with text processing formatting validation');
    console.log('🎯 Real-world user workflows tested with professional terminal display');
    console.log('📈 Performance monitoring and professional user experience validated');
  });
});