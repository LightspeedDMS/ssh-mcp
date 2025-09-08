# Story: Source-Specific Cancellation

## User Story
As a system administrator, I want cancellation commands to respect source ownership so that browser users and MCP clients cannot interfere with each other's operations while maintaining proper system isolation.

## Acceptance Criteria

### Given: Commands from different sources are tracked separately
### When: Cancellation is requested from any source
### Then: Only commands from the requesting source can be cancelled

**Scenario 1: Browser cannot cancel MCP commands**
- Given MCP client has initiated a command via `ssh_exec`
- When browser user attempts Ctrl-C cancellation
- Then browser cancellation has no effect on MCP command
- And MCP command continues running until completion or MCP cancellation

**Scenario 2: MCP cannot cancel browser commands**
- Given browser user has initiated a command via WebSocket
- When MCP client calls `ssh_cancel_command`
- Then MCP cancellation returns error "No MCP command to cancel"
- And browser command continues running uninterrupted

**Scenario 3: Source ownership properly identified**
- Given both browser and MCP have executed commands in sequence
- When cancellation is requested from either source
- Then system correctly identifies which commands belong to which source
- And only appropriate commands are eligible for cancellation

**Scenario 4: Concurrent commands from different sources**
- Given browser command is running (holding gatekeeper lock)
- And MCP command is queued/waiting
- When browser user cancels their command
- Then only browser command is cancelled
- And queued MCP command can proceed immediately
- And MCP command remains under MCP control

**Scenario 5: Command source tracking persistence**
- Given commands have been executed from both sources
- When system state is inspected
- Then each command clearly attributed to correct source (browser/MCP)
- And source information persists through command lifecycle

## Technical Implementation

### Source Identification System
- 📊 Enhanced command tracking with source attribution
- 🔧 Browser commands tagged as `source: 'browser'`
- ⚙️ MCP commands tagged as `source: 'mcp'`
- 🔍 Source validation for all cancellation requests

### Cancellation Permission Logic
```typescript
interface CommandCancellationRequest {
  sessionName: string;
  requestSource: 'browser' | 'mcp';
}

// Only commands matching requestSource can be cancelled
const canCancel = (activeCommand.source === requestSource);
```

### Integration with Gatekeeper
- ⏸️ Gatekeeper tracks both command and source information
- ✅ Lock release respects source ownership
- 🚀 Cross-source command queuing remains intact

### Enhanced Session State
- Command history with source attribution
- Active command tracking with ownership
- Source-specific cancellation capabilities

## Testing Requirements

### E2E Test Scenarios
- Mixed source command execution with cancellation attempts
- Source isolation verification under concurrent operations
- Proper error responses for invalid cancellation requests
- Gatekeeper behavior with source-specific operations

### Unit Test Coverage
- Source identification logic
- Cancellation permission validation
- Command attribution accuracy
- Cross-source interference prevention

### Integration Test Coverage
- Browser + MCP concurrent operation scenarios
- Source ownership persistence through command lifecycle
- Gatekeeper lock management with source awareness
- Error handling for cross-source cancellation attempts

## Definition of Done
- ✅ All commands properly attributed to correct source (browser/MCP)
- ✅ Browser cancellation only affects browser commands
- ✅ MCP cancellation only affects MCP commands
- ✅ Cross-source interference completely prevented
- ✅ Proper error messages for invalid cancellation attempts
- ✅ Source ownership information persists through command lifecycle
- ✅ All existing tests continue passing with source-aware enhancements
- ✅ Comprehensive test coverage validates source isolation