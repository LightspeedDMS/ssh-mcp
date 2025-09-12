/**
 * EnvironmentValueProvider
 * Implementation for AC 6.4, 6.15 - Environment preparation and performance optimization
 * 
 * Collects runtime environment values with caching for performance optimization.
 * Supports custom variable definitions and cross-platform compatibility.
 * 
 * CRITICAL: No mocks - uses real system calls and environment access.
 */

import * as os from 'os';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Standard environment values interface
 */
export interface EnvironmentValues {
  USER: string;           // process.env.USER || os.userInfo().username
  PWD: string;            // process.cwd()
  HOSTNAME: string;       // os.hostname()
  HOME: string;           // os.homedir()
  LS_OUTPUT: string[];    // fs.readdirSync(process.cwd())
  TIMESTAMP: string;      // Date.now().toString()
  [key: string]: any;     // Support for custom variables
}

/**
 * Configuration for EnvironmentValueProvider
 */
export interface EnvironmentValueProviderConfig {
  cacheTimeoutMs?: number;              // Cache expiration time (default: no expiration)
  customVariables?: Record<string, string>;  // Custom variable definitions
  targetDirectory?: string;             // Target directory for LS_OUTPUT (default: cwd)
  failOnCommandError?: boolean;         // Fail on custom command execution errors (default: true)
}

/**
 * EnvironmentValueProvider class
 */
export class EnvironmentValueProvider {
  private cachedValues: EnvironmentValues | null = null;
  private cacheTimestamp: number = 0;
  private readonly config: Required<EnvironmentValueProviderConfig>;
  private sessionTimestamp: string | null = null; // Fix TIMESTAMP stability

  constructor(config: EnvironmentValueProviderConfig = {}) {
    this.config = {
      cacheTimeoutMs: config.cacheTimeoutMs || 0, // 0 means no expiration
      customVariables: config.customVariables || {},
      targetDirectory: config.targetDirectory || process.cwd(),
      failOnCommandError: config.failOnCommandError !== false
    };
    // Initialize session timestamp that remains stable until explicitly reset
    this.sessionTimestamp = Date.now().toString();
  }

  /**
   * Get all environment values with caching
   * AC 6.4: Pre-execution environment preparation
   * AC 6.15: Performance optimization through caching
   */
  async getValues(): Promise<EnvironmentValues> {
    // Check cache validity
    if (this.cachedValues && this.isCacheValid()) {
      return this.cachedValues;
    }

    // Collect fresh values
    this.cachedValues = await this.collectValues();
    this.cacheTimestamp = Date.now();

    return this.cachedValues;
  }

  /**
   * Invalidate cached values
   * AC 6.15: Cache invalidation for environment changes
   */
  invalidateCache(): void {
    this.cachedValues = null;
    this.cacheTimestamp = 0;
    // DO NOT reset sessionTimestamp - it should remain stable per test session
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    if (this.config.cacheTimeoutMs === 0) {
      return true; // No expiration
    }
    
    return Date.now() - this.cacheTimestamp < this.config.cacheTimeoutMs;
  }

  /**
   * Collect all environment values from system
   */
  private async collectValues(): Promise<EnvironmentValues> {
    const values: EnvironmentValues = {
      USER: this.getUserName(),
      PWD: process.cwd(),
      HOSTNAME: os.hostname(),
      HOME: os.homedir(),
      LS_OUTPUT: this.getDirectoryListing(),
      TIMESTAMP: this.sessionTimestamp! // Use stable session timestamp
    };

    // Add custom variables
    for (const [key, definition] of Object.entries(this.config.customVariables)) {
      try {
        values[key] = await this.resolveCustomVariable(definition);
      } catch (error) {
        if (this.config.failOnCommandError) {
          throw new Error(`Failed to resolve custom variable '${key}': ${error instanceof Error ? error.message : String(error)}`);
        } else {
          values[key] = ''; // Default to empty string on failure
        }
      }
    }

    return values;
  }

  /**
   * Get username with fallback to os.userInfo
   * AC 6.1: Dynamic username value construction
   */
  private getUserName(): string {
    return process.env.USER || os.userInfo().username;
  }

  /**
   * Get directory listing for current working directory
   * AC 6.8: Directory listing dynamic validation
   */
  private getDirectoryListing(): string[] {
    try {
      return fs.readdirSync(this.config.targetDirectory);
    } catch (error) {
      throw new Error(`Failed to read directory listing for '${this.config.targetDirectory}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Resolve custom variable definition
   * AC 6.11: Custom variable definition and usage
   */
  private async resolveCustomVariable(definition: string): Promise<string> {
    if (definition.startsWith('exec:')) {
      // Execute command and return output
      const command = definition.substring(5).trim();
      const { stdout } = await execAsync(command);
      return stdout.trim();
    } else {
      // Return literal value
      return definition;
    }
  }
}