# Story: Command Cleanup Removal

## Story Overview
**Story ID:** 03_Story_CommandCleanupRemoval
**Feature:** 01_Feat_TimeoutArchitectureCleanup
**Epic:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning

## User Story
[Conversation Reference: User stated "Remove command state cleanup (30-second GC) - unnecessary metadata cleanup"]

As a system administrator managing command state
I want automatic command cleanup removed
So that command metadata persists until explicitly cleared instead of arbitrary garbage collection

## Problem Context
[Conversation Reference: User identified 30-second GC as "unnecessary metadata cleanup"]

The current 30-second garbage collection system for command metadata introduces unnecessary complexity and interferes with command state persistence required for background task polling.

## Acceptance Criteria

### Command State Cleanup Removal
[Conversation Reference: User specified "Remove command state cleanup (30-second GC)"]

```gherkin
Given the current command state management with 30-second GC
When commands complete execution
Then no automatic metadata cleanup occurs
And command state persists indefinitely
And no garbage collection timers trigger
```

### Metadata Persistence
[Conversation Reference: User emphasized unnecessary nature of automatic cleanup]

```gherkin
Given command metadata exists in session state
When 30 seconds elapse after command completion
Then the metadata remains fully accessible
And no automatic cleanup occurs
And state persistence is maintained for polling access
```

### Explicit Cleanup Only
```gherkin
Given command state requires cleanup
When cleanup is necessary
Then only explicit cleanup mechanisms are available
And no automatic garbage collection occurs
And metadata persists until explicitly removed
```

## Technical Implementation

### Code Removal Targets
[Conversation Reference: Based on user's identification of 30-second GC system]

- **GC Timer Logic**: Remove 30-second cleanup intervals
- **Metadata Cleanup Handlers**: Remove automatic state clearing
- **Garbage Collection State**: Remove GC tracking mechanisms
- **Cleanup Triggers**: Remove timeout-based cleanup events

### Implementation Steps
1. **Identify GC Code**: Locate all 30-second cleanup logic
2. **Remove Cleanup Timers**: Eliminate automatic metadata cleanup
3. **Preserve State Persistence**: Maintain command metadata indefinitely
4. **Prepare Manual Cleanup**: Ready state for explicit cleanup interfaces

## State Management Changes

### Before: Automatic Cleanup
```
Command Complete → 30 Second Timer → Automatic GC → Metadata Cleared
```

### After: Persistent State
[Conversation Reference: User's metadata persistence model for polling]

```
Command Complete → Persistent State → Explicit Cleanup → Metadata Cleared
```

## Testing Strategy

### Persistence Validation
- **State Retention**: Verify metadata persists beyond 30 seconds
- **No Automatic Cleanup**: Confirm absence of GC timers
- **Long Duration Persistence**: Test state retention over extended periods

### Regression Testing
- **State Access**: Ensure command state remains accessible
- **Session Management**: Verify session lifecycle unaffected
- **Memory Behavior**: Monitor memory usage without automatic cleanup

## Definition of Done

### Functional Requirements
- [ ] 30-second command state cleanup completely removed
- [ ] Command metadata persists indefinitely without GC
- [ ] No automatic garbage collection mechanisms remain
- [ ] State persistence maintained for polling access

### Architecture Requirements
- [ ] Explicit cleanup interface prepared
- [ ] No timing-based state management logic
- [ ] Clean state persistence without GC complexity
- [ ] Metadata retention supports background task polling

### Validation Requirements
- [ ] Command state accessible beyond 30-second threshold
- [ ] No automatic metadata cleanup occurs
- [ ] State persistence maintained across extended durations
- [ ] Memory management stable without automatic GC

## Background Task Polling Support

### State Persistence Requirement
[Conversation Reference: User specified "Store task reference in session for polling"]

- **Polling Access**: Command metadata must persist for status checking
- **Result Retention**: Output and exit codes must remain accessible
- **State History**: Command execution history must be preserved

### Memory Management Considerations
- **Controlled Growth**: Explicit cleanup prevents unbounded growth
- **Session Isolation**: Per-session state prevents cross-contamination
- **Manual Control**: Explicit cleanup provides predictable memory management

## Risk Mitigation

### Memory Management
- **Unbounded Growth**: Metadata accumulating without automatic cleanup
  - *Mitigation*: Explicit cleanup mechanisms in subsequent features
- **Resource Consumption**: Persistent state consuming system resources
  - *Mitigation*: Session-based isolation limits per-session impact

### System Performance
- **Memory Leaks**: State persistence creating memory leaks
  - *Mitigation*: Explicit cleanup interfaces provide controlled memory management
- **Performance Degradation**: Large persistent state affecting performance
  - *Mitigation*: Session isolation and controlled state size limits impact