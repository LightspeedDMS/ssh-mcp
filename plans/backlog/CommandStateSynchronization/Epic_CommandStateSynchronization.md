# Epic: SSH MCP Command State Synchronization

## Epic Intent

**Business Problem**: Claude Code operates with stale assumptions about terminal state when users execute commands directly in the browser terminal. This creates state conflicts, wrong command decisions, and unreliable automation behavior. When a user types commands in the browser while Claude Code attempts MCP operations, neither system is aware of the other's actions, leading to conflicting operations and broken workflows.

**Proposed Solution**: Implement comprehensive command state synchronization between browser terminal and MCP client through server-side command tracking, mutual exclusion gating, and intelligent conflict resolution with nuclear fallback capabilities.

## Overall Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     SSH MCP Server Architecture                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   Browser       │    │  CommandGate    │    │    MCP       │ │
│  │   Terminal      │───▶│    keeper       │◀───│   Client     │ │
│  │   (User)        │    │                 │    │  (Claude)    │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│          │                        │                      │      │
│          ▼                        ▼                      ▼      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   WebSocket     │    │   SessionData   │    │   MCP-SSH    │ │
│  │   Handler       │    │   + Buffer      │    │   Tools      │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│          │                        │                      │      │
│          └────────────────────────┼──────────────────────┘      │
│                                   ▼                             │
│                    ┌─────────────────────────────┐              │
│                    │    SSH Connection Manager   │              │
│                    │    + Nuclear Fallback       │              │
│                    └─────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Component Descriptions

- **CommandGatekeeper**: ⚙️ Token-based mutual exclusion system ensuring only one command source can execute at a time per SSH session
- **Browser Command Buffer**: 📊 Simple array storage in SessionData tracking all user-initiated commands until MCP notification
- **Enhanced Error Response**: 🔍 Structured MCP error responses including complete command history for intelligent retry logic
- **Nuclear Fallback System**: 🚀 30-second timeout mechanism that kills and re-establishes SSH sessions when cancellation fails

### Technology Stack

- **Node.js/TypeScript**: Type-safe server-side implementation with async/await patterns
- **WebSocket Protocol**: Real-time bidirectional communication for browser terminal interface  
- **MCP JSON-RPC 2.0**: Standard protocol compliance for Claude Code integration
- **SSH2 Library**: Direct SSH session management and command execution
- **AsyncMutex Pattern**: Lightweight mutual exclusion without external dependencies

### Data Flow Architecture

```
User Command Flow:
Browser Input → WebSocket → Buffer Tracking → Gatekeeper → SSH Execution

MCP Command Flow:
Claude Code → MCP Protocol → Buffer Check → Gatekeeper → SSH Execution OR Error Response

Conflict Resolution:
MCP Command + Buffer Content → Structured Error + Command History → Buffer Clear → Retry Allowed
```

## Feature Implementation Order

- [ ] 01_Feat_BrowserCommandTracking
- [ ] 02_Feat_MCPCommandGating  
- [ ] 03_Feat_CommandCancellation
- [ ] 04_Feat_NuclearFallback

### Implementation Dependencies

1. **01_Feat_BrowserCommandTracking** (Foundation)
   - No dependencies - foundational command capture capability
   - Enables all subsequent features

2. **02_Feat_MCPCommandGating** (Core Logic)
   - Depends on: 01_Feat_BrowserCommandTracking
   - Requires command buffer data for gating decisions

3. **03_Feat_CommandCancellation** (User Control)
   - Depends on: 01_Feat_BrowserCommandTracking, 02_Feat_MCPCommandGating
   - Requires gating system for source-specific cancellation

4. **04_Feat_NuclearFallback** (Safety Net)
   - Depends on: 01_Feat_BrowserCommandTracking, 02_Feat_MCPCommandGating, 03_Feat_CommandCancellation
   - Requires cancellation system to trigger fallback mechanism

## Success Metrics

- ✅ **Zero State Conflicts**: No conflicting commands between browser and MCP client
- ✅ **Complete Context Awareness**: MCP client receives full command history before operations
- ✅ **Reliable Recovery**: Nuclear fallback ensures system never hangs permanently
- ⏸️ **Seamless User Experience**: No changes to browser terminal interaction patterns
- 📊 **Command Tracking Coverage**: 100% of browser commands captured and tracked

## Architecture Benefits

1. **State Synchronization**: Eliminates assumptions and provides complete context
2. **Conflict Prevention**: Mutual exclusion prevents concurrent command chaos  
3. **Intelligent Recovery**: Nuclear fallback ensures system reliability under all conditions
4. **MCP Protocol Compliance**: Preserves existing integration patterns while adding capabilities
5. **Scalable Design**: Simple patterns that work across multiple SSH sessions simultaneously

This epic establishes the foundation for reliable, conflict-free command execution across both user-initiated and automated command sources while maintaining full backward compatibility and system reliability.