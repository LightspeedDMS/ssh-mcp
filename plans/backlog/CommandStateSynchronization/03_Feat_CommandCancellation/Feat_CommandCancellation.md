# Feature: Command Cancellation

## Feature Description

Source-specific command cancellation system allowing browser users (Ctrl-C) and MCP clients (cancel command) to terminate their respective commands without affecting the other source.

## Technical Architecture

### Cancellation Sources
- **Browser**: Existing Ctrl-C via `sendTerminalSignal`
- **MCP Client**: New `ssh_cancel_command` tool

### Gating Integration
- Cancellation respects command source ownership
- Browser can only cancel browser-initiated commands
- MCP can only cancel MCP-initiated commands

## Story Implementation Order

- [ ] 01_Story_BrowserCommandCancellation
- [ ] 02_Story_MCPCommandCancellation  
- [ ] 03_Story_SourceSpecificCancellation

## Success Criteria

- ⏸️ **Source Isolation**: Each source can only cancel own commands
- ✅ **Gate Release**: Cancellation releases gatekeeper for other source
- 🔧 **Existing Integration**: Browser Ctrl-C continues working
- ⚙️ **MCP Tool**: New cancel command available for Claude Code