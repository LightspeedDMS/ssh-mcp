import { SSHConnectionManager } from "../src/ssh-connection-manager";
import {
  SSHConnectionConfig,
  CommandSource,
  QUEUE_CONSTANTS,
} from "../src/types";

// Mock the ssh2 module
jest.mock('ssh2', () => {
  const mockClient = {
    on: jest.fn(),
    shell: jest.fn(),
    connect: jest.fn(),
    destroy: jest.fn()
  };

  return {
    Client: jest.fn(() => mockClient)
  };
});

describe("Queue Limit Unit Test", () => {
  let connectionManager: SSHConnectionManager;
  
  const mockConfig: SSHConnectionConfig = {
    name: "limit-test-session",
    host: "localhost", 
    username: "testuser",
    password: "testpass"
  };

  beforeEach(() => {
    connectionManager = new SSHConnectionManager();
    jest.clearAllMocks();
    
    const mockClient = require('ssh2').Client();
    const mockChannel = {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      removeListener: jest.fn(),
      stderr: { on: jest.fn() },
      setWindow: jest.fn()
    };

    mockClient.on = jest.fn((event, callback) => {
      if (event === 'ready') {
        setTimeout(() => callback(), 0);
      }
    });

    mockClient.shell = jest.fn((callback) => {
      callback(null, mockChannel);
    });

    mockClient.connect = jest.fn();

    let dataCallback: ((data: Buffer) => void) | undefined;
    mockChannel.on = jest.fn((event, callback) => {
      if (event === 'data') {
        dataCallback = callback;
        setTimeout(() => {
          if (dataCallback) {
            dataCallback(Buffer.from('user@localhost:~$ '));
          }
        }, 10);
      }
    });
    
    // Mock shell channel to never complete commands
    // This will cause them to stay in executing state
    mockChannel.write = jest.fn();
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  it("should enforce queue size limit by synchronously adding many commands", async () => {
    await connectionManager.createConnection(mockConfig);
    
    const promises: Promise<any>[] = [];
    
    // Add significantly more than MAX_QUEUE_SIZE commands
    for (let i = 0; i < QUEUE_CONSTANTS.MAX_QUEUE_SIZE + 10; i++) {
      const promise = connectionManager.executeCommand(
        mockConfig.name,
        `echo "command ${i}"`,
        { source: "claude" as CommandSource }
      );
      promises.push(promise);
    }
    
    console.log(`Created ${promises.length} command promises`);
    
    // Wait for all promises to settle
    const results = await Promise.allSettled(promises);
    
    // Count rejections
    const rejectedCount = results.filter(result => result.status === 'rejected').length;
    const fulfilledCount = results.filter(result => result.status === 'fulfilled').length;
    
    console.log(`Rejected: ${rejectedCount}, Fulfilled: ${fulfilledCount}`);
    
    // Should have exactly 10 rejections (commands beyond MAX_QUEUE_SIZE)
    expect(rejectedCount).toBe(10);
    expect(fulfilledCount).toBeLessThanOrEqual(QUEUE_CONSTANTS.MAX_QUEUE_SIZE);
    
    // Verify rejection reasons
    const rejectedResults = results.filter(result => result.status === 'rejected') as PromiseRejectedResult[];
    rejectedResults.forEach(result => {
      expect(result.reason.message).toMatch(/queue.*full/i);
    });
  }, 30000);

  it("should reject the 101st command when queue is full", async () => {
    await connectionManager.createConnection(mockConfig);
    
    const promises: Promise<any>[] = [];
    
    // Add exactly MAX_QUEUE_SIZE + 1 commands
    for (let i = 0; i <= QUEUE_CONSTANTS.MAX_QUEUE_SIZE; i++) {
      const promise = connectionManager.executeCommand(
        mockConfig.name,
        `echo "command ${i}"`,
        { source: "claude" as CommandSource }
      );
      promises.push(promise);
    }
    
    // Wait for all to settle
    const results = await Promise.allSettled(promises);
    
    const rejectedCount = results.filter(result => result.status === 'rejected').length;
    const fulfilledCount = results.filter(result => result.status === 'fulfilled').length;
    
    console.log(`Total commands: ${results.length}, Rejected: ${rejectedCount}, Fulfilled: ${fulfilledCount}`);
    
    // Should have exactly 1 rejection (the 101st command)
    expect(rejectedCount).toBe(1);
    expect(fulfilledCount).toBe(QUEUE_CONSTANTS.MAX_QUEUE_SIZE);
    
    // Check the rejection message
    const rejectedResult = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejectedResult.reason.message).toMatch(/queue.*full/i);
    expect(rejectedResult.reason.message).toContain('100');
  }, 30000);

  it("should validate constants are reasonable", () => {
    expect(QUEUE_CONSTANTS.MAX_QUEUE_SIZE).toBe(100);
    expect(QUEUE_CONSTANTS.MAX_COMMAND_AGE_MS).toBe(5 * 60 * 1000);
  });
});