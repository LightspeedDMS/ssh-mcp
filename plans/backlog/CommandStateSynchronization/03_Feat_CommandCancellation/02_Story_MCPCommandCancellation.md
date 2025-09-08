# Story: MCP Command Cancellation

## User Story
As an MCP client (Claude Code), I want a dedicated `ssh_cancel_command` tool to cancel my running commands so that I can stop unresponsive operations without affecting browser user commands.

## Acceptance Criteria

### Given: MCP-initiated command is running
### When: `ssh_cancel_command` tool is invoked  
### Then: Only MCP command is cancelled, browser operations remain unaffected

**Scenario 1: MCP command cancellation via new tool**
- Given MCP client has initiated a long-running command via `ssh_exec`
- When `ssh_cancel_command {"sessionName": "session-name"}` is called
- Then active MCP command is terminated
- And gatekeeper lock is released
- And browser terminal operations continue unaffected

**Scenario 2: MCP cancellation respects command source ownership**
- Given browser user is running a command
- When MCP client calls `ssh_cancel_command`
- Then cancellation request returns error "No MCP command to cancel"
- And browser command continues running uninterrupted

**Scenario 3: Cancel command handles no active command gracefully**
- Given no commands are currently running
- When `ssh_cancel_command` is invoked
- Then tool returns informative message "No active command to cancel"
- And system state remains unchanged

**Scenario 4: MCP cancellation updates command tracking**
- Given MCP command is executing with gatekeeper lock
- When command is cancelled via `ssh_cancel_command`
- Then command status updated in session tracking
- And gatekeeper lock immediately released for other operations

## Technical Implementation

### New MCP Tool Definition
```typescript
{
  name: "ssh_cancel_command",
  description: "Cancel currently running MCP command for specified SSH session",
  inputSchema: {
    type: "object",
    properties: {
      sessionName: {
        type: "string", 
        description: "Name of SSH session to cancel command for"
      }
    },
    required: ["sessionName"]
  }
}
```

### Cancellation Logic
- 🔧 Source-specific cancellation (MCP commands only)
- ⚙️ Gatekeeper lock release on successful cancellation
- 🔍 Proper error handling for invalid cancellation requests
- 📊 Command state tracking updates

### Integration Points
- Enhanced `SSHConnectionManager` with MCP-specific cancellation
- Gatekeeper integration for lock management
- Command source tracking for permission validation

## Testing Requirements

### E2E Test Scenarios
- MCP long-running command + cancellation tool usage
- Cross-source cancellation prevention (MCP cannot cancel browser commands)
- Graceful handling of no-command scenarios
- Immediate operation capability after cancellation

### Unit Test Coverage
- `ssh_cancel_command` tool registration and functionality
- Source-specific cancellation permission logic
- Gatekeeper lock release mechanisms
- Error response formatting for invalid requests

## Definition of Done
- ✅ New `ssh_cancel_command` MCP tool implemented and registered
- ✅ MCP commands can be cancelled without affecting browser operations
- ✅ Source ownership validation prevents cross-cancellation
- ✅ Gatekeeper lock properly released on cancellation
- ✅ All existing functionality preserved and tested
- ✅ Comprehensive test coverage for new cancellation scenarios