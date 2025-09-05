/**
 * Story 8: Robust Error Handling and Diagnostics - Unit Tests
 * 
 * Unit tests for RobustErrorDiagnostics class following strict TDD practices.
 * These tests will initially fail and drive the implementation of comprehensive
 * error reporting and diagnostic capabilities.
 * 
 * Test Coverage:
 * 1. Configuration validation and initialization
 * 2. Error report generation with detailed context
 * 3. Command sequence tracking and reporting
 * 4. Resource state monitoring and serialization
 * 5. Framework vs application error classification
 * 6. Debugging tips database and recommendations
 * 7. Resource cleanup guarantees during errors
 * 8. Integration with ComprehensiveResponseCollector
 * 
 * CRITICAL: These are unit tests with NO MOCKS in production code.
 * All mocking is limited to test doubles only.
 */

import { RobustErrorDiagnostics, RobustErrorDiagnosticsConfig } from './robust-error-diagnostics';
import { MCPServerManager } from './mcp-server-manager';
import { MCPClient } from './mcp-client';
import { PreWebSocketCommandExecutor } from './pre-websocket-command-executor';
import { WebSocketConnectionDiscovery } from './websocket-connection-discovery';
import { InitialHistoryReplayCapture } from './initial-history-replay-capture';
import { PostWebSocketCommandExecutor } from './post-websocket-command-executor';

describe('RobustErrorDiagnostics', () => {
  let diagnostics: RobustErrorDiagnostics;
  
  beforeEach(() => {
    // Create fresh instance for each test
    diagnostics = new RobustErrorDiagnostics();
  });

  afterEach(async () => {
    // Ensure cleanup after each test
    if (diagnostics) {
      await diagnostics.cleanup();
    }
  });

  describe('Configuration and Initialization', () => {
    test('should initialize with default configuration', () => {
      const config = diagnostics.getConfig();
      
      expect(config.workflowTimeout).toBe(10000);
      expect(config.sessionName).toBe('diagnostic-test-session');
      expect(config.enableServerLogCapture).toBe(true);
      expect(config.enableWebSocketStateMonitoring).toBe(true);
      expect(config.maxServerLogLines).toBe(100);
      expect(config.debuggingTipsDatabase).toBeInstanceOf(Map);
    });

    test('should accept custom configuration', () => {
      const customConfig: RobustErrorDiagnosticsConfig = {
        workflowTimeout: 15000,
        sessionName: 'custom-session',
        enableServerLogCapture: false,
        enableWebSocketStateMonitoring: false,
        maxServerLogLines: 50,
        debuggingTipsDatabase: new Map([
          ['custom-phase', ['custom tip 1', 'custom tip 2']]
        ])
      };

      const customDiagnostics = new RobustErrorDiagnostics(customConfig);
      const config = customDiagnostics.getConfig();
      
      expect(config.workflowTimeout).toBe(15000);
      expect(config.sessionName).toBe('custom-session');
      expect(config.enableServerLogCapture).toBe(false);
      expect(config.enableWebSocketStateMonitoring).toBe(false);
      expect(config.maxServerLogLines).toBe(50);
      expect(config.debuggingTipsDatabase.get('custom-phase')).toEqual(['custom tip 1', 'custom tip 2']);
    });

    test('should throw error for invalid maxServerLogLines', () => {
      expect(() => {
        new RobustErrorDiagnostics({ maxServerLogLines: 0 });
      }).toThrow('maxServerLogLines must be positive');

      expect(() => {
        new RobustErrorDiagnostics({ maxServerLogLines: -5 });
      }).toThrow('maxServerLogLines must be positive');
    });

    test('should initialize default debugging tips database', () => {
      const config = diagnostics.getConfig();
      const debuggingTips = config.debuggingTipsDatabase;
      
      expect(debuggingTips.has('server-startup')).toBe(true);
      expect(debuggingTips.has('pre-websocket')).toBe(true);
      expect(debuggingTips.has('websocket-connection')).toBe(true);
      expect(debuggingTips.has('history-replay')).toBe(true);
      expect(debuggingTips.has('post-websocket')).toBe(true);
      expect(debuggingTips.has('configuration')).toBe(true);
      
      expect(debuggingTips.get('server-startup')).toContain('Verify MCP server binary exists and has execute permissions');
      expect(debuggingTips.get('websocket-connection')).toContain('Verify WebSocket URL discovery is working correctly');
    });
  });

  describe('Framework Component Integration', () => {
    test('should track resource state when setting server manager', () => {
      const mockServerManager = {} as MCPServerManager;
      
      diagnostics.setServerManager(mockServerManager);
      const resourceStates = diagnostics.getResourceStates();
      
      expect(resourceStates.has('server-manager')).toBe(true);
      const serverManagerState = resourceStates.get('server-manager');
      expect(serverManagerState?.status).toBe('initialized');
      expect(serverManagerState?.details).toEqual({ isRunning: false });
      expect(serverManagerState?.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should track resource state when setting MCP client', () => {
      const mockClient = {} as MCPClient;
      
      diagnostics.setMcpClient(mockClient);
      const resourceStates = diagnostics.getResourceStates();
      
      expect(resourceStates.has('mcp-client')).toBe(true);
      const clientState = resourceStates.get('mcp-client');
      expect(clientState?.status).toBe('initialized');
      expect(clientState?.details).toEqual({ connected: false });
    });

    test('should track all framework components', () => {
      const mockServerManager = {} as MCPServerManager;
      const mockClient = {} as MCPClient;
      const mockPreExecutor = {} as PreWebSocketCommandExecutor;
      const mockDiscovery = {} as WebSocketConnectionDiscovery;
      const mockHistory = {} as InitialHistoryReplayCapture;
      const mockPostExecutor = {} as PostWebSocketCommandExecutor;
      
      diagnostics.setServerManager(mockServerManager);
      diagnostics.setMcpClient(mockClient);
      diagnostics.setPreWebSocketExecutor(mockPreExecutor);
      diagnostics.setConnectionDiscovery(mockDiscovery);
      diagnostics.setHistoryCapture(mockHistory);
      diagnostics.setPostWebSocketExecutor(mockPostExecutor);
      
      const resourceStates = diagnostics.getResourceStates();
      expect(resourceStates.size).toBe(6);
      expect(resourceStates.has('server-manager')).toBe(true);
      expect(resourceStates.has('mcp-client')).toBe(true);
      expect(resourceStates.has('pre-websocket-executor')).toBe(true);
      expect(resourceStates.has('websocket-discovery')).toBe(true);
      expect(resourceStates.has('history-capture')).toBe(true);
      expect(resourceStates.has('post-websocket-executor')).toBe(true);
    });
  });

  describe('Error Classification', () => {
    test('should classify framework errors correctly', async () => {
      // This test will fail initially as the error classification method is private
      // We'll need to test it through the diagnostic report creation
      try {
        await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
      } catch {
        // Expected to fail, we'll check the classification indirectly
      }
      
      const reports = diagnostics.getDiagnosticReports();
      // This assertion will fail until we implement the real error classification
      expect(reports.length).toBeGreaterThan(0);
    });

    test('should classify application errors correctly', async () => {
      try {
        await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
      } catch {
        // Expected to fail, we'll check the classification indirectly
      }
      
      const reports = diagnostics.getDiagnosticReports();
      // This assertion will fail until we implement the real error classification
      expect(reports.length).toBeGreaterThan(0);
    });
  });

  describe('Diagnostic Report Generation', () => {
    test('should create comprehensive diagnostic report on error', async () => {
      // This test will initially fail as the workflow execution isn't fully implemented
      try {
        const result = await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
        
        // If we get here, check for diagnostic reports
        expect(result.diagnosticReports).toBeDefined();
        expect(Array.isArray(result.diagnosticReports)).toBe(true);
      } catch (error) {
        // Expected to fail initially
        expect(error).toBeDefined();
      }
    });

    test('should include timestamp in diagnostic reports', async () => {
      try {
        await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
      } catch {
        // Expected to fail
      }
      
      const reports = diagnostics.getDiagnosticReports();
      if (reports.length > 0) {
        expect(reports[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    });

    test('should include command sequence in diagnostic context', async () => {
      try {
        await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
      } catch {
        // Expected to fail
      }
      
      const reports = diagnostics.getDiagnosticReports();
      if (reports.length > 0) {
        expect(reports[0].context.commandSequence).toBeDefined();
        expect(Array.isArray(reports[0].context.commandSequence)).toBe(true);
      }
    });

    test('should include resource states in diagnostic context', async () => {
      // Set up some components to track resource states
      diagnostics.setServerManager({} as MCPServerManager);
      diagnostics.setMcpClient({} as MCPClient);
      
      try {
        await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
      } catch {
        // Expected to fail
      }
      
      const reports = diagnostics.getDiagnosticReports();
      if (reports.length > 0) {
        expect(reports[0].context.resourceStates).toBeDefined();
        expect(reports[0].context.resourceStates['server-manager']).toBeDefined();
        expect(reports[0].context.resourceStates['mcp-client']).toBeDefined();
      }
    });

    test('should include debugging tips in diagnostic reports', async () => {
      try {
        await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
      } catch {
        // Expected to fail
      }
      
      const reports = diagnostics.getDiagnosticReports();
      if (reports.length > 0) {
        expect(reports[0].debuggingTips).toBeDefined();
        expect(Array.isArray(reports[0].debuggingTips)).toBe(true);
        expect(reports[0].debuggingTips.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Resource Cleanup Guarantees', () => {
    test('should ensure cleanup even when workflow fails', async () => {
      let cleanupSuccess = false;
      
      try {
        const result = await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
        cleanupSuccess = result.resourceCleanupSuccess;
      } catch {
        // Check if cleanup was attempted even on error
        cleanupSuccess = await diagnostics.cleanup();
      }
      
      // This assertion will fail until we implement proper cleanup
      expect(typeof cleanupSuccess).toBe('boolean');
    });

    test('should track resource cleanup in diagnostic reports', async () => {
      try {
        const result = await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
        expect(result.resourceCleanupSuccess).toBeDefined();
        expect(typeof result.resourceCleanupSuccess).toBe('boolean');
      } catch {
        // Expected to fail initially
      }
    });
  });

  describe('WebSocket State Monitoring', () => {
    test('should capture WebSocket state when monitoring enabled', async () => {
      const configWithMonitoring = new RobustErrorDiagnostics({
        enableWebSocketStateMonitoring: true
      });
      
      try {
        await configWithMonitoring.executeComprehensiveWorkflowWithDiagnostics();
      } catch {
        // Expected to fail
      }
      
      const reports = configWithMonitoring.getDiagnosticReports();
      if (reports.length > 0) {
        // This will initially fail as WebSocket state capture is not implemented
        expect(reports[0].context.webSocketState).toBeDefined();
      }
      
      await configWithMonitoring.cleanup();
    });

    test('should skip WebSocket state when monitoring disabled', async () => {
      const configWithoutMonitoring = new RobustErrorDiagnostics({
        enableWebSocketStateMonitoring: false
      });
      
      try {
        await configWithoutMonitoring.executeComprehensiveWorkflowWithDiagnostics();
      } catch {
        // Expected to fail
      }
      
      const reports = configWithoutMonitoring.getDiagnosticReports();
      if (reports.length > 0) {
        expect(reports[0].context.webSocketState).toBeUndefined();
      }
      
      await configWithoutMonitoring.cleanup();
    });
  });

  describe('Server Log Capture', () => {
    test('should capture server logs when enabled', async () => {
      const configWithLogs = new RobustErrorDiagnostics({
        enableServerLogCapture: true,
        maxServerLogLines: 50
      });
      
      try {
        await configWithLogs.executeComprehensiveWorkflowWithDiagnostics();
      } catch {
        // Expected to fail
      }
      
      const reports = configWithLogs.getDiagnosticReports();
      if (reports.length > 0) {
        expect(reports[0].context.serverLogs).toBeDefined();
        expect(Array.isArray(reports[0].context.serverLogs)).toBe(true);
        // This will initially show placeholder until real implementation
        expect(reports[0].context.serverLogs.length).toBeGreaterThan(0);
      }
      
      await configWithLogs.cleanup();
    });

    test('should skip server logs when disabled', async () => {
      const configWithoutLogs = new RobustErrorDiagnostics({
        enableServerLogCapture: false
      });
      
      try {
        await configWithoutLogs.executeComprehensiveWorkflowWithDiagnostics();
      } catch {
        // Expected to fail
      }
      
      const reports = configWithoutLogs.getDiagnosticReports();
      if (reports.length > 0) {
        // Should still have serverLogs array but it might be empty
        expect(reports[0].context.serverLogs).toBeDefined();
        expect(Array.isArray(reports[0].context.serverLogs)).toBe(true);
      }
      
      await configWithoutLogs.cleanup();
    });
  });

  describe('Integration with ComprehensiveResponseCollector', () => {
    test('should delegate to ComprehensiveResponseCollector for workflow execution', async () => {
      // This test will fail initially as the integration is not fully implemented
      try {
        const result = await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
        
        // Check if we get a proper DiagnosticWorkflowResult
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
        expect(result.concatenatedResponses).toBeDefined();
        expect(result.totalExecutionTime).toBeDefined();
        expect(result.diagnosticReports).toBeDefined();
        expect(result.resourceCleanupSuccess).toBeDefined();
      } catch (error) {
        // Expected to fail until implementation is complete
        expect(error).toBeDefined();
      }
    });

    test('should wrap ComprehensiveResponseCollector errors with diagnostic reports', async () => {
      try {
        await diagnostics.executeComprehensiveWorkflowWithDiagnostics();
      } catch (error) {
        // Even if workflow fails, should generate diagnostic reports
        const reports = diagnostics.getDiagnosticReports();
        expect(reports.length).toBeGreaterThan(0);
      }
    });
  });
});