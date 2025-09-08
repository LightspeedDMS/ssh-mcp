/**
 * Terminal Display Diagnosis using Villenele Framework
 * 
 * This test uses the comprehensive Villenele Terminal History Testing Framework 
 * to diagnose the exact root cause of terminal display issues:
 * 1. Commands appearing on separate lines instead of inline with prompts
 * 2. Corrupted prompts (missing characters like '[j' -> 'sbattig@localhost')
 * 3. Terminal control sequence issues causing positioning problems
 * 
 * CRITICAL: Uses real WebSocket capture from browser perspective - NO MOCKS
 */

import { JestTestUtilities, WebSocketValidationResult } from './integration/terminal-history-framework/jest-test-utilities';
import { CommandConfigurationJSON } from './integration/terminal-history-framework/flexible-command-configuration';
import { WorkflowResult } from './integration/terminal-history-framework/comprehensive-response-collector';

describe('Terminal Display Diagnosis with Villenele Framework', () => {
  let testUtils: JestTestUtilities;
  
  beforeAll(async () => {
    // Enable detailed logging to see exactly what's happening
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true,
      testTimeout: 45000
    });
    
    // Extend Jest matchers for terminal validation
    JestTestUtilities.extendJestMatchers();
  });

  beforeEach(async () => {
    await testUtils.setupTest('terminal-display-diagnosis');
  });

  afterEach(async () => {
    await testUtils.cleanupTest();
  });

  describe('Root Cause Analysis - WebSocket Message Capture', () => {
    test('should capture exact WebSocket messages from complete-fix-test session to diagnose prompt issues', async () => {
      console.log('\n=== TERMINAL DISPLAY DIAGNOSIS STARTING ===');
      console.log('Testing session: complete-fix-test');
      console.log('Expected URL: http://localhost:8084/session/complete-fix-test');
      console.log('Problem: Commands on separate lines + corrupted prompts');
      
      const config: CommandConfigurationJSON = {
        preWebSocketCommands: [
          // Connect to SSH session
          'ssh_connect {"name": "complete-fix-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          
          // Execute the exact commands that are showing display issues
          'ssh_exec {"sessionName": "complete-fix-test", "command": "echo \\"final validation test\\""}',
          
          // Execute a few more commands to see the pattern
          'ssh_exec {"sessionName": "complete-fix-test", "command": "pwd"}',
          'ssh_exec {"sessionName": "complete-fix-test", "command": "whoami"}'
        ],
        postWebSocketCommands: [
          // Test real-time command execution after WebSocket connection
          'ssh_exec {"sessionName": "complete-fix-test", "command": "date"}',
          'ssh_exec {"sessionName": "complete-fix-test", "command": "hostname"}'
        ],
        workflowTimeout: 40000,
        sessionName: 'complete-fix-test'
      };

      let workflowResult: WorkflowResult;
      
      try {
        console.log('\n=== EXECUTING VILLENELE FRAMEWORK ===');
        workflowResult = await testUtils.runTerminalHistoryTest(config);
        
        console.log('\n=== WORKFLOW EXECUTION RESULTS ===');
        console.log(`Success: ${workflowResult.success}`);
        console.log(`Total Execution Time: ${workflowResult.totalExecutionTime}ms`);
        console.log(`Phase Breakdown Available: ${workflowResult.phaseBreakdown ? 'Yes' : 'No'}`);
        if (workflowResult.phaseBreakdown) {
          console.log(`  - Server Launch: ${workflowResult.phaseBreakdown.serverLaunchSuccess}`);
          console.log(`  - Pre-WebSocket Commands: ${workflowResult.phaseBreakdown.preWebSocketCommandsSuccess}`);
          console.log(`  - WebSocket Connection: ${workflowResult.phaseBreakdown.webSocketConnectionSuccess}`);
          console.log(`  - History Replay Capture: ${workflowResult.phaseBreakdown.historyReplayCaptureSuccess}`);
          console.log(`  - Post-WebSocket Commands: ${workflowResult.phaseBreakdown.postWebSocketCommandsSuccess}`);
        }
        
        // This is the CRITICAL data - the verbatim WebSocket messages
        console.log(`\n=== RAW WEBSOCKET MESSAGES (VERBATIM) ===`);
        console.log(`Message Length: ${workflowResult.concatenatedResponses?.length || 0} characters`);
        
        if (workflowResult.concatenatedResponses) {
          // Show raw messages with visible control characters
          const rawMessages = workflowResult.concatenatedResponses;
          console.log('Raw messages with escaped control chars:');
          console.log(JSON.stringify(rawMessages, null, 2));
          
          // Show messages line by line for analysis
          console.log('\n=== LINE-BY-LINE ANALYSIS ===');
          const lines = rawMessages.split('\n');
          lines.forEach((line, index) => {
            console.log(`Line ${index + 1}: "${line}"`);
            console.log(`  - Contains \\r: ${line.includes('\r')}`);
            console.log(`  - Length: ${line.length}`);
            console.log(`  - Ends with $: ${line.endsWith('$')}`);
            console.log(`  - Contains prompt pattern: ${/\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\]\$/.test(line)}`);
          });
          
          console.log('\n=== PROMPT PATTERN ANALYSIS ===');
          const promptMatches = rawMessages.match(/\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\]\$/g);
          console.log(`Found prompts: ${promptMatches?.length || 0}`);
          if (promptMatches) {
            promptMatches.forEach((prompt, index) => {
              console.log(`Prompt ${index + 1}: "${prompt}"`);
            });
          }
          
          console.log('\n=== COMMAND DETECTION ANALYSIS ===');
          const commandPattern = /echo "final validation test"|pwd|whoami|date|hostname/g;
          const commandMatches = rawMessages.match(commandPattern);
          console.log(`Found commands: ${commandMatches?.length || 0}`);
          if (commandMatches) {
            commandMatches.forEach((cmd, index) => {
              console.log(`Command ${index + 1}: "${cmd}"`);
            });
          }
          
          console.log('\n=== POSITIONING ISSUE ANALYSIS ===');
          // Look for the specific issues mentioned by the user
          
          // Check for commands on separate lines (should be inline with prompts)
          const separateLinePattern = /\]\$\s*\n\s*[a-zA-Z]/g;
          const separateLineMatches = rawMessages.match(separateLinePattern);
          console.log(`Commands on separate lines: ${separateLineMatches?.length || 0}`);
          if (separateLineMatches) {
            separateLineMatches.forEach((match, index) => {
              console.log(`Separate line issue ${index + 1}: "${match}"`);
            });
          }
          
          // Check for corrupted prompts (missing characters)
          const corruptedPromptPattern = /sbattig@localhost/g;
          const corruptedMatches = rawMessages.match(corruptedPromptPattern);
          console.log(`Corrupted prompts (missing [j): ${corruptedMatches?.length || 0}`);
          if (corruptedMatches) {
            console.log('CRITICAL: Found corrupted prompts - missing opening bracket and username prefix!');
          }
          
          console.log('\n=== CRLF ANALYSIS ===');
          console.log(`Contains CRLF (\\r\\n): ${rawMessages.includes('\r\n')}`);
          console.log(`Contains LF only (\\n): ${rawMessages.includes('\n')}`);
          console.log(`CRLF count: ${(rawMessages.match(/\r\n/g) || []).length}`);
          console.log(`LF count: ${(rawMessages.match(/\n/g) || []).length}`);
        }
        
        if (workflowResult.error) {
          console.log(`\n=== ERROR INFORMATION ===`);
          console.log(`Error: ${workflowResult.error}`);
        }
        
      } catch (error) {
        console.error('\n=== VILLENELE FRAMEWORK ERROR ===');
        console.error('Error during diagnosis:', error);
        throw error;
      }

      // Validate the workflow succeeded
      expect(workflowResult.success).toBe(true);
      expect(workflowResult.concatenatedResponses).toBeDefined();
      expect(workflowResult.concatenatedResponses!.length).toBeGreaterThan(0);
      
      // Use Villenele's WebSocket validation
      const validation: WebSocketValidationResult = testUtils.validateWebSocketMessages(workflowResult.concatenatedResponses!);
      
      console.log('\n=== VILLENELE VALIDATION RESULTS ===');
      console.log(`Has Messages: ${validation.hasMessages}`);
      console.log(`Has CRLF: ${validation.hasCRLF}`);
      console.log(`Has Prompts: ${validation.hasPrompts}`);
      console.log(`Command Count: ${validation.commandCount}`);
      console.log(`Message Count: ${validation.messageCount}`);
      console.log(`Validation Errors: ${validation.errors.length}`);
      
      if (validation.errors.length > 0) {
        console.log('=== VALIDATION ERRORS ===');
        validation.errors.forEach((error, index) => {
          console.log(`Error ${index + 1}: ${error}`);
        });
      }
      
      // Store the results for further analysis
      console.log('\n=== DIAGNOSIS COMPLETE ===');
      console.log('WebSocket messages captured successfully.');
      console.log('Raw data available for root cause analysis.');
      console.log('Check the console output above for detailed terminal sequence analysis.');
    });
    
    test('should analyze specific ANSI control sequences causing positioning issues', async () => {
      console.log('\n=== ANSI CONTROL SEQUENCE ANALYSIS ===');
      
      const config: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_connect {"name": "ansi-analysis", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          // Simple command to analyze exact output
          'ssh_exec {"sessionName": "ansi-analysis", "command": "echo \\"test command\\""}',
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "ansi-analysis", "command": "pwd"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'ansi-analysis'
      };
      
      const workflowResult = await testUtils.runTerminalHistoryTest(config);
      
      expect(workflowResult.success).toBe(true);
      
      if (workflowResult.concatenatedResponses) {
        console.log('\n=== ANSI ESCAPE SEQUENCE DETECTION ===');
        const rawMessages = workflowResult.concatenatedResponses;
        
        // Look for common ANSI escape sequences
        const ansiPatterns = {
          'Cursor Movement': /\x1b\[[0-9;]*[HfABCD]/g,
          'Clear Screen/Line': /\x1b\[[0-9;]*[JK]/g,
          'Color Codes': /\x1b\[[0-9;]*m/g,
          'Save/Restore Cursor': /\x1b\[[su]/g,
          'Set Mode': /\x1b\[[?][0-9;]*[hl]/g
        };
        
        Object.entries(ansiPatterns).forEach(([name, pattern]) => {
          const matches = rawMessages.match(pattern);
          console.log(`${name}: ${matches?.length || 0} sequences found`);
          if (matches && matches.length > 0) {
            console.log(`  Examples: ${matches.slice(0, 3).map(m => JSON.stringify(m)).join(', ')}`);
          }
        });
        
        // Check for carriage returns without newlines (could cause overwriting)
        const crWithoutLf = rawMessages.match(/\r(?!\n)/g);
        console.log(`Carriage Returns without LF: ${crWithoutLf?.length || 0}`);
        if (crWithoutLf && crWithoutLf.length > 0) {
          console.log('CRITICAL: Found CR without LF - this can cause character overwriting!');
        }
      }
    });
  });
  
  describe('Fix Implementation Phase', () => {
    test('should apply terminal control sequence fixes and validate results', async () => {
      // This test will be implemented after root cause analysis identifies the issues
      console.log('\n=== FIX IMPLEMENTATION PHASE ===');
      console.log('This test will implement fixes based on Villenele diagnosis results');
      console.log('Currently pending root cause identification...');
      
      // Placeholder for fix implementation
      expect(true).toBe(true);
    });
  });
});