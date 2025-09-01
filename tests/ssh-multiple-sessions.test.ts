import { SSHConnectionManager } from '../src/ssh-connection-manager';
import { SSHConnectionConfig, ConnectionStatus, SSHConnection, CommandResult } from '../src/types';

describe('SSHConnectionManager - Multiple Session Management (Story 5)', () => {
  let connectionManager: SSHConnectionManager;
  
  beforeEach(() => {
    connectionManager = new SSHConnectionManager();
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  describe('Session Isolation - Independent Connection State', () => {
    const session1Config: SSHConnectionConfig = {
      name: 'session-1',
      host: 'localhost',
      username: 'test_user',
      password: 'password123'
    };

    const session2Config: SSHConnectionConfig = {
      name: 'session-2',
      host: 'localhost',
      username: 'test_user',
      password: 'password123'
    };

    it('should maintain independent connection state for each session', async () => {
      // Create two sessions
      const connection1 = await connectionManager.createConnection(session1Config);
      const connection2 = await connectionManager.createConnection(session2Config);
      
      expect(connection1.name).toBe('session-1');
      expect(connection2.name).toBe('session-2');
      expect(connection1.status).toBe(ConnectionStatus.CONNECTED);
      expect(connection2.status).toBe(ConnectionStatus.CONNECTED);
      
      // Each session should have independent state
      expect(connection1).not.toBe(connection2);
      expect(connection1.lastActivity).not.toBe(connection2.lastActivity);
    }, 20000);
  });

  describe('Session Isolation - Working Directories', () => {
    it('should maintain isolated working directories for each session', async () => {
      const session1Config: SSHConnectionConfig = {
        name: 'session-1',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      };

      const session2Config: SSHConnectionConfig = {
        name: 'session-2',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      };

      await connectionManager.createConnection(session1Config);
      await connectionManager.createConnection(session2Config);

      // Change directory in session-1
      await connectionManager.executeCommand('session-1', 'cd /tmp');
      const session1Pwd = await connectionManager.executeCommand('session-1', 'pwd');

      // Change directory in session-2 to a different location
      await connectionManager.executeCommand('session-2', 'cd /var');
      const session2Pwd = await connectionManager.executeCommand('session-2', 'pwd');

      // Working directories should be isolated
      expect(session1Pwd.stdout.trim()).toBe('/tmp');
      expect(session2Pwd.stdout.trim()).toBe('/var');
      expect(session1Pwd.stdout).not.toBe(session2Pwd.stdout);
    }, 25000);
  });

  describe('Session Isolation - Environment Variables', () => {
    it('should maintain isolated environment variables for each session', async () => {
      const session1Config: SSHConnectionConfig = {
        name: 'session-env-1',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      };

      const session2Config: SSHConnectionConfig = {
        name: 'session-env-2',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      };

      await connectionManager.createConnection(session1Config);
      await connectionManager.createConnection(session2Config);

      // Set different environment variables in each session
      await connectionManager.executeCommand('session-env-1', 'export TEST_VAR="session1_value"');
      await connectionManager.executeCommand('session-env-2', 'export TEST_VAR="session2_value"');

      // Check environment variable isolation
      const session1Env = await connectionManager.executeCommand('session-env-1', 'echo $TEST_VAR');
      const session2Env = await connectionManager.executeCommand('session-env-2', 'echo $TEST_VAR');

      expect(session1Env.stdout.trim()).toBe('session1_value');
      expect(session2Env.stdout.trim()).toBe('session2_value');
      expect(session1Env.stdout).not.toBe(session2Env.stdout);
    }, 25000);
  });

  describe('Session Name Uniqueness and Validation', () => {
    it('should ensure session names are unique', async () => {
      const sessionConfig: SSHConnectionConfig = {
        name: 'duplicate-session',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      };

      // Create first session
      await connectionManager.createConnection(sessionConfig);

      // Attempt to create second session with same name should fail
      await expect(connectionManager.createConnection(sessionConfig))
        .rejects.toThrow('Session name \'duplicate-session\' already exists');
    }, 20000);

    it('should validate session name format', async () => {
      const invalidConfigs = [
        { name: '', host: 'localhost', username: 'test_user', password: 'password123' },
        { name: '   ', host: 'localhost', username: 'test_user', password: 'password123' },
        { name: 'session with spaces', host: 'localhost', username: 'test_user', password: 'password123' },
        { name: 'session@invalid', host: 'localhost', username: 'test_user', password: 'password123' }
      ];

      for (const config of invalidConfigs) {
        await expect(connectionManager.createConnection(config))
          .rejects.toThrow(/Invalid session name/);
      }
    }, 20000);
  });

  describe('Session Listing', () => {
    it('should list all active sessions with their status', async () => {
      // This test will fail initially as listSessions method doesn't exist
      const sessions = connectionManager.listSessions();
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions).toHaveLength(0);
    });

    it('should list multiple active sessions with correct information', async () => {
      const session1Config: SSHConnectionConfig = {
        name: 'list-session-1',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      };

      const session2Config: SSHConnectionConfig = {
        name: 'list-session-2',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      };

      await connectionManager.createConnection(session1Config);
      await connectionManager.createConnection(session2Config);

      const sessions = connectionManager.listSessions();
      expect(sessions).toHaveLength(2);
      
      const sessionNames = sessions.map(s => s.name);
      expect(sessionNames).toContain('list-session-1');
      expect(sessionNames).toContain('list-session-2');

      sessions.forEach(session => {
        expect(session.status).toBe(ConnectionStatus.CONNECTED);
        expect(session.host).toBe('localhost');
        expect(session.username).toBe('test_user');
      });
    }, 25000);
  });

  describe('Session Disconnection by Name', () => {
    it('should disconnect specific session by name', async () => {
      const session1Config: SSHConnectionConfig = {
        name: 'disconnect-session-1',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      };

      const session2Config: SSHConnectionConfig = {
        name: 'disconnect-session-2',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      };

      await connectionManager.createConnection(session1Config);
      await connectionManager.createConnection(session2Config);

      // Disconnect specific session
      await connectionManager.disconnectSession('disconnect-session-1');

      // Verify session-1 is disconnected but session-2 remains
      const connection1 = connectionManager.getConnection('disconnect-session-1');
      const connection2 = connectionManager.getConnection('disconnect-session-2');

      expect(connection1).toBeUndefined();
      expect(connection2).toBeDefined();
      expect(connection2?.status).toBe(ConnectionStatus.CONNECTED);
    }, 25000);

    it('should throw error when disconnecting non-existent session', async () => {
      await expect(connectionManager.disconnectSession('non-existent-session'))
        .rejects.toThrow('Session \'non-existent-session\' not found');
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup session resources when connection is closed', async () => {
      const sessionConfig: SSHConnectionConfig = {
        name: 'cleanup-session',
        host: 'localhost',
        username: 'test_user',
        password: 'password123'
      };

      await connectionManager.createConnection(sessionConfig);
      
      // Verify session exists
      let sessions = connectionManager.listSessions();
      expect(sessions).toHaveLength(1);

      // Disconnect session
      await connectionManager.disconnectSession('cleanup-session');

      // Verify session is cleaned up
      sessions = connectionManager.listSessions();
      expect(sessions).toHaveLength(0);

      const connection = connectionManager.getConnection('cleanup-session');
      expect(connection).toBeUndefined();
    }, 20000);
  });

  describe('Performance Requirements', () => {
    it('should handle minimum 5 concurrent sessions', async () => {
      const sessionPromises: Promise<SSHConnection>[] = [];
      
      // Create 5 concurrent sessions
      for (let i = 0; i < 5; i++) {
        const config: SSHConnectionConfig = {
          name: `perf-session-${i}`,
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        };
        sessionPromises.push(connectionManager.createConnection(config));
      }

      const connections = await Promise.all(sessionPromises);
      expect(connections).toHaveLength(5);

      // Verify all sessions are listed
      const sessions = connectionManager.listSessions();
      expect(sessions).toHaveLength(5);

      // Verify session isolation by executing commands in each
      const commandPromises: Promise<CommandResult>[] = [];
      for (let i = 0; i < 5; i++) {
        commandPromises.push(
          connectionManager.executeCommand(`perf-session-${i}`, `echo "session-${i}"`)
        );
      }

      const results = await Promise.all(commandPromises);
      results.forEach((result, index) => {
        expect(result.stdout.trim()).toBe(`session-${index}`);
      });
    }, 40000);

    it('should prevent cross-session interference under concurrent load', async () => {
      // Create 3 sessions
      const sessionConfigs = [
        { name: 'isolation-1', host: 'localhost', username: 'test_user', password: 'password123' },
        { name: 'isolation-2', host: 'localhost', username: 'test_user', password: 'password123' },
        { name: 'isolation-3', host: 'localhost', username: 'test_user', password: 'password123' }
      ];

      for (const config of sessionConfigs) {
        await connectionManager.createConnection(config);
      }

      // Execute concurrent commands with different outputs
      const commandPromises = [
        connectionManager.executeCommand('isolation-1', 'export ISOLATION_TEST="value1" && echo $ISOLATION_TEST'),
        connectionManager.executeCommand('isolation-2', 'export ISOLATION_TEST="value2" && echo $ISOLATION_TEST'), 
        connectionManager.executeCommand('isolation-3', 'export ISOLATION_TEST="value3" && echo $ISOLATION_TEST')
      ];

      const results = await Promise.all(commandPromises);

      // Each session should have its own isolated result
      expect(results[0].stdout.trim()).toBe('value1');
      expect(results[1].stdout.trim()).toBe('value2');
      expect(results[2].stdout.trim()).toBe('value3');
    }, 30000);
  });
});