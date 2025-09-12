/**
 * Terminal Display Bug Reproduction Test
 * 
 * This test reproduces the actual terminal display issues by capturing real WebSocket messages
 * from the problematic session to identify root causes.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Terminal Display Bug Reproduction', () => {
  let testUtils: JestTestUtilities;

  beforeEach(async () => {
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true,
      testTimeout: 30000
    });
    await testUtils.setupTest('terminal-display-bug-reproduction');
  });

  afterEach(async () => {
    await testUtils.cleanupTest();
  });

  test('reproduce broken terminal display with post-restart-test session', async () => {
    console.log('🔍 Reproducing broken terminal display state...');

    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "post-restart-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "post-restart-test", "command": "ls"}'
      ],
      postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "post-restart-test", "command": "pwd"}'}
        ],
      workflowTimeout: 30000,
      sessionName: 'post-restart-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    console.log('📊 Workflow Result Analysis:');
    console.log('Success:', result.success);
    console.log('Total Execution Time:', result.totalExecutionTime);
    console.log('Concatenated Responses Length:', result.concatenatedResponses.length);
    
    // Log the actual WebSocket messages to analyze the broken state
    console.log('\n🔍 Raw WebSocket Messages (First 1000 chars):');
    console.log(result.concatenatedResponses.substring(0, 1000));
    
    console.log('\n🔍 Raw WebSocket Messages (Hex representation for CRLF analysis):');
    const hex = Buffer.from(result.concatenatedResponses.substring(0, 200)).toString('hex');
    console.log(hex.match(/.{1,2}/g)?.join(' ') || hex);

    // Test the broken patterns we expect to find
    console.log('\n❌ Testing for known broken patterns:');
    
    // Look for command on separate line (wrong)
    const commandOnSeparateLine = /\]\$\s*\r?\n\s*ls/.test(result.concatenatedResponses);
    console.log('Command on separate line (broken):', commandOnSeparateLine);
    
    // Look for corrupted prompt (missing characters)
    const corruptedPrompt = /sbattig@localhost/.test(result.concatenatedResponses);
    console.log('Corrupted prompt found:', corruptedPrompt);
    
    // Look for proper inline format (should be missing)
    const properInlineFormat = /\[jsbattig@localhost[^\]]*\]\$\s+ls/.test(result.concatenatedResponses);
    console.log('Proper inline format present:', properInlineFormat);

    // Detailed message validation
    try {
      testUtils.expectWebSocketMessages(result.concatenatedResponses)
        .toContainCRLF()
        .toHavePrompts()
        .toMatchCommandSequence(['ls', 'pwd'])
        .toHaveMinimumLength(10)
        .validate();
      
      console.log('✅ Basic WebSocket message validation passed');
    } catch (error) {
      console.log('❌ WebSocket message validation failed:', error instanceof Error ? error.message : String(error));
    }

    // Document the exact broken state for debugging
    console.log('\n🐛 Documenting broken state for root cause analysis:');
    console.log('Raw response preview:', JSON.stringify(result.concatenatedResponses.substring(0, 300)));
    
    expect(result.success).toBe(true); // Test should run successfully even if content is broken
  });

  test('capture specific broken patterns from real session', async () => {
    console.log('🔍 Capturing specific broken patterns...');

    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "broken-pattern-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "broken-pattern-test", "command": "echo test123"}'
      ],
      postWebSocketCommands: [],
      workflowTimeout: 30000,
      sessionName: 'broken-pattern-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    console.log('\n🔍 Analyzing specific broken patterns:');
    
    const messages = result.concatenatedResponses;
    
    // Pattern 1: Commands appearing on wrong line
    const lines = messages.split('\r\n');
    console.log('Total lines:', lines.length);
    console.log('First 10 lines:');
    lines.slice(0, 10).forEach((line, i) => {
      console.log(`Line ${i + 1}: ${JSON.stringify(line)}`);
    });
    
    // Pattern 2: Look for prompt integrity
    const promptPattern = /\[([^\]]+)\]\$/g;
    const promptMatches = [...messages.matchAll(promptPattern)];
    console.log('\n🔍 Prompt matches found:', promptMatches.length);
    promptMatches.forEach((match, i) => {
      console.log(`Prompt ${i + 1}: ${match[0]}`);
    });
    
    // Pattern 3: Command positioning analysis
    const commandEchoPattern = /echo test123/g;
    const commandMatches = [...messages.matchAll(commandEchoPattern)];
    console.log('\n🔍 Command echo matches:', commandMatches.length);
    
    expect(result.success).toBe(true);
    expect(messages.length).toBeGreaterThan(0);
  });
});