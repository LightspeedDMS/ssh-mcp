/**
 * Prompt Detection Regex Bug Reproduction Test
 * TDD: Isolate and fix the specific regex issue in isPromptLine()
 */

describe('Prompt Detection Regex Bug Reproduction', () => {
  
  /**
   * Test to isolate the exact regex issue
   */
  it('should identify the broken regex pattern for bracket prompts', () => {
    // Current broken regex from terminal-input-handler.js line 262
    const brokenRegex = /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s+[^\]]+\]\$\s*$/;
    
    // Real bracket prompt examples from our system
    const realPrompts = [
      '[jsbattig@localhost ls-ssh-mcp]$ ',
      '[jsbattig@localhost ls-ssh-mcp]$',
      '[jsbattig@localhost ~]$ ',
      '[jsbattig@localhost /home/jsbattig]$ '
    ];

    console.log('Testing current broken regex against real prompts:');
    
    for (const prompt of realPrompts) {
      const matches = brokenRegex.test(prompt.trim());
      console.log(`"${prompt}" -> ${matches}`);
      
      // These should match but currently FAIL - demonstrating the bug
      if (!matches) {
        console.log(`❌ REGEX BUG FOUND: "${prompt}" should match but doesn't!`);
      }
    }

    // This test will FAIL initially, proving the bug exists
    expect(realPrompts.every(prompt => brokenRegex.test(prompt.trim()))).toBe(true);
  });

  /**
   * Test to analyze why the regex fails
   */
  it('should analyze the regex pattern components', () => {
    const brokenRegex = /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s+[^\]]+\]\$\s*$/;
    const testPrompt = '[jsbattig@localhost ls-ssh-mcp]$';
    
    console.log('Analyzing regex components:');
    console.log('Full regex:', brokenRegex.toString());
    console.log('Test prompt:', `"${testPrompt}"`);
    
    // Break down the regex to find the issue
    const components = [
      { name: 'Start bracket', pattern: /^\[/, test: testPrompt },
      { name: 'Username', pattern: /^\[[a-zA-Z0-9._-]+/, test: testPrompt },
      { name: 'Username@host', pattern: /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+/, test: testPrompt },
      { name: 'Username@host space', pattern: /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s+/, test: testPrompt },
      { name: 'Username@host space project', pattern: /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s+[^\]]+/, test: testPrompt },
      { name: 'Full without end', pattern: /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s+[^\]]+\]/, test: testPrompt },
      { name: 'Full pattern', pattern: brokenRegex, test: testPrompt }
    ];
    
    for (const component of components) {
      const matches = component.pattern.test(component.test);
      console.log(`${component.name}: ${matches ? '✅' : '❌'} ${component.pattern}`);
      
      if (!matches && component.name !== 'Full pattern') {
        console.log(`🔍 ISSUE FOUND at component: ${component.name}`);
        break;
      }
    }

    // The issue is likely the required space (\s+) between hostname and project
    // Our prompts are: [jsbattig@localhost ls-ssh-mcp]$ 
    // But regex expects: [jsbattig@localhost SPACE project]$
    // However, "ls-ssh-mcp" comes right after localhost with NO space!
    
    console.log('🔍 HYPOTHESIS: The \\s+ (required space) is the problem!');
    console.log('Real format: [jsbattig@localhost ls-ssh-mcp]$');
    console.log('Regex expects: [jsbattig@localhost SPACE project]$');
    
    expect(false).toBe(true); // This test should fail to demonstrate the analysis
  });

  /**
   * Test the corrected regex pattern
   */
  it('should provide corrected regex that works', () => {
    // Fixed regex - remove required space, allow anything between host and ]
    const betterRegex = /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+[^\]]*\]\$\s*$/;
    
    const realPrompts = [
      '[jsbattig@localhost ls-ssh-mcp]$ ',
      '[jsbattig@localhost ls-ssh-mcp]$',
      '[jsbattig@localhost ~]$ ',
      '[jsbattig@localhost /home/jsbattig]$ '
    ];

    console.log('Testing corrected regex:');
    for (const prompt of realPrompts) {
      const matches = betterRegex.test(prompt.trim());
      console.log(`"${prompt}" -> ${matches ? '✅' : '❌'}`);
    }

    // This should pass with the corrected regex
    expect(realPrompts.every(prompt => betterRegex.test(prompt.trim()))).toBe(true);
  });
});