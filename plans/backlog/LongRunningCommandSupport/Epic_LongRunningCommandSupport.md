# Epic: Long Running Command Support

## Epic Overview
**Epic ID:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning

## Problem Statement
[Conversation Reference: User stated "Remove echo suppression system (100ms window) - over-engineered for current architecture", "Remove queue staleness timeouts (5-minute expiry) - replace with infinite wait + explicit cancellation", "Remove command state cleanup (30-second GC) - unnecessary metadata cleanup", "Remove activity-reset timeout - replace with infinite real timeout"]

Current timeout architecture contains over-engineered systems that need complete removal and replacement with simpler infinite wait + explicit cancellation model.

## Solution Approach
[Conversation Reference: User outlined specific architectural approach: "Use threaded task approach for MCP commands with optional asyncTimeout parameter", "Browser commands infinite wait (no timeout mechanism)", "Timed wait with timeout → return error to MCP client → keep task running in background", "Store task reference in session for polling"]

Replace complex timeout systems with threaded task execution, background task persistence, and explicit cancellation mechanisms.

## Core Design Principles
[Conversation Reference: User specified "KISS approach", "One active task per session, rest queue in FIFO order", "Browser and MCP commands use identical code path"]

1. **Simplicity First**: Remove over-engineered timeout mechanisms
2. **Single Task Model**: One active task per session with FIFO queuing
3. **Unified Code Path**: Browser and MCP commands use identical execution path
4. **Infinite Wait**: No automatic timeouts, only explicit cancellation
5. **Background Persistence**: Tasks continue running after MCP timeout

## Features Implementation Order

### Feature Breakdown
- [ ] **01_Feat_TimeoutArchitectureCleanup** - Remove existing timeout systems
- [ ] **02_Feat_AsyncExecutionViaThreading** - Implement threaded task execution
- [ ] **03_Feat_PollingAPIImplementation** - Background task status checking
- [ ] **04_Feat_UniversalCancellationSystem** - MCP and browser cancellation

### Sequential Dependencies
[Conversation Reference: User requested "conversation plan" with "sequential phases"]

**Phase 1**: Timeout Architecture Cleanup (Foundation)
**Phase 2**: Async Execution via Threading (Core Capability)
**Phase 3**: Polling API Implementation (Status Checking)
**Phase 4**: Universal Cancellation System (Control Mechanism)

## Behavioral Changes
[Conversation Reference: User specified "ssh_exec returns ERROR when going async (not backward compatible)", "WebSocket only sends: successful results + cancellation notifications"]

### Breaking Changes
- **ssh_exec Behavior**: Returns ERROR when transitioning to async mode (intentionally not backward compatible)
- **WebSocket Messaging**: Only sends successful results and cancellation notifications
- **Queue Management**: Single active command with FIFO queue for additional commands

### Error Handling Philosophy
[Conversation Reference: User emphasized "Clean error messages for dead tasks (graceful failure)"]

- **Graceful Failure**: Clean error messages for dead or failed tasks
- **Error Persistence**: Task failures stored for polling retrieval
- **Clear Communication**: Explicit async mode error notifications

## Technical Architecture

### Session State Management
[Conversation Reference: User specified "Store task reference in session for polling"]

- **Task Storage**: Session-based task reference storage
- **State Tracking**: Running/completed/failed/cancelled states
- **Result Persistence**: Task outputs persist until next command

### Cancellation Mechanisms
[Conversation Reference: User detailed "ssh_cancel_command MCP tool", "Browser Ctrl-C capture via WebSocket", "Cancel running command + clear entire queue", "SSH2 library cancellation via stream.write('\x03') + stream.destroy()"]

- **MCP Cancellation**: ssh_cancel_command tool for programmatic cancellation
- **Browser Cancellation**: Ctrl-C capture via WebSocket for user cancellation
- **Queue Clearing**: Cancel active command and clear entire session queue
- **SSH2 Integration**: Use stream.write('\x03') + stream.destroy() for process termination

## Success Criteria

### Core Functionality
[Conversation Reference: Based on user's architectural requirements]

✅ **Timeout Removal**: All echo suppression, queue staleness, and cleanup timeouts removed
✅ **Async Threading**: Commands execute in background threads with asyncTimeout parameter support
✅ **Polling Access**: ssh_get_command_status provides background task status checking
✅ **Universal Cancellation**: Both MCP and browser can cancel any running command
✅ **Error Communication**: Clean async mode error messages with polling instructions
✅ **Queue Management**: Single active task per session with FIFO ordering

### Integration Requirements
✅ **Code Path Unification**: Browser and MCP commands use identical execution path
✅ **WebSocket Notifications**: Cancellation notifications broadcast to browser
✅ **Session Isolation**: Task references stored per session without cross-contamination
✅ **Graceful Degradation**: Dead task detection with clean error messages

## Implementation Strategy

### Development Phases
[Conversation Reference: User requested sequential implementation approach]

**Phase 1: Foundation** - Remove existing timeout architecture completely
**Phase 2: Core Engine** - Implement threaded task execution with session storage
**Phase 3: Status Interface** - Build polling API for background task monitoring
**Phase 4: Control Layer** - Add universal cancellation capabilities

### Testing Approach
[Conversation Reference: Based on user's emphasis on "Clean error messages for dead tasks"]

- **Background Task Validation**: Verify tasks continue after MCP timeout
- **Cancellation Testing**: Validate both MCP and browser cancellation effectiveness
- **Error Message Testing**: Confirm clean error communication for all failure modes
- **Queue Behavior Testing**: Verify FIFO queue management and single task enforcement

## Risk Mitigation

### Technical Risks
- **Process Orphaning**: Tasks continuing without proper cleanup
  - *Mitigation*: Proper SSH2 stream management and signal handling
- **Session State Corruption**: Invalid task references or state inconsistencies
  - *Mitigation*: Session-based isolation and atomic state updates

### Compatibility Risks
- **Breaking Change Impact**: ssh_exec error responses affecting existing integrations
  - *Mitigation*: Clear error messages with migration guidance
- **WebSocket Message Changes**: Modified notification patterns affecting browser clients
  - *Mitigation*: Maintain essential notification delivery while removing unnecessary messages

## Definition of Done

### Functional Completeness
- [ ] All timeout systems (echo suppression, queue staleness, cleanup, activity-reset) completely removed
- [ ] Threaded task execution with asyncTimeout parameter support implemented
- [ ] ssh_get_command_status API providing background task status and results
- [ ] ssh_cancel_command MCP tool with queue clearing capability
- [ ] Browser Ctrl-C cancellation via WebSocket integration
- [ ] Single active task per session with FIFO queue management
- [ ] Unified code path for browser and MCP command execution

### Quality Standards
- [ ] Clean error messages for all failure scenarios (dead tasks, async transitions, cancellations)
- [ ] Session-based task isolation preventing cross-session interference
- [ ] Graceful failure handling with informative error responses
- [ ] WebSocket notification system delivering only successful results and cancellations

### Validation Requirements
- [ ] Background task persistence verified after MCP client timeout
- [ ] Universal cancellation effectiveness confirmed for both MCP and browser sources
- [ ] FIFO queue behavior validated under multiple command scenarios
- [ ] Error message clarity confirmed for async mode transitions and dead tasks