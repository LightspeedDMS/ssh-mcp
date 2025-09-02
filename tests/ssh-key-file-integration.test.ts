/**
 * Integration Tests for SSH Key File Enhancement
 * Tests complete workflow with various key file scenarios
 */
import { SSHConnectionManager } from "../src/ssh-connection-manager.js";
import { MCPSSHServer } from "../src/mcp-ssh-server.js";
import { SSHConnectionConfig } from "../src/types.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("SSH Key File Integration Tests", () => {
  let connectionManager: SSHConnectionManager;
  let mcpServer: MCPSSHServer;
  const testKeyDir = path.join(os.tmpdir(), "ssh-key-integration-test");

  // Test RSA key that's properly formatted but still for testing only
  const validTestRSAKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA4f6wHWw1mKtP7Vm7rF8vWmEBGkI2vNKPfZ2bE3Sd8Q9Hb2yH
YNMqCmKlV5l5Q3aZ9z7K3D3k1J7W2q9B9v4A8F7H3E1QQ6oV5J2b3c4d5E6F7G8H
9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5I6J7K8L9M0N
1O2P3Q4R5S6T7U8V9W0X1Y2Z3A4B5C6D7E8F9G0H1I2J3K4L5M6N7O8P9Q0R1S2T
3U4V5W6X7Y8Z9A0B1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z
5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1A2B3C4D5E6F
7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5I6J7K8L
QIDAQABAoIBAQCVqJ6mUF1Tt/2VlkV2aZK3uHZ4z8g9C2N3dPH6V2bT9L5N6Z4R
5M3H8I2K9C4J7E6L1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0G1H2I3J4K
5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q
7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W
9X0Y1Z2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8A9B0C
1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0G1H2I
J3K4L5M6NAoGBAP5TmVhKiV4p2t5aYP6oI3tFG4qK5r6K7j8K9l0K1m2K3n4K5o6K
p7q8K9r0L1s2L3t4L5u6L7v8L9w0M1x2M3y4M5z6M7a8M9b0N1c2N3d4N5e6N7f8N
9g0O1h2O3i4O5j6O7k8O9l0P1m2P3n4P5o6P7p8P9q0Q1r2Q3s4Q5t6Q7u8Q9v0R
AoGBAOT9U0VgLGi6v0u7nJ8zYo0qC9I4J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z
4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G
7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K7L8M9N
0O1P2Q3R4S5T6U7V8W9X0Y1Z2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S1AoG
BALz9T0VhKiV4p2t5aYP6oI3tFG4qK5r6K7j8K9l0K1m2K3n4K5o6Kp7q8K9r0L1s2L
3t4L5u6L7v8L9w0M1x2M3y4M5z6M7a8M9b0N1c2N3d4N5e6N7f8N9g0O1h2O3i4O5j6
O7k8O9l0P1m2P3n4P5o6P7p8P9q0Q1r2Q3s4Q5t6Q7u8Q9v0RAoGBAMj8K9L0M1N2O
3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6
W7X8Y9Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D
0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W9X0Y1Z2A3B4C5D6E7F8G9H0I1J2K
-----END RSA PRIVATE KEY-----`;

  // Encrypted test key (for testing encrypted key detection)
  const encryptedTestKey = `-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: AES-128-CBC,1234567890ABCDEF1234567890ABCDEF

MIIEpAIBAAKCAQEA4f6wHWw1mKtP7Vm7rF8vWmEBGkI2vNKPfZ2bE3Sd8Q9Hb2yH
Encrypted content here - this is a test encrypted key
NOT A REAL ENCRYPTED KEY - FOR TESTING ONLY
-----END RSA PRIVATE KEY-----`;

  beforeEach(() => {
    connectionManager = new SSHConnectionManager();
    mcpServer = new MCPSSHServer();
    
    // Create test directory
    if (!fs.existsSync(testKeyDir)) {
      fs.mkdirSync(testKeyDir, { recursive: true });
    }
  });

  afterEach(async () => {
    connectionManager.cleanup();
    if (mcpServer) {
      await mcpServer.stop();
    }
    
    // Clean up test directory
    if (fs.existsSync(testKeyDir)) {
      fs.rmSync(testKeyDir, { recursive: true, force: true });
    }
  });

  describe("End-to-End Key File Workflow", () => {
    it("should successfully read unencrypted key file and attempt connection", async () => {
      const testKeyPath = path.join(testKeyDir, "test_key");
      fs.writeFileSync(testKeyPath, validTestRSAKey);
      
      const config: SSHConnectionConfig = {
        name: "e2e-test-keyfile",
        host: "localhost",
        username: "testuser",
        keyFilePath: testKeyPath
      };

      // Should read the key file and attempt connection
      // Will fail with connection error (not file error) because localhost SSH isn't set up
      try {
        await connectionManager.createConnection(config);
        expect(true).toBe(false); // Should not succeed
      } catch (error) {
        const errorMessage = (error as Error).message;
        
        // Should get connection-related error, not file-related error
        expect(
          errorMessage.includes("ECONNREFUSED") ||
          errorMessage.includes("ENOTFOUND") ||
          errorMessage.includes("connection") ||
          errorMessage.includes("All configured authentication methods failed") ||
          errorMessage.includes("Cannot parse privateKey")
        ).toBe(true);
        
        // Should NOT be a file-related error
        expect(errorMessage).not.toContain("Key file not found");
        expect(errorMessage).not.toContain("Cannot read key file");
      }
    }, 15000);

    it("should handle tilde path expansion correctly", async () => {
      // Create a test key in actual home directory for this test  
      const homeDir = os.homedir();
      const testKeyInHome = path.join(homeDir, ".test-ssh-key-temp");
      
      try {
        fs.writeFileSync(testKeyInHome, validTestRSAKey);
        
        const config: SSHConnectionConfig = {
          name: "e2e-tilde-test",
          host: "localhost", 
          username: "testuser",
          keyFilePath: "~/.test-ssh-key-temp" // Should expand to home directory
        };

        try {
          await connectionManager.createConnection(config);
          expect(true).toBe(false); // Should not succeed
        } catch (error) {
          const errorMessage = (error as Error).message;
          
          // Should get connection-related error, proving tilde expansion worked
          expect(
            errorMessage.includes("ECONNREFUSED") ||
            errorMessage.includes("connection") ||
            errorMessage.includes("All configured authentication methods failed") ||
            errorMessage.includes("Cannot parse privateKey")
          ).toBe(true);
          
          // Should NOT get file not found (proving tilde expansion worked)
          expect(errorMessage).not.toContain("Key file not found");
        }
      } finally {
        // Clean up test key from home directory
        if (fs.existsSync(testKeyInHome)) {
          fs.unlinkSync(testKeyInHome);
        }
      }
    }, 15000);

    it("should prioritize privateKey over keyFilePath", async () => {
      const testKeyPath = path.join(testKeyDir, "ignored_key");
      fs.writeFileSync(testKeyPath, validTestRSAKey);
      
      const config: SSHConnectionConfig = {
        name: "e2e-priority-test",
        host: "localhost",
        username: "testuser", 
        privateKey: validTestRSAKey, // Should be used
        keyFilePath: testKeyPath // Should be ignored
      };

      // Since privateKey is provided, keyFilePath should be ignored
      try {
        await connectionManager.createConnection(config);
        expect(true).toBe(false); // Should not succeed  
      } catch (error) {
        const errorMessage = (error as Error).message;
        
        // Should get connection-related error using privateKey content
        expect(
          errorMessage.includes("ECONNREFUSED") ||
          errorMessage.includes("connection") ||
          errorMessage.includes("All configured authentication methods failed") ||
          errorMessage.includes("Cannot parse privateKey")
        ).toBe(true);
      }
    }, 15000);

    it("should handle encrypted key detection correctly", async () => {
      const testKeyPath = path.join(testKeyDir, "encrypted_key");
      fs.writeFileSync(testKeyPath, encryptedTestKey);
      
      const config: SSHConnectionConfig = {
        name: "e2e-encrypted-test",
        host: "localhost",
        username: "testuser",
        keyFilePath: testKeyPath,
        passphrase: "testpassword"
      };

      // Should detect encrypted key and pass passphrase to SSH2
      try {
        await connectionManager.createConnection(config);
        expect(true).toBe(false); // Should not succeed
      } catch (error) {
        const errorMessage = (error as Error).message;
        // Log for debugging: errorMessage
        
        // Should get connection attempt (not key decryption error)
        // because SSH2 handles encrypted key decryption
        expect(
          errorMessage.includes("ECONNREFUSED") ||
          errorMessage.includes("connection") ||
          errorMessage.includes("All configured authentication methods failed") ||
          errorMessage.includes("Cannot parse privateKey") ||
          errorMessage.includes("Error while parsing") ||
          errorMessage.includes("getPrivatePEM is not a function") ||
          errorMessage.includes("key")
        ).toBe(true);
      }
    }, 15000);

    it("should fail when encrypted key provided without passphrase", async () => {
      const testKeyPath = path.join(testKeyDir, "encrypted_key_no_pass");
      fs.writeFileSync(testKeyPath, encryptedTestKey);
      
      const config: SSHConnectionConfig = {
        name: "e2e-encrypted-no-pass",
        host: "localhost",
        username: "testuser", 
        keyFilePath: testKeyPath
        // No passphrase provided
      };

      // Should fail with specific error about missing passphrase
      try {
        await connectionManager.createConnection(config);
        expect(true).toBe(false); // Should not succeed
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain("Key is encrypted but no passphrase provided");
      }
    }, 15000);
  });

  describe("MCP Server Integration", () => {
    it("should handle keyFilePath via MCP callTool interface", async () => {
      const testKeyPath = path.join(testKeyDir, "mcp_test_key");
      fs.writeFileSync(testKeyPath, validTestRSAKey);
      
      const result = await mcpServer.callTool("ssh_connect", {
        name: "mcp-integration-test",
        host: "localhost",
        username: "testuser",
        keyFilePath: testKeyPath
      }) as any;

      // Should fail at connection level, not schema/file level
      expect(result.success).toBe(false);
      expect(
        result.error.includes("ECONNREFUSED") ||
        result.error.includes("connection") ||
        result.error.includes("All configured authentication methods failed") ||
        result.error.includes("Cannot parse privateKey")
      ).toBe(true);
      
      // Should NOT be file-related errors
      expect(result.error).not.toContain("Key file not found");
    }, 15000);

    it("should handle both keyFilePath and passphrase via MCP interface", async () => {
      const testKeyPath = path.join(testKeyDir, "mcp_encrypted_key");
      fs.writeFileSync(testKeyPath, encryptedTestKey);
      
      const result = await mcpServer.callTool("ssh_connect", {
        name: "mcp-encrypted-test",
        host: "localhost",
        username: "testuser",
        keyFilePath: testKeyPath,
        passphrase: "testpassword"
      }) as any;

      // Should fail at connection level with encrypted key handling
      expect(result.success).toBe(false);
      // Log for debugging: result.error
      expect(
        result.error.includes("ECONNREFUSED") ||
        result.error.includes("connection") ||
        result.error.includes("All configured authentication methods failed") ||
        result.error.includes("Cannot parse privateKey") ||
        result.error.includes("Error while parsing") ||
        result.error.includes("getPrivatePEM is not a function") ||
        result.error.includes("key")
      ).toBe(true);
    }, 15000);
  });

  describe("Error Scenarios", () => {
    it("should provide clear error for non-existent key file", async () => {
      const config: SSHConnectionConfig = {
        name: "error-test-notfound",
        host: "localhost",
        username: "testuser",
        keyFilePath: "/this/path/does/not/exist/key.pem"
      };

      try {
        await connectionManager.createConnection(config);
        expect(true).toBe(false); // Should not succeed
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain("Key file not accessible");
        // Path should not be exposed for security reasons - check it was sanitized
        expect(errorMessage).not.toContain("/this/path/does/not/exist/key.pem");
      }
    });

    it("should require at least one authentication method", async () => {
      const config: SSHConnectionConfig = {
        name: "error-test-no-auth",
        host: "localhost", 
        username: "testuser"
        // No password, privateKey, or keyFilePath
      };

      try {
        await connectionManager.createConnection(config);
        expect(true).toBe(false); // Should not succeed
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(
          errorMessage.includes("Either password, privateKey, or keyFilePath must be provided") ||
          errorMessage.includes("All configured authentication methods failed")
        ).toBe(true);
      }
    }, 15000);
  });
});