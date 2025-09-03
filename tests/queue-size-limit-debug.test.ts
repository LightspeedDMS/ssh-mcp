import { SSHConnectionManager } from "../src/ssh-connection-manager";
import {
  SSHConnectionConfig,
  CommandSource,
  QUEUE_CONSTANTS,
} from "../src/types";

// Mock the ssh2 module to avoid real SSH connections in unit tests
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

describe("Queue Size Limit Debug", () => {
  let connectionManager: SSHConnectionManager;
  
  const mockConfig: SSHConnectionConfig = {
    name: "debug-test-session",
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
    
    // Mock write to NOT auto-complete commands - this keeps them in queue
    mockChannel.write = jest.fn();
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  it("should enforce MAX_QUEUE_SIZE limit when commands don't execute immediately", async () => {
    await connectionManager.createConnection(mockConfig);
    
    console.log(`Testing with MAX_QUEUE_SIZE = ${QUEUE_CONSTANTS.MAX_QUEUE_SIZE}`);
    
    const promises: Promise<any>[] = [];
    
    // Add exactly MAX_QUEUE_SIZE commands - they should all be queued since write is mocked to not complete
    for (let i = 0; i < QUEUE_CONSTANTS.MAX_QUEUE_SIZE; i++) {
      const promise = connectionManager.executeCommand(
        mockConfig.name,
        `echo "command ${i}"`,
        { source: "claude" as CommandSource }
      );
      promises.push(promise);
    }
    
    console.log(`Added ${QUEUE_CONSTANTS.MAX_QUEUE_SIZE} commands to queue`);
    
    // Now this command should be rejected due to queue limit
    let rejectedAsExpected = false;
    try {
      await connectionManager.executeCommand(
        mockConfig.name,
        "echo 'this should be rejected'",
        { source: "claude" as CommandSource }
      );
      console.log('ERROR: Command was NOT rejected - queue limit not working');
    } catch (error) {
      rejectedAsExpected = true;
      console.log('SUCCESS: Command was rejected due to queue limit');
      console.log('Error message:', (error as Error).message);
    }
    
    expect(rejectedAsExpected).toBe(true);
    
    // Clean up - these will timeout since they don't complete
    await Promise.allSettled(promises);
  }, 30000);
});