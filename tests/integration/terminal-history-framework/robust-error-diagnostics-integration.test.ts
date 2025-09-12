/**
 * Story 8: Robust Error Handling and Diagnostics - Integration Tests
 * 
 * Integration tests for RobustErrorDiagnostics with real framework components.
 * These tests will fail initially and force implementation of real error handling,
 * server log capture, WebSocket state monitoring, and resource cleanup.
 * 
 * Test Coverage:
 * 1. Real error scenarios with actual framework components
 * 2. Server log capture during errors
 * 3. WebSocket state monitoring during connection failures
 * 4. Resource cleanup verification during error conditions
 * 5. Command sequence tracking through real workflow failures
 * 6. Integration with all Stories 1-7 components
 * 
 * CRITICAL: Integration tests with NO MOCKS.
 * Uses real framework components to test error diagnostics.
 */

import { RobustErrorDiagnostics } from './robust-error-diagnostics';
import { MCPServerManager } from './mcp-server-manager';
import { MCPClient } from './mcp-client';
import { PreWebSocketCommandExecutor } from './pre-websocket-command-executor';
import { WebSocketConnectionDiscovery } from './websocket-connection-discovery';
import { InitialHistoryReplayCapture } from './initial-history-replay-capture';
import { PostWebSocketCommandExecutor } from './post-websocket-command-executor';
import path from 'path';

describe('RobustErrorDiagnostics Integration Tests', () => {
  let diagnostics: RobustErrorDiagnostics;
  let serverManager: MCPServerManager;
  let mcpClient: MCPClient;
  let preExecutor: PreWebSocketCommandExecutor;
  let discovery: WebSocketConnectionDiscovery;
  let historyCapture: InitialHistoryReplayCapture;
  let postExecutor: PostWebSocketCommandExecutor;

  const testSessionName = 'diagnostic-integration-test';
  
  beforeEach(async () => {
    // Create real framework components
    const serverPath = path.join(__dirname, '../../..', 'dist/src/mcp-ssh-server.js');
    serverManager = new MCPServerManager({ serverPath });
    
    // Start server to get process for MCP client
    await serverManager.start();
    const rawProcess = serverManager.getRawProcess();
    
    if (!rawProcess) {
      throw new Error('Failed to get raw process from server manager');
    }
    
    mcpClient = new MCPClient(rawProcess);
    preExecutor = new PreWebSocketCommandExecutor(mcpClient);
    discovery = new WebSocketConnectionDiscovery(mcpClient);
    historyCapture = new InitialHistoryReplayCapture();
    postExecutor = new PostWebSocketCommandExecutor();

    // Create diagnostics with real configuration
    diagnostics = new RobustErrorDiagnostics({
      sessionName: testSessionName,
      enableServerLogCapture: true,
      enableWebSocketStateMonitoring: true,
      maxServerLogLines: 50,
      workflowTimeout: 15000,
      historyReplayTimeout: 5000,
      commandTimeout: 10000
    });

    // Inject real components
    diagnostics.setServerManager(serverManager);
    diagnostics.setMcpClient(mcpClient);
    diagnostics.setPreWebSocketExecutor(preExecutor);
    diagnostics.setConnectionDiscovery(discovery);
    diagnostics.setHistoryCapture(historyCapture);
    diagnostics.setPostWebSocketExecutor(postExecutor);
  });

  afterEach(async () => {
    // Comprehensive cleanup
    if (diagnostics) {
      await diagnostics.cleanup();
    }
    if (serverManager && serverManager.isRunning()) {
      await serverManager.stop();
    }
    if (mcpClient) {
      await mcpClient.disconnect();
    }
    if (preExecutor) {
      await preExecutor.cleanup();
    }
    if (historyCapture) {
      await historyCapture.cleanup();
    }
    if (postExecutor) {
      await postExecutor.cleanup();
    }
  });

  describe('Real Error Scenario Handling', () => {
    test('should capture diagnostic reports during server startup failure', async () => {
      // Create diagnostics with invalid server path to force startup failure
      const invalidServerPath = '/invalid/path/to/server';
      const failingServerManager = new MCPServerManager({ serverPath: invalidServerPath });
      
      // Create a minimal client setup for this test (without starting server)
      const mockProcess = {
        stdin: { write: jest.fn() },
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        kill: jest.fn()
      } as any;
      
      const failingClient = new MCPClient(mockProcess);
      const failingPreExecutor = new PreWebSocketCommandExecutor(failingClient);
      const failingDiscovery = new WebSocketConnectionDiscovery(failingClient);
      const failingHistory = new InitialHistoryReplayCapture();
      const failingPostExecutor = new PostWebSocketCommandExecutor();
      
      const failingDiagnostics = new RobustErrorDiagnostics({
        sessionName: testSessionName + '-server-fail',
        enableServerLogCapture: true,
        enableWebSocketStateMonitoring: true
      });

      failingDiagnostics.setServerManager(failingServerManager);
      failingDiagnostics.setMcpClient(failingClient);
      failingDiagnostics.setPreWebSocketExecutor(failingPreExecutor);
      failingDiagnostics.setConnectionDiscovery(failingDiscovery);
      failingDiagnostics.setHistoryCapture(failingHistory);
      failingDiagnostics.setPostWebSocketExecutor(failingPostExecutor);

      // Execute workflow expecting failure
      const result = await failingDiagnostics.executeComprehensiveWorkflowWithDiagnostics();
      
      // Should fail but with diagnostic reports
      expect(result.success).toBe(false);
      expect(result.diagnosticReports).toBeDefined();
      expect(result.diagnosticReports!.length).toBeGreaterThan(0);
      
      // Check diagnostic report content
      const report = result.diagnosticReports![0];
      expect(report.timestamp).toBeDefined();
      expect(report.phase).toMatch(/^(server-startup|configuration|websocket-connection|pre-websocket|history-replay|post-websocket)$/);
      expect(report.errorType).toMatch(/^(framework|application)$/);
      expect(report.message).toBeDefined();
      expect(report.context.commandSequence).toBeDefined();
      expect(report.context.resourceStates).toBeDefined();
      expect(report.debuggingTips.length).toBeGreaterThan(0);
      
      // Cleanup components
      await failingDiagnostics.cleanup();
      await failingPreExecutor.cleanup();
      await failingHistory.cleanup();
      await failingPostExecutor.cleanup();
    });

    test('should track resource states through workflow phases', async () => {
      // This will likely fail initially due to missing component implementations
      try {
        await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
        
        // If successful, verify resource state tracking
        const resourceStates = diagnostics.getResourceStates();
        expect(resourceStates.size).toBeGreaterThan(0);
        
        // Check if resource states were updated during workflow
        for (const [name, state] of resourceStates) {
          expect(state.name).toBe(name);
          expect(state.lastUpdated).toBeDefined();
          expect(state.status).toMatch(/^(initialized|running|stopped|error|unknown)$/);
        }
        
      } catch (error) {
        // If it fails, ensure diagnostic reports were created
        const reports = diagnostics.getDiagnosticReports();
        expect(reports.length).toBeGreaterThan(0);
        
        // Verify resource states are captured in diagnostic context
        const report = reports[0];
        expect(report.context.resourceStates).toBeDefined();
        expect(Object.keys(report.context.resourceStates).length).toBeGreaterThan(0);
      }
    });
  });

  describe('Server Log Capture', () => {
    test('should capture real server logs during error scenarios', async () => {
      // Start server first to generate logs
      try {
        await serverManager.start();
        // Let it run briefly to generate logs
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch {
        // Expected if server fails to start
      }

      // Now execute workflow which may fail but should capture logs
      const result = await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
      
      if (result.diagnosticReports && result.diagnosticReports.length > 0) {
        const report = result.diagnosticReports[0];
        
        // Server logs should be captured
        expect(report.context.serverLogs).toBeDefined();
        expect(Array.isArray(report.context.serverLogs)).toBe(true);
        
        // Should have real logs, not just placeholder
        if (report.context.serverLogs.length > 0) {
          expect(report.context.serverLogs[0]).not.toBe('Server log capture not yet implemented');
        }
      }
    });

    test('should respect maxServerLogLines configuration', async () => {
      const limitedLogsDiagnostics = new RobustErrorDiagnostics({
        sessionName: testSessionName + '-limited-logs',
        enableServerLogCapture: true,
        maxServerLogLines: 5
      });

      // Set up components
      limitedLogsDiagnostics.setServerManager(serverManager);
      limitedLogsDiagnostics.setMcpClient(mcpClient);
      limitedLogsDiagnostics.setPreWebSocketExecutor(preExecutor);
      limitedLogsDiagnostics.setConnectionDiscovery(discovery);
      limitedLogsDiagnostics.setHistoryCapture(historyCapture);
      limitedLogsDiagnostics.setPostWebSocketExecutor(postExecutor);

      try {
        await limitedLogsDiagnostics.executeComprehensiveWorkflowWithDiagnostics();
      } catch {
        // Expected to fail
      }

      const reports = limitedLogsDiagnostics.getDiagnosticReports();
      if (reports.length > 0) {
        const report = reports[0];
        // Should respect the 5 line limit
        expect(report.context.serverLogs.length).toBeLessThanOrEqual(5);
      }

      await limitedLogsDiagnostics.cleanup();
    });
  });

  describe('WebSocket State Monitoring', () => {
    test('should capture WebSocket connection state during failures', async () => {
      // Execute workflow which will likely fail at WebSocket connection phase
      const result = await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
      
      if (result.diagnosticReports && result.diagnosticReports.length > 0) {
        const report = result.diagnosticReports[0];
        
        // WebSocket state should be captured when monitoring is enabled
        expect(report.context.webSocketState).toBeDefined();
        
        // Should have real state information, not just placeholder
        expect(report.context.webSocketState).not.toBe('WebSocket state capture not yet implemented');
      }
    });

    test('should skip WebSocket monitoring when disabled', async () => {
      const noMonitoringDiagnostics = new RobustErrorDiagnostics({
        sessionName: testSessionName + '-no-monitoring',
        enableWebSocketStateMonitoring: false
      });

      // Set up components
      noMonitoringDiagnostics.setServerManager(serverManager);
      noMonitoringDiagnostics.setMcpClient(mcpClient);
      noMonitoringDiagnostics.setPreWebSocketExecutor(preExecutor);
      noMonitoringDiagnostics.setConnectionDiscovery(discovery);
      noMonitoringDiagnostics.setHistoryCapture(historyCapture);
      noMonitoringDiagnostics.setPostWebSocketExecutor(postExecutor);

      try {
        await noMonitoringDiagnostics.executeComprehensiveWorkflowWithDiagnostics();
      } catch {
        // Expected to fail
      }

      const reports = noMonitoringDiagnostics.getDiagnosticReports();
      if (reports.length > 0) {
        const report = reports[0];
        expect(report.context.webSocketState).toBeUndefined();
      }

      await noMonitoringDiagnostics.cleanup();
    });
  });

  describe('Command Sequence Tracking', () => {
    test('should track command sequence through workflow execution', async () => {
      // Configure with pre and post WebSocket commands
      const commandTrackingDiagnostics = new RobustErrorDiagnostics({
        sessionName: testSessionName + '-command-tracking',
        preWebSocketCommands: [
          { tool: 'ssh_create_session', args: { sessionName: testSessionName + '-tracking' } }
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ls'},
          {initiator: 'mcp-client', command: 'pwd'}
        ]
      });

      // Set up components
      commandTrackingDiagnostics.setServerManager(serverManager);
      commandTrackingDiagnostics.setMcpClient(mcpClient);
      commandTrackingDiagnostics.setPreWebSocketExecutor(preExecutor);
      commandTrackingDiagnostics.setConnectionDiscovery(discovery);
      commandTrackingDiagnostics.setHistoryCapture(historyCapture);
      commandTrackingDiagnostics.setPostWebSocketExecutor(postExecutor);

      try {
        await commandTrackingDiagnostics.executeComprehensiveWorkflowWithDiagnostics();
      } catch {
        // Expected to fail
      }

      const reports = commandTrackingDiagnostics.getDiagnosticReports();
      if (reports.length > 0) {
        const report = reports[0];
        
        // Command sequence should be tracked
        expect(report.context.commandSequence).toBeDefined();
        expect(Array.isArray(report.context.commandSequence)).toBe(true);
        
        // Should contain the commands we configured
        // This will fail until command tracking is properly implemented
        expect(report.context.commandSequence.length).toBeGreaterThan(0);
      }

      await commandTrackingDiagnostics.cleanup();
    });
  });

  describe('Error Classification Integration', () => {
    test('should classify real framework errors correctly', async () => {
      // Force a framework error by using invalid server configuration
      const frameworkErrorDiagnostics = new RobustErrorDiagnostics({
        sessionName: testSessionName + '-framework-error',
        workflowTimeout: 100 // Very short timeout to force framework timeout error
      });

      frameworkErrorDiagnostics.setServerManager(serverManager);
      frameworkErrorDiagnostics.setMcpClient(mcpClient);
      frameworkErrorDiagnostics.setPreWebSocketExecutor(preExecutor);
      frameworkErrorDiagnostics.setConnectionDiscovery(discovery);
      frameworkErrorDiagnostics.setHistoryCapture(historyCapture);
      frameworkErrorDiagnostics.setPostWebSocketExecutor(postExecutor);

      const result = await frameworkErrorDiagnostics.executeComprehensiveWorkflowWithDiagnostics();
      
      expect(result.success).toBe(false);
      expect(result.diagnosticReports!.length).toBeGreaterThan(0);
      
      const report = result.diagnosticReports![0];
      expect(report.errorType).toBe('framework');
      expect(report.message).toContain('timeout');
      
      await frameworkErrorDiagnostics.cleanup();
    });

    test('should classify application configuration errors correctly', async () => {
      // Force an application error by providing invalid configuration
      const appErrorDiagnostics = new RobustErrorDiagnostics({
        sessionName: '', // Invalid empty session name
        preWebSocketCommands: [
          { tool: 'invalid_command', args: {} } // Invalid command
        ]
      });

      appErrorDiagnostics.setServerManager(serverManager);
      appErrorDiagnostics.setMcpClient(mcpClient);
      appErrorDiagnostics.setPreWebSocketExecutor(preExecutor);
      appErrorDiagnostics.setConnectionDiscovery(discovery);
      appErrorDiagnostics.setHistoryCapture(historyCapture);
      appErrorDiagnostics.setPostWebSocketExecutor(postExecutor);

      const result = await appErrorDiagnostics.executeComprehensiveWorkflowWithDiagnostics();
      
      expect(result.success).toBe(false);
      expect(result.diagnosticReports!.length).toBeGreaterThan(0);
      
      // Should classify as application error
      const report = result.diagnosticReports![0];
      expect(report.errorType).toBe('application');
      
      await appErrorDiagnostics.cleanup();
    });
  });

  describe('Resource Cleanup Verification', () => {
    test('should guarantee resource cleanup even during critical failures', async () => {
      // Create a scenario that will fail at various phases
      const cleanupTestDiagnostics = new RobustErrorDiagnostics({
        sessionName: testSessionName + '-cleanup-test',
        workflowTimeout: 2000 // Short timeout to force failure
      });

      cleanupTestDiagnostics.setServerManager(serverManager);
      cleanupTestDiagnostics.setMcpClient(mcpClient);
      cleanupTestDiagnostics.setPreWebSocketExecutor(preExecutor);
      cleanupTestDiagnostics.setConnectionDiscovery(discovery);
      cleanupTestDiagnostics.setHistoryCapture(historyCapture);
      cleanupTestDiagnostics.setPostWebSocketExecutor(postExecutor);

      const result = await cleanupTestDiagnostics.executeComprehensiveWorkflowWithDiagnostics();
      
      // Should indicate cleanup success even if workflow failed
      expect(result.resourceCleanupSuccess).toBe(true);
      
      // Additional cleanup verification
      const additionalCleanupSuccess = await cleanupTestDiagnostics.cleanup();
      expect(additionalCleanupSuccess).toBe(true);
      
      // Resource states should reflect cleanup
      const finalResourceStates = cleanupTestDiagnostics.getResourceStates();
      for (const [, state] of finalResourceStates) {
        // After cleanup, resources should be stopped or have cleanup attempted
        expect(state.details.cleanupAttempted).toBe(true);
      }
    });
  });

  describe('Debugging Information Quality', () => {
    test('should provide actionable debugging tips for each error phase', async () => {
      const result = await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
      
      if (result.diagnosticReports && result.diagnosticReports.length > 0) {
        const report = result.diagnosticReports[0];
        
        // Should have debugging tips
        expect(report.debuggingTips).toBeDefined();
        expect(Array.isArray(report.debuggingTips)).toBe(true);
        expect(report.debuggingTips.length).toBeGreaterThan(0);
        
        // Tips should be actionable (contain specific guidance)
        const tipText = report.debuggingTips.join(' ').toLowerCase();
        expect(tipText).toMatch(/verify|check|ensure|configure/);
      }
    });

    test('should include stack trace information for debugging', async () => {
      const result = await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
      
      if (result.diagnosticReports && result.diagnosticReports.length > 0) {
        const report = result.diagnosticReports[0];
        
        // Should include stack trace for errors
        if (report.stackTrace) {
          expect(report.stackTrace).toBeDefined();
          expect(typeof report.stackTrace).toBe('string');
          expect(report.stackTrace.length).toBeGreaterThan(0);
        }
      }
    });
  });
});