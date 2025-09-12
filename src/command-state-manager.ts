/**
 * Command State Manager - Echo Suppression Coordination
 * 
 * Provides the temporal coordination that was lost when the terminal locking mechanism
 * was removed. Tracks command submission timing to distinguish SSH echo from legitimate output.
 * 
 * Solution designed by elite-software-architect to restore proper echo suppression.
 */

interface CommandState {
  command: string;
  timestamp: number;
  echoWindow: boolean;
  echoSeen: boolean;
  resultSeen: boolean;
}

export class CommandStateManager {
  private states = new Map<string, CommandState>();
  
  /**
   * Track command submission - opens echo window
   */
  onCommandSubmit(sessionId: string, command: string): void {
    const state: CommandState = {
      command,
      timestamp: Date.now(),
      echoWindow: true,
      echoSeen: false,
      resultSeen: false
    };
    
    this.states.set(sessionId, state);
    
    // Close echo window after SSH round-trip time
    setTimeout(() => {
      const currentState = this.states.get(sessionId);
      if (currentState && currentState.timestamp === state.timestamp) {
        currentState.echoWindow = false;
      }
    }, 100); // Increased from 50ms to be safer
  }
  
  /**
   * Process SSH output - suppress echo within window
   */
  processOutput(sessionId: string, data: Buffer): Buffer {
    const state = this.states.get(sessionId);
    if (!state) return data;
    
    const output = data.toString();
    
    // Within echo window AND matches command AND not yet seen?
    if (state.echoWindow && 
        !state.echoSeen && 
        this.isCommandEcho(output, state.command)) {
      
      state.echoSeen = true;
      console.log(`[CommandStateManager] Suppressing echo for command: ${state.command}`);
      
      // Remove the command echo line but preserve the rest
      return Buffer.from(this.removeCommandEcho(output, state.command));
    }
    
    return data;
  }
  
  /**
   * Detect if output contains command echo
   */
  private isCommandEcho(output: string, command: string): boolean {
    // Look for patterns like: "[user@host ~]$ pwd" or just "pwd"
    const lines = output.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      // Exact match for command
      if (trimmed === command) {
        return true;
      }
      // Command at end of prompt line
      if (trimmed.endsWith('$ ' + command) || trimmed.endsWith('# ' + command)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Remove command echo from output while preserving structure
   */
  private removeCommandEcho(output: string, command: string): string {
    const lines = output.split(/\r?\n/);
    const filtered: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip lines that are just the command
      if (trimmed === command) {
        continue;
      }
      
      // For prompt lines ending with command, keep prompt but remove command
      if (trimmed.endsWith('$ ' + command)) {
        const promptPart = line.substring(0, line.lastIndexOf(command));
        filtered.push(promptPart);
        continue;
      }
      
      if (trimmed.endsWith('# ' + command)) {
        const promptPart = line.substring(0, line.lastIndexOf(command));
        filtered.push(promptPart);
        continue;
      }
      
      // Keep all other lines
      filtered.push(line);
    }
    
    return filtered.join('\r\n');
  }
  
  /**
   * Mark command as complete - cleanup state
   */
  onCommandComplete(sessionId: string): void {
    this.states.delete(sessionId);
  }
  
  /**
   * Get current command state for debugging
   */
  getState(sessionId: string): CommandState | undefined {
    return this.states.get(sessionId);
  }
  
  /**
   * Clean up old states (garbage collection)
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 30000; // 30 seconds
    
    for (const [sessionId, state] of this.states.entries()) {
      if (now - state.timestamp > maxAge) {
        this.states.delete(sessionId);
      }
    }
  }
}