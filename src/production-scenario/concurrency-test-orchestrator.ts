/**
 * Concurrency Test Orchestrator - CLAUDE.md Foundation #6 compliant
 * 
 * Focused component for orchestrating concurrent user sessions and multi-user scenarios
 * Part of Production Scenario Validator refactoring to follow KISS principle
 */

import { ProductionScenarioExecutor, ProductionScenarioConfig, ProductionValidationResult } from './production-scenario-executor';

export interface ConcurrentUserScenario {
  name: string;
  description: string;
  sessionCount: number;
  commandsPerSession: number;
  expectedDuration: number;
  userIsolationRequired?: boolean;
}

export interface MultiUserScenario {
  name: string;
  description: string;
  userCount: number;
  sessionsPerUser: number;
  commandsPerSession: number;
  expectedDuration: number;
}

export interface ConcurrentSessionResult {
  userId: number;
  sessionId?: number;
  success: boolean;
  professionalDisplay: boolean;
  crossSessionInterference: boolean;
  commandStateSyncWorking: boolean;
  executionTime: number;
  errors: string[];
}

export interface ConcurrencyTestResult {
  success: boolean;
  sessions: ConcurrentSessionResult[];
  concurrentExecutionSuccessful: boolean;
  userIsolationMaintained: boolean;
  systemStableUnderLoad: boolean;
  performanceImpact: {
    degradationPercentage: number;
    acceptableDegradation: boolean;
  };
}

export class ConcurrencyTestOrchestrator {
  private executor: ProductionScenarioExecutor;

  // Named constants - CLAUDE.md Foundation #8 compliance
  private static readonly CONCURRENCY_LIMITS = {
    MAX_CONCURRENT_SESSIONS: 10,
    MAX_USERS: 5,
    MAX_SESSIONS_PER_USER: 3,
    ACCEPTABLE_PERFORMANCE_DEGRADATION: 0.3, // 30%
    MIN_SUCCESS_RATE: 0.9 // 90% of sessions must succeed
  };

  // Removed unused constants for now

  constructor(executor: ProductionScenarioExecutor) {
    this.executor = executor;
  }

  /**
   * Execute concurrent user scenario (AC 2.5)
   */
  async executeConcurrentUserScenario(scenario: ConcurrentUserScenario): Promise<ConcurrencyTestResult> {
    const concurrentSessions: Promise<ConcurrentSessionResult>[] = [];
    // const baselineTime = Date.now(); // Not used in current implementation
    
    // Create concurrent sessions for each simulated user
    for (let userId = 0; userId < Math.min(scenario.sessionCount, ConcurrencyTestOrchestrator.CONCURRENCY_LIMITS.MAX_CONCURRENT_SESSIONS); userId++) {
      const sessionScenario: ProductionScenarioConfig = {
        name: `concurrent-user-${userId}`,
        description: `Concurrent user ${userId} session`,
        commands: this.executor.generateConcurrentUserCommands(scenario.commandsPerSession, userId),
        expectedDuration: scenario.expectedDuration,
        performanceThresholds: {
          maxExecutionTime: scenario.expectedDuration + 15000
        }
      };

      const sessionPromise = this.executeSingleConcurrentSession(sessionScenario, userId, Date.now());
      concurrentSessions.push(sessionPromise);
    }

    // Execute all sessions concurrently and wait for completion
    const sessionResults = await Promise.all(concurrentSessions);
    
    // Analyze concurrent session results
    return this.analyzeConcurrentResults(sessionResults, scenario);
  }

  /**
   * Execute multi-user validation scenario (AC 2.13)
   */
  async executeMultiUserScenario(scenario: MultiUserScenario): Promise<ConcurrencyTestResult> {
    const userPromises: Promise<ConcurrentSessionResult[]>[] = [];

    // Create multiple users with multiple sessions each
    for (let userId = 0; userId < Math.min(scenario.userCount, ConcurrencyTestOrchestrator.CONCURRENCY_LIMITS.MAX_USERS); userId++) {
      const userPromise = this.createMultiSessionUser(userId, scenario.sessionsPerUser, scenario.commandsPerSession, scenario.expectedDuration);
      userPromises.push(userPromise);
    }

    const userResults = await Promise.all(userPromises);
    const flatSessionResults = userResults.flat();
    
    // Analyze multi-user results
    return this.analyzeMultiUserResults(flatSessionResults, scenario);
  }

  /**
   * Test system stability under concurrent load
   */
  async testSystemStabilityUnderLoad(
    concurrentSessions: number, 
    commandsPerSession: number, 
    testDurationMs: number
  ): Promise<{
    systemStable: boolean;
    maxConcurrentSessions: number;
    performanceMetrics: {
      averageResponseTime: number;
      successRate: number;
      errorRate: number;
    };
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    let systemStable = true;
    let maxConcurrentSessions = 0;
    let totalResponseTime = 0;
    let totalSessions = 0;
    let successfulSessions = 0;
    let errorCount = 0;

    // Test increasing concurrent load until system becomes unstable
    for (let currentLoad = 1; currentLoad <= Math.min(concurrentSessions, ConcurrencyTestOrchestrator.CONCURRENCY_LIMITS.MAX_CONCURRENT_SESSIONS); currentLoad += 2) {
      const loadTestScenario: ConcurrentUserScenario = {
        name: `load-test-${currentLoad}`,
        description: `Load test with ${currentLoad} concurrent sessions`,
        sessionCount: currentLoad,
        commandsPerSession,
        expectedDuration: testDurationMs
      };

      try {
        const result = await this.executeConcurrentUserScenario(loadTestScenario);
        totalSessions += result.sessions.length;
        
        for (const session of result.sessions) {
          totalResponseTime += session.executionTime;
          if (session.success) {
            successfulSessions++;
          } else {
            errorCount++;
          }
        }

        // Check if system remains stable at this load
        const successRate = successfulSessions / totalSessions;
        if (successRate >= ConcurrencyTestOrchestrator.CONCURRENCY_LIMITS.MIN_SUCCESS_RATE && result.success) {
          maxConcurrentSessions = currentLoad;
        } else {
          systemStable = false;
          recommendations.push(`System becomes unstable with ${currentLoad} concurrent sessions`);
          break;
        }

      } catch (error) {
        systemStable = false;
        errorCount += currentLoad;
        recommendations.push(`Load test failed at ${currentLoad} sessions: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
    }

    // Calculate final metrics
    const averageResponseTime = totalSessions > 0 ? totalResponseTime / totalSessions : 0;
    const successRate = totalSessions > 0 ? successfulSessions / totalSessions : 0;
    const errorRate = totalSessions > 0 ? errorCount / totalSessions : 0;

    // Generate recommendations based on results
    if (maxConcurrentSessions < 3) {
      recommendations.push('System has low concurrency capacity - consider infrastructure improvements');
    }
    if (averageResponseTime > 10000) { // 10 seconds
      recommendations.push('High response times under load - optimize command processing');
    }
    if (errorRate > 0.1) { // 10% error rate
      recommendations.push('High error rate under concurrent load - improve error handling');
    }

    return {
      systemStable,
      maxConcurrentSessions,
      performanceMetrics: {
        averageResponseTime,
        successRate,
        errorRate
      },
      recommendations
    };
  }

  /**
   * Analyze cross-session interference patterns
   */
  analyzeCrossSessionInterference(sessionResults: ConcurrentSessionResult[]): {
    interferenceDetected: boolean;
    affectedSessions: number;
    interferencePatterns: string[];
  } {
    let interferenceDetected = false;
    let affectedSessions = 0;
    const interferencePatterns: string[] = [];

    for (const session of sessionResults) {
      if (session.crossSessionInterference) {
        interferenceDetected = true;
        affectedSessions++;
        
        if (session.errors.some(error => error.includes('command mixing'))) {
          interferencePatterns.push('Command output mixing between sessions');
        }
        if (session.errors.some(error => error.includes('state leak'))) {
          interferencePatterns.push('Session state leakage detected');
        }
        if (!session.professionalDisplay) {
          interferencePatterns.push('Display quality degradation in concurrent sessions');
        }
      }
    }

    // Remove duplicate patterns
    const uniquePatterns = Array.from(new Set(interferencePatterns));

    return {
      interferenceDetected,
      affectedSessions,
      interferencePatterns: uniquePatterns
    };
  }

  /**
   * Private helper methods
   */
  private async executeSingleConcurrentSession(
    scenario: ProductionScenarioConfig, 
    userId: number,
    _baselineTime: number
  ): Promise<ConcurrentSessionResult> {
    try {
      const startTime = Date.now();
      const result = await this.executor.executeProductionScenario(scenario);
      const executionTime = Date.now() - startTime;
      
      return {
        userId,
        success: result.success,
        professionalDisplay: result.professionalDisplay,
        crossSessionInterference: this.detectCrossSessionInterference(result),
        commandStateSyncWorking: this.validateCommandStateSyncWorking(result),
        executionTime,
        errors: result.errors
      };
    } catch (error) {
      return {
        userId,
        success: false,
        professionalDisplay: false,
        crossSessionInterference: false,
        commandStateSyncWorking: false,
        executionTime: 0,
        errors: [`Session execution failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  private async createMultiSessionUser(
    userId: number, 
    sessionsPerUser: number, 
    commandsPerSession: number, 
    expectedDuration: number
  ): Promise<ConcurrentSessionResult[]> {
    const sessionPromises: Promise<ConcurrentSessionResult>[] = [];
    
    for (let sessionId = 0; sessionId < Math.min(sessionsPerUser, ConcurrencyTestOrchestrator.CONCURRENCY_LIMITS.MAX_SESSIONS_PER_USER); sessionId++) {
      const sessionScenario: ProductionScenarioConfig = {
        name: `multi-user-${userId}-session-${sessionId}`,
        description: `Multi-user testing - User ${userId}, Session ${sessionId}`,
        commands: this.executor.generateConcurrentUserCommands(commandsPerSession, userId),
        expectedDuration
      };

      const sessionPromise = this.executeSingleConcurrentSession(sessionScenario, userId, Date.now())
        .then(result => ({ ...result, sessionId }));
      sessionPromises.push(sessionPromise);
    }

    return Promise.all(sessionPromises);
  }

  private analyzeConcurrentResults(
    sessionResults: ConcurrentSessionResult[], 
    scenario: ConcurrentUserScenario
  ): ConcurrencyTestResult {
    const success = sessionResults.every(result => result.success);
    const userIsolationMaintained = sessionResults.every(s => !s.crossSessionInterference);
    
    // Calculate performance impact
    const averageExecutionTime = sessionResults.reduce((sum, r) => sum + r.executionTime, 0) / sessionResults.length;
    const expectedSingleSessionTime = scenario.expectedDuration;
    const degradationPercentage = Math.max(0, (averageExecutionTime - expectedSingleSessionTime) / expectedSingleSessionTime);
    const acceptableDegradation = degradationPercentage <= ConcurrencyTestOrchestrator.CONCURRENCY_LIMITS.ACCEPTABLE_PERFORMANCE_DEGRADATION;

    return {
      success,
      sessions: sessionResults,
      concurrentExecutionSuccessful: success,
      userIsolationMaintained,
      systemStableUnderLoad: success && userIsolationMaintained && acceptableDegradation,
      performanceImpact: {
        degradationPercentage,
        acceptableDegradation
      }
    };
  }

  private analyzeMultiUserResults(
    sessionResults: ConcurrentSessionResult[], 
    scenario: MultiUserScenario
  ): ConcurrencyTestResult {
    const success = sessionResults.every(session => session.success);
    // const userIsolationMaintained = sessionResults.every(session => !session.crossSessionInterference);
    
    // Group by user to check per-user isolation
    const userGroups = new Map<number, ConcurrentSessionResult[]>();
    for (const session of sessionResults) {
      if (!userGroups.has(session.userId)) {
        userGroups.set(session.userId, []);
      }
      userGroups.get(session.userId)!.push(session);
    }

    // Check if each user's sessions remained isolated
    let allUsersIsolated = true;
    for (const [_userId, userSessions] of userGroups) {
      const userIsolated = userSessions.every(session => !session.crossSessionInterference);
      if (!userIsolated) {
        allUsersIsolated = false;
      }
    }

    // Calculate performance impact across all users
    const averageExecutionTime = sessionResults.reduce((sum, r) => sum + r.executionTime, 0) / sessionResults.length;
    const expectedTime = scenario.expectedDuration;
    const degradationPercentage = Math.max(0, (averageExecutionTime - expectedTime) / expectedTime);
    const acceptableDegradation = degradationPercentage <= ConcurrencyTestOrchestrator.CONCURRENCY_LIMITS.ACCEPTABLE_PERFORMANCE_DEGRADATION;

    return {
      success,
      sessions: sessionResults,
      concurrentExecutionSuccessful: success,
      userIsolationMaintained: allUsersIsolated,
      systemStableUnderLoad: success && allUsersIsolated && acceptableDegradation,
      performanceImpact: {
        degradationPercentage,
        acceptableDegradation
      }
    };
  }

  private detectCrossSessionInterference(result: ProductionValidationResult): boolean {
    // Simple interference detection based on professional display degradation
    // and command state sync issues
    return !result.professionalDisplay || result.echoQuality === 'poor';
  }

  private validateCommandStateSyncWorking(result: ProductionValidationResult): boolean {
    // Command state sync is working if the overall result is successful
    // and display quality is maintained
    return result.success && result.professionalDisplay && result.echoQuality !== 'poor';
  }
}