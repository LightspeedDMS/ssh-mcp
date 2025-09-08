# Feature: Browser Command Tracking

## Feature Description

Server-side tracking and buffering of all commands executed directly in browser terminals. This foundational capability enables state synchronization by maintaining a simple array of user commands until MCP client notification.

## Technical Architecture

### Component Integration
```
Browser Terminal Input → WebSocket Message → handleTerminalInputMessage() → Command Buffer Array
```

### Data Structure
```
SessionData {
  // ... existing fields
  browserCommandBuffer: string[]  // Simple array of command strings
  lastBrowserCommandTime: number  // Timestamp of most recent command
}
```

### Implementation Points
- **WebSocket Interception**: `WebServerManager.handleTerminalInputMessage()`
- **Buffer Management**: Enhanced `SessionData` interface in `ssh-connection-manager.ts`
- **Command Capture**: Intercept terminal input before SSH execution

## Story Implementation Order

- [ ] 01_Story_ServerSideCommandCapture
- [ ] 02_Story_SessionDataBufferIntegration
- [ ] 03_Story_TransparentUserExperience

## Dependencies

**Prerequisites**: None - foundational feature
**Enables**: All subsequent features (02_Feat_MCPCommandGating, 03_Feat_CommandCancellation, 04_Feat_NuclearFallback)

## Integration Requirements

### WebSocket Message Flow
1. User types command in browser terminal
2. WebSocket message received by `handleTerminalInputMessage()`
3. Command string added to `browserCommandBuffer` array
4. Command proceeds to SSH execution normally
5. User experience remains unchanged

### SessionData Enhancement
```
interface SessionData {
  // ... existing fields
  browserCommandBuffer: string[];
  bufferCreatedAt?: number;
}
```

## Success Criteria

- ✅ **100% Command Capture**: All browser terminal commands tracked in buffer
- ✅ **Zero User Impact**: Terminal experience unchanged for users
- ✅ **Session Isolation**: Command buffers separated per SSH session
- 📊 **Buffer Persistence**: Commands remain until explicitly cleared
- ⚙️ **Integration Ready**: Buffer accessible for subsequent gating features

## Testing Requirements

### Unit Tests
- Command interception in WebSocket message handler
- SessionData buffer array management
- Session isolation validation

### Integration Tests  
- End-to-end command capture via browser terminal
- Buffer persistence across multiple commands
- WebSocket message flow validation

### E2E Tests
- Real browser terminal interaction with command verification
- Multiple concurrent session command isolation
- Buffer state validation using Villenele framework

This feature establishes the foundational command tracking capability required for all state synchronization functionality.