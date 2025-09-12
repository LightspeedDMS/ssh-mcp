/**
 * DynamicExpectedValueConstructor
 * Implementation for Story 06: Dynamic Expected Value Construction
 * 
 * Main orchestrator class that coordinates EnvironmentValueProvider and TemplateResolver
 * to provide runtime generation of expected command outputs with parameterized values.
 * 
 * CRITICAL: No mocks - uses real environment values and template resolution.
 */

import { EnvironmentValueProvider, EnvironmentValues } from './environment-value-provider';
import { TemplateResolver } from './template-resolver';

/**
 * Configuration for DynamicExpectedValueConstructor
 */
export interface DynamicExpectedValueConstructorConfig {
  customVariables?: Record<string, string>;     // Custom variable definitions
  fallbackValues?: Record<string, string>;     // Fallback values for missing variables
  cacheTimeoutMs?: number;                     // Cache timeout for environment values
  templateConfig?: {
    maxRecursionDepth?: number;
    commandTimeout?: number;
  };
}

/**
 * Volatile pattern types for regex generation
 */
export type VolatilePatternType = 'timestamp' | 'date' | 'pid' | 'memory' | 'time';

/**
 * DynamicExpectedValueConstructor class
 */
export class DynamicExpectedValueConstructor {
  private readonly environmentProvider: EnvironmentValueProvider;
  private readonly config: DynamicExpectedValueConstructorConfig;
  private templateResolverCache: Map<string, TemplateResolver> = new Map();

  constructor(config: DynamicExpectedValueConstructorConfig = {}) {
    this.config = config;

    // Initialize environment provider with custom variables
    this.environmentProvider = new EnvironmentValueProvider({
      customVariables: this.mergeCustomVariables(),
      cacheTimeoutMs: config.cacheTimeoutMs
    });
  }

  /**
   * Resolve template string to actual values
   * AC 6.5: Dynamic value substitution in expected outputs
   * AC 6.10: Template variable expansion system
   */
  async resolveTemplate(template: string): Promise<string> {
    // Validate template syntax first
    TemplateResolver.validateSyntax(template);

    // Get environment values
    const environmentValues = await this.getEnvironmentValues();

    // Get or create template resolver for this environment
    const cacheKey = this.getResolverCacheKey(environmentValues);
    let resolver = this.templateResolverCache.get(cacheKey);

    if (!resolver) {
      resolver = new TemplateResolver(
        environmentValues,
        this.config.customVariables || {},
        this.config.templateConfig
      );
      this.templateResolverCache.set(cacheKey, resolver);
    }

    try {
      return await resolver.resolve(template);
    } catch (error) {
      // Add fallback handling
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Unknown template variable') && this.config.fallbackValues) {
        const unknownVar = this.extractUnknownVariable(errorMessage);
        if (unknownVar && this.config.fallbackValues[unknownVar]) {
          // Create new resolver with fallback values
          const fallbackResolver = new TemplateResolver(
            { ...environmentValues, ...this.config.fallbackValues },
            this.config.customVariables || {},
            this.config.templateConfig
          );
          return await fallbackResolver.resolve(template);
        }
      }
      throw error;
    }
  }

  /**
   * Check if actual output matches dynamic pattern
   * AC 6.13: Dynamic expected value integration with Jest matchers
   */
  async matchesDynamicPattern(actualOutput: string, template: string): Promise<boolean> {
    try {
      const resolvedTemplate = await this.resolveTemplate(template);
      return actualOutput === resolvedTemplate;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get environment values with caching
   * AC 6.4: Pre-execution environment preparation
   */
  async getEnvironmentValues(): Promise<EnvironmentValues> {
    return await this.environmentProvider.getValues();
  }

  /**
   * Invalidate all cached values
   * AC 6.15: Cache invalidation for environment changes
   */
  invalidateCache(): void {
    this.environmentProvider.invalidateCache();
    this.templateResolverCache.clear();
  }

  /**
   * Create regex pattern for volatile outputs
   * AC 6.7: Volatile output handling with regex patterns
   */
  createVolatilePattern(patternType: VolatilePatternType): RegExp {
    switch (patternType) {
      case 'timestamp':
        // Matches Unix timestamps
        return /\d{10,13}/;
      
      case 'date':
        // Matches date command output like "Mon Dec 25 10:30:45 UTC 2023"
        return /\w{3}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\w{3}\s+\d{4}/i;
      
      case 'pid':
        // Matches process IDs
        return /\d+/;
      
      case 'memory':
        // Matches memory usage patterns like "1.2MB" or "512KB"
        return /\d+\.?\d*[KMGT]?B/i;
      
      case 'time':
        // Matches time patterns like "10:30:45"
        return /\d{2}:\d{2}:\d{2}/;
      
      default:
        throw new Error(`Unknown volatile pattern type: ${patternType}`);
    }
  }

  /**
   * Merge custom variables with built-in variables
   */
  private mergeCustomVariables(): Record<string, string> {
    const builtInVariables: Record<string, string> = {
      'SSH_SESSION_COUNT': 'exec:who | wc -l',
      'GIT_BRANCH': 'exec:git branch --show-current 2>/dev/null || echo "not-in-git"',
      'NODE_VERSION': 'exec:node --version'
    };

    return {
      ...builtInVariables,
      ...(this.config.customVariables || {})
    };
  }

  /**
   * Generate cache key for template resolver
   */
  private getResolverCacheKey(environmentValues: EnvironmentValues): string {
    const keyData = {
      user: environmentValues.USER,
      pwd: environmentValues.PWD,
      hostname: environmentValues.HOSTNAME,
      timestamp: environmentValues.TIMESTAMP
    };
    return JSON.stringify(keyData);
  }

  /**
   * Extract unknown variable name from error message
   */
  private extractUnknownVariable(errorMessage: string): string | null {
    const match = errorMessage.match(/Unknown template variable: (\w+)/);
    return match ? match[1] : null;
  }
}