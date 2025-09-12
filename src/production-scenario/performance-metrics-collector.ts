/**
 * Performance Metrics Collector - CLAUDE.md Foundation #6 compliant  
 * 
 * Focused component for monitoring performance metrics, memory usage, and system stability
 * Part of Production Scenario Validator refactoring to follow KISS principle
 */

import { WorkflowResult } from '../../tests/integration/terminal-history-framework/comprehensive-response-collector';

export interface PerformanceMetrics {
  commandsExecuted: number;
  averageResponseTime: number;
  peakMemoryUsage: number;
  totalExecutionTime: number;
  commandThroughput: number;
  memoryEfficiency: number;
}

export interface PerformanceThresholds {
  maxExecutionTime?: number;
  maxMemoryUsage?: number;
  minResponseTime?: number;
  minCommandThroughput?: number;
}

export class PerformanceMetricsCollector {
  // Named constants for performance limits - CLAUDE.md Foundation #8 compliance
  private static readonly PERFORMANCE_LIMITS = {
    MAX_COMMAND_TIME_MS: 15000,
    MAX_SESSION_TIME_MS: 35 * 60 * 1000, // 35 minutes
    MAX_MEMORY_MB: 512,
    MIN_RESPONSE_TIME_MS: 50,
    MIN_COMMANDS_PER_SECOND: 0.1,
    MAX_MEMORY_PER_COMMAND_MB: 10
  };

  private static readonly PERFORMANCE_GRADES = {
    EXCELLENT_THRESHOLD: 0.95,
    GOOD_THRESHOLD: 0.8,
    ACCEPTABLE_THRESHOLD: 0.6
  };

  /**
   * Collect comprehensive performance metrics from workflow result
   */
  collectPerformanceMetrics(workflowResult: WorkflowResult, commandCount: number, executionTime: number): PerformanceMetrics {
    const baseMetrics = {
      commandsExecuted: commandCount,
      averageResponseTime: commandCount > 0 ? workflowResult.totalExecutionTime / commandCount : 0,
      peakMemoryUsage: process.memoryUsage().heapUsed,
      totalExecutionTime: executionTime
    };

    // Calculate derived metrics
    const commandThroughput = commandCount > 0 ? commandCount / (executionTime / 1000) : 0; // commands per second
    const memoryEfficiency = this.calculateMemoryEfficiency(baseMetrics.peakMemoryUsage, commandCount);

    return {
      ...baseMetrics,
      commandThroughput,
      memoryEfficiency
    };
  }

  /**
   * Validate performance against thresholds
   */
  validatePerformanceThresholds(
    metrics: PerformanceMetrics, 
    thresholds: PerformanceThresholds
  ): { passed: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let passed = true;

    if (thresholds.maxExecutionTime && metrics.totalExecutionTime > thresholds.maxExecutionTime) {
      warnings.push(`Execution time ${metrics.totalExecutionTime}ms exceeded threshold ${thresholds.maxExecutionTime}ms`);
      passed = false;
    }

    if (thresholds.maxMemoryUsage && metrics.peakMemoryUsage > thresholds.maxMemoryUsage) {
      warnings.push(`Memory usage ${Math.round(metrics.peakMemoryUsage / 1024 / 1024)}MB exceeded threshold ${Math.round(thresholds.maxMemoryUsage / 1024 / 1024)}MB`);
      passed = false;
    }

    if (thresholds.minResponseTime && metrics.averageResponseTime < thresholds.minResponseTime) {
      warnings.push(`Response time ${metrics.averageResponseTime}ms too fast - possible mocked responses`);
      passed = false;
    }

    if (thresholds.minCommandThroughput && metrics.commandThroughput < thresholds.minCommandThroughput) {
      warnings.push(`Command throughput ${metrics.commandThroughput.toFixed(2)} commands/sec below threshold ${thresholds.minCommandThroughput}`);
      passed = false;
    }

    return { passed, warnings };
  }

  /**
   * Analyze system stability metrics
   */
  analyzeSystemStability(metrics: PerformanceMetrics, success: boolean): {
    stabilityScore: number;
    memoryLeakDetected: boolean;
    performanceGrade: 'excellent' | 'good' | 'acceptable' | 'poor';
  } {
    let stabilityScore = 1.0;
    let memoryLeakDetected = false;

    // Check for memory efficiency
    const memoryPerCommand = metrics.peakMemoryUsage / Math.max(1, metrics.commandsExecuted);
    const maxReasonableMemoryPerCommand = PerformanceMetricsCollector.PERFORMANCE_LIMITS.MAX_MEMORY_PER_COMMAND_MB * 1024 * 1024; // Convert to bytes
    
    if (memoryPerCommand > maxReasonableMemoryPerCommand) {
      memoryLeakDetected = true;
      stabilityScore -= 0.3;
    }

    // Check command throughput efficiency
    if (metrics.commandThroughput < PerformanceMetricsCollector.PERFORMANCE_LIMITS.MIN_COMMANDS_PER_SECOND) {
      stabilityScore -= 0.2;
    }

    // Check response time consistency
    if (metrics.averageResponseTime > PerformanceMetricsCollector.PERFORMANCE_LIMITS.MAX_COMMAND_TIME_MS) {
      stabilityScore -= 0.2;
    }

    // Factor in overall execution success
    if (!success) {
      stabilityScore -= 0.4;
    }

    // Factor in memory efficiency
    stabilityScore += (metrics.memoryEfficiency - 0.5); // Bonus/penalty based on efficiency

    // Clamp score
    stabilityScore = Math.max(0, Math.min(1, stabilityScore));

    // Determine performance grade
    let performanceGrade: 'excellent' | 'good' | 'acceptable' | 'poor';
    if (stabilityScore >= PerformanceMetricsCollector.PERFORMANCE_GRADES.EXCELLENT_THRESHOLD) {
      performanceGrade = 'excellent';
    } else if (stabilityScore >= PerformanceMetricsCollector.PERFORMANCE_GRADES.GOOD_THRESHOLD) {
      performanceGrade = 'good';
    } else if (stabilityScore >= PerformanceMetricsCollector.PERFORMANCE_GRADES.ACCEPTABLE_THRESHOLD) {
      performanceGrade = 'acceptable';
    } else {
      performanceGrade = 'poor';
    }

    return { stabilityScore, memoryLeakDetected, performanceGrade };
  }

  /**
   * Monitor extended session performance over time
   */
  monitorExtendedSession(sessionDurationMs: number, commandCount: number, memorySnapshots: number[]): {
    sessionStable: boolean;
    memoryTrend: 'increasing' | 'stable' | 'decreasing';
    throughputConsistent: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let sessionStable = true;
    let throughputConsistent = true;

    // Analyze memory trend
    const memoryTrend = this.analyzeMemoryTrend(memorySnapshots);
    
    if (memoryTrend === 'increasing') {
      const memoryIncrease = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
      const increaseRatio = memoryIncrease / memorySnapshots[0];
      
      if (increaseRatio > 0.5) { // 50% increase
        warnings.push('Significant memory increase detected - potential memory leak');
        sessionStable = false;
      }
    }

    // Check session duration limits
    if (sessionDurationMs > PerformanceMetricsCollector.PERFORMANCE_LIMITS.MAX_SESSION_TIME_MS) {
      warnings.push(`Session duration ${Math.round(sessionDurationMs / 1000 / 60)}min exceeded recommended limit`);
      sessionStable = false;
    }

    // Check command throughput consistency
    const expectedThroughput = commandCount / (sessionDurationMs / 1000);
    if (expectedThroughput < PerformanceMetricsCollector.PERFORMANCE_LIMITS.MIN_COMMANDS_PER_SECOND) {
      warnings.push('Command throughput below expected rate for extended session');
      throughputConsistent = false;
    }

    return {
      sessionStable,
      memoryTrend,
      throughputConsistent,
      warnings
    };
  }

  /**
   * Analyze protocol switching performance impact
   */
  analyzeProtocolSwitchingPerformance(
    _totalSwitches: number,
    averageSwitchTime: number,
    performanceDegradation: number
  ): {
    switchingEfficient: boolean;
    degradationAcceptable: boolean;
    performanceScore: number;
  } {
    let performanceScore = 1.0;
    
    // Penalize excessive switching overhead
    const maxAcceptableSwitchTime = 1000; // 1 second per switch
    if (averageSwitchTime > maxAcceptableSwitchTime) {
      performanceScore -= Math.min(0.3, (averageSwitchTime - maxAcceptableSwitchTime) / maxAcceptableSwitchTime);
    }

    // Penalize performance degradation
    const maxAcceptableDegradation = 0.2; // 20%
    if (performanceDegradation > maxAcceptableDegradation) {
      performanceScore -= Math.min(0.4, performanceDegradation - maxAcceptableDegradation);
    }

    const switchingEfficient = averageSwitchTime <= maxAcceptableSwitchTime;
    const degradationAcceptable = performanceDegradation <= maxAcceptableDegradation;

    return {
      switchingEfficient,
      degradationAcceptable,
      performanceScore: Math.max(0, performanceScore)
    };
  }

  /**
   * Create performance assessment report
   */
  createPerformanceReport(metrics: PerformanceMetrics): {
    overallGrade: 'excellent' | 'good' | 'acceptable' | 'poor';
    keyMetrics: Record<string, string | number>;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let scores = 0;
    let totalChecks = 0;

    // Evaluate key performance areas
    
    // 1. Response Time
    totalChecks++;
    if (metrics.averageResponseTime <= 1000) { // < 1 second
      scores++;
    } else if (metrics.averageResponseTime > 5000) { // > 5 seconds
      recommendations.push('Consider optimizing command execution time - responses are slow');
    }

    // 2. Memory Efficiency
    totalChecks++;
    if (metrics.memoryEfficiency >= PerformanceMetricsCollector.PERFORMANCE_GRADES.GOOD_THRESHOLD) {
      scores++;
    } else {
      recommendations.push('Memory usage per command is high - investigate potential memory leaks');
    }

    // 3. Command Throughput
    totalChecks++;
    if (metrics.commandThroughput >= PerformanceMetricsCollector.PERFORMANCE_LIMITS.MIN_COMMANDS_PER_SECOND * 2) {
      scores++;
    } else {
      recommendations.push('Command throughput is low - consider connection or processing optimizations');
    }

    // 4. Resource Usage
    totalChecks++;
    const memoryMB = metrics.peakMemoryUsage / 1024 / 1024;
    if (memoryMB <= PerformanceMetricsCollector.PERFORMANCE_LIMITS.MAX_MEMORY_MB * 0.5) {
      scores++;
    } else if (memoryMB > PerformanceMetricsCollector.PERFORMANCE_LIMITS.MAX_MEMORY_MB) {
      recommendations.push('Peak memory usage exceeds recommended limits');
    }

    // Calculate overall grade
    const overallScore = scores / totalChecks;
    let overallGrade: 'excellent' | 'good' | 'acceptable' | 'poor';
    
    if (overallScore >= PerformanceMetricsCollector.PERFORMANCE_GRADES.EXCELLENT_THRESHOLD) {
      overallGrade = 'excellent';
    } else if (overallScore >= PerformanceMetricsCollector.PERFORMANCE_GRADES.GOOD_THRESHOLD) {
      overallGrade = 'good';
    } else if (overallScore >= PerformanceMetricsCollector.PERFORMANCE_GRADES.ACCEPTABLE_THRESHOLD) {
      overallGrade = 'acceptable';
    } else {
      overallGrade = 'poor';
    }

    const keyMetrics = {
      'Commands Executed': metrics.commandsExecuted,
      'Average Response Time (ms)': Math.round(metrics.averageResponseTime),
      'Peak Memory (MB)': Math.round(memoryMB),
      'Command Throughput (cmd/s)': parseFloat(metrics.commandThroughput.toFixed(3)),
      'Memory Efficiency': parseFloat(metrics.memoryEfficiency.toFixed(3)),
      'Total Execution Time (s)': Math.round(metrics.totalExecutionTime / 1000)
    };

    return { overallGrade, keyMetrics, recommendations };
  }

  /**
   * Helper methods
   */
  private calculateMemoryEfficiency(peakMemoryUsage: number, commandCount: number): number {
    const memoryPerCommand = peakMemoryUsage / Math.max(1, commandCount);
    const optimalMemoryPerCommand = 1024 * 1024; // 1MB per command
    const maxReasonableMemory = PerformanceMetricsCollector.PERFORMANCE_LIMITS.MAX_MEMORY_PER_COMMAND_MB * 1024 * 1024;
    
    // Efficiency score: 1.0 for optimal usage, decreasing as usage increases
    if (memoryPerCommand <= optimalMemoryPerCommand) {
      return 1.0;
    } else if (memoryPerCommand <= maxReasonableMemory) {
      return 1.0 - ((memoryPerCommand - optimalMemoryPerCommand) / (maxReasonableMemory - optimalMemoryPerCommand)) * 0.5;
    } else {
      return 0.5 - Math.min(0.4, (memoryPerCommand - maxReasonableMemory) / maxReasonableMemory * 0.4);
    }
  }

  private analyzeMemoryTrend(snapshots: number[]): 'increasing' | 'stable' | 'decreasing' {
    if (snapshots.length < 2) return 'stable';

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const changeRatio = (last - first) / first;

    if (changeRatio > 0.1) { // 10% increase
      return 'increasing';
    } else if (changeRatio < -0.1) { // 10% decrease
      return 'decreasing';
    } else {
      return 'stable';
    }
  }
}