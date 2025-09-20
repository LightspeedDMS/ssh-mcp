/**
 * Debug terminal history content to understand concatenation bug
 */
import { JestTestUtilities } from '../tests/integration/terminal-history-framework/jest-test-utilities.js';

describe('Terminal History Debug', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('terminal-history-debug');

  test('should debug terminal history content when browser connects', async () => {
    // Create same scenario as concatenation bug
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "history-debug-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "history-debug-session", "command": "pwd"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "history-debug-session", "command": "whoami"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'history-debug-session'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    console.log('\n🔍 DEBUG: Terminal History Analysis');
    console.log('=====================================');

    // Log the full WebSocket capture for analysis
    console.log('📊 WebSocket Response Analysis:');
    console.log('Length:', result.concatenatedResponses.length);
    console.log('Contains CRLF:', result.concatenatedResponses.includes('\r\n'));

    // Parse individual lines
    const lines = result.concatenatedResponses.split('\r\n');
    console.log('\n📋 Line-by-Line Analysis:');
    lines.forEach((line, index) => {
      if (line.trim()) {
        console.log(`  Line ${index + 1}: "${line}"`);
      }
    });

    // Check for command echo patterns
    const commandEchoPattern = /\[.*@.*\s+.*\]\$/;
    const commandEchos = lines.filter(line => commandEchoPattern.test(line));
    console.log('\n⚡ Command Echo Analysis:');
    console.log('Command echoes found:', commandEchos.length);
    commandEchos.forEach((echo, index) => {
      console.log(`  Echo ${index + 1}: "${echo}"`);
    });

    // Check for results
    const results = lines.filter(line =>
      line.includes('/home/jsbattig') || line.includes('jsbattig') && !commandEchoPattern.test(line)
    );
    console.log('\n📤 Results Analysis:');
    console.log('Results found:', results.length);
    results.forEach((result, index) => {
      console.log(`  Result ${index + 1}: "${result}"`);
    });

    // Verify proper structure
    expect(commandEchos.length).toBeGreaterThan(0); // Should have command echoes
    expect(results.length).toBeGreaterThan(0); // Should have results
    expect(result.concatenatedResponses).toContain('\r\n'); // Should have CRLF

  }, 60000);
});