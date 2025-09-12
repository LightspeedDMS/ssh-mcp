/**
 * Terminal Quality Analyzer - CLAUDE.md Foundation #6 compliant
 * 
 * Focused component for validating terminal display quality, echo patterns, and formatting
 * Part of Production Scenario Validator refactoring to follow KISS principle
 */

import { WorkflowResult } from '../../tests/integration/terminal-history-framework/comprehensive-response-collector';

// Reuse the same constants for consistency
export class TerminalQualityAnalyzer {
  // Named constants for all threshold values - CLAUDE.md Foundation #8 compliance
  private static readonly QUALITY_THRESHOLDS = {
    EXCELLENT: 0.95,
    GOOD: 0.8,
    POOR: 0.5,
    MINIMUM_ACCEPTABLE: 0.7
  };

  private static readonly VALIDATION_PATTERNS = {
    OLD_PROMPT_FORMAT: /[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+:[^$]*\$/,
    BRACKET_PROMPT_FORMAT: /\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\]\$/,
    DUPLICATED_PROMPT: /(\$\s*){2,}/,
    DUPLICATED_COMMAND: /echo.*echo/,
    ANSI_COLOR_CODES: /\x1b\[[0-9;]*m/g,
    PROBLEMATIC_CONTROL_CHARS: /[\x00-\x08\x0B\x0C\x0E-\x1A\x1C-\x1F\x7F]/,
    CRLF_LINE_ENDINGS: /\r\n/g,
    LF_LINE_ENDINGS: /\n/g
  };

  /**
   * Analyze command echo quality with real validation logic
   */
  analyzeCommandEchoQuality(output: string): number {
    // REAL VALIDATION LOGIC: Analyze command echo quality
    const lines = output.split('\n');
    let totalCommands = 0;
    let properEchoPatterns = 0;
    let duplicatedEchoes = 0;
    let cleanEchoes = 0;

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1];
      
      // Detect command patterns (lines ending with $)
      if (TerminalQualityAnalyzer.VALIDATION_PATTERNS.OLD_PROMPT_FORMAT.test(line) || 
          TerminalQualityAnalyzer.VALIDATION_PATTERNS.BRACKET_PROMPT_FORMAT.test(line)) {
        totalCommands++;
        
        // Check if next line contains the command echo
        const commandMatch = line.match(/\$\s*(.+)$/);
        if (commandMatch && nextLine.includes(commandMatch[1])) {
          properEchoPatterns++;
          
          // Check for clean echo (no duplication)
          const commandText = commandMatch[1].trim();
          if (commandText && nextLine.split(commandText).length === 2) {
            cleanEchoes++;
          } else {
            duplicatedEchoes++;
          }
        }
      }
    }

    // Calculate echo quality score
    if (totalCommands === 0) return TerminalQualityAnalyzer.QUALITY_THRESHOLDS.EXCELLENT;
    
    const echoQualityRatio = properEchoPatterns / totalCommands;
    const duplicationPenalty = duplicatedEchoes / totalCommands;
    const cleanlinessBonus = cleanEchoes / totalCommands;
    
    return Math.max(0, echoQualityRatio - duplicationPenalty + (cleanlinessBonus * 0.1));
  }

  /**
   * Analyze how well command results are separated
   */
  analyzeResultSeparationQuality(output: string): number {
    // REAL VALIDATION LOGIC: Analyze how well command results are separated
    const lines = output.split('\n');
    let commandResultPairs = 0;
    let properSeparation = 0;
    let blendedResults = 0;

    for (let i = 0; i < lines.length - 2; i++) {
      const line = lines[i];
      
      // Detect command execution patterns
      if (TerminalQualityAnalyzer.VALIDATION_PATTERNS.OLD_PROMPT_FORMAT.test(line) || 
          TerminalQualityAnalyzer.VALIDATION_PATTERNS.BRACKET_PROMPT_FORMAT.test(line)) {
        
        const commandMatch = line.match(/\$\s*(.+)$/);
        if (commandMatch) {
          commandResultPairs++;
          
          // Look for proper separation between command and result
          let separationFound = false;
          let resultStart = -1;
          
          // Check next few lines for result patterns
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const resultLine = lines[j];
            
            // Skip empty lines and command echoes
            if (resultLine.trim() === '' || resultLine.includes(commandMatch[1])) {
              continue;
            }
            
            // Found potential result line
            if (resultStart === -1) {
              resultStart = j;
            }
            
            // Check if result is clearly separated from next prompt
            if (j < lines.length - 1 && 
                (TerminalQualityAnalyzer.VALIDATION_PATTERNS.OLD_PROMPT_FORMAT.test(lines[j + 1]) || 
                 TerminalQualityAnalyzer.VALIDATION_PATTERNS.BRACKET_PROMPT_FORMAT.test(lines[j + 1]))) {
              separationFound = true;
              break;
            }
          }
          
          if (separationFound) {
            properSeparation++;
          } else {
            blendedResults++;
          }
        }
      }
    }

    // Calculate separation quality score
    if (commandResultPairs === 0) return TerminalQualityAnalyzer.QUALITY_THRESHOLDS.EXCELLENT;
    
    const separationRatio = properSeparation / commandResultPairs;
    const blendingPenalty = blendedResults / commandResultPairs;
    
    return Math.max(0, separationRatio - (blendingPenalty * 0.5));
  }

  /**
   * Analyze overall terminal output cleanliness
   */
  analyzeOverallCleanliness(output: string): number {
    // REAL VALIDATION LOGIC: Analyze overall terminal output cleanliness
    let cleanlinessScore = 1.0;
    let issues = 0;
    let totalChecks = 0;

    // Check CRLF line ending consistency (critical for xterm.js)
    totalChecks++;
    const crlfMatches = output.match(TerminalQualityAnalyzer.VALIDATION_PATTERNS.CRLF_LINE_ENDINGS);
    const lfMatches = output.match(TerminalQualityAnalyzer.VALIDATION_PATTERNS.LF_LINE_ENDINGS);
    const crlfRatio = crlfMatches ? crlfMatches.length / (lfMatches ? lfMatches.length : 1) : 0;
    
    if (crlfRatio < 0.8) {
      issues++;
      cleanlinessScore -= 0.3; // Heavy penalty for CRLF inconsistency
    }

    // Check for problematic control characters
    totalChecks++;
    const cleanOutput = output.replace(TerminalQualityAnalyzer.VALIDATION_PATTERNS.ANSI_COLOR_CODES, '');
    if (TerminalQualityAnalyzer.VALIDATION_PATTERNS.PROBLEMATIC_CONTROL_CHARS.test(cleanOutput)) {
      issues++;
      cleanlinessScore -= 0.2;
    }

    // Check for prompt duplication patterns
    totalChecks++;
    if (TerminalQualityAnalyzer.VALIDATION_PATTERNS.DUPLICATED_PROMPT.test(output)) {
      issues++;
      cleanlinessScore -= 0.15;
    }

    // Check for command echo duplication
    totalChecks++;
    if (TerminalQualityAnalyzer.VALIDATION_PATTERNS.DUPLICATED_COMMAND.test(output)) {
      issues++;
      cleanlinessScore -= 0.15;
    }

    // Check for excessive whitespace or formatting issues
    totalChecks++;
    const lines = output.split('\n');
    let excessiveWhitespace = 0;
    let emptyLineStreaks = 0;
    let currentEmptyStreak = 0;

    for (const line of lines) {
      if (line.trim() === '') {
        currentEmptyStreak++;
        if (currentEmptyStreak > 3) {
          excessiveWhitespace++;
        }
      } else {
        if (currentEmptyStreak > 2) {
          emptyLineStreaks++;
        }
        currentEmptyStreak = 0;
        
        // Check for lines with excessive trailing whitespace
        if (line !== line.trimEnd() && line.trimEnd().length > 0) {
          excessiveWhitespace++;
        }
      }
    }

    const whitespaceIssueRatio = (excessiveWhitespace + emptyLineStreaks) / Math.max(1, lines.length / 10);
    if (whitespaceIssueRatio > 0.1) {
      issues++;
      cleanlinessScore -= Math.min(0.1, whitespaceIssueRatio * 0.05);
    }

    // Check for proper encoding (no garbled characters)
    totalChecks++;
    const encoding = /[\uFFFD\u00C2\u00A0]/.test(output); // Common encoding issues
    if (encoding) {
      issues++;
      cleanlinessScore -= 0.1;
    }

    return Math.max(0, Math.min(1, cleanlinessScore));
  }

  /**
   * Validate line ending consistency
   */
  validateLineEndingConsistency(output: string): number {
    const crlfCount = (output.match(TerminalQualityAnalyzer.VALIDATION_PATTERNS.CRLF_LINE_ENDINGS) || []).length;
    const lfCount = (output.match(TerminalQualityAnalyzer.VALIDATION_PATTERNS.LF_LINE_ENDINGS) || []).length;
    
    return crlfCount > 0 ? crlfCount / lfCount : 0;
  }

  /**
   * Validate prompt consistency throughout output
   */
  validatePromptConsistency(output: string): number {
    // REAL VALIDATION LOGIC: Check for consistent prompt formatting throughout the output
    const lines = output.split('\n');
    const promptPatterns = new Map<string, number>();
    let totalPrompts = 0;

    for (const line of lines) {
      if (TerminalQualityAnalyzer.VALIDATION_PATTERNS.OLD_PROMPT_FORMAT.test(line) || 
          TerminalQualityAnalyzer.VALIDATION_PATTERNS.BRACKET_PROMPT_FORMAT.test(line)) {
        
        totalPrompts++;
        
        // Extract prompt pattern (everything before the command)
        const promptMatch = line.match(/^(.+\$)\s*(.*)$/);
        if (promptMatch) {
          const promptPart = promptMatch[1];
          const currentCount = promptPatterns.get(promptPart) || 0;
          promptPatterns.set(promptPart, currentCount + 1);
        }
      }
    }

    if (totalPrompts === 0) return TerminalQualityAnalyzer.QUALITY_THRESHOLDS.EXCELLENT;

    // Calculate consistency - higher score for fewer distinct patterns
    const uniquePatterns = promptPatterns.size;
    const dominantPattern = Math.max(...promptPatterns.values());
    const consistency = dominantPattern / totalPrompts;
    
    // Penalty for too many different prompt patterns
    const varietyPenalty = Math.max(0, (uniquePatterns - 2) * 0.1);
    
    return Math.max(0, consistency - varietyPenalty);
  }

  /**
   * Validate overall output structure quality
   */
  validateOutputStructure(output: string): number {
    // REAL VALIDATION LOGIC: Validate overall output structure
    const lines = output.split('\n');
    let structureScore = 1.0;
    let structuralIssues = 0;

    // Check for proper command-response structure
    let expectedPromptNext = false;
    let commandsWithoutResults = 0;
    let orphanedResults = 0;
    let properCommandResponsePairs = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (TerminalQualityAnalyzer.VALIDATION_PATTERNS.OLD_PROMPT_FORMAT.test(line) || 
          TerminalQualityAnalyzer.VALIDATION_PATTERNS.BRACKET_PROMPT_FORMAT.test(line)) {
        
        const commandMatch = line.match(/\$\s*(.+)$/);
        if (commandMatch && commandMatch[1].trim()) {
          // Found a command - look for corresponding result
          let foundResult = false;
          
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const nextLine = lines[j];
            
            // Skip empty lines and direct command echoes
            if (nextLine.trim() === '' || nextLine === commandMatch[1]) {
              continue;
            }
            
            // If we hit another prompt before finding results, this is problematic
            if (TerminalQualityAnalyzer.VALIDATION_PATTERNS.OLD_PROMPT_FORMAT.test(nextLine) || 
                TerminalQualityAnalyzer.VALIDATION_PATTERNS.BRACKET_PROMPT_FORMAT.test(nextLine)) {
              break;
            }
            
            // Found result content
            if (nextLine.trim().length > 0) {
              foundResult = true;
              properCommandResponsePairs++;
              break;
            }
          }
          
          if (!foundResult) {
            commandsWithoutResults++;
            structuralIssues++;
          }
        }
      } else if (line.trim().length > 0) {
        // Non-prompt content - check if it's an orphaned result
        if (expectedPromptNext) {
          orphanedResults++;
          structuralIssues++;
        }
      }
    }

    // Calculate structural quality
    const totalCommands = properCommandResponsePairs + commandsWithoutResults;
    if (totalCommands > 0) {
      const structureRatio = properCommandResponsePairs / totalCommands;
      structureScore = structureRatio;
    }

    // Apply penalties for structural issues
    const issueRatio = structuralIssues / Math.max(1, lines.length / 5);
    structureScore -= Math.min(0.5, issueRatio * 0.1);

    // Check for excessive fragmentation (too many short lines)
    const shortLines = lines.filter(line => line.trim().length > 0 && line.trim().length < 3).length;
    const fragmentationRatio = shortLines / Math.max(1, lines.length);
    if (fragmentationRatio > 0.3) {
      structureScore -= 0.1;
    }

    return Math.max(0, structureScore);
  }

  /**
   * Validate professional display standards
   */
  validateProfessionalDisplay(workflowResult: WorkflowResult): {
    professionalDisplay: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const output = workflowResult.concatenatedResponses;
    
    // Check for professional terminal formatting
    const hasCRLF = output.includes('\r\n');
    const hasProperPrompts = this.validatePromptFormatting(output);
    const noEchoDuplication = this.validateNoEchoDuplication(output);
    const cleanFormatting = this.validateCleanFormatting(output);

    const professionalDisplay = hasCRLF && hasProperPrompts && noEchoDuplication && cleanFormatting;
    
    if (!hasCRLF) warnings.push('Missing CRLF line endings for xterm.js compatibility');
    if (!hasProperPrompts) warnings.push('Improper prompt formatting detected');
    if (!noEchoDuplication) warnings.push('Echo duplication detected');
    if (!cleanFormatting) warnings.push('Terminal formatting issues detected');

    return { professionalDisplay, warnings };
  }

  /**
   * Validate column alignment for tabular data
   */
  validateColumnAlignment(output: string): number {
    // REAL VALIDATION LOGIC: Validate tabular data column alignment
    const lines = output.split('\n').filter(line => line.trim().length > 0);
    let tabularBlocks = 0;
    let wellAlignedBlocks = 0;

    // Define tabular patterns commonly seen in command output
    const tabularIndicators = [
      /\s+PID\s+USER\s+/,           // ps aux
      /Filesystem\s+Size\s+Used\s+Avail\s+Use%/, // df -h
      /Proto\s+Recv-Q\s+Send-Q/,   // netstat
      /\s+USER\s+TTY\s+/,          // who
      /\w+\s+\w+\s+\w+\s+\d+/      // Generic columnar pattern
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line indicates tabular data
      if (tabularIndicators.some(pattern => pattern.test(line))) {
        tabularBlocks++;
        
        // Analyze the next few lines for alignment consistency
        let alignmentScore = 0;
        let columnarLines = 0;
        
        for (let j = i; j < Math.min(i + 10, lines.length); j++) {
          const currentLine = lines[j];
          const nextLine = lines[j + 1];
          
          if (!nextLine) break;
          
          // Split by multiple spaces to identify columns
          const currentColumns = currentLine.split(/\s{2,}/);
          const nextColumns = nextLine.split(/\s{2,}/);
          
          if (currentColumns.length > 1 && nextColumns.length > 1) {
            columnarLines++;
            
            // Check column alignment by comparing starting positions
            let alignedColumns = 0;
            const currentPositions = this.getColumnPositions(currentLine);
            const nextPositions = this.getColumnPositions(nextLine);
            
            const minColumns = Math.min(currentPositions.length, nextPositions.length);
            for (let k = 0; k < minColumns; k++) {
              // Allow 2-character tolerance for alignment
              if (Math.abs(currentPositions[k] - nextPositions[k]) <= 2) {
                alignedColumns++;
              }
            }
            
            if (minColumns > 0) {
              alignmentScore += alignedColumns / minColumns;
            }
          }
        }
        
        // Calculate average alignment for this block
        if (columnarLines > 0) {
          const blockAlignment = alignmentScore / columnarLines;
          if (blockAlignment >= TerminalQualityAnalyzer.QUALITY_THRESHOLDS.MINIMUM_ACCEPTABLE) {
            wellAlignedBlocks++;
          }
        }
        
        // Skip ahead to avoid re-processing the same block
        i += Math.min(10, columnarLines);
      }
    }

    return tabularBlocks === 0 ? 
      TerminalQualityAnalyzer.QUALITY_THRESHOLDS.EXCELLENT : 
      (wellAlignedBlocks / tabularBlocks);
  }

  /**
   * Analyze text processing command output quality
   */
  analyzeTextProcessingOutput(output: string): number {
    // REAL VALIDATION LOGIC: Analyze text processing command output quality
    // Remove unused variable
    let qualityChecks = 0;
    let passedChecks = 0;

    // Check for common text processing command patterns
    const textProcessingPatterns = [
      /grep.*:/,                    // grep with line numbers/filenames
      /\d+\s+\d+\s+\d+\s+\S+/,    // wc output (lines words chars filename)
      /\|\s*head/,                  // piped head
      /\|\s*tail/,                  // piped tail  
      /\|\s*sort/,                  // piped sort
      /\|\s*uniq/,                  // piped uniq
      /\|\s*awk/,                   // piped awk
      /\|\s*sed/                    // piped sed
    ];

    const lines = output.split('\n');
    let textProcessingFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect text processing commands
      if (textProcessingPatterns.some(pattern => pattern.test(line))) {
        textProcessingFound = true;
        qualityChecks++;
        
        // Analyze result quality in subsequent lines
        let hasResults = false;
        let resultsWellFormatted = true;
        
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const resultLine = lines[j];
          
          // Skip prompts and command echoes
          if (TerminalQualityAnalyzer.VALIDATION_PATTERNS.OLD_PROMPT_FORMAT.test(resultLine) || 
              TerminalQualityAnalyzer.VALIDATION_PATTERNS.BRACKET_PROMPT_FORMAT.test(resultLine)) {
            break;
          }
          
          if (resultLine.trim().length > 0) {
            hasResults = true;
            
            // Check for formatting issues
            if (resultLine.includes('\u0000') || // null characters
                resultLine.includes('\uFFFD') ||  // replacement characters
                /[\x00-\x08\x0E-\x1F\x7F]/.test(resultLine)) { // control characters
              resultsWellFormatted = false;
            }
          }
        }
        
        if (hasResults && resultsWellFormatted) {
          passedChecks++;
        }
      }
    }

    // If no text processing found, assume excellent (not applicable)
    if (!textProcessingFound) {
      return TerminalQualityAnalyzer.QUALITY_THRESHOLDS.EXCELLENT;
    }

    // Calculate quality based on well-formatted text processing results
    // const basicQuality = qualityChecks > 0 ? passedChecks / qualityChecks : 1.0;
    
    // Additional checks for text processing quality
    
    // Check for proper encoding handling
    qualityChecks++;
    const hasEncodingIssues = /[\uFFFD\u00C2\u00A0]/.test(output);
    if (!hasEncodingIssues) {
      passedChecks++;
    }
    
    // Check for proper line handling (no excessive truncation)
    qualityChecks++;
    const excessiveTruncation = output.includes('...') && 
      (output.match(/\.\.\./g) || []).length > lines.length * 0.1;
    if (!excessiveTruncation) {
      passedChecks++;
    }
    
    // Check for proper whitespace handling
    qualityChecks++;
    const properWhitespace = !(/\t{5,}/.test(output) || /\s{20,}/.test(output));
    if (properWhitespace) {
      passedChecks++;
    }

    return Math.max(0, passedChecks / qualityChecks);
  }

  /**
   * Helper method to find column starting positions in a line
   */
  private getColumnPositions(line: string): number[] {
    const positions: number[] = [];
    const columns = line.split(/\s{2,}/);
    let currentPos = 0;
    
    for (let i = 0; i < columns.length; i++) {
      const columnIndex = line.indexOf(columns[i], currentPos);
      if (columnIndex !== -1) {
        positions.push(columnIndex);
        currentPos = columnIndex + columns[i].length;
      }
    }
    
    return positions;
  }

  /**
   * Helper methods for validation
   */
  private validatePromptFormatting(output: string): boolean {
    // Check for both old and new bracket format prompts
    const oldFormatPattern = TerminalQualityAnalyzer.VALIDATION_PATTERNS.OLD_PROMPT_FORMAT;
    const bracketFormatPattern = TerminalQualityAnalyzer.VALIDATION_PATTERNS.BRACKET_PROMPT_FORMAT;
    
    return oldFormatPattern.test(output) || bracketFormatPattern.test(output);
  }

  private validateNoEchoDuplication(output: string): boolean {
    // Check for common echo duplication patterns
    const duplicatedPromptPattern = TerminalQualityAnalyzer.VALIDATION_PATTERNS.DUPLICATED_PROMPT;
    const duplicatedCommandPattern = TerminalQualityAnalyzer.VALIDATION_PATTERNS.DUPLICATED_COMMAND;
    
    return !duplicatedPromptPattern.test(output) && !duplicatedCommandPattern.test(output);
  }

  private validateCleanFormatting(output: string): boolean {
    // Allow ANSI escape sequences (color codes) but check for other problematic control characters
    // ANSI sequences start with \x1b[ (ESC[) and are common in terminal output
    const cleanOutput = output.replace(TerminalQualityAnalyzer.VALIDATION_PATTERNS.ANSI_COLOR_CODES, ''); // Remove ANSI color codes
    
    // Check for problematic control characters (excluding ANSI sequences, CR, LF, and Tab)
    const hasProblematicControlChars = TerminalQualityAnalyzer.VALIDATION_PATTERNS.PROBLEMATIC_CONTROL_CHARS.test(cleanOutput);
    return !hasProblematicControlChars;
  }

  /**
   * Calculate echo quality grade
   */
  calculateEchoQuality(output: string): 'excellent' | 'good' | 'poor' {
    const commandEchoQuality = this.analyzeCommandEchoQuality(output);
    const resultSeparationQuality = this.analyzeResultSeparationQuality(output);
    const overallCleanliness = this.analyzeOverallCleanliness(output);

    if (commandEchoQuality >= TerminalQualityAnalyzer.QUALITY_THRESHOLDS.EXCELLENT && 
        resultSeparationQuality >= TerminalQualityAnalyzer.QUALITY_THRESHOLDS.EXCELLENT && 
        overallCleanliness >= TerminalQualityAnalyzer.QUALITY_THRESHOLDS.EXCELLENT) {
      return 'excellent';
    } else if (commandEchoQuality >= TerminalQualityAnalyzer.QUALITY_THRESHOLDS.GOOD && 
               resultSeparationQuality >= TerminalQualityAnalyzer.QUALITY_THRESHOLDS.GOOD && 
               overallCleanliness >= TerminalQualityAnalyzer.QUALITY_THRESHOLDS.GOOD) {
      return 'good';
    } else {
      return 'poor';
    }
  }

  /**
   * Calculate terminal formatting grade
   */
  calculateTerminalFormatting(output: string): 'clean' | 'acceptable' | 'poor' {
    const lineEndingConsistency = this.validateLineEndingConsistency(output);
    const promptConsistency = this.validatePromptConsistency(output);
    const outputStructure = this.validateOutputStructure(output);

    if (lineEndingConsistency >= TerminalQualityAnalyzer.QUALITY_THRESHOLDS.EXCELLENT && 
        promptConsistency >= TerminalQualityAnalyzer.QUALITY_THRESHOLDS.EXCELLENT && 
        outputStructure >= TerminalQualityAnalyzer.QUALITY_THRESHOLDS.EXCELLENT) {
      return 'clean';
    } else if (lineEndingConsistency >= TerminalQualityAnalyzer.QUALITY_THRESHOLDS.GOOD && 
               promptConsistency >= TerminalQualityAnalyzer.QUALITY_THRESHOLDS.GOOD && 
               outputStructure >= TerminalQualityAnalyzer.QUALITY_THRESHOLDS.GOOD) {
      return 'acceptable';
    } else {
      return 'poor';
    }
  }
}