/**
 * TemplateResolver
 * Implementation for AC 6.10, 6.11, 6.12 - Template variable expansion and conditional logic
 * 
 * Resolves template strings with variable substitution and conditional expressions.
 * Supports nested references, command execution, and complex conditional logic.
 * 
 * CRITICAL: No mocks - uses real command execution and variable resolution.
 */

import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EnvironmentValues } from './environment-value-provider';

const execAsync = promisify(exec);

/**
 * Template resolution configuration
 */
export interface TemplateResolverConfig {
  maxRecursionDepth?: number;    // Maximum recursion depth for nested variables (default: 10)
  commandTimeout?: number;       // Timeout for command execution (default: 5000ms)
}

/**
 * TemplateResolver class
 */
export class TemplateResolver {
  private readonly environmentValues: EnvironmentValues;
  private readonly customVariables: Record<string, string>;
  private readonly config: Required<TemplateResolverConfig>;
  private readonly resolutionStack: Set<string> = new Set();
  private recursionDepth: number = 0;

  constructor(
    environmentValues: EnvironmentValues,
    customVariables: Record<string, string> = {},
    config: TemplateResolverConfig = {}
  ) {
    this.environmentValues = environmentValues;
    this.customVariables = customVariables;
    this.config = {
      maxRecursionDepth: config.maxRecursionDepth || 10,
      commandTimeout: config.commandTimeout || 5000
    };
  }

  /**
   * Resolve template string with variable substitution
   * AC 6.10: Template variable expansion system
   */
  async resolve(template: string): Promise<string> {
    this.resolutionStack.clear();
    this.recursionDepth = 0;
    
    return await this.resolveInternal(template);
  }

  /**
   * Internal template resolution with recursion protection
   */
  private async resolveInternal(template: string): Promise<string> {
    if (this.recursionDepth > this.config.maxRecursionDepth) {
      throw new Error(`Maximum recursion depth exceeded (${this.config.maxRecursionDepth})`);
    }

    // Find all template variables in format ${VARIABLE_NAME}
    const variablePattern = /\$\{([^}]+)\}/g;
    let result = template;
    let match;
    let hasReplacements = true;

    // Keep resolving until no more variables are found
    while (hasReplacements) {
      hasReplacements = false;
      const matches: Array<{fullMatch: string, expression: string, index: number}> = [];
      
      // Collect all matches first
      while ((match = variablePattern.exec(result)) !== null) {
        matches.push({
          fullMatch: match[0],
          expression: match[1],
          index: match.index
        });
      }
      
      // Reset regex for next iteration
      variablePattern.lastIndex = 0;
      
      // Process matches in reverse order to maintain correct indices
      for (let i = matches.length - 1; i >= 0; i--) {
        const { fullMatch, expression } = matches[i];
        
        // Check for circular references
        if (this.resolutionStack.has(fullMatch)) {
          throw new Error(`Circular reference detected: ${fullMatch}`);
        }

        try {
          this.resolutionStack.add(fullMatch);
          this.recursionDepth++;

          const resolvedValue = await this.resolveExpression(expression);
          result = result.replace(fullMatch, resolvedValue);
          hasReplacements = true;

          this.recursionDepth--;
          this.resolutionStack.delete(fullMatch);
        } catch (error) {
          this.resolutionStack.delete(fullMatch);
          this.recursionDepth--;
          throw error;
        }
      }
    }

    // Handle escaped variables
    result = result.replace(/\\(\$\{[^}]+\})/g, '$1');

    return result;
  }

  /**
   * Resolve individual expression (variable, conditional, or command)
   */
  private async resolveExpression(expression: string): Promise<string> {
    // Check for conditional expressions (AC 6.12)
    if (this.isConditionalExpression(expression)) {
      return await this.resolveConditional(expression);
    }

    // Check for pattern syntax
    if (expression.startsWith('pattern:')) {
      return expression; // Return as-is for pattern matching
    }

    // Check for file existence check
    if (expression.startsWith('FILE_EXISTS:')) {
      const filename = expression.substring(12);
      const exists = fs.existsSync(filename);
      return exists.toString();
    }

    // Check for process existence check
    if (expression.startsWith('PROCESS_EXISTS:')) {
      const processName = expression.substring(15);
      return await this.checkProcessExists(processName);
    }

    // Check for command execution
    if (expression.startsWith('exec:')) {
      const command = expression.substring(5).trim();
      const { stdout } = await execAsync(command, { timeout: this.config.commandTimeout });
      return stdout.trim();
    }

    // Check custom variables first
    if (this.customVariables.hasOwnProperty(expression)) {
      const customValue = this.customVariables[expression];
      
      // Handle exec: commands in custom variables
      if (customValue.startsWith('exec:')) {
        const command = customValue.substring(5).trim();
        try {
          const { stdout } = await execAsync(command, { timeout: this.config.commandTimeout });
          return stdout.trim();
        } catch (error) {
          throw new Error(`Command execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Recursively resolve if it contains template variables  
      return await this.resolveInternal(customValue);
    }

    // Check environment values
    if (this.environmentValues.hasOwnProperty(expression)) {
      const value = this.environmentValues[expression];
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      return value.toString();
    }

    throw new Error(`Unknown template variable: ${expression}`);
  }

  /**
   * Check if expression is a conditional
   * AC 6.12: Conditional template resolution
   */
  private isConditionalExpression(expression: string): boolean {
    return expression.includes('?') && expression.includes(':');
  }

  /**
   * Resolve conditional expression
   * Format: condition ? true_value : false_value
   */
  private async resolveConditional(expression: string): Promise<string> {
    const questionIndex = expression.indexOf('?');
    const colonIndex = expression.lastIndexOf(':');

    if (questionIndex === -1 || colonIndex === -1 || colonIndex <= questionIndex) {
      throw new Error(`Invalid conditional syntax: ${expression}`);
    }

    const condition = expression.substring(0, questionIndex).trim();
    const trueValue = expression.substring(questionIndex + 1, colonIndex).trim();
    const falseValue = expression.substring(colonIndex + 1).trim();

    const conditionResult = await this.evaluateCondition(condition);

    if (conditionResult) {
      return await this.resolveConditionalValue(trueValue);
    } else {
      return await this.resolveConditionalValue(falseValue);
    }
  }

  /**
   * Resolve conditional value (handles quoted strings vs variables)
   */
  private async resolveConditionalValue(value: string): Promise<string> {
    // If it's a quoted string, remove quotes and return as literal
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    // Otherwise, treat as template and resolve
    return await this.resolveInternal(value);
  }

  /**
   * Evaluate boolean condition
   */
  private async evaluateCondition(condition: string): Promise<boolean> {
    // Handle file existence conditions
    if (condition.startsWith('FILE_EXISTS:')) {
      const filename = condition.substring(12);
      return fs.existsSync(filename);
    }

    // Handle equality conditions
    if (condition.includes('===')) {
      const [left, right] = condition.split('===').map(s => s.trim());
      const leftValue = await this.resolveVariableValue(left);
      const rightValue = await this.resolveVariableValue(right);
      return leftValue === rightValue;
    }

    // Handle inequality conditions
    if (condition.includes('!==')) {
      const [left, right] = condition.split('!==').map(s => s.trim());
      const leftValue = await this.resolveVariableValue(left);
      const rightValue = await this.resolveVariableValue(right);
      return leftValue !== rightValue;
    }

    // Handle contains conditions
    if (condition.includes('.includes(')) {
      const match = condition.match(/(\w+)\.includes\(([^)]+)\)/);
      if (match) {
        const varName = match[1];
        const searchValue = match[2].replace(/['"]/g, ''); // Remove quotes
        const varValue = await this.resolveVariableValue(varName);
        
        if (Array.isArray(this.environmentValues[varName])) {
          return this.environmentValues[varName].includes(searchValue);
        }
        return varValue.includes(searchValue);
      }
    }

    // Handle length comparisons
    if (condition.includes('.length')) {
      const match = condition.match(/(\w+)\.length\s*([><=!]+)\s*(\d+)/);
      if (match) {
        const varName = match[1];
        const operator = match[2];
        const threshold = parseInt(match[3]);
        const varValue = this.environmentValues[varName];
        
        let length = 0;
        if (Array.isArray(varValue)) {
          length = varValue.length;
        } else if (typeof varValue === 'string') {
          length = varValue.length;
        }

        switch (operator) {
          case '>': return length > threshold;
          case '>=': return length >= threshold;
          case '<': return length < threshold;
          case '<=': return length <= threshold;
          case '===': return length === threshold;
          case '!==': return length !== threshold;
          default: return false;
        }
      }
    }

    throw new Error(`Unsupported condition syntax: ${condition}`);
  }

  /**
   * Resolve variable value for condition evaluation
   */
  private async resolveVariableValue(variable: string): Promise<string> {
    // Remove quotes if present
    const cleanVar = variable.replace(/^["']|["']$/g, '');
    
    // If it's a quoted string, return as-is
    if (variable.startsWith('"') || variable.startsWith("'")) {
      return cleanVar;
    }

    // Try to resolve as variable
    try {
      return await this.resolveExpression(cleanVar);
    } catch {
      // If not a variable, return as literal
      return cleanVar;
    }
  }

  /**
   * Check if process exists
   * AC 6.9: Process information dynamic validation
   */
  private async checkProcessExists(processName: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`pgrep -f "${processName}"`, { timeout: this.config.commandTimeout });
      return (stdout.trim().length > 0).toString();
    } catch {
      return 'false';
    }
  }

  /**
   * Validate template syntax
   */
  static validateSyntax(template: string): void {
    let braceCount = 0;
    let inVariable = false;

    for (let i = 0; i < template.length; i++) {
      const char = template[i];
      const nextChar = template[i + 1];

      if (char === '$' && nextChar === '{') {
        braceCount++;
        inVariable = true;
        i++; // Skip next character
      } else if (char === '}' && inVariable) {
        braceCount--;
        if (braceCount === 0) {
          inVariable = false;
        }
      }
    }

    if (braceCount !== 0) {
      throw new Error(`Invalid template syntax: unmatched braces in "${template}"`);
    }
  }
}