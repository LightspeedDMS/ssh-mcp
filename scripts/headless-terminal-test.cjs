#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function runHeadlessTerminalTest(testUrl) {
    // Default to a test URL if none provided
    if (!testUrl) {
        console.log('⚠️  No URL provided. Usage: node headless-terminal-test.cjs <terminal-url>');
        console.log('   Example: node headless-terminal-test.cjs http://localhost:8081/session/my-session');
        process.exit(1);
    }

    console.log(`🧪 Starting headless terminal test for: ${testUrl}`);
    
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set up console logging to capture any browser errors
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
        await new Promise(resolve => setTimeout(resolve, 2000)); // Allow WebSocket connection to establish
        
        // Check for any JavaScript errors
        console.log('🔍 Checking for JavaScript errors...');
        const errors = await page.evaluate(() => {
            return window.errors || [];
        });
        
        if (errors.length > 0) {
            console.error('❌ JavaScript errors found:', errors);
            return false;
        }
        
        // Get initial terminal content (history replay) - FIXED: Preserve line structure
        console.log('📜 Checking terminal history replay...');
        const initialContent = await page.evaluate(() => {
            const terminalElement = document.querySelector('.xterm-screen');
            if (!terminalElement) return '';

            // CRITICAL FIX: Get terminal content with line structure preserved
            const rows = terminalElement.querySelectorAll('.xterm-rows > *');
            if (rows.length === 0) {
                // Fallback: if no rows structure, try to get inner text which preserves some formatting
                return terminalElement.innerText || terminalElement.textContent || '';
            }

            // Build line-by-line content with explicit line breaks
            const lines = [];
            rows.forEach(row => {
                const lineContent = row.innerText || row.textContent || '';
                if (lineContent.trim()) { // Only add non-empty lines
                    lines.push(lineContent);
                }
            });

            return lines.join('\n'); // Join with explicit newlines
        });
        
        console.log('📜 Initial terminal content:');
        console.log('---START TERMINAL CONTENT---');
        console.log(initialContent);
        console.log('---END TERMINAL CONTENT---');
        
        // Basic validation - look for any actual terminal content vs just CSS
        const hasActualContent = initialContent.length > 0 &&
                               !initialContent.startsWith('WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW') && // Not just CSS
                               (initialContent.includes('$') || initialContent.includes('localhost') || initialContent.includes('/home'));

        // CRITICAL: Check for proper line separation (no concatenation)
        const lines = initialContent.split('\n');
        const hasProperLineSeparation = lines.length > 1;
        const hasNoConcatenation = !initialContent.includes('pwd/home/jsbattig') && !initialContent.includes('whoamijsbattig');
        
        console.log(`📊 Content Analysis:
   - Content length: ${initialContent.length} chars
   - Has actual terminal content: ${hasActualContent ? '✓' : '✗'}
   - Contains prompt indicators: ${(initialContent.includes('$') || initialContent.includes('@')) ? '✓' : '✗'}
   - Has proper line separation: ${hasProperLineSeparation ? '✓' : '✗'} (${lines.length} lines)
   - No concatenation detected: ${hasNoConcatenation ? '✓' : '✗'}`);

        // Test typing functionality if content looks valid AND properly formatted
        if (hasActualContent && hasProperLineSeparation && hasNoConcatenation) {
            console.log('⌨️  Testing typing functionality...');
            const terminalInput = await page.waitForSelector('.xterm textarea', { timeout: 5000 });
            
            // Focus on terminal and type a command
            await terminalInput.focus();
            const testCommand = 'echo test-command';
            
            console.log(`⌨️  Typing command: ${testCommand}`);
            await page.type('.xterm textarea', testCommand);
            
            // Wait a moment to see the typed characters
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get content after typing (before pressing enter)
            const contentAfterTyping = await page.evaluate(() => {
                const terminalElement = document.querySelector('.xterm-screen');
                return terminalElement ? terminalElement.textContent : '';
            });
            
            const showsTypedCommand = contentAfterTyping.includes(testCommand);
            console.log(`⌨️  Typing verification: ${showsTypedCommand ? '✓' : '✗'} Command appears while typing`);
            
            return hasActualContent && hasProperLineSeparation && hasNoConcatenation && showsTypedCommand;
        } else {
            if (!hasActualContent) {
                console.log('⚠️  Terminal content appears to be CSS or invalid - skipping interaction test');
            } else if (!hasProperLineSeparation) {
                console.log('❌ CONCATENATION BUG: Terminal content lacks proper line separation');
            } else if (!hasNoConcatenation) {
                console.log('❌ CONCATENATION BUG: Commands and results are concatenated on same line');
            }
            return false;
        }
        
    } catch (error) {
        console.error('💥 Test failed with error:', error.message);
        return false;
    } finally {
        await browser.close();
    }
}

// Check if puppeteer is available
async function checkPuppeteer() {
    try {
        require('puppeteer');
        return true;
    } catch (e) {
        console.log('📦 Installing puppeteer...');
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            exec('npm install puppeteer', (error) => {
                if (error) {
                    console.error('❌ Failed to install puppeteer:', error.message);
                    resolve(false);
                } else {
                    console.log('✅ Puppeteer installed successfully');
                    resolve(true);
                }
            });
        });
    }
}

// Main execution
(async () => {
    const puppeteerAvailable = await checkPuppeteer();
    if (!puppeteerAvailable) {
        console.error('❌ Could not install/access puppeteer');
        process.exit(1);
    }
    
    // Get URL from command line arguments
    const testUrl = process.argv[2];
    
    const success = await runHeadlessTerminalTest(testUrl);
    
    console.log(`\n🎯 HEADLESS TEST RESULT: ${success ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (success) {
        console.log('✅ Terminal loads correctly with proper content and typing works');
    } else {
        console.log('❌ Terminal has display issues or typing doesn\'t work');
    }
    
    process.exit(success ? 0 : 1);
})();