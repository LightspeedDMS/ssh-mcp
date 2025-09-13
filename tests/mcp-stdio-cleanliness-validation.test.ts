import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * CRITICAL TEST: MCP Protocol Stdio Cleanliness Validation
 * 
 * PURPOSE: Ensure MCP server NEVER outputs to stdio, which would corrupt JSON-RPC protocol
 * CONTEXT: Code-reviewer found 60+ console statements that can break MCP communication
 * REQUIREMENT: MCP server must maintain clean stdio for JSON-RPC protocol integrity
 */
describe('MCP Protocol Stdio Cleanliness Validation', () => {

  let mcpProcess: ChildProcess;
  let stdoutBuffer: string = '';
  let stderrBuffer: string = '';
  let allProcessOutput: string = '';

  const MCP_SERVER_PATH = path.join(__dirname, '../src/mcp-server.ts');

  beforeEach(() => {
    stdoutBuffer = '';
    stderrBuffer = '';
    allProcessOutput = '';
  });

  afterEach(async () => {
    if (mcpProcess && !mcpProcess.killed) {
      mcpProcess.kill('SIGTERM');
      await new Promise(resolve => {
        mcpProcess.on('exit', resolve);
        setTimeout(resolve, 2000); // Force cleanup after 2s
      });
    }
  });

  /**
   * TEST 1: Stdio Cleanliness During MCP Server Startup
   * REQUIREMENT: No console.log/console.error during server initialization
   */
  test('MCP server startup produces ZERO console output to stdio', async () => {
    const startupPromise = new Promise<void>((resolve, reject) => {
      // Start MCP server
      mcpProcess = spawn('npx', ['tsx', MCP_SERVER_PATH], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      mcpProcess.stdout!.on('data', (data: Buffer) => {
        const output = data.toString();
        stdoutBuffer += output;
        allProcessOutput += `STDOUT: ${output}`;
      });

      mcpProcess.stderr!.on('data', (data: Buffer) => {
        const output = data.toString();
        stderrBuffer += output;
        allProcessOutput += `STDERR: ${output}`;
      });

      mcpProcess.on('error', (error) => {
        reject(new Error(`MCP process error: ${error.message}`));
      });

      // Allow 3 seconds for startup
      setTimeout(() => {
        resolve();
      }, 3000);
    });

    await startupPromise;

    // CRITICAL ASSERTION: Zero console output during startup
    expect(stderrBuffer.trim()).toBe('');
    expect(stdoutBuffer).not.toMatch(/console\./);
    expect(allProcessOutput).not.toMatch(/Error|Warning|Log|Debug/i);
    
    // Log any violations for debugging
    if (stderrBuffer.length > 0 || stdoutBuffer.includes('console.')) {
      console.error('STDIO CLEANLINESS VIOLATION DETECTED:');
      console.error('STDERR:', stderrBuffer);
      console.error('STDOUT (non-JSON):', stdoutBuffer.replace(/\{.*\}/g, '[JSON_REMOVED]'));
    }
  });

  /**
   * TEST 2: Stdio Cleanliness During MCP JSON-RPC Communication
   * REQUIREMENT: Only valid JSON-RPC messages on stdout, nothing on stderr
   */
  test('MCP server produces only valid JSON-RPC on stdout during communication', async () => {
    const communicationPromise = new Promise<void>((resolve, reject) => {
      mcpProcess = spawn('npx', ['tsx', MCP_SERVER_PATH], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      mcpProcess.stdout!.on('data', (data: Buffer) => {
        const output = data.toString();
        stdoutBuffer += output;
      });

      mcpProcess.stderr!.on('data', (data: Buffer) => {
        const output = data.toString();
        stderrBuffer += output;
        allProcessOutput += `STDERR_VIOLATION: ${output}`;
      });

      // Send MCP initialization message
      setTimeout(() => {
        const initMessage = JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test-client", version: "1.0.0" }
          }
        }) + '\n';

        mcpProcess.stdin!.write(initMessage);
        
        // Allow time for processing
        setTimeout(resolve, 2000);
      }, 1000);

      mcpProcess.on('error', reject);
    });

    await communicationPromise;

    // CRITICAL ASSERTION: No stderr output during JSON-RPC communication
    expect(stderrBuffer.trim()).toBe('');
    
    // CRITICAL ASSERTION: Only valid JSON-RPC on stdout
    const stdoutLines = stdoutBuffer.split('\n').filter(line => line.trim());
    for (const line of stdoutLines) {
      if (line.trim()) {
        expect(() => JSON.parse(line)).not.toThrow();
        const parsed = JSON.parse(line);
        expect(parsed).toHaveProperty('jsonrpc', '2.0');
      }
    }

    // Log any violations
    if (stderrBuffer.length > 0) {
      console.error('JSON-RPC STDIO VIOLATION:', stderrBuffer);
    }
  });

  /**
   * TEST 3: Console Statement Detection in Source Code
   * REQUIREMENT: Zero console.log/console.error in MCP server production code
   */
  test('MCP server source code contains ZERO console statements', async () => {
    const sourceFiles = [
      'src/mcp-server.ts',
      'src/orchestrator.ts',
      'src/ssh-connection-manager.ts', 
      'src/web-server-manager.ts',
      'src/command-state-manager.ts',
      'src/types.ts'
    ];

    const violations: string[] = [];

    for (const filePath of sourceFiles) {
      const fullPath = path.join(__dirname, '..', filePath);
      
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Only detect active console statements, not comments or commented-out code
          const trimmedLine = line.trim();
          if (line.includes('console.') && 
              !trimmedLine.startsWith('//') && 
              !trimmedLine.startsWith('*') &&
              !trimmedLine.startsWith('/*')) {
            violations.push(`${filePath}:${index + 1}: ${line.trim()}`);
          }
        });
      }
    }

    // CRITICAL ASSERTION: Zero console statements in production code
    expect(violations).toEqual([]);
    
    if (violations.length > 0) {
      console.error('CONSOLE STATEMENT VIOLATIONS FOUND:');
      violations.forEach(violation => console.error(violation));
    }
  });

  /**
   * TEST 4: Debug Mode Stdio Cleanliness
   * REQUIREMENT: Even in debug mode, MCP server must not pollute stdio
   */
  test('MCP server in debug mode maintains stdio cleanliness', async () => {
    const debugPromise = new Promise<void>((resolve, reject) => {
      mcpProcess = spawn('npx', ['tsx', MCP_SERVER_PATH], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, DEBUG: '1', NODE_ENV: 'development' }
      });

      mcpProcess.stdout!.on('data', (data: Buffer) => {
        stdoutBuffer += data.toString();
      });

      mcpProcess.stderr!.on('data', (data: Buffer) => {
        stderrBuffer += data.toString();
      });

      setTimeout(resolve, 3000);
      mcpProcess.on('error', reject);
    });

    await debugPromise;

    // CRITICAL ASSERTION: Debug mode must not pollute stdio
    expect(stderrBuffer.trim()).toBe('');
    
    // Verify stdout contains only JSON-RPC messages
    if (stdoutBuffer.trim()) {
      const lines = stdoutBuffer.split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.trim()) {
          expect(() => JSON.parse(line)).not.toThrow();
        }
      }
    }
  });

  /**
   * TEST 5: Logging Abstraction Layer Verification
   * REQUIREMENT: Logger must route output away from stdio for MCP context
   */
  test('Logger abstraction routes output correctly by transport type', async () => {
    const { Logger } = await import('../src/logger');
    const fs = await import('fs');
    const path = await import('path');
    
    // TEST: 'stdio' transport produces NO console output
    const stdioLogger = new Logger('stdio', 'TEST');
    
    // Capture console output during stdio logger usage
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    let consoleOutputDetected = false;
    console.log = (...args) => { consoleOutputDetected = true; originalConsoleLog(...args); };
    console.error = (...args) => { consoleOutputDetected = true; originalConsoleError(...args); };
    console.warn = (...args) => { consoleOutputDetected = true; originalConsoleWarn(...args); };
    
    // Use stdio logger - should produce NO console output
    stdioLogger.info('Test message');
    stdioLogger.error('Test error');
    stdioLogger.warn('Test warning');
    stdioLogger.debug('Test debug');
    
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;  
    console.warn = originalConsoleWarn;
    
    // CRITICAL ASSERTION: stdio transport must not produce console output
    expect(consoleOutputDetected).toBe(false);
    
    // TEST: 'file' transport writes to log file
    const testLogPath = path.join(__dirname, 'test-log.txt');
    const fileLogger = new Logger('file', 'TEST', testLogPath);
    
    fileLogger.info('File logger test message');
    
    // Verify log file was created and contains message
    expect(fs.existsSync(testLogPath)).toBe(true);
    const logContent = fs.readFileSync(testLogPath, 'utf-8');
    expect(logContent).toContain('File logger test message');
    
    // Cleanup
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }
    
    // TEST: 'null' transport discards all output
    const nullLogger = new Logger('null', 'TEST');
    
    // This should not throw and should not produce any output
    expect(() => {
      nullLogger.info('Null logger test');
      nullLogger.error('Null logger error');
    }).not.toThrow();
  });

  /**
   * TEST 6: Entry Point Error Handling Cleanliness
   * REQUIREMENT: Entry point error handlers must not pollute stdio during MCP execution
   * CRITICAL: mcp-server.ts main() and catch handlers must use stderr, not console.error
   */
  test('Entry point error handlers maintain stdio cleanliness', async () => {
    // Test mcp-server.ts entry point with simulated startup error
    const errorTestPromise = new Promise<void>((resolve, reject) => {
      // Create a temporary invalid config to trigger error path
      const invalidConfigEnv = {
        ...process.env,
        SSH_KEY_PATH: '/invalid/nonexistent/path/key.pem' // Force error
      };

      mcpProcess = spawn('npx', ['tsx', MCP_SERVER_PATH], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: invalidConfigEnv
      });

      mcpProcess.stdout!.on('data', (data: Buffer) => {
        stdoutBuffer += data.toString();
      });

      mcpProcess.stderr!.on('data', (data: Buffer) => {
        stderrBuffer += data.toString();
      });

      mcpProcess.on('exit', () => {
        resolve();
      });

      mcpProcess.on('error', reject);

      // Allow time for error to occur and process to exit
      setTimeout(resolve, 5000);
    });

    await errorTestPromise;

    // CRITICAL ASSERTION: Error output should go to stderr, not pollute stdout
    // Entry points can use stderr for critical errors, but NEVER stdout
    expect(stdoutBuffer.trim()).toBe(''); // No JSON pollution on stdout
    
    // If stderr contains error output, it should be process.stderr.write format, not console.error
    if (stderrBuffer.length > 0) {
      // Should not contain console.* patterns in stderr output
      expect(stderrBuffer).not.toMatch(/console\.[a-zA-Z]+\(/);
    }
  });

  /**
   * TEST 7: Orchestrator Entry Point Stdio Cleanliness
   * REQUIREMENT: orchestrator.ts main() must not pollute stdio
   */
  test('Orchestrator entry point maintains stdio cleanliness', async () => {
    const ORCHESTRATOR_PATH = path.join(__dirname, '../src/orchestrator.ts');
    let orchestratorProcess: ChildProcess;
    let orchStdoutBuffer = '';
    let orchStderrBuffer = '';

    const orchTestPromise = new Promise<void>((resolve, reject) => {
      orchestratorProcess = spawn('npx', ['tsx', ORCHESTRATOR_PATH], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      orchestratorProcess.stdout!.on('data', (data: Buffer) => {
        orchStdoutBuffer += data.toString();
      });

      orchestratorProcess.stderr!.on('data', (data: Buffer) => {
        orchStderrBuffer += data.toString();
      });

      orchestratorProcess.on('error', reject);

      // Allow startup time then kill gracefully
      setTimeout(() => {
        if (orchestratorProcess && !orchestratorProcess.killed) {
          orchestratorProcess.kill('SIGTERM');
          setTimeout(resolve, 1000);
        } else {
          resolve();
        }
      }, 3000);
    });

    await orchTestPromise;

    // CRITICAL ASSERTION: Orchestrator should produce minimal stdio output
    expect(orchStderrBuffer.trim()).toBe('');
    
    // Stdout should only contain structured output if any, no console pollution
    expect(orchStdoutBuffer).not.toMatch(/console\./);
    expect(orchStdoutBuffer).not.toMatch(/Warning:|Error:|Log:/i);
    
    if (orchStderrBuffer.length > 0 || orchStdoutBuffer.includes('console.')) {
      console.error('ORCHESTRATOR STDIO VIOLATION:');
      console.error('STDERR:', orchStderrBuffer);
      console.error('STDOUT:', orchStdoutBuffer);
    }
  });

});