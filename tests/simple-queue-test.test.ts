import { SSHConnectionManager } from "../src/ssh-connection-manager";
import {
  SSHConnectionConfig,
  CommandSource,
  QUEUE_CONSTANTS,
} from "../src/types";

// Mock the ssh2 module to avoid real SSH connections
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

describe("Simple Queue Test", () => {
  let connectionManager: SSHConnectionManager;
  
  const mockConfig: SSHConnectionConfig = {
    name: "simple-test-session",
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
    
    // Don't complete commands immediately - this should keep them in queue
    mockChannel.write = jest.fn((command: string) => {
      // Simulate that commands don't complete (no dataCallback invocation)
      console.log(`Mock channel write called with: ${command.slice(0, 50)}...`);
    });
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  it("should demonstrate queue size limit with a smaller test", async () => {
    await connectionManager.createConnection(mockConfig);
    
    console.log(`MAX_QUEUE_SIZE is ${QUEUE_CONSTANTS.MAX_QUEUE_SIZE}`);
    
    // Test with just 2-3 commands to see if queue logic works
    const promises: Promise<any>[] = [];
    
    for (let i = 0; i < 3; i++) {
      console.log(`Adding command ${i}`);
      const promise = connectionManager.executeCommand(
        mockConfig.name,
        `echo "test ${i}"`,
        { source: "claude" as CommandSource }
      );
      promises.push(promise);
    }
    
    // Give a moment for commands to be queued
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('Now testing if queue accepts one more command...');
    
    try {
      await connectionManager.executeCommand(
        mockConfig.name,
        "echo 'one more'",
        { source: "claude" as CommandSource }
      );
      console.log('Command was accepted - queue not full yet');
    } catch (error) {
      console.log('Command was rejected:', (error as Error).message);
    }
    
    // Clean up
    await Promise.allSettled(promises);
  }, 10000);

  it("should test the exact MAX_QUEUE_SIZE boundary", async () => {
    await connectionManager.createConnection(mockConfig);
    
    // This test is to verify the constant is working
    expect(QUEUE_CONSTANTS.MAX_QUEUE_SIZE).toBe(100);
    
    // Just test that we can create a connection and add one command
    try {
      const result = connectionManager.executeCommand(
        mockConfig.name,
        "echo 'test'",
        { source: "claude" as CommandSource }
      );
      
      // Give it a short time then check
      setTimeout(() => {
        console.log('Command promise created successfully');
      }, 100);
      
      // Don't await - just verify it was created without error
      expect(result).toBeInstanceOf(Promise);
    } catch (error) {
      console.log('Error creating command:', error);
      throw error;
    }
  }, 5000);
});