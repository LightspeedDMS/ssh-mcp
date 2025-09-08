/**
 * TypeScript to JavaScript Compilation Pipeline Test
 * 
 * CRITICAL TEST: Ensures that TypeScript source can be properly compiled to JavaScript
 * and that the compilation process maintains protocol consistency.
 * 
 * PURPOSE: Establish sustainable development workflow where TypeScript changes
 * can be compiled to JavaScript without breaking the Interactive Terminal Epic.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';

describe('TypeScript Compilation Pipeline', () => {
  const projectRoot = process.cwd();
  const staticDir = join(projectRoot, 'static');
  const tsFilePath = join(staticDir, 'terminal-input-handler.ts');
  const jsFilePath = join(staticDir, 'terminal-input-handler.js');
  const backupJsPath = join(staticDir, 'terminal-input-handler.js.backup');

  beforeAll(() => {
    // Backup existing JS file
    if (existsSync(jsFilePath)) {
      const jsContent = readFileSync(jsFilePath, 'utf8');
      writeFileSync(backupJsPath, jsContent);
    }
  });

  afterAll(() => {
    // Restore backup
    if (existsSync(backupJsPath)) {
      const backupContent = readFileSync(backupJsPath, 'utf8');
      writeFileSync(jsFilePath, backupContent);
    }
  });

  test('TypeScript file exists and has valid syntax', () => {
    expect(existsSync(tsFilePath)).toBe(true);
    
    const tsContent = readFileSync(tsFilePath, 'utf8');
    expect(tsContent.length).toBeGreaterThan(100);
    
    // Basic TypeScript syntax validation
    expect(tsContent).toContain('export class TerminalInputHandler');
    expect(tsContent).toContain('interface');
    expect(tsContent).toContain('private');
    expect(tsContent).toContain('public');
  });

  test('TypeScript can be compiled to JavaScript', () => {
    const tsContent = readFileSync(tsFilePath, 'utf8');
    
    // TypeScript compiler options for browser-compatible output
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2017,
      module: ts.ModuleKind.None,  // No module system for browser
      lib: ['ES2017', 'DOM'],
      strict: false,  // Relaxed for browser compatibility
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      removeComments: false,  // Keep comments for debugging
      sourceMap: false,  // No source maps needed for static file
    };

    // Compile TypeScript to JavaScript
    const result = ts.transpileModule(tsContent, {
      compilerOptions
    });

    expect(result.outputText).toBeDefined();
    expect(result.outputText.length).toBeGreaterThan(100);
    expect(result.diagnostics).toEqual([]);  // No compilation errors

    // Verify compiled output has essential elements
    expect(result.outputText).toContain('TerminalInputHandler');
    expect(result.outputText).toContain('submitCommand');
    expect(result.outputText).toContain('command:');
    expect(result.outputText).toContain('commandId:');
  });

  test('Compiled JavaScript maintains protocol compatibility', () => {
    const tsContent = readFileSync(tsFilePath, 'utf8');
    
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2017,
      module: ts.ModuleKind.None,
      lib: ['ES2017', 'DOM'],
      strict: false,
      removeComments: false,
    };

    const result = ts.transpileModule(tsContent, { compilerOptions });
    const compiledJS = result.outputText;

    // Verify protocol elements are preserved in compilation
    expect(compiledJS).toContain('terminal_input');
    expect(compiledJS).toContain('sessionName');
    expect(compiledJS).toContain('command');  // NOT 'data'
    expect(compiledJS).toContain('commandId');
    expect(compiledJS).toContain('cmd_');
    expect(compiledJS).toContain('Date.now()');

    // Verify WebSocket send structure is correct
    const submitCommandMatch = compiledJS.match(/webSocket\.send\(JSON\.stringify\(([\s\S]*?)\)\);/);
    if (submitCommandMatch) {
      const messageStructure = submitCommandMatch[1];
      expect(messageStructure).toContain('command:');
      expect(messageStructure).toContain('commandId:');
    }
  });

  test('Package.json should have TypeScript build scripts', () => {
    const packageJsonPath = join(projectRoot, 'package.json');
    expect(existsSync(packageJsonPath)).toBe(true);

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    
    // This test documents what scripts should exist for sustainable development
    const shouldHaveBuildScript = packageJson.scripts?.['build:client'] || 
                                 packageJson.scripts?.['build:static'] ||
                                 packageJson.scripts?.['compile:ts'];

    // Initially this will fail, documenting what needs to be added
    if (!shouldHaveBuildScript) {
      expect(true).toBe(false); // Force failure to document requirement
    }
  });

  test('NPM script compilation should work', () => {
    // Skip if npm scripts don't exist yet
    const packageJsonPath = join(projectRoot, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    
    const buildScript = packageJson.scripts?.['build:client'] || 
                       packageJson.scripts?.['build:static'] ||
                       packageJson.scripts?.['compile:ts'];

    if (!buildScript) {
      // Document what the script should do
      expect(buildScript).toBeDefined();
      return;
    }

    // If script exists, test it works
    try {
      execSync('npm run build:client || npm run build:static || npm run compile:ts', {
        cwd: projectRoot,
        stdio: 'pipe'
      });
    } catch (error) {
      expect(true).toBe(false); // Compilation should not fail
    }

    // Verify compilation produced valid output
    expect(existsSync(jsFilePath)).toBe(true);
    const compiledContent = readFileSync(jsFilePath, 'utf8');
    expect(compiledContent).toContain('TerminalInputHandler');
    expect(compiledContent).toContain('command:');
    expect(compiledContent).toContain('commandId:');
  });
});