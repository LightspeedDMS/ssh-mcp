/**
 * TDD Tests for SSH Key File Security and Validation Fixes
 * Based on code reviewer feedback for path traversal, input validation,
 * error sanitization, and async consistency issues
 */
import { SSHConnectionManager } from "../src/ssh-connection-manager.js";
import { SSHConnectionConfig } from "../src/types.js";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as os from "os";
import * as path from "path";

describe("SSH Key File Security and Validation", () => {
  let connectionManager: SSHConnectionManager;
  const testKeyDir = path.join(os.tmpdir(), "ssh-key-security-test");

  // Valid test key for legitimate tests
  const validTestKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA4f6wHWw1mKtP7Vm7rF8vWmEBGkI2vNKPfZ2bE3Sd8Q9Hb2yH
YNMqCmKlV5l5Q3aZ9z7K3D3k1J7W2q9B9v4A8F7H3E1QQ6oV5J2b3c4d5E6F7G8H
Test RSA key - FOR TESTING ONLY - NOT A REAL KEY
9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5I6J7K8L9M0N
1O2P3Q4R5S6T7U8V9W0X1Y2Z3A4B5C6D7E8F9G0H1I2J3K4L5M6N7O8P9Q0R1S2T
3U4V5W6X7Y8Z9A0B1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z
5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F
7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5I6J7K8L
QIDVAQABJQRJQJVJQJkjJ2kj2Jkj2kj2kjJkj2kJJk2jkj2kj2kj2J2kj2kjkj2
-----END RSA PRIVATE KEY-----`;

  beforeEach(async () => {
    connectionManager = new SSHConnectionManager();
    
    // Create test directory
    if (!fsSync.existsSync(testKeyDir)) {
      await fs.mkdir(testKeyDir, { recursive: true });
    }
  });

  afterEach(async () => {
    connectionManager.cleanup();
    
    // Clean up test directory
    if (fsSync.existsSync(testKeyDir)) {
      await fs.rm(testKeyDir, { recursive: true, force: true });
    }
  });

  describe("Path Traversal Security Tests", () => {
    it("should fail - path traversal attack through .. sequences", async () => {
      // Create a valid key file outside the expected location
      const sensitiveFile = path.join(os.tmpdir(), "sensitive-key.pem");
      await fs.writeFile(sensitiveFile, validTestKey);
      
      const config: SSHConnectionConfig = {
        name: "path-traversal-test",
        host: "localhost",
        username: "testuser",
        // This should be blocked by path traversal protection
        keyFilePath: `~/../../tmp/sensitive-key.pem`
      };

      try {
        await connectionManager.createConnection(config);
        fail("Should have thrown error for path traversal attempt");
      } catch (error) {
        // Currently this attack might succeed - we need protection
        // After fix, should throw specific security error
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain("Invalid path"); // Should be blocked
      } finally {
        // Clean up sensitive file
        if (fsSync.existsSync(sensitiveFile)) {
          await fs.unlink(sensitiveFile);
        }
      }
    });

    it("should fail - absolute path traversal attack", async () => {
      // Try to access system files through absolute path
      const config: SSHConnectionConfig = {
        name: "absolute-traversal-test",
        host: "localhost",
        username: "testuser",
        keyFilePath: "/etc/passwd" // Should be blocked
      };

      try {
        await connectionManager.createConnection(config);
        fail("Should have thrown error for absolute path attack");
      } catch (error) {
        // Should be blocked by validation
        expect((error as Error).message).toContain("Invalid path");
      }
    });

    it("should fail - symlink-based path traversal attack", async () => {
      // Create a malicious symlink
      const maliciousLink = path.join(testKeyDir, "malicious-link");
      const targetFile = "/etc/hostname"; // System file
      
      try {
        await fs.symlink(targetFile, maliciousLink);
        
        const config: SSHConnectionConfig = {
          name: "symlink-traversal-test",
          host: "localhost",
          username: "testuser",
          keyFilePath: maliciousLink
        };

        await connectionManager.createConnection(config);
        fail("Should have thrown error for symlink traversal attack");
      } catch (error) {
        // Should detect and block symlink attacks
        expect((error as Error).message).toContain("Invalid path");
      }
    });
  });

  describe("Input Validation Tests", () => {
    it("should fail - null keyFilePath validation", async () => {
      const config: SSHConnectionConfig = {
        name: "null-path-test",
        host: "localhost",
        username: "testuser",
        keyFilePath: null as any // Invalid input
      };

      try {
        await connectionManager.createConnection(config);
        fail("Should have thrown error for null keyFilePath");
      } catch (error) {
        expect((error as Error).message).toContain("Invalid keyFilePath");
      }
    });

    it("should fail - empty string keyFilePath validation", async () => {
      const config: SSHConnectionConfig = {
        name: "empty-path-test",
        host: "localhost",
        username: "testuser",
        keyFilePath: "" // Invalid input
      };

      try {
        await connectionManager.createConnection(config);
        fail("Should have thrown error for empty keyFilePath");
      } catch (error) {
        expect((error as Error).message).toContain("Invalid keyFilePath");
      }
    });

    it("should fail - whitespace-only keyFilePath validation", async () => {
      const config: SSHConnectionConfig = {
        name: "whitespace-path-test",
        host: "localhost",
        username: "testuser",
        keyFilePath: "   \t\n  " // Invalid input
      };

      try {
        await connectionManager.createConnection(config);
        fail("Should have thrown error for whitespace-only keyFilePath");
      } catch (error) {
        expect((error as Error).message).toContain("Invalid keyFilePath");
      }
    });

    it("should fail - extremely long keyFilePath validation", async () => {
      const longPath = "a".repeat(5000); // Extremely long path
      
      const config: SSHConnectionConfig = {
        name: "long-path-test",
        host: "localhost",
        username: "testuser",
        keyFilePath: longPath
      };

      try {
        await connectionManager.createConnection(config);
        fail("Should have thrown error for excessively long keyFilePath");
      } catch (error) {
        expect((error as Error).message).toContain("Invalid keyFilePath");
      }
    });
  });

  describe("Error Message Sanitization Tests", () => {
    it("should fail - system path leakage in error messages", async () => {
      const sensitiveSystemPath = "/home/secret-user/.ssh/id_rsa";
      
      const config: SSHConnectionConfig = {
        name: "path-leak-test",
        host: "localhost",
        username: "testuser",
        keyFilePath: sensitiveSystemPath
      };

      try {
        await connectionManager.createConnection(config);
        fail("Should have thrown error");
      } catch (error) {
        const errorMessage = (error as Error).message;
        // Error message should NOT contain the full system path
        expect(errorMessage).not.toContain("/home/secret-user/.ssh/id_rsa");
        // Should contain generic message instead
        expect(errorMessage).toContain("Key file not accessible");
      }
    });

    it("should fail - home directory path leakage", async () => {
      const homeDir = os.homedir();
      const privatePath = path.join(homeDir, ".private", "secret-key");
      
      const config: SSHConnectionConfig = {
        name: "home-leak-test",
        host: "localhost",
        username: "testuser",
        keyFilePath: privatePath
      };

      try {
        await connectionManager.createConnection(config);
        fail("Should have thrown error");
      } catch (error) {
        const errorMessage = (error as Error).message;
        // Should not leak user's home directory structure
        expect(errorMessage).not.toContain(homeDir);
        expect(errorMessage).not.toContain(".private");
      }
    });
  });

  describe("Async Consistency Tests", () => {
    it("should fail - readPrivateKeyFromFile should use async file operations", async () => {
      const testKeyPath = path.join(testKeyDir, "async-test-key");
      await fs.writeFile(testKeyPath, validTestKey);
      
      const config: SSHConnectionConfig = {
        name: "async-consistency-test",
        host: "localhost",
        username: "testuser",
        keyFilePath: testKeyPath
      };

      // Monitor the execution to see if it blocks
      const startTime = Date.now();
      
      try {
        await connectionManager.createConnection(config);
        fail("Connection should fail (no actual SSH server)");
      } catch (error) {
        const executionTime = Date.now() - startTime;
        
        // With proper async operations, file I/O shouldn't block significantly
        // This is a heuristic test - proper async should be fast for file operations
        expect(executionTime).toBeLessThan(100); // Should be near-instantaneous for file I/O
        
        // Error should be connection-related, not file-related
        // Parsing error is also acceptable as it means the file was read successfully
        expect((error as Error).message).toMatch(
          /(connection|authentication|timeout|ECONNREFUSED|parse|Malformed)/i
        );
      }
    });

    it("should fail - async declaration without async usage is misleading", () => {
      // This test verifies the method signature matches implementation
      // If method is declared async, it should use async operations
      
      // Access the private method through type assertion for testing
      const manager = connectionManager as any;
      const method = manager.readPrivateKeyFromFile;
      
      // Method should be async (returns Promise)
      expect(method.constructor.name).toBe("AsyncFunction");
      
      // Test actual async behavior by checking if it returns a promise
      const testPath = path.join(testKeyDir, "test.key");
      fsSync.writeFileSync(testPath, validTestKey);
      
      const result = method.call(manager, testPath);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe("Security Integration Tests", () => {
    it("should pass - legitimate tilde expansion should work", async () => {
      const homeDir = os.homedir();
      const testKeyInHome = path.join(homeDir, ".test-ssh-key-temp");
      
      try {
        await fs.writeFile(testKeyInHome, validTestKey);
        
        const config: SSHConnectionConfig = {
          name: "legitimate-tilde-test",
          host: "localhost",
          username: "testuser",
          keyFilePath: "~/.test-ssh-key-temp"
        };

        await connectionManager.createConnection(config);
        fail("Should fail with connection error, not path error");
      } catch (error) {
        // Should fail with connection/auth error, not path validation error
        const errorMessage = (error as Error).message;
        expect(errorMessage).not.toContain("Invalid path");
        // Parsing error is also acceptable as it means the file was read successfully
        expect(errorMessage).toMatch(/(connection|authentication|timeout|parse|Malformed)/i);
      } finally {
        if (fsSync.existsSync(testKeyInHome)) {
          await fs.unlink(testKeyInHome);
        }
      }
    });

    it("should pass - relative paths in safe directory should work", async () => {
      const relativeKeyPath = path.join(testKeyDir, "relative-test-key");
      
      await fs.writeFile(relativeKeyPath, validTestKey);
      
      const config: SSHConnectionConfig = {
        name: "relative-path-test",
        host: "localhost",
        username: "testuser",
        keyFilePath: relativeKeyPath
      };

      try {
        await connectionManager.createConnection(config);
        fail("Should fail with connection error");
      } catch (error) {
        // Should process the file successfully and fail on connection
        expect((error as Error).message).not.toContain("Invalid path");
      }
    });
  });
});