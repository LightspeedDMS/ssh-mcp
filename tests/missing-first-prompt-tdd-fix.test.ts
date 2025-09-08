/**
 * TDD Test: Missing First Prompt Fix
 * 
 * PURPOSE: This test reproduces the exact issue where the first command
 * appears without its preceding prompt in WebSocket terminal history.
 * 
 * BROKEN BEHAVIOR:
 * - WebSocket receives: "whoami\r\njsbattig\r\n[jsbattig@localhost ~]$ "
 * 
 * EXPECTED BEHAVIOR:
 * - WebSocket receives: "[jsbattig@localhost ~]$ whoami\r\njsbattig\r\n[jsbattig@localhost ~]$ "
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';
import { ExactAssertionPatterns } from './exact-assertion-patterns-library';
import { TestEnvironmentConfig } from './test-environment-config';

describe('Missing First Prompt TDD Fix', () => {
    const testUtils = JestTestUtilities.setupJestEnvironment('missing-first-prompt-fix');

    test('❌ FAILING: First command should include its preceding prompt', async () => {
        const username = TestEnvironmentConfig.getTestUsername();
        const sshKeyPath = TestEnvironmentConfig.getTestSSHKeyPath();
        
        const config = {
            preWebSocketCommands: [
                `ssh_connect {"name": "prompt-fix-test", "host": "localhost", "username": "${username}", "keyFilePath": "${sshKeyPath}"}`,
                'ssh_exec {"sessionName": "prompt-fix-test", "command": "whoami"}'
            ],
            postWebSocketCommands: [],
            workflowTimeout: 20000,
            sessionName: 'prompt-fix-test'
        };

        const result = await testUtils.runTerminalHistoryTest(config);
        
        expect(result.success).toBe(true);
        
        console.log('=== FIRST PROMPT FIX TEST ===');
        console.log('Actual output:', JSON.stringify(result.concatenatedResponses));
        console.log('============================');

        // Use pattern-based exact assertion library - this will FAIL with current broken terminal behavior
        const actualOutput = result.concatenatedResponses;
        ExactAssertionPatterns.validateCompleteOutput(actualOutput, 'whoami');

        console.log('✅ FIRST PROMPT CORRECTLY INCLUDED IN TERMINAL OUTPUT');
    });

    test('❌ FAILING: Multiple commands should ALL have their preceding prompts', async () => {
        const username = TestEnvironmentConfig.getTestUsername();
        const sshKeyPath = TestEnvironmentConfig.getTestSSHKeyPath();
        
        const config = {
            preWebSocketCommands: [
                `ssh_connect {"name": "multi-prompt-test", "host": "localhost", "username": "${username}", "keyFilePath": "${sshKeyPath}"}`,
                'ssh_exec {"sessionName": "multi-prompt-test", "command": "whoami"}',
                'ssh_exec {"sessionName": "multi-prompt-test", "command": "pwd"}'
            ],
            postWebSocketCommands: [],
            workflowTimeout: 30000,
            sessionName: 'multi-prompt-test'
        };

        const result = await testUtils.runTerminalHistoryTest(config);
        
        expect(result.success).toBe(true);
        
        console.log('=== MULTI-COMMAND PROMPT TEST ===');
        console.log('Actual output:', JSON.stringify(result.concatenatedResponses));
        console.log('=================================');

        // Use pattern-based exact assertion library - this will FAIL with current broken terminal behavior
        const actualOutput = result.concatenatedResponses;
        ExactAssertionPatterns.validateCompleteOutput(actualOutput, 'multi-command');

        console.log('✅ ALL COMMANDS HAVE THEIR PRECEDING PROMPTS');
    });

    test('❌ FAILING: Post-WebSocket real-time commands should also have prompts', async () => {
        const username = TestEnvironmentConfig.getTestUsername();
        const sshKeyPath = TestEnvironmentConfig.getTestSSHKeyPath();
        
        const config = {
            preWebSocketCommands: [
                `ssh_connect {"name": "realtime-prompt-test", "host": "localhost", "username": "${username}", "keyFilePath": "${sshKeyPath}"}`,
                'ssh_exec {"sessionName": "realtime-prompt-test", "command": "pwd"}'
            ],
            postWebSocketCommands: [
                'ssh_exec {"sessionName": "realtime-prompt-test", "command": "whoami"}'
            ],
            workflowTimeout: 30000,
            sessionName: 'realtime-prompt-test'
        };

        const result = await testUtils.runTerminalHistoryTest(config);
        
        expect(result.success).toBe(true);
        
        console.log('=== REAL-TIME COMMAND PROMPT TEST ===');
        console.log('Actual output:', JSON.stringify(result.concatenatedResponses));
        console.log('=====================================');

        // Use pattern-based exact assertion library - this will FAIL with current broken terminal behavior
        const actualOutput = result.concatenatedResponses;
        ExactAssertionPatterns.validateCompleteOutput(actualOutput, 'multi-command');

        console.log('✅ BOTH PRE AND POST-WEBSOCKET COMMANDS HAVE PROMPTS');
    });
});