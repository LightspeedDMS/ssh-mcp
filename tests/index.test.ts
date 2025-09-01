import { SSHConnectionManager, SSHConnection, SSHConnectionConfig, ConnectionStatus } from '../src/index';

describe('Index Module', () => {
  it('should export SSHConnectionManager', () => {
    expect(SSHConnectionManager).toBeDefined();
    expect(typeof SSHConnectionManager).toBe('function');
  });

  it('should export ConnectionStatus enum', () => {
    expect(ConnectionStatus).toBeDefined();
    expect(ConnectionStatus.CONNECTED).toBe('connected');
  });

  it('should export interfaces as types', () => {
    // These are TypeScript interfaces, so we just verify they exist at compile time
    // by using them in variable declarations
    const mockConfig: SSHConnectionConfig = {
      name: 'test',
      host: 'localhost',
      username: 'test'
    };
    
    const mockConnection: SSHConnection = {
      name: 'test',
      host: 'localhost', 
      username: 'test',
      status: ConnectionStatus.CONNECTED,
      lastActivity: new Date()
    };

    expect(mockConfig).toBeDefined();
    expect(mockConnection).toBeDefined();
  });
});