# Epic: Session Isolation and State Awareness

## Epic Intent

Implement robust session isolation and state awareness to prevent Claude Code instances from interfering with each other and ensure Claude Code is always aware of user-initiated commands that may have changed the SSH session state. This prevents context mismatches where Claude Code assumes unchanged session state when users have executed intervening commands.

## Overall Proposed Architecture

### Core Components
- **Session Token System**: Unique tokens per SSH session to prevent multi-instance interference
- **Command History Tracking**: Per-session tracking of user commands since last MCP command
- **State Awareness Gate**: Mandatory awareness mechanism before MCP command execution
- **Enhanced MCP Responses**: Detailed command history in blocking responses

### Technology Stack
- **Session Management**: Enhanced ssh-connection-manager.ts with token validation
- **Command Tracking**: Per-session command history with full details (stdout/stderr/exit codes/duration)
- **MCP Protocol**: Enhanced tool responses with detailed error information
- **Token Generation**: Short unique identifiers for session ownership

### High-Level Component Connections
```
Claude Code → MCP Tools → Session Token Validation → Command History Check → SSH Execution
                             ↓                            ↓
                      Error if invalid              Error if user activity
                                                         ↓
                                              Return full command history
```

### Architecture Principles
- **Session Ownership**: Only the Claude Code instance that created a session can execute commands
- **State Transparency**: Complete visibility into user activity since last MCP command
- **No Bypass**: Mandatory acknowledgment of user activity before proceeding
- **Breaking Change**: Token system required for all MCP commands (security improvement)

---

## User Stories

### Story 1: Session Token-Based Isolation
**As a** Claude Code instance creating SSH sessions  
**I want to** receive a unique session token with exclusive access rights  
**So that** other Claude Code instances cannot interfere with my SSH session

#### Acceptance Criteria

**AC1.1: Session Token Generation**  
**Given** I call ssh_connect with valid credentials  
**When** the connection is established successfully  
**Then** the response includes both sessionName and sessionToken  
**And** the sessionToken is a short unique identifier  
**And** the token is associated with this specific session

**AC1.2: Token-Required Command Execution**  
**Given** I want to execute any SSH command via MCP tools  
**When** I call ssh_exec, ssh_disconnect, or ssh_get_monitoring_url  
**Then** I must provide both sessionName and sessionToken  
**And** the command fails with clear error if token is missing  
**And** the command fails with clear error if token doesn't match the session owner

**AC1.3: Token Validation Security**  
**Given** another Claude Code instance tries to use my session  
**When** they provide the sessionName but wrong or missing sessionToken  
**Then** they receive "Invalid or missing session token for session 'name'" error  
**And** my session remains unaffected and secure  
**And** no command execution occurs on the target session

**AC1.4: Session Listing with Token Privacy**  
**Given** multiple Claude Code instances have created sessions  
**When** I call ssh_list_sessions  
**Then** I only see sessions I own (created with my tokens)  
**And** I do not see sessions created by other Claude Code instances  
**And** session tokens are not exposed in the response

---

### Story 2: User Activity Detection and Tracking
**As a** session management system  
**I want to** track user-initiated commands with complete details since the last MCP command  
**So that** I can detect when user activity has occurred that Claude Code needs to be aware of

#### User Command History Lifecycle
```
Session Start → [Clean State: No User Commands Tracked]
     ↓
MCP Command Executes → [Clean State: No User Commands Tracked] 
     ↓
User Command 1 → [Track: Command 1 Details]
     ↓  
User Command 2 → [Track: Command 1 + Command 2 Details]
     ↓
User Command N → [Track: Command 1...N Details]
     ↓
MCP Command Attempt → [BLOCKED: Return Full History of Commands 1...N]
     ↓
History Sent to Claude Code → [RESET: Clean State, No User Commands Tracked]
     ↓
Next MCP Command → [Executes Successfully]
     ↓
[Cycle Repeats...]
```

#### Acceptance Criteria

**AC2.1: User Command History Tracking**  
**Given** a user executes commands in the browser terminal  
**When** each command completes  
**Then** the system records the complete command details including:
- Command text executed
- Complete stdout output  
- Complete stderr output
- Exit code
- Execution duration
- Timestamp of execution
- Command source marked as "user"

**AC2.2: User Command History Reset on MCP Success**  
**Given** Claude Code executes a command via MCP tools successfully  
**When** the command completes  
**Then** the system clears all tracked user command history  
**And** resets to clean state with no user commands tracked  
**And** begins fresh tracking of any subsequent user activity

**AC2.3: User Command History Reset on Gate Response**  
**Given** Claude Code attempts an MCP command after user activity  
**When** the system sends the blocking response with user command history  
**Then** the tracked user command history is immediately cleared  
**And** the system resets to clean state  
**And** the next MCP command attempt will execute successfully (unless new user activity occurs)

**AC2.4: Cross-Session History Isolation**  
**Given** multiple sessions are active  
**When** user activity occurs in different sessions  
**Then** command history tracking is maintained separately per session  
**And** user activity in session A does not affect session B  
**And** each session maintains its own gate state independently

**AC2.5: Complete Command Detail Capture**  
**Given** a user executes a command producing large output  
**When** the command completes  
**Then** the entire output is captured without truncation  
**And** all stdout and stderr content is preserved exactly  
**And** the exact exit code and timing are recorded  
**And** the information matches what Claude Code would see if it executed the command

---

### Story 3: State Awareness Gate Implementation
**As a** Claude Code instance executing MCP commands  
**I want to** be notified when user activity has changed the session state  
**So that** I can re-evaluate my approach based on current session state

#### Acceptance Criteria

**AC3.1: User Activity Detection**  
**Given** I previously executed an MCP command successfully  
**When** a user executes commands in the browser terminal  
**And** I attempt to execute another MCP command  
**Then** the MCP command is blocked with a detailed error response  
**And** I receive complete history of all user commands since my last MCP command

**AC3.2: Comprehensive History Response**  
**Given** the system blocks my MCP command due to user activity  
**When** I receive the error response  
**Then** the response includes for each user command:
- Exact command text
- Complete stdout output (untruncated)
- Complete stderr output (untruncated)  
- Exit code
- Execution duration
- Timestamp
- Sequential order of execution

**AC3.3: Gate Reset After Notification**  
**Given** I receive the user activity history response  
**When** the system sends the response back to me  
**Then** the gate is immediately reset for that session  
**And** my next MCP command attempt will execute normally  
**And** fresh user activity tracking begins from that point

**AC3.4: Absolute No Bypass Policy**  
**Given** user activity has occurred since my last MCP command  
**When** I attempt to execute any MCP command  
**Then** there is NO way to bypass the state awareness requirement  
**And** NO override flags, parameters, or special modes exist  
**And** NO emergency or administrative bypass mechanisms are available  
**And** I MUST receive and process the user activity history  
**And** the gate enforcement is absolute and non-negotiable

---

### Story 4: Enhanced MCP Tool Response Format
**As a** Claude Code instance receiving MCP responses  
**I want to** receive detailed and structured information about session state changes  
**So that** I can make informed decisions about my next actions

#### Acceptance Criteria

**AC4.1: Session Creation Response Enhancement**  
**Given** I call ssh_connect successfully  
**When** the connection is established  
**Then** the response format is:
```json
{
  "success": true,
  "connection": { /* existing connection details */ },
  "sessionToken": "abc123def",
  "message": "Session created. Use sessionToken for all subsequent commands."
}
```

**AC4.2: Token-Enhanced Command Parameters**  
**Given** I want to execute subsequent MCP commands  
**When** I call ssh_exec, ssh_disconnect, or ssh_get_monitoring_url  
**Then** I must provide parameters in format:
```json
{
  "sessionName": "my-session",
  "sessionToken": "abc123def",
  "command": "ls -la"  // for ssh_exec
}
```

**AC4.3: User Activity Blocking Response Format**  
**Given** user activity has occurred and my MCP command is blocked  
**When** I receive the response  
**Then** the response format includes:
```json
{
  "success": false,
  "error": "user_activity_detected",
  "message": "User commands executed since last MCP command. Review activity and retry.",
  "userActivitySince": "2025-09-03T10:30:00Z",
  "userCommands": [
    {
      "command": "cd /home/user/project", 
      "stdout": "",
      "stderr": "", 
      "exitCode": 0,
      "duration": 45,
      "timestamp": "2025-09-03T10:30:15Z"
    }
  ]
}
```

**AC4.4: Token Validation Error Response**  
**Given** I provide invalid or missing session token  
**When** I attempt any MCP command  
**Then** the response format is:
```json
{
  "success": false,
  "error": "invalid_session_token",
  "message": "Invalid or missing session token for session 'session-name'"
}
```

---

### Story 5: Complete Breaking Change - No Fallbacks
**As a** system implementer  
**I want to** completely eliminate backward compatibility and all fallback mechanisms  
**So that** security is enforced and system behavior is predictable without legacy workarounds

#### Critical Design Principles
- **NO FALLBACKS**: No mechanism to bypass token requirements
- **NO BACKWARD COMPATIBILITY**: Old command formats must fail completely  
- **NO BYPASS**: No override flags or parameters for state awareness gate
- **CLEAN BREAK**: All legacy behavior removed, forcing upgrade to new system

#### Acceptance Criteria

**AC5.1: Absolute Token Requirement - No Fallbacks**  
**Given** the new system is deployed  
**When** any MCP command is called without sessionToken parameter  
**Then** the command fails immediately with clear error message  
**And** NO fallback to sessionName-only behavior exists  
**And** NO compatibility mode or legacy support is available  
**And** NO override flags can bypass the token requirement  
**And** the system refuses to execute any command without proper token

**AC5.2: Legacy Session Cleanup**  
**Given** existing sessions were created without tokens  
**When** the new system starts  
**Then** all existing sessions are terminated cleanly  
**And** users must create new sessions with the enhanced ssh_connect  
**And** clear error messages guide users through the upgrade process

**AC5.3: Web Interface Compatibility**  
**Given** the token system is implemented for MCP commands  
**When** users access the web monitoring interface  
**Then** the web interface continues to work without requiring tokens  
**And** monitoring URLs remain accessible via direct browser access  
**And** only MCP programmatic access requires tokens

**AC5.4: Clear Migration Guidance**  
**Given** existing users attempt to use old command format  
**When** they receive token validation errors  
**Then** error messages clearly explain the breaking change  
**And** provide examples of the new command format required  
**And** guide users to re-create sessions with updated ssh_connect calls

---

## Definition of Done

### Implementation Requirements
- [ ] Session token generation and storage in SessionData structure
- [ ] Token validation middleware for all MCP commands except ssh_connect
- [ ] Per-session user command history tracking with complete details
- [ ] State awareness gate implementation with blocking logic
- [ ] Enhanced MCP response formats with detailed error information
- [ ] Breaking change implementation removing backward compatibility

### Testing Requirements
- [ ] Unit tests for token generation and validation logic
- [ ] E2E tests for session isolation between multiple Claude Code instances
- [ ] User activity detection and history capture validation tests
- [ ] State awareness gate blocking and reset behavior tests
- [ ] MCP response format validation for all new response types

### Quality Requirements
- [ ] Token uniqueness guaranteed across all sessions
- [ ] Complete command history capture without data loss
- [ ] Zero bypass mechanisms for state awareness gate
- [ ] Clear and actionable error messages for all failure cases
- [ ] Session isolation prevents any cross-session interference

### Security Requirements
- [ ] Session tokens prevent unauthorized access to sessions
- [ ] Token validation occurs on every MCP command
- [ ] No session data exposed across Claude Code instances
- [ ] Web interface access remains unrestricted for legitimate monitoring

### User Experience Requirements
- [ ] Clear error messages guide users through breaking changes
- [ ] Detailed user activity history enables informed decision making
- [ ] Fast gate reset enables smooth workflow continuation
- [ ] Token-based security provides reliable session ownership