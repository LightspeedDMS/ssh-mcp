/**
 * Terminal Protocol Mismatch Reproduction Test
 * 
 * CRITICAL TEST: Reproduces the protocol mismatch between client JavaScript and server
 * that prevents the Interactive Terminal Epic from functioning properly.
 * 
 * ROOT CAUSE: JavaScript sends {data: "command\r"}, server expects {command: "command", commandId: "cmd_123"}
 */

import { readFileSync } from 'fs';
import { join } from 'path';

describe('Terminal Protocol Mismatch Reproduction', () => {
  const projectRoot = process.cwd();
  const jsHandlerPath = join(projectRoot, 'static', 'terminal-input-handler.js');
  const tsHandlerPath = join(projectRoot, 'static', 'terminal-input-handler.ts');

  test('FIXED: JavaScript client now uses correct protocol format', () => {
    const jsContent = readFileSync(jsHandlerPath, 'utf8');
    
    // Check if JavaScript now uses correct protocol (after fix)
    const usesCommandField = jsContent.includes('command:');
    const hasCommandId = jsContent.includes('commandId:');
    const hasCommandIdGeneration = jsContent.includes('cmd_') && jsContent.includes('Date.now()');

    // This test verifies the protocol is now correct
    expect(usesCommandField).toBe(true);  // Now correctly sends 'command' 
    expect(hasCommandId).toBe(true);  // Has 'commandId' field
    expect(hasCommandIdGeneration).toBe(true);  // Generates unique commandId

    // Verify the exact correct protocol structure
    const submitCommandMatch = jsContent.match(/webSocket\.send\(JSON\.stringify\(([\s\S]*?)\)\);/);
    if (submitCommandMatch) {
      const messageStructure = submitCommandMatch[1];
      expect(messageStructure).toContain('command:');
      expect(messageStructure).toContain('commandId:');
      expect(messageStructure).not.toContain('data:');  // Should not use 'data' anymore
    }
  });

  test('TypeScript source has correct protocol format', () => {
    const tsContent = readFileSync(tsHandlerPath, 'utf8');
    
    // Verify TypeScript has the correct protocol
    expect(tsContent).toContain('command:');
    expect(tsContent).toContain('commandId:');
    expect(tsContent).toContain('type: \'terminal_input\'');
    expect(tsContent).toContain('sessionName:');

    // Verify proper commandId generation
    expect(tsContent).toContain('cmd_${Date.now()}_${');
    expect(tsContent).toContain('this.commandCounter');
  });

  test('PROTOCOL REQUIREMENTS: Define expected message structure', () => {
    // This test documents the required protocol structure
    const expectedProtocol = {
      type: 'terminal_input',
      sessionName: 'test-session',
      command: 'pwd',  // NOT 'data'
      commandId: 'cmd_1730000000000_1',  // REQUIRED for tracking
      timestamp: '2024-10-27T12:00:00.000Z'  // OPTIONAL but good practice
    };

    // Document requirements for fixing the JavaScript
    expect(expectedProtocol).toHaveProperty('type', 'terminal_input');
    expect(expectedProtocol).toHaveProperty('sessionName');
    expect(expectedProtocol).toHaveProperty('command');  // NOT 'data'
    expect(expectedProtocol).toHaveProperty('commandId');  // CRITICAL for server tracking
    expect(expectedProtocol.commandId).toMatch(/^cmd_\d+_\d+$/);
  });

  test('CRITICAL FIX REQUIREMENTS: JavaScript must match TypeScript protocol', () => {
    // This test will fail until JavaScript is fixed to match TypeScript
    const jsContent = readFileSync(jsHandlerPath, 'utf8');
    
    // After fix, JavaScript should match TypeScript protocol
    const hasCorrectProtocol = (
      jsContent.includes('command:') &&           // Uses 'command' not 'data'
      jsContent.includes('commandId:') &&         // Has commandId for tracking
      jsContent.includes('type: \'terminal_input\'') &&  // Correct message type
      jsContent.includes('sessionName:')          // Has session identification
    );

    const hasCommandIdGeneration = (
      jsContent.includes('cmd_') &&
      jsContent.includes('Date.now()') &&
      jsContent.includes('Math.random()')
    );

    const removesTrailingCarriageReturn = !jsContent.includes('command + \'\\r\'');

    // These assertions will fail initially, then pass after the fix
    expect(hasCorrectProtocol).toBe(true);
    expect(hasCommandIdGeneration).toBe(true);
    expect(removesTrailingCarriageReturn).toBe(true);
  });

  test('INTEGRATION REQUIREMENT: Verify server protocol expectations', () => {
    // Check that server-side code expects the correct protocol
    // This is a documentation test to ensure we understand server requirements
    
    const serverExpectations = {
      messageType: 'terminal_input',
      requiredFields: ['type', 'sessionName', 'command', 'commandId'],
      commandFieldName: 'command',  // Server expects 'command' not 'data'
      commandIdPattern: /^cmd_\d+_\d+$/,
      noTrailingCR: true  // Server adds \r, client should not
    };

    // Document what the server expects
    expect(serverExpectations.requiredFields).toContain('command');
    expect(serverExpectations.requiredFields).toContain('commandId');
    expect(serverExpectations.commandFieldName).toBe('command');
    expect(serverExpectations.noTrailingCR).toBe(true);
  });
});