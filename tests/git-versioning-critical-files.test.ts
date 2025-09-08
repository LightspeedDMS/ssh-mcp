/**
 * Git Versioning Critical Files Test
 * 
 * CRITICAL TEST: Ensures that essential static JavaScript files are properly tracked by git
 * to prevent the Interactive Terminal Epic functionality from being lost during rollbacks.
 * 
 * ROOT CAUSE: *.js in .gitignore caused the working JavaScript client to be lost,
 * leaving a protocol mismatch between client and server.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Git Versioning Critical Files', () => {
  const projectRoot = process.cwd();
  const staticDir = join(projectRoot, 'static');
  const criticalJSFile = join(staticDir, 'terminal-input-handler.js');
  const gitignoreFile = join(projectRoot, '.gitignore');

  test('CRITICAL: terminal-input-handler.js must be tracked by git', () => {
    // Verify the file exists
    expect(existsSync(criticalJSFile)).toBe(true);

    // Check if file is tracked by git using git ls-files (most reliable method)
    let isTracked = false;
    try {
      const trackedFiles = execSync('git ls-files static/terminal-input-handler.js', { 
        cwd: projectRoot,
        encoding: 'utf8' 
      }).trim();
      
      // If git ls-files returns the filename, it's tracked
      isTracked = trackedFiles === 'static/terminal-input-handler.js';
    } catch (error) {
      // If git ls-files fails or returns empty, file is not tracked
      isTracked = false;
    }

    expect(isTracked).toBe(true);
  });

  test('gitignore must allow static JavaScript files while maintaining security', () => {
    const gitignoreContent = readFileSync(gitignoreFile, 'utf8');
    
    // This test will initially fail, documenting what needs to be fixed
    const hasCorrectIgnorePattern = (
      gitignoreContent.includes('*.js') && 
      gitignoreContent.includes('!static/*.js')
    ) || (
      // Alternative: more specific ignore patterns instead of blanket *.js
      !gitignoreContent.includes('*.js') &&
      gitignoreContent.includes('dist/*.js') &&
      gitignoreContent.includes('build/*.js')
    );

    expect(hasCorrectIgnorePattern).toBe(true);
  });

  test('static directory structure must support versioned JavaScript', () => {
    expect(existsSync(staticDir)).toBe(true);
    expect(existsSync(join(staticDir, 'terminal-input-handler.ts'))).toBe(true);
    expect(existsSync(join(staticDir, 'terminal-input-handler.js'))).toBe(true);
    
    // Verify the JavaScript file has substantial content (not empty stub)
    const jsContent = readFileSync(criticalJSFile, 'utf8');
    expect(jsContent.length).toBeGreaterThan(100);
    expect(jsContent).toContain('TerminalInputHandler');
    expect(jsContent).toContain('submitCommand');
  });
});