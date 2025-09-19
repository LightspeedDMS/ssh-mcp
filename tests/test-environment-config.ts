/**
 * Test Environment Configuration
 * 
 * Centralizes all environment-dependent test configuration to eliminate hardcoded values
 */

import * as os from 'os';

export class TestEnvironmentConfig {
  /**
   * Get current system username for terminal prompt patterns
   * Uses system username instead of hardcoded values
   */
  static getTestUsername(): string {
    return process.env.TEST_USERNAME || os.userInfo().username;
  }

  /**
   * Get test hostname for terminal prompt patterns
   * Uses system hostname instead of hardcoded values
   */
  static getTestHostname(): string {
    return process.env.TEST_HOSTNAME || 'localhost';
  }

  /**
   * Get test home directory path
   * Uses system home directory instead of hardcoded values
   */
  static getTestHomeDirectory(): string {
    return process.env.TEST_HOME_DIR || os.homedir();
  }

  /**
   * Get SSH key path for testing
   * Uses environment variable or default SSH key location
   */
  static getTestSSHKeyPath(): string {
    return process.env.TEST_SSH_KEY_PATH || `~/.ssh/id_ed25519`;
  }

  /**
   * Generate expected terminal prompt format
   * [username@hostname ~]$ (with space for command input when trailing)
   */
  static getExpectedPrompt(): string {
    const username = this.getTestUsername();
    const hostname = this.getTestHostname();
    return `[${username}@${hostname} ~]$`;
  }

  /**
   * Generate expected trailing prompt format (with space for next command)
   */
  static getExpectedTrailingPrompt(): string {
    const username = this.getTestUsername();
    const hostname = this.getTestHostname();
    return `[${username}@${hostname} ~]$ `;
  }

  /**
   * Generate expected terminal prompt pattern for regex matching
   * Escapes special characters for use in regex patterns
   */
  static getExpectedPromptPattern(): string {
    const prompt = this.getExpectedPrompt();
    return prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Replace hardcoded username patterns in expected output strings
   * Used to parameterize test assertions
   */
  static parameterizeExpectedOutput(expectedOutput: string): string {
    const username = this.getTestUsername();
    const hostname = this.getTestHostname();
    const homeDir = this.getTestHomeDirectory();
    
    return expectedOutput
      .replace(/jsbattig/g, username)
      .replace(/localhost/g, hostname)
      .replace(/\/home\/jsbattig/g, homeDir);
  }

  /**
   * Get test configuration summary for debugging
   */
  static getConfigSummary(): { username: string; hostname: string; homeDir: string; sshKeyPath: string; prompt: string } {
    return {
      username: this.getTestUsername(),
      hostname: this.getTestHostname(), 
      homeDir: this.getTestHomeDirectory(),
      sshKeyPath: this.getTestSSHKeyPath(),
      prompt: this.getExpectedPrompt()
    };
  }
}