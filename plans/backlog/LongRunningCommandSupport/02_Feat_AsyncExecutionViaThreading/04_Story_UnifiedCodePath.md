# Story: Unified Code Path

## Story Overview
**Story ID:** 04_Story_UnifiedCodePath
**Feature:** 02_Feat_AsyncExecutionViaThreading
**Epic:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning

## User Story
[Conversation Reference: User specified "Browser and MCP commands use identical code path"]

As a system architect
I want browser and MCP commands to use identical execution paths
So that behavior is consistent and maintenance complexity is minimized

## Problem Context
[Conversation Reference: User's requirement for unified code path and "Browser commands infinite wait (no timeout mechanism)"]

Current architecture may have separate code paths for browser and MCP command execution, creating maintenance overhead and potential behavioral inconsistencies.

## Acceptance Criteria

### Identical Execution Path
[Conversation Reference: User specified "Browser and MCP commands use identical code path"]

```gherkin
Given commands are executed from browser or MCP sources
When command execution occurs
Then both sources use the same execution code path
And no source-specific execution logic exists
And behavior consistency is maintained across sources
```

### Browser Infinite Wait
[Conversation Reference: User specified "Browser commands infinite wait (no timeout mechanism)"]

```gherkin
Given a command is executed from the browser terminal
When the command runs for extended periods
Then the browser waits infinitely for completion
And no timeout mechanism interrupts browser execution
And real-time output streaming continues indefinitely
```

### Consistent Threading Behavior
```gherkin
Given commands are executed from different sources
When threaded execution occurs
Then browser and MCP commands both use background threads
And thread management is identical for both sources
And task storage behavior is consistent
```

### Source-Agnostic State Management
```gherkin
Given tasks are executing from different sources
When task state is managed
Then state tracking is identical regardless of source
And session storage behavior is consistent
And polling access works identically for both sources
```

## Technical Implementation

### Code Path Unification
[Conversation Reference: Based on user's unified code path requirement]

- **Single Execution Engine**: One command execution implementation
- **Source-Agnostic Processing**: Execution logic independent of command source
- **Consistent Threading**: Identical threading behavior for all sources
- **Unified State Management**: Same state tracking for browser and MCP

### Browser-Specific Behavior
[Conversation Reference: User specified browser infinite wait]

- **No Timeout for Browser**: Browser commands never timeout
- **Infinite Wait Implementation**: Browser waits indefinitely for completion
- **Real-time Streaming**: Continuous output streaming to browser
- **No AsyncTimeout for Browser**: Browser commands ignore asyncTimeout parameter

### Implementation Steps

1. **Identify Code Paths**: Locate existing browser vs MCP execution differences
2. **Unify Execution Logic**: Merge execution paths into single implementation
3. **Source Detection**: Implement source detection for behavior customization
4. **Browser Timeout Exemption**: Ensure browser commands bypass timeout logic

## Testing Strategy

### Code Path Validation
- **Execution Consistency**: Verify identical execution behavior for both sources
- **Threading Behavior**: Test consistent threading across sources
- **State Management**: Validate consistent state tracking

### Browser-Specific Testing
- **Infinite Wait**: Test browser commands waiting indefinitely
- **No Timeout Interruption**: Verify browser commands never timeout
- **Real-time Streaming**: Test continuous output streaming to browser

## Definition of Done

### Functional Requirements
- [ ] Browser and MCP commands use identical execution code path
- [ ] Browser commands wait infinitely without timeout mechanisms
- [ ] Consistent threading behavior across all command sources
- [ ] Source-agnostic state management and task storage

### Technical Requirements
- [ ] Single command execution implementation serving both sources
- [ ] Source detection for behavior customization where needed
- [ ] No duplicate execution logic for different sources
- [ ] Clean architecture without source-specific code paths

### Validation Requirements
- [ ] Execution behavior verified as identical across sources
- [ ] Browser infinite wait capability confirmed
- [ ] Threading consistency validated across sources
- [ ] State management consistency verified

## Architecture Design

### Unified Execution Engine
[Conversation Reference: User's unified code path architecture]

```
Command Request (Browser/MCP) → Source Detection → Unified Execution Engine → Background Thread
                                      ↓
                               Source-Specific Behaviors:
                               - MCP: AsyncTimeout support
                               - Browser: Infinite wait
```

### Source Detection Logic
- **Request Source Identification**: Detect whether command originates from browser or MCP
- **Behavior Customization**: Apply source-specific behaviors without code duplication
- **Execution Path Unity**: Use same execution engine regardless of source

## Implementation Patterns

### Source-Agnostic Core
[Conversation Reference: Based on user's unified code path requirement]

- **Command Processing**: Same processing logic for all sources
- **Threading Management**: Identical thread handling for all sources
- **State Tracking**: Consistent state management across sources
- **Result Storage**: Same result storage mechanism for all sources

### Source-Specific Customization
[Conversation Reference: User's browser infinite wait requirement]

- **Timeout Behavior**: MCP uses asyncTimeout, browser uses infinite wait
- **Response Format**: Different response formats for different sources
- **Error Handling**: Source-appropriate error communication

## Risk Mitigation

### Architecture Risks
- **Behavior Divergence**: Browser and MCP behavior accidentally diverging
  - *Mitigation*: Comprehensive testing across both sources
- **Code Duplication**: Inadvertent code duplication for different sources
  - *Mitigation*: Code review and architecture validation

### Functionality Risks
- **Browser Functionality**: Browser-specific features being lost in unification
  - *Mitigation*: Careful preservation of browser infinite wait capability
- **MCP Functionality**: MCP-specific features being lost in unification
  - *Mitigation*: Proper asyncTimeout parameter handling preservation

## Integration Points

### WebSocket Integration
[Conversation Reference: User's browser infinite wait requirement]

- **Real-time Streaming**: Maintain real-time output streaming to browser
- **Infinite Wait Support**: Ensure WebSocket supports indefinite command execution
- **Notification Delivery**: Consistent notification delivery across sources

### MCP Protocol Integration
- **AsyncTimeout Support**: Maintain asyncTimeout parameter processing for MCP
- **Error Response Format**: Proper MCP error response formatting
- **Polling Support**: Ensure polling API works consistently

## Benefits

### Maintenance Simplification
[Conversation Reference: User's unified code path goal]

- **Single Code Path**: One execution implementation to maintain
- **Consistent Behavior**: Predictable behavior across sources
- **Reduced Complexity**: Eliminated duplicate execution logic
- **Easier Testing**: Single code path simplifies testing requirements

### Architecture Clarity
- **Clear Separation**: Source detection vs execution logic separation
- **Consistent Patterns**: Same patterns used throughout system
- **Predictable Behavior**: Consistent execution regardless of source