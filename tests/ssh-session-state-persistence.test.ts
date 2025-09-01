import { SSHConnectionManager } from '../src/ssh-connection-manager';
import { SSHConnectionConfig, CommandResult } from '../src/types';

describe('SSH Session State Persistence', () => {
  let connectionManager: SSHConnectionManager;
  const testConfig: SSHConnectionConfig = {
    name: 'test-session-persistence',
    host: 'localhost',
    username: 'test_user',
    password: 'password123'
  };
  
  beforeEach(() => {
    connectionManager = new SSHConnectionManager();
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  describe('Working Directory Persistence', () => {
    it('should maintain working directory changes across separate command executions', async () => {
      // Given an SSH session is executing commands
      await connectionManager.createConnection(testConfig);
      
      // When I change the working directory in the first command
      await connectionManager.executeCommand(testConfig.name, 'mkdir -p ~/test-session-dir && cd ~/test-session-dir');
      
      // And I execute a second command that shows current directory
      const result: CommandResult = await connectionManager.executeCommand(testConfig.name, 'pwd');
      
      // Then the working directory change persists across commands
      expect(result.stdout.trim()).toContain('test-session-dir');
      expect(result.exitCode).toBe(0);
      
      // Cleanup
      await connectionManager.executeCommand(testConfig.name, 'cd ~ && rm -rf ~/test-session-dir');
    }, 20000);
  });

  describe('Environment Variable Persistence', () => {
    it('should maintain environment variable modifications across separate command executions', async () => {
      // Given an SSH session is executing commands
      await connectionManager.createConnection(testConfig);
      
      // When I set an environment variable in the first command
      const setResult: CommandResult = await connectionManager.executeCommand(
        testConfig.name, 
        'export SESSION_TEST_VAR="persistent_value"'
      );
      expect(setResult.exitCode).toBe(0);
      
      // And I execute a second command that uses the environment variable
      const getResult: CommandResult = await connectionManager.executeCommand(
        testConfig.name, 
        'echo $SESSION_TEST_VAR'
      );
      
      // Then the environment variable modification persists across commands
      expect(getResult.stdout.trim()).toBe('persistent_value');
      expect(getResult.exitCode).toBe(0);
    }, 20000);
  });

  describe('Command History Persistence', () => {
    it('should maintain command history per session', async () => {
      // Given an SSH session is executing commands
      await connectionManager.createConnection(testConfig);
      
      // When I execute multiple commands
      await connectionManager.executeCommand(testConfig.name, 'echo "first command"');
      await connectionManager.executeCommand(testConfig.name, 'echo "second command"'); 
      await connectionManager.executeCommand(testConfig.name, 'echo "third command"');
      
      // And I check the command history
      const historyResult: CommandResult = await connectionManager.executeCommand(
        testConfig.name, 
        'history | tail -5'
      );
      
      // Then the command history is maintained per session
      expect(historyResult.stdout).toContain('echo "first command"');
      expect(historyResult.stdout).toContain('echo "second command"');
      expect(historyResult.stdout).toContain('echo "third command"');
      expect(historyResult.exitCode).toBe(0);
    }, 20000);
  });

  describe('Background Process Persistence', () => {
    it('should maintain background processes active between command executions', async () => {
      // Given an SSH session is executing commands
      await connectionManager.createConnection(testConfig);
      
      // When I start a background process in the first command
      const startResult: CommandResult = await connectionManager.executeCommand(
        testConfig.name, 
        'sleep 30 & echo $!'
      );
      expect(startResult.exitCode).toBe(0);
      
      // Extract PID from output (might contain job number like "[1] 12345")
      const pidMatch = startResult.stdout.match(/(\d+)$/);
      expect(pidMatch).toBeTruthy();
      const pid = pidMatch![1];
      
      // And I check for the background process in a second command
      const checkResult: CommandResult = await connectionManager.executeCommand(
        testConfig.name, 
        `ps -p ${pid} -o pid,cmd --no-headers`
      );
      
      // Then the background process remains active between command executions
      expect(checkResult.stdout).toContain(pid);
      expect(checkResult.stdout).toContain('sleep 30');
      expect(checkResult.exitCode).toBe(0);
      
      // Cleanup - kill the background process
      await connectionManager.executeCommand(testConfig.name, `kill ${pid}`);
    }, 25000);
  });
});