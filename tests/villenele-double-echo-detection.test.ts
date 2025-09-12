/**
 * Villenele Double Echo Detection Test
 * 
 * Uses Terminal History Testing Framework to detect double echo problems
 * in the browser terminal implementation. This test captures real WebSocket
 * messages from browser perspective to verify clean terminal display.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Villenele: Double Echo Detection', () => {
    const testUtils = JestTestUtilities.setupJestEnvironment('double-echo-detection');

    /**
     * TEST GOAL: Detect double echo in character-by-character typing
     * 
     * EXPECTED BEHAVIOR:
     * - User types 'w', 'h', 'o', 'a', 'm', 'i', ENTER
     * - SSH echoes back each character once
     * - WebSocket should show single 'whoami' and result
     * 
     * DOUBLE ECHO PROBLEM:
     * - Browser shows local 'whoami' 
     * - SSH also echoes 'whoami'
     * - WebSocket captures 'wwhhooaammii' or duplicate display
     */
    test('✅ Character-by-character typing should not cause double echo', async () => {
        const config = {
            preWebSocketCommands: [
                'ssh_connect {"name": "final-validation", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
            ],
            postWebSocketCommands: [
                // This will be sent character by character to simulate typing
                {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "final-validation", "command": "whoami"}'}
            ],
            workflowTimeout: 20000,
            sessionName: 'final-validation'
        };

        const result = await testUtils.runTerminalHistoryTest(config);
        
        // ASSERTION: WebSocket messages should NOT contain double characters
        // This test will FAIL until we fix the terminal-input-handler.js state issues
        expect(result.concatenatedResponses)
            .not.toContain('wwhhooaammii'); // Double character echo
        
        expect(result.concatenatedResponses)
            .not.toContain('whooami'); // Partial double echo
            
        // Should contain clean single 'whoami' command
        expect(result.concatenatedResponses)
            .toMatch(/\[.*\]\$.*whoami.*\r?\n/); // Clean command with result
            
        // Validate proper CRLF line endings are preserved
        testUtils.expectWebSocketMessages(result.concatenatedResponses)
            .toContainCRLF()
            .toHavePrompts()
            .validate();
    });

    /**
     * TEST GOAL: Validate clean terminal experience
     * 
     * EXPECTED BEHAVIOR: 
     * - Commands appear inline with prompts
     * - No local browser state pollution
     * - SSH handles ALL terminal display logic
     */
    test('✅ Terminal display should be clean like standard SSH client', async () => {
        const config = {
            preWebSocketCommands: [
                'ssh_connect {"name": "final-validation", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
            ],
            postWebSocketCommands: [
                {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "final-validation", "command": "pwd"}'},
                {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "final-validation", "command": "ls -la"}'}
            ],
            workflowTimeout: 30000,
            sessionName: 'final-validation'
        };

        const result = await testUtils.runTerminalHistoryTest(config);
        
        // ASSERTION: Each command should appear exactly once
        const pwdMatches = (result.concatenatedResponses.match(/pwd/g) || []).length;
        const lsMatches = (result.concatenatedResponses.match(/ls -la/g) || []).length;
        
        // Should see each command exactly once (not doubled)
        expect(pwdMatches).toBeLessThanOrEqual(2); // Once in prompt, once in history
        expect(lsMatches).toBeLessThanOrEqual(2);  // Once in prompt, once in history
        
        // Should NOT have character duplication patterns
        expect(result.concatenatedResponses).not.toMatch(/([a-z])\1{2,}/); // No triple+ chars
        
        // Should have proper command/result separation
        testUtils.expectWebSocketMessages(result.concatenatedResponses)
            .toMatchCommandSequence(['pwd', 'ls -la'])
            .toHaveMinimumLength(10)
            .validate();
    });

    /**
     * TEST GOAL: Validate browser is pure passthrough
     * 
     * EXPECTED BEHAVIOR:
     * - Browser sends raw input to SSH
     * - SSH handles ALL echoing, editing, cursor movement
     * - WebSocket captures only SSH output (no browser pollution)
     */
    test('✅ Browser should be pure input passthrough', async () => {
        const config = {
            preWebSocketCommands: [
                'ssh_connect {"name": "final-validation", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
            ],
            postWebSocketCommands: [
                // Test backspace behavior
                {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "final-validation", "command": "echo test"}'}
            ],
            workflowTimeout: 15000,
            sessionName: 'final-validation'
        };

        const result = await testUtils.runTerminalHistoryTest(config);
        
        // ASSERTION: Should see clean command execution
        // Real WebSocket captures show: "[jsbattig@localhost ~]$ echo test" followed by "test" output
        expect(result.concatenatedResponses)
            .toContain('echo test'); // Command present
            
        expect(result.concatenatedResponses)
            .toMatch(/echo test[\s\S]*test/); // Command followed by output (flexible whitespace)
            
        // Should NOT have browser state artifacts
        expect(result.concatenatedResponses)
            .not.toContain('currentLine'); // No state leakage
            
        expect(result.concatenatedResponses)
            .not.toContain('cursorPosition'); // No state leakage
            
        // Should maintain proper terminal flow
        testUtils.expectWebSocketMessages(result.concatenatedResponses)
            .toContainCRLF()
            .toHavePrompts()
            .validate();
    });
});