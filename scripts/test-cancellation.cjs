#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function testCancellation(testUrl) {
    if (!testUrl) {
        console.log('⚠️  No URL provided. Usage: node test-cancellation.cjs <terminal-url>');
        console.log('   Example: node test-cancellation.cjs http://localhost:8081/session/prompt-test');
        process.exit(1);
    }

    console.log(`🧪 Testing cancellation behavior for: ${testUrl}`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Capture console output for debugging
        page.on('console', msg => {
            console.log(`🌐 Browser Console [${msg.type()}]:`, msg.text());
        });

        page.on('pageerror', error => {
            console.error(`❌ Browser Error:`, error.message);
        });

        console.log('📄 Loading terminal page...');
        await page.goto(testUrl, { waitUntil: 'networkidle0', timeout: 10000 });

        // Wait for terminal to be ready
        console.log('⏳ Waiting for terminal initialization...');
        await page.waitForSelector('.xterm', { timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 3000)); // Allow WebSocket connection

        console.log('📝 Typing long-running command: sleep 60; echo "hello world"');

        // Type the command
        await page.evaluate(() => {
            // Simulate typing each character
            const command = 'sleep 60; echo "hello world"';
            const terminal = window.term;
            if (terminal) {
                // Send each character
                for (let char of command) {
                    terminal._core._inputHandler.parse(char);
                }
            }
        });

        // Wait a moment then press Enter
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('⏎ Pressing Enter to execute command...');
        await page.evaluate(() => {
            const terminal = window.term;
            if (terminal) {
                terminal._core._inputHandler.parse('\r');
            }
        });

        // Wait for command to start, then send Ctrl-C
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('🛑 Sending Ctrl-C cancellation...');
        await page.evaluate(() => {
            const terminal = window.term;
            if (terminal) {
                // Send Ctrl-C (character code 3)
                terminal._core._inputHandler.parse('\x03');
            }
        });

        // Wait to see the result
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get terminal content to analyze
        console.log('📊 Analyzing terminal output...');
        const terminalContent = await page.evaluate(() => {
            const terminal = window.term;
            if (terminal) {
                const buffer = terminal.buffer.active;
                let content = '';
                for (let i = 0; i < buffer.length; i++) {
                    const line = buffer.getLine(i);
                    if (line) {
                        content += line.translateToString() + '\n';
                    }
                }
                return content;
            }
            return 'No terminal found';
        });

        console.log('📋 Terminal Content:');
        console.log('─'.repeat(50));
        console.log(terminalContent);
        console.log('─'.repeat(50));

        // Test typing after cancellation
        console.log('📝 Testing command after cancellation: echo "after cancel"');

        await page.evaluate(() => {
            const command = 'echo "after cancel"';
            const terminal = window.term;
            if (terminal) {
                for (let char of command) {
                    terminal._core._inputHandler.parse(char);
                }
                terminal._core._inputHandler.parse('\r');
            }
        });

        // Wait for response
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get final terminal content
        const finalContent = await page.evaluate(() => {
            const terminal = window.term;
            if (terminal) {
                const buffer = terminal.buffer.active;
                let content = '';
                for (let i = 0; i < buffer.length; i++) {
                    const line = buffer.getLine(i);
                    if (line) {
                        content += line.translateToString() + '\n';
                    }
                }
                return content;
            }
            return 'No terminal found';
        });

        console.log('📋 Final Terminal Content:');
        console.log('─'.repeat(50));
        console.log(finalContent);
        console.log('─'.repeat(50));

        // Analyze the issues
        console.log('🔍 Analysis:');
        if (finalContent.includes('Signal SIGINT sent')) {
            console.log('✅ SIGINT signal was sent');
        } else {
            console.log('❌ SIGINT signal NOT detected');
        }

        if (finalContent.includes('after cancel')) {
            console.log('✅ Command after cancellation executed');
        } else {
            console.log('❌ Command after cancellation did NOT execute');
        }

        // Check for prompt after SIGINT
        const lines = finalContent.split('\n');
        let foundSigint = false;
        let promptAfterSigint = false;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Signal SIGINT sent')) {
                foundSigint = true;
                // Check if next non-empty line has a prompt
                for (let j = i + 1; j < lines.length; j++) {
                    if (lines[j].trim() && lines[j].includes('[') && lines[j].includes(']$')) {
                        promptAfterSigint = true;
                        break;
                    }
                }
                break;
            }
        }

        if (promptAfterSigint) {
            console.log('✅ Prompt appeared after SIGINT');
        } else {
            console.log('❌ NO prompt after SIGINT - terminal appears dead');
        }

        return true;

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    } finally {
        await browser.close();
    }
}

// Run the test
const testUrl = process.argv[2];
testCancellation(testUrl)
    .then(success => {
        console.log(success ? '✅ Test completed' : '❌ Test failed');
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Test error:', error);
        process.exit(1);
    });