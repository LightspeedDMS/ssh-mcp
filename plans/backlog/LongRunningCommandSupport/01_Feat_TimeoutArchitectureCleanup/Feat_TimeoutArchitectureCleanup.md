# Feature: Timeout Architecture Cleanup

## Feature Overview
**Feature ID:** 01_Feat_TimeoutArchitectureCleanup
**Epic:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning

## Problem Statement
[Conversation Reference: User stated "Remove echo suppression system (100ms window) - over-engineered for current architecture", "Remove queue staleness timeouts (5-minute expiry) - replace with infinite wait + explicit cancellation", "Remove command state cleanup (30-second GC) - unnecessary metadata cleanup", "Remove activity-reset timeout - replace with infinite real timeout"]

Current timeout architecture contains four over-engineered systems that must be completely removed to enable infinite wait + explicit cancellation model.

## Solution Approach
[Conversation Reference: User specified complete removal of timeout systems as foundation for new architecture]

Remove all existing timeout mechanisms to create clean foundation for threaded task execution with infinite wait capability.

## User Stories

### Story Breakdown
- [ ] **01_Story_EchoSuppressionRemoval** - Remove 100ms echo suppression window system
- [ ] **02_Story_QueueStalenessRemoval** - Remove 5-minute queue expiry timeouts
- [ ] **03_Story_CommandCleanupRemoval** - Remove 30-second GC metadata cleanup
- [ ] **04_Story_ActivityResetRemoval** - Remove activity-reset timeout system

## Acceptance Criteria

### Echo Suppression System Removal
[Conversation Reference: User specified "Remove echo suppression system (100ms window) - over-engineered for current architecture"]

```gherkin
Given the current echo suppression system with 100ms window
When timeout architecture cleanup is implemented
Then the echo suppression timing window is completely removed
And no command output suppression occurs based on timing
And all command output is immediately available for processing
```

### Queue Staleness Timeout Removal
[Conversation Reference: User specified "Remove queue staleness timeouts (5-minute expiry) - replace with infinite wait + explicit cancellation"]

```gherkin
Given the current 5-minute queue expiry system
When timeout architecture cleanup is implemented
Then the 5-minute queue staleness timeout is completely removed
And commands wait infinitely until explicit cancellation
And no automatic queue expiration occurs
```

### Command State Cleanup Removal
[Conversation Reference: User specified "Remove command state cleanup (30-second GC) - unnecessary metadata cleanup"]

```gherkin
Given the current 30-second GC metadata cleanup system
When timeout architecture cleanup is implemented
Then the 30-second command state cleanup is completely removed
And command metadata persists until explicitly cleared
And no automatic garbage collection of command state occurs
```

### Activity Reset Timeout Removal
[Conversation Reference: User specified "Remove activity-reset timeout - replace with infinite real timeout"]

```gherkin
Given the current activity-reset timeout system
When timeout architecture cleanup is implemented
Then the activity-reset timeout mechanism is completely removed
And commands continue indefinitely without activity-based resets
And only explicit cancellation can terminate commands
```

## Technical Implementation

### Code Removal Targets
[Conversation Reference: Based on user's specific timeout system identification]

- **Echo Suppression Logic**: Remove 100ms window timing code
- **Queue Expiry Timers**: Remove 5-minute staleness checking
- **Metadata GC System**: Remove 30-second cleanup intervals
- **Activity Reset Handlers**: Remove timeout-based command termination

### Cleanup Requirements
- **Timer Cleanup**: Clear all timeout intervals and handlers
- **State Cleanup**: Remove timeout-related session state fields
- **Logic Cleanup**: Remove conditional timeout handling code
- **Event Cleanup**: Remove timeout-triggered event handlers

## Dependencies
**Prerequisite**: This is the foundation feature for the entire epic
**Blocks**: All subsequent features depend on clean timeout removal

## Testing Strategy

### Removal Validation
- **Echo Suppression**: Verify immediate command output availability
- **Queue Persistence**: Confirm commands wait indefinitely without expiry
- **State Persistence**: Validate metadata persists without GC cleanup
- **Activity Persistence**: Ensure commands continue without activity-reset termination

### Regression Prevention
- **Existing Functionality**: Ensure core command execution still works
- **WebSocket Communication**: Verify browser communication remains intact
- **Session Management**: Confirm session lifecycle unaffected

## Success Criteria

### Complete Removal
✅ **Echo Suppression**: 100ms window system completely removed
✅ **Queue Staleness**: 5-minute expiry timeouts completely removed
✅ **Command Cleanup**: 30-second GC system completely removed
✅ **Activity Reset**: Activity-reset timeout system completely removed

### Clean Foundation
✅ **No Timeout Dependencies**: No code depends on removed timeout systems
✅ **Infinite Wait Ready**: Architecture prepared for infinite wait implementation
✅ **Explicit Cancellation Ready**: Framework prepared for explicit cancellation system

## Risk Mitigation

### Technical Risks
- **Incomplete Removal**: Timeout code remaining in unexpected locations
  - *Mitigation*: Comprehensive code search and systematic removal
- **Dependency Breaking**: Other systems relying on removed timeout mechanisms
  - *Mitigation*: Thorough dependency analysis before removal

### Functional Risks
- **Core Functionality Impact**: Essential features broken by timeout removal
  - *Mitigation*: Careful testing of all command execution paths
- **WebSocket Communication**: Browser interaction affected by timeout changes
  - *Mitigation*: Verify WebSocket communication patterns remain intact