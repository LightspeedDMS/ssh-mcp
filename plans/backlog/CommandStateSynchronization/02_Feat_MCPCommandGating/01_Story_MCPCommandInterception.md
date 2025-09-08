# Story: MCP Command Interception

**As a** MCP client (Claude Code)
**I want** my commands intercepted when browser commands are buffered
**So that** I receive notification of state changes before executing potentially conflicting commands

## Acceptance Criteria

#### Scenario 1: Buffer Content Detection
- [ ] **Given** user has executed `pwd` command in browser terminal
- [ ] **When** Claude Code attempts `ssh_exec` via MCP protocol
- [ ] **Then** MCP command is intercepted before SSH execution
- [ ] **And** system detects non-empty browser command buffer
- [ ] **And** CommandGatingError is raised with buffer contents

#### Scenario 2: Empty Buffer Pass-Through  
- [ ] **Given** browser command buffer is empty
- [ ] **When** Claude Code sends `ssh_exec` command
- [ ] **Then** command proceeds to SSH execution normally
- [ ] **And** no interception or gating occurs
- [ ] **And** standard MCP response is returned

#### Scenario 3: Multiple Buffered Commands
- [ ] **Given** browser buffer contains `['ls', 'whoami', 'date']`
- [ ] **When** Claude Code attempts any SSH command
- [ ] **Then** interception occurs with complete command array
- [ ] **And** all three commands included in error response
- [ ] **And** buffer state preserved during interception

## Implementation Requirements

### Interception Point Integration
```
PSEUDOCODE MCP Handler Enhancement:
async function handleSSHExec(args) {
    sessionName = args.sessionName
    browserCommands = getSessionCommandBuffer(sessionName)
    
    if (browserCommands.isNotEmpty()) {
        errorResponse = createGatingError(browserCommands)
        clearSessionCommandBuffer(sessionName)
        return errorResponse
    }
    
    return executeSSHCommand(args)
}
```

## Definition of Done

- ✅ **Interception Working**: MCP commands blocked when buffer has content
- ✅ **Pass-Through Working**: Commands execute normally when buffer empty  
- ✅ **Complete Detection**: All buffered commands included in interception
- 📊 **State Preservation**: Buffer integrity maintained during checks