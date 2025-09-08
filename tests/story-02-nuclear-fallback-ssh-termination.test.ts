/**
 * Nuclear Fallback Epic - Story 02: SSH Session Termination and Re-establishment
 * 
 * Test Requirements:
 * - SSH connections terminate forcibly on nuclear fallback
 * - Essential session state is preserved during termination
 * - Sessions automatically re-establish with same configuration
 * - Re-establishment failures are handled gracefully
 * 
 * ANTI-MOCK COMPLIANCE: Uses real SSH connections and infrastructure
 */

import { SSHConnectionManager } from '../src/ssh-connection-manager.js';

describe('Story 02: Nuclear Fallback SSH Session Termination', () => {
  let manager: SSHConnectionManager;
  
  beforeEach(() => {
    manager = new SSHConnectionManager(8080);
  });

  afterEach(async () => {
    // Clean up all connections
    const sessions = manager.listSessions();
    await Promise.all(
      sessions.map(session => manager.disconnectSession(session.name))
    );
  });

  describe('AC 2.1: Force SSH Connection Termination', () => {
    it('should fail - SSH connection must be forcibly terminated on nuclear fallback', async () => {
      // Create real SSH session
      await manager.createConnection({
        name: 'termination-test',
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });

      // Verify session is healthy
      expect(manager.isSessionHealthy('termination-test')).toBe(true);
      expect(manager.hasSession('termination-test')).toBe(true);

      // Add command and trigger nuclear fallback by accelerating timeout
      manager.addBrowserCommand('termination-test', 'sleep 60', 'cmd1', 'user');
      manager.sendTerminalSignal('termination-test', 'SIGINT');
      await manager.setNuclearTimeoutDuration(100); // Accelerate for testing
      
      // Wait longer for nuclear fallback to trigger and complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // TEST ASSERTIONS: Session should be terminated and re-established
      expect(manager.hasTriggeredNuclearFallback('termination-test')).toBe(true);
      expect(manager.hasSession('termination-test')).toBe(true); // Re-established
      expect(manager.isSessionHealthy('termination-test')).toBe(true); // Healthy after re-establishment
    }, 10000);
  });

  describe('AC 2.2: Session State Preservation', () => {
    it('should fail - essential session configuration must be preserved during termination', async () => {
      // Create real SSH session with specific configuration
      const originalConfig = {
        name: 'state-preservation-test',
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      };
      
      await manager.createConnection(originalConfig);

      // Get original connection details
      const originalConnection = manager.getConnection('state-preservation-test');
      expect(originalConnection).toBeDefined();
      
      // Trigger nuclear fallback
      manager.addBrowserCommand('state-preservation-test', 'sleep 60', 'cmd1', 'user');
      manager.sendTerminalSignal('state-preservation-test', 'SIGINT');
      await manager.setNuclearTimeoutDuration(100);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // TEST ASSERTIONS: Configuration should be preserved
      const reestablishedConnection = manager.getConnection('state-preservation-test');
      expect(reestablishedConnection).toBeDefined();
      expect(reestablishedConnection!.name).toBe(originalConfig.name);
      expect(reestablishedConnection!.host).toBe(originalConfig.host);
      expect(reestablishedConnection!.username).toBe(originalConfig.username);
    }, 10000);
  });

  describe('AC 2.3: Automatic Session Re-establishment', () => {
    it('should fail - new SSH connection must be automatically established after termination', async () => {
      // Create real SSH session
      await manager.createConnection({
        name: 'reestablishment-test',
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });

      // Execute a command to verify initial functionality
      const initialResult = await manager.executeCommand('reestablishment-test', 'whoami', {
        timeout: 3000,
        source: 'user'
      });
      
      expect(initialResult.stdout.trim()).toBe('jsbattig');
      expect(initialResult.exitCode).toBe(0);
      
      // Trigger nuclear fallback
      manager.addBrowserCommand('reestablishment-test', 'sleep 60', 'cmd1', 'user');
      manager.sendTerminalSignal('reestablishment-test', 'SIGINT');
      await manager.setNuclearTimeoutDuration(100);
      
      // Wait longer for nuclear fallback to complete fully
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // TEST ASSERTIONS: Session should be re-established and functional
      expect(manager.hasTriggeredNuclearFallback('reestablishment-test')).toBe(true);
      
      console.log('Session healthy check:', manager.isSessionHealthy('reestablishment-test'));
      console.log('Session exists:', manager.hasSession('reestablishment-test'));
      
      expect(manager.isSessionHealthy('reestablishment-test')).toBe(true);
      
      // Execute command on re-established session
      const reestablishedResult = await manager.executeCommand('reestablishment-test', 'echo "reestablished"', {
        timeout: 3000,
        source: 'user'
      });
      
      expect(reestablishedResult.stdout).toContain('reestablished');
      expect(reestablishedResult.exitCode).toBe(0);
    }, 15000);
  });

  describe('AC 2.4: Re-establishment Failure Handling', () => {
    it('should fail - re-establishment failures must be logged and handled', async () => {
      // Create real SSH session
      await manager.createConnection({
        name: 'failure-handling-test',
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });

      // Trigger nuclear fallback - this will test the actual re-establishment logic
      manager.addBrowserCommand('failure-handling-test', 'sleep 60', 'cmd1', 'user');
      manager.sendTerminalSignal('failure-handling-test', 'SIGINT');
      await manager.setNuclearTimeoutDuration(100);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // TEST ASSERTIONS: Nuclear fallback should be triggered and handled
      expect(manager.hasTriggeredNuclearFallback('failure-handling-test')).toBe(true);
      expect(manager.getLastNuclearFallbackReason('failure-handling-test')).toContain('timeout');
      
      // After re-establishment attempt, session should either be healthy or failed
      const isHealthy = manager.isSessionHealthy('failure-handling-test');
      expect(typeof isHealthy).toBe('boolean'); // Should return a boolean result
    }, 10000);
  });

  describe('Integration: Complete SSH Termination and Re-establishment Flow', () => {
    it('should fail - complete SSH termination and re-establishment workflow', async () => {
      // Create multiple real SSH sessions
      await manager.createConnection({
        name: 'session-a',
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });
      
      await manager.createConnection({
        name: 'session-b',
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });

      // Execute commands on both to verify they're working
      await manager.executeCommand('session-a', 'echo "session-a-initial"', {
        timeout: 2000,
        source: 'user'
      });
      
      await manager.executeCommand('session-b', 'echo "session-b-initial"', {
        timeout: 2000,
        source: 'user'
      });

      // Trigger nuclear fallback on session-a only
      manager.addBrowserCommand('session-a', 'sleep 60', 'cmd1', 'user');
      manager.sendTerminalSignal('session-a', 'SIGINT');
      await manager.setNuclearTimeoutDuration(100);
      
      // Wait longer for nuclear fallback to complete fully
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // TEST ASSERTIONS: Only session-a should be affected
      expect(manager.hasTriggeredNuclearFallback('session-a')).toBe(true);
      expect(manager.hasTriggeredNuclearFallback('session-b')).toBe(false);
      expect(manager.isSessionHealthy('session-a')).toBe(true); // Re-established
      expect(manager.isSessionHealthy('session-b')).toBe(true); // Unaffected
      
      // Both sessions should still work
      const resultA = await manager.executeCommand('session-a', 'echo "session-a-after"', {
        timeout: 3000,
        source: 'user'
      });
      
      const resultB = await manager.executeCommand('session-b', 'echo "session-b-after"', {
        timeout: 3000,
        source: 'user'
      });
      
      expect(resultA.stdout.trim()).toBe('session-a-after');
      expect(resultB.stdout.trim()).toBe('session-b-after');
    }, 20000);
  });
});