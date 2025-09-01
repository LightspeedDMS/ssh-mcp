import { SSHConnectionManager } from '../src/ssh-connection-manager';
import { SSHConnectionConfig } from '../src/types';

describe('Story 6: Session Command History Panel - Command Tracking', () => {
  let connectionManager: SSHConnectionManager;
  const testConfig: SSHConnectionConfig = {
    name: 'test-history-session',
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

  describe('Command execution tracking', () => {
    it('should track command execution with timestamp', async () => {
      // Given an active SSH session exists
      await connectionManager.createConnection(testConfig);
      
      // When I execute a command
      const startTime = Date.now();
      await connectionManager.executeCommand(testConfig.name, 'echo "test command"');
      const endTime = Date.now();
      
      // Then the command should be tracked with timestamp
      const history = connectionManager.getCommandHistory(testConfig.name);
      expect(history).toBeDefined();
      expect(history.length).toBe(1);
      
      const commandEntry = history[0];
      expect(commandEntry.command).toBe('echo "test command"');
      expect(commandEntry.timestamp).toBeGreaterThanOrEqual(startTime);
      expect(commandEntry.timestamp).toBeLessThanOrEqual(endTime);
      expect(commandEntry.sessionName).toBe(testConfig.name);
    }, 15000);

    it('should track command execution duration', async () => {
      // Given an active SSH session exists
      await connectionManager.createConnection(testConfig);
      
      // When I execute a command that takes some time
      await connectionManager.executeCommand(testConfig.name, 'sleep 0.1; echo "done"');
      
      // Then the command execution duration should be tracked
      const history = connectionManager.getCommandHistory(testConfig.name);
      expect(history.length).toBe(1);
      
      const commandEntry = history[0];
      expect(commandEntry.duration).toBeGreaterThan(90); // At least 90ms
      expect(commandEntry.duration).toBeLessThan(500); // But less than 500ms for test performance
    }, 15000);

    it('should track command exit code for successful commands', async () => {
      // Given an active SSH session exists
      await connectionManager.createConnection(testConfig);
      
      // When I execute a successful command
      await connectionManager.executeCommand(testConfig.name, 'echo "success"');
      
      // Then the exit code should be tracked as 0
      const history = connectionManager.getCommandHistory(testConfig.name);
      expect(history.length).toBe(1);
      
      const commandEntry = history[0];
      expect(commandEntry.exitCode).toBe(0);
      expect(commandEntry.status).toBe('success');
    }, 15000);

    it('should track command exit code for failed commands', async () => {
      // Given an active SSH session exists
      await connectionManager.createConnection(testConfig);
      
      // When I execute a command that fails
      await connectionManager.executeCommand(testConfig.name, 'false');
      
      // Then the exit code should be tracked as non-zero
      const history = connectionManager.getCommandHistory(testConfig.name);
      expect(history.length).toBe(1);
      
      const commandEntry = history[0];
      expect(commandEntry.exitCode).toBe(1);
      expect(commandEntry.status).toBe('failure');
    }, 15000);

    it('should track multiple commands in chronological order', async () => {
      // Given an active SSH session exists
      await connectionManager.createConnection(testConfig);
      
      // When I execute multiple commands
      await connectionManager.executeCommand(testConfig.name, 'echo "first"');
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure timestamp difference
      await connectionManager.executeCommand(testConfig.name, 'echo "second"');
      await new Promise(resolve => setTimeout(resolve, 10));
      await connectionManager.executeCommand(testConfig.name, 'echo "third"');
      
      // Then commands should be tracked in chronological order
      const history = connectionManager.getCommandHistory(testConfig.name);
      expect(history.length).toBe(3);
      
      expect(history[0].command).toBe('echo "first"');
      expect(history[1].command).toBe('echo "second"');
      expect(history[2].command).toBe('echo "third"');
      
      // Verify timestamps are in ascending order
      expect(history[0].timestamp).toBeLessThan(history[1].timestamp);
      expect(history[1].timestamp).toBeLessThan(history[2].timestamp);
    }, 15000);
  });

  describe('Command history storage with 100 entry limit', () => {
    it('should store up to 100 command entries per session', async () => {
      // Given an active SSH session exists
      await connectionManager.createConnection(testConfig);
      
      // When I execute 105 commands
      for (let i = 1; i <= 105; i++) {
        await connectionManager.executeCommand(testConfig.name, `echo "command ${i}"`);
      }
      
      // Then only the last 100 commands should be stored
      const history = connectionManager.getCommandHistory(testConfig.name);
      expect(history.length).toBe(100);
      
      // The first entry should be command 6 (commands 1-5 were removed)
      expect(history[0].command).toBe('echo "command 6"');
      expect(history[99].command).toBe('echo "command 105"');
    }, 30000);

    it('should maintain separate command history for different sessions', async () => {
      // Given two active SSH sessions exist
      const session1Config = { ...testConfig, name: 'session1' };
      const session2Config = { ...testConfig, name: 'session2' };
      
      await connectionManager.createConnection(session1Config);
      await connectionManager.createConnection(session2Config);
      
      // When I execute different commands in each session
      await connectionManager.executeCommand('session1', 'echo "session1 command"');
      await connectionManager.executeCommand('session2', 'echo "session2 command"');
      await connectionManager.executeCommand('session1', 'echo "session1 command2"');
      
      // Then each session should have its own command history
      const history1 = connectionManager.getCommandHistory('session1');
      const history2 = connectionManager.getCommandHistory('session2');
      
      expect(history1.length).toBe(2);
      expect(history2.length).toBe(1);
      
      expect(history1[0].command).toBe('echo "session1 command"');
      expect(history1[1].command).toBe('echo "session1 command2"');
      expect(history2[0].command).toBe('echo "session2 command"');
      
      expect(history1[0].sessionName).toBe('session1');
      expect(history2[0].sessionName).toBe('session2');
    }, 25000);

    it('should return empty history for non-existent sessions', async () => {
      // When I request command history for a non-existent session
      // Then it should throw an error
      expect(() => {
        connectionManager.getCommandHistory('non-existent');
      }).toThrow("Session 'non-existent' not found");
    });
  });

  describe('Command history data structure', () => {
    it('should include all required fields in command history entries', async () => {
      // Given an active SSH session exists
      await connectionManager.createConnection(testConfig);
      
      // When I execute a command
      await connectionManager.executeCommand(testConfig.name, 'echo "detailed test"');
      
      // Then the command history entry should have all required fields
      const history = connectionManager.getCommandHistory(testConfig.name);
      expect(history.length).toBe(1);
      
      const entry = history[0];
      expect(entry).toHaveProperty('command', 'echo "detailed test"');
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('duration');
      expect(entry).toHaveProperty('exitCode', 0);
      expect(entry).toHaveProperty('status', 'success');
      expect(entry).toHaveProperty('sessionName', testConfig.name);
      
      expect(typeof entry.timestamp).toBe('number');
      expect(typeof entry.duration).toBe('number');
      expect(typeof entry.exitCode).toBe('number');
      expect(['success', 'failure'].includes(entry.status)).toBe(true);
    }, 15000);
  });
});