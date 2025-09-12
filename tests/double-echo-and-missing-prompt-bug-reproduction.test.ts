/**
 * Double Command Echo and Missing Initial Prompt Bug Reproduction Tests
 * 
 * This test file reproduces two critical terminal display issues:
 * 1. Double command echo - commands appear twice in terminal
 * 2. Missing initial prompt - terminal history doesn't show initial prompt
 * 
 * Uses Terminal History Testing Framework to capture exact WebSocket messages
 * and identify the source of these display problems.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities.js';

describe('Terminal Display Bug Reproduction', () => {
  let testUtils: JestTestUtilities;

  beforeAll(async () => {
    testUtils = JestTestUtilities.setupJestEnvironment('double-echo-bug-reproduction');
  }, 60000);

  beforeEach(async () => {
    if (testUtils) {
      await testUtils.setupTest();
    }
  });

  afterEach(async () => {
    if (testUtils) {
      await testUtils.cleanupTest();
    }
  });

  describe('Double Command Echo Issue', () => {
    test('should reproduce double command echo bug', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-fixed-terminal", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "test-fixed-terminal", "command": "echo hello"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "test-fixed-terminal", "command": "ls"}'}
        ],
        workflowTimeout: 30000,
        sessionName: 'test-fixed-terminal'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('\n=== DOUBLE ECHO ANALYSIS ===');
      console.log('Raw WebSocket Messages:');
      console.log(result.concatenatedResponses);
      
      // Parse individual messages to analyze command echo patterns
      const messages = result.concatenatedResponses.split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(msg => msg && msg.type === 'terminal_output');

      console.log('\n=== TERMINAL OUTPUT MESSAGES ===');
      messages.forEach((msg, index) => {
        console.log(`Message ${index + 1}:`);
        console.log(`  Data: ${JSON.stringify(msg.data)}`);
        console.log(`  Source: ${msg.source}`);
        console.log(`  Timestamp: ${msg.timestamp}`);
      });

      // Check for command echo patterns
      const echoCommands = messages
        .map(msg => msg.data)
        .filter(data => data === 'echo hello' || data === 'ls');

      console.log('\n=== ECHO COMMAND ANALYSIS ===');
      console.log('Commands that appear as standalone output:', echoCommands);
      console.log('Echo count for "echo hello":', echoCommands.filter(cmd => cmd === 'echo hello').length);
      console.log('Echo count for "ls":', echoCommands.filter(cmd => cmd === 'ls').length);

      // FAILING ASSERTION: We expect NO standalone command echoes
      // Currently this will fail because commands are being echoed
      expect(echoCommands.length).toBe(0); // `Expected no standalone command echoes, but found: ${JSON.stringify(echoCommands)}`

    }, 60000);

    test('should identify source of command echo in WebSocket messages', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-echo-source", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "test-echo-source", "command": "whoami"}'}
        ],
        workflowTimeout: 30000,
        sessionName: 'test-echo-source'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      // Analyze message sequence to identify when command echo occurs
      const lines = result.concatenatedResponses.split('\n').filter(line => line.trim());
      
      let beforeCommand = [];
      let duringCommand = [];
      let afterCommand = [];
      let phase = 'before';
      
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'terminal_output') {
            if (msg.data.includes('whoami') && phase === 'before') {
              phase = 'during';
            } else if (msg.data.includes('jsbattig') && phase === 'during') {
              phase = 'after';
            }
            
            if (phase === 'before') beforeCommand.push(msg);
            else if (phase === 'during') duringCommand.push(msg);
            else afterCommand.push(msg);
          }
        } catch {
          // Skip invalid JSON
        }
      }

      console.log('\n=== COMMAND EXECUTION PHASES ===');
      console.log('Before command execution:');
      beforeCommand.forEach(msg => console.log(`  "${msg.data}" (source: ${msg.source})`));
      
      console.log('During command execution (potential echo phase):');
      duringCommand.forEach(msg => console.log(`  "${msg.data}" (source: ${msg.source})`));
      
      console.log('After command execution:');
      afterCommand.forEach(msg => console.log(`  "${msg.data}" (source: ${msg.source})`));

      // FAILING ASSERTION: Command should not appear as standalone output
      const echoMessages = duringCommand.filter(msg => msg.data.trim() === 'whoami');
      expect(echoMessages.length).toBe(0); // `Expected no command echo, but found ${echoMessages.length} echo messages: ${JSON.stringify(echoMessages)}`

    }, 60000);
  });

  describe('Missing Initial Prompt Issue', () => {
    test('should reproduce missing initial prompt in terminal history', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-prompt-missing", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}',
          // No commands - just establish connection
        ],
        postWebSocketCommands: [
          // First WebSocket command to see if initial prompt is present
          'ssh_exec {"sessionName": "test-prompt-missing", "command": "pwd"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'test-prompt-missing'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('\n=== INITIAL PROMPT ANALYSIS ===');
      console.log('Raw WebSocket Messages:');
      console.log(result.concatenatedResponses);

      // Parse messages to find initial prompt
      const messages = result.concatenatedResponses.split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(msg => msg && msg.type === 'terminal_output')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      console.log('\n=== CHRONOLOGICAL TERMINAL MESSAGES ===');
      messages.forEach((msg, index) => {
        console.log(`Message ${index + 1} (${msg.timestamp}):`);
        console.log(`  Data: ${JSON.stringify(msg.data)}`);
        console.log(`  Source: ${msg.source}`);
      });

      // Check for bracket format prompt pattern
      const promptPattern = /\[[\w-]+@[\w.-]+\s+[\w/.-]+\]\$/;
      const initialPromptMessages = messages.filter(msg => promptPattern.test(msg.data));

      console.log('\n=== PROMPT DETECTION ===');
      console.log('Bracket format prompt pattern:', promptPattern);
      console.log('Messages containing prompts:');
      initialPromptMessages.forEach(msg => {
        console.log(`  "${msg.data}" at ${msg.timestamp}`);
      });

      // FAILING ASSERTION: First message should be initial prompt
      expect(messages.length).toBeGreaterThan(0); // 'Expected at least one terminal message'
      
      if (messages.length > 0) {
        const firstMessage = messages[0];
        console.log('\nFirst terminal message:', JSON.stringify(firstMessage.data));
        
        // FAILING ASSERTION: First message should contain initial prompt
        expect(promptPattern.test(firstMessage.data)).toBe(true); // `Expected first message to be initial prompt matching ${promptPattern}, but got: "${firstMessage.data}"`
      }

    }, 60000);

    test('should verify initial prompt is included in terminal history replay', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-history-replay", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "test-history-replay", "command": "echo setup-complete"}'
        ],
        postWebSocketCommands: [
          // Simulating a new browser connecting - should get history replay
        ],
        workflowTimeout: 30000,
        sessionName: 'test-history-replay'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      // Find all prompt-related messages in history replay
      const messages = result.concatenatedResponses.split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(msg => msg && msg.type === 'terminal_output');

      const promptPattern = /\[[\w-]+@[\w.-]+\s+[\w/.-]+\]\$/;
      const promptMessages = messages.filter(msg => promptPattern.test(msg.data));

      console.log('\n=== TERMINAL HISTORY REPLAY ANALYSIS ===');
      console.log('Total terminal output messages:', messages.length);
      console.log('Prompt messages found:', promptMessages.length);
      
      promptMessages.forEach((msg, index) => {
        console.log(`Prompt ${index + 1}: "${msg.data}" at ${msg.timestamp}`);
      });

      // FAILING ASSERTION: Should have at least initial prompt
      expect(promptMessages.length).toBeGreaterThanOrEqual(1); // `Expected at least one prompt in terminal history, but found ${promptMessages.length}`

      // FAILING ASSERTION: History should start with initial prompt
      if (messages.length > 0) {
        const sortedMessages = messages.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        const firstNonEmptyMessage = sortedMessages.find(msg => msg.data.trim() !== '');
        
        if (firstNonEmptyMessage) {
          expect(promptPattern.test(firstNonEmptyMessage.data)).toBe(true); // `Expected terminal history to start with prompt, but started with: "${firstNonEmptyMessage.data}"`
        }
      }

    }, 60000);
  });

  describe('Combined Analysis', () => {
    test('should capture complete message flow for both issues', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-combined-analysis", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "test-combined-analysis", "command": "echo test"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "test-combined-analysis", "command": "pwd"}'}
        ],
        workflowTimeout: 30000,
        sessionName: 'test-combined-analysis'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('\n=== COMPLETE MESSAGE FLOW ANALYSIS ===');
      console.log('Full WebSocket message sequence:');
      console.log(result.concatenatedResponses);

      // This test documents the current behavior for analysis
      // No assertions - just capture data for debugging
      expect(result.concatenatedResponses).toBeDefined();
      expect(result.concatenatedResponses.length).toBeGreaterThan(0);

    }, 60000);
  });
});