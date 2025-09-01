import { SSHConnectionManager } from '../src/ssh-connection-manager';
import { SSHConnection, SSHConnectionConfig, ConnectionStatus } from '../src/types';

describe('SSHConnectionManager', () => {
  let connectionManager: SSHConnectionManager;
  
  beforeEach(() => {
    connectionManager = new SSHConnectionManager();
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  describe('SSH Connection Establishment', () => {
    const validConfig: SSHConnectionConfig = {
      name: 'test-connection',
      host: 'localhost',
      username: 'test_user',
      password: 'password123'
    };

    it('should establish SSH connection with valid credentials', async () => {
      const connection = await connectionManager.createConnection(validConfig);
      
      expect(connection).toBeDefined();
      expect(connection.name).toBe(validConfig.name);
      expect(connection.host).toBe(validConfig.host);
      expect(connection.username).toBe(validConfig.username);
      expect(connection.status).toBe(ConnectionStatus.CONNECTED);
    }, 15000); // 15 second timeout to allow for connection establishment

    it('should store connection with unique name identifier', async () => {
      const connection = await connectionManager.createConnection(validConfig);
      
      // Verify connection is stored with unique name
      expect(connection.name).toBe(validConfig.name);
    }, 15000);

    it('should track connection status as connected', async () => {
      const connection = await connectionManager.createConnection(validConfig);
      
      expect(connection.status).toBe(ConnectionStatus.CONNECTED);
    }, 15000);

    it('should maintain connection metadata (host, user, last activity)', async () => {
      const beforeConnection = Date.now();
      const connection = await connectionManager.createConnection(validConfig);
      const afterConnection = Date.now();
      
      expect(connection.host).toBe(validConfig.host);
      expect(connection.username).toBe(validConfig.username);
      expect(connection.lastActivity).toBeInstanceOf(Date);
      expect(connection.lastActivity.getTime()).toBeGreaterThanOrEqual(beforeConnection);
      expect(connection.lastActivity.getTime()).toBeLessThanOrEqual(afterConnection);
    }, 15000);

    it('should establish connection within 15 seconds performance requirement', async () => {
      const startTime = Date.now();
      
      await connectionManager.createConnection(validConfig);
      
      const endTime = Date.now();
      const connectionTime = endTime - startTime;
      
      expect(connectionTime).toBeLessThan(15000); // Less than 15 seconds
    }, 20000);

    it('should support minimum 5 concurrent SSH connections', async () => {
      const connections: Promise<SSHConnection>[] = [];
      
      // Create 5 concurrent connections
      for (let i = 0; i < 5; i++) {
        const config: SSHConnectionConfig = {
          name: `test-connection-${i}`,
          host: 'localhost',
          username: 'test_user',
          password: 'password123'
        };
        connections.push(connectionManager.createConnection(config));
      }
      
      const establishedConnections = await Promise.all(connections);
      
      expect(establishedConnections).toHaveLength(5);
      establishedConnections.forEach((connection, index) => {
        expect(connection.status).toBe(ConnectionStatus.CONNECTED);
        expect(connection.name).toBe(`test-connection-${index}`);
      });
    }, 30000); // 30 seconds for multiple connections
  });

  describe('Error Handling', () => {
    it('should handle connection errors with invalid credentials', async () => {
      const invalidConfig: SSHConnectionConfig = {
        name: 'invalid-connection',
        host: 'nonexistent-host.invalid',
        username: 'invalid-user',
        password: 'invalid-password'
      };

      await expect(connectionManager.createConnection(invalidConfig))
        .rejects.toThrow();
    }, 15000);

    it('should handle connection timeout', async () => {
      // Create a config that will timeout (using a non-routable IP)
      const timeoutConfig: SSHConnectionConfig = {
        name: 'timeout-connection',
        host: '192.0.2.1', // RFC5737 test address that should not respond
        username: 'test',
        password: 'test'
      };

      await expect(connectionManager.createConnection(timeoutConfig))
        .rejects.toThrow('Connection timeout after 10 seconds');
    }, 15000);
  });

});