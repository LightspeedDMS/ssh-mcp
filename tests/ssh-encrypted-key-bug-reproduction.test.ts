/**
 * Test to reproduce the critical encrypted SSH key passphrase bug
 * 
 * Bug: Passphrase parameter is not properly passed from MCP tool to ssh2 library
 * This causes encrypted SSH keys to fail with "Encrypted private OpenSSH key detected, but no passphrase given"
 */

import * as fs from 'fs/promises';
import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import { SSHConnectionConfig } from '../src/types.js';

describe('Encrypted SSH Key Passphrase Bug Fix Verification', () => {
  let connectionManager: SSHConnectionManager;
  
  // Test key paths and passphrases from ssh2 fixtures
  const RSA_ENCRYPTED_KEY_PATH = '/home/jsbattig/Dev/ls-ssh-mcp/node_modules/ssh2/test/fixtures/id_rsa_enc';
  const OPENSSH_NEW_RSA_ENCRYPTED_KEY_PATH = '/home/jsbattig/Dev/ls-ssh-mcp/node_modules/ssh2/test/fixtures/keyParser/openssh_new_rsa_enc';
  const TEST_PASSPHRASE = 'foobarbaz';

  beforeEach(() => {
    connectionManager = new SSHConnectionManager();
  });

  afterEach(() => {
    connectionManager.cleanup();
  });

  describe('Traditional RSA encrypted key format', () => {
    test('should successfully decrypt RSA encrypted key with correct passphrase', async () => {
      // Read the encrypted key to confirm it exists
      const keyContent = await fs.readFile(RSA_ENCRYPTED_KEY_PATH, 'utf8');
      expect(keyContent).toContain('Proc-Type: 4,ENCRYPTED');
      expect(keyContent).toContain('DEK-Info:');

      const config: SSHConnectionConfig = {
        name: 'test-encrypted-rsa-key',
        host: '127.0.0.1', // Fake host - will fail at connection but key should decrypt
        username: 'testuser',
        keyFilePath: RSA_ENCRYPTED_KEY_PATH,
        passphrase: TEST_PASSPHRASE,
      };

      // The key should decrypt successfully, but connection will fail since no SSH server
      // We expect "All configured authentication methods failed" NOT "no passphrase given"
      await expect(connectionManager.createConnection(config)).rejects.toThrow();
      await expect(connectionManager.createConnection(config)).rejects.toThrow(
        /All configured authentication methods failed|Connection timeout|ECONNREFUSED/i
      );
    }, 30000);

    test('should successfully decrypt RSA key when using privateKey parameter directly', async () => {
      // Test direct privateKey parameter with encrypted content
      const keyContent = await fs.readFile(RSA_ENCRYPTED_KEY_PATH, 'utf8');
      
      const config: SSHConnectionConfig = {
        name: 'test-encrypted-rsa-direct',
        host: '127.0.0.1',
        username: 'testuser', 
        privateKey: keyContent,
        passphrase: TEST_PASSPHRASE,
      };

      // Key should decrypt successfully - connection failure is expected
      await expect(connectionManager.createConnection(config)).rejects.toThrow();
      await expect(connectionManager.createConnection(config)).rejects.toThrow(
        /All configured authentication methods failed|Connection timeout|ECONNREFUSED/i
      );
    }, 30000);

    test('should fail with "no passphrase given" when passphrase is missing for RSA key', async () => {
      const config: SSHConnectionConfig = {
        name: 'test-rsa-no-passphrase',
        host: '127.0.0.1',
        username: 'testuser',
        keyFilePath: RSA_ENCRYPTED_KEY_PATH,
        // No passphrase provided
      };

      // Should get an error indicating passphrase is required
      await expect(connectionManager.createConnection(config)).rejects.toThrow();
      await expect(connectionManager.createConnection(config)).rejects.toThrow(
        /no passphrase|passphrase.*required|Key is encrypted but no passphrase provided/i
      );
    }, 30000);
  });

  describe('OpenSSH new format encrypted key', () => {
    test('should handle OpenSSH new format encrypted keys with passphrase (wrong passphrase test)', async () => {
      // Read the OpenSSH new format encrypted key
      const keyContent = await fs.readFile(OPENSSH_NEW_RSA_ENCRYPTED_KEY_PATH, 'utf8');
      expect(keyContent).toContain('-----BEGIN OPENSSH PRIVATE KEY-----');
      
      const config: SSHConnectionConfig = {
        name: 'test-encrypted-openssh-key',
        host: '127.0.0.1',
        username: 'testuser',
        keyFilePath: OPENSSH_NEW_RSA_ENCRYPTED_KEY_PATH,
        passphrase: TEST_PASSPHRASE, // This passphrase might be wrong for OpenSSH new format
      };

      // With wrong passphrase, should get "bad passphrase" error, not "no passphrase given"
      await expect(connectionManager.createConnection(config)).rejects.toThrow();
      await expect(connectionManager.createConnection(config)).rejects.toThrow(
        /bad passphrase|integrity check failed/i
      );
    }, 30000);

    test('should fail with "no passphrase given" when passphrase is missing for OpenSSH key', async () => {
      const config: SSHConnectionConfig = {
        name: 'test-openssh-no-passphrase',
        host: '127.0.0.1',
        username: 'testuser',
        keyFilePath: OPENSSH_NEW_RSA_ENCRYPTED_KEY_PATH,
        // No passphrase provided
      };

      // Should get an error indicating passphrase is required
      await expect(connectionManager.createConnection(config)).rejects.toThrow();
      await expect(connectionManager.createConnection(config)).rejects.toThrow(
        /no passphrase|passphrase.*required|Key is encrypted but no passphrase provided/i
      );
    }, 30000);
  });

  describe('Key encryption detection', () => {
    test('should correctly detect traditional RSA encrypted keys', async () => {
      const keyContent = await fs.readFile(RSA_ENCRYPTED_KEY_PATH, 'utf8');
      
      // Access the private method to test encryption detection
      const isEncrypted = (connectionManager as any).isKeyEncrypted(keyContent);
      expect(isEncrypted).toBe(true);
    });

    test('should correctly detect OpenSSH new format encrypted keys', async () => {
      const keyContent = await fs.readFile(OPENSSH_NEW_RSA_ENCRYPTED_KEY_PATH, 'utf8');
      
      // The current implementation may not detect OpenSSH new format encrypted keys correctly
      // This test documents the current behavior
      const isEncrypted = (connectionManager as any).isKeyEncrypted(keyContent);
      
      // This might fail if the isKeyEncrypted method doesn't handle OpenSSH new format
      // which could be part of the bug
      expect(isEncrypted).toBe(true);
    });
  });

  describe('Bug fix verification', () => {
    test('should prove that passphrase is now being passed to ssh2 library correctly', async () => {
      // This test verifies that the bug has been fixed by confirming the passphrase
      // is being passed through to ssh2 library correctly
      
      const config: SSHConnectionConfig = {
        name: 'test-passphrase-flow',
        host: '127.0.0.1',
        username: 'testuser',
        keyFilePath: RSA_ENCRYPTED_KEY_PATH,
        passphrase: TEST_PASSPHRASE,
      };

      try {
        await connectionManager.createConnection(config);
        fail('Expected connection to fail due to no SSH server running');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Document the exact error message we get after fix
        console.log('Fixed implementation error message:', errorMessage);
        
        // The error should NOT mention "no passphrase given" anymore
        // Instead it should be a connection failure since the key decrypted successfully
        expect(errorMessage).toMatch(/All configured authentication methods failed|Connection timeout|ECONNREFUSED/i);
        expect(errorMessage).not.toMatch(/no passphrase given/i);
      }
    }, 30000);
  });
});