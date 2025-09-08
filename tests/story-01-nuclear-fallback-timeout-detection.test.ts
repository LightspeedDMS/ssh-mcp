/**
 * Nuclear Fallback Epic - Story 01: Cancellation Timeout Detection
 * 
 * Test Requirements:
 * - 30-second timeout timer starts on all cancellation commands
 * - Timeout detection triggers nuclear fallback protocol  
 * - Successful cancellations clear timeout timers properly
 * - Multiple sessions handle timeouts independently
 * 
 * ANTI-MOCK COMPLIANCE: Uses real SSH connections and infrastructure
 */

import { SSHConnectionManager } from '../src/ssh-connection-manager.js';

describe('Story 01: Nuclear Fallback Timeout Detection', () => {
  let manager: SSHConnectionManager;
  
  beforeEach(() => {
    manager = new SSHConnectionManager(8080);
  });

  afterEach(async () => {
    // Clean up all connections with timeout protection
    const sessions = manager.listSessions();
    const disconnectionPromises = sessions.map(async (session) => {
      try {
        // Add timeout protection for disconnection
        const disconnectPromise = manager.disconnectSession(session.name);
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Session ${session.name} disconnection timed out after 5 seconds`));
          }, 5000);
        });
        
        await Promise.race([disconnectPromise, timeoutPromise]);
      } catch (error) {
        console.warn(`Failed to disconnect session ${session.name}:`, error);
      }
    });
    
    await Promise.allSettled(disconnectionPromises);
    
    // Force cleanup of manager resources
    manager.cleanup();
  });

  describe('AC 1.1: Timeout Timer Implementation', () => {
    it('should fail - nuclear timeout timer must start when browser cancellation issued', async () => {
      // Create real SSH session
      await manager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });

      // Add browser command to buffer
      manager.addBrowserCommand('test-session', 'sleep 5', 'cmd1', 'user');
      
      // Issue browser cancellation (SIGINT) - should start nuclear timeout timer
      manager.sendTerminalSignal('test-session', 'SIGINT');
      
      // TEST ASSERTION: Nuclear timeout timer should be active
      expect(manager.hasActiveNuclearTimeout('test-session')).toBe(true);
      expect(manager.getNuclearTimeoutDuration('test-session')).toBe(30000);
    }, 10000);

    it('should fail - nuclear timeout timer must start when MCP cancellation issued', async () => {
      // Create real SSH session
      await manager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'jsbattig', 
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });

      // Add MCP command to buffer
      manager.addBrowserCommand('test-session', 'sleep 5', 'cmd1', 'claude');
      
      // Issue MCP cancellation - should start nuclear timeout timer
      const cancelResult = manager.cancelMCPCommands('test-session');
      
      // TEST ASSERTION: Nuclear timeout timer should be active
      expect(manager.hasActiveNuclearTimeout('test-session')).toBe(true);
      expect(manager.getNuclearTimeoutDuration('test-session')).toBe(30000);
      expect(cancelResult.success).toBe(true);
    }, 10000);
  });

  describe('AC 1.2: Timeout Detection Triggering', () => {
    it('should fail - nuclear fallback must trigger after 30 seconds timeout', async () => {
      // Create real SSH session
      await manager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });

      // Add command and issue cancellation
      manager.addBrowserCommand('test-session', 'sleep 60', 'cmd1', 'user');
      manager.sendTerminalSignal('test-session', 'SIGINT');
      
      // Mock timer acceleration for testing
      await manager.setNuclearTimeoutDuration(1000); // 1 second for test
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // TEST ASSERTION: Nuclear fallback should have triggered
      expect(manager.hasTriggeredNuclearFallback('test-session')).toBe(true);
      expect(manager.getLastNuclearFallbackReason('test-session')).toContain('timeout');
    }, 15000);
  });

  describe('AC 1.3: Successful Cancellation Timer Cleanup', () => {
    it('should fail - nuclear timeout must clear when manually cleared', async () => {
      // Create real SSH session
      await manager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });

      // Add browser command and issue cancellation to start nuclear timeout
      manager.addBrowserCommand('test-session', 'sleep 30', 'cmd1', 'user');
      manager.sendTerminalSignal('test-session', 'SIGINT');
      
      // Verify timer started
      expect(manager.hasActiveNuclearTimeout('test-session')).toBe(true);
      
      // Manually clear the nuclear timeout (simulating successful cancellation)
      manager.clearNuclearTimeout('test-session');
      
      // TEST ASSERTION: Nuclear timeout should be cleared
      expect(manager.hasActiveNuclearTimeout('test-session')).toBe(false);
    }, 5000);

    it('should fail - nuclear timeout must be preserved until explicitly cleared', async () => {
      // Create real SSH session
      await manager.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });

      // Add browser command and issue cancellation to start nuclear timeout
      manager.addBrowserCommand('test-session', 'sleep 10', 'cmd1', 'user');
      manager.sendTerminalSignal('test-session', 'SIGINT');
      
      // Verify timer started
      expect(manager.hasActiveNuclearTimeout('test-session')).toBe(true);
      
      // Wait some time - timeout should remain active
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // TEST ASSERTION: Nuclear timeout should still be active
      expect(manager.hasActiveNuclearTimeout('test-session')).toBe(true);
      
      // Execute a different command that completes successfully
      await manager.executeCommand('test-session', 'echo "separate command"', {
        timeout: 2000,
        source: 'claude'
      });
      
      // TEST ASSERTION: Nuclear timeout should be cleared after any successful command completion
      expect(manager.hasActiveNuclearTimeout('test-session')).toBe(false);
    }, 8000);
  });

  describe('AC 1.4: Multiple Session Timeout Support', () => {
    it('should fail - each session must handle nuclear timeouts independently', async () => {
      // Create multiple real SSH sessions
      await manager.createConnection({
        name: 'session-1',
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });
      
      await manager.createConnection({
        name: 'session-2',
        host: 'localhost', 
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });

      // Issue cancellations for both sessions
      manager.addBrowserCommand('session-1', 'sleep 30', 'cmd1', 'user');
      manager.addBrowserCommand('session-2', 'sleep 30', 'cmd2', 'user');
      
      manager.sendTerminalSignal('session-1', 'SIGINT');
      manager.sendTerminalSignal('session-2', 'SIGINT');
      
      // TEST ASSERTION: Both sessions should have independent timeouts
      expect(manager.hasActiveNuclearTimeout('session-1')).toBe(true);
      expect(manager.hasActiveNuclearTimeout('session-2')).toBe(true);
      
      // Clear timeout for session-1 only
      manager.clearNuclearTimeout('session-1');
      
      // TEST ASSERTION: Only session-1 timeout should be cleared
      expect(manager.hasActiveNuclearTimeout('session-1')).toBe(false);
      expect(manager.hasActiveNuclearTimeout('session-2')).toBe(true);
    }, 15000);
  });

  describe('Integration: Complete Timeout Detection Flow', () => {
    it('should fail - complete nuclear timeout workflow with real SSH session', async () => {
      // Create real SSH session
      await manager.createConnection({
        name: 'integration-test',
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });

      // Add both browser and MCP commands
      manager.addBrowserCommand('integration-test', 'sleep 45', 'browser-cmd', 'user');
      manager.addBrowserCommand('integration-test', 'sleep 45', 'mcp-cmd', 'claude');
      
      // Issue browser cancellation
      manager.sendTerminalSignal('integration-test', 'SIGINT');
      
      // Verify nuclear timeout started and is tracking properly
      expect(manager.hasActiveNuclearTimeout('integration-test')).toBe(true);
      expect(manager.getNuclearTimeoutStartTime('integration-test')).toBeGreaterThan(Date.now() - 5000);
      
      // Accelerate timeout for testing
      await manager.setNuclearTimeoutDuration(500);
      
      // Wait longer for nuclear fallback to complete fully
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // TEST ASSERTIONS: Complete nuclear fallback workflow
      expect(manager.hasTriggeredNuclearFallback('integration-test')).toBe(true);
      expect(manager.isSessionHealthy('integration-test')).toBe(true); // Should be healthy after fallback
      expect(manager.getBrowserCommandBuffer('integration-test')).toHaveLength(0); // Buffer cleared
    }, 20000);
  });
});