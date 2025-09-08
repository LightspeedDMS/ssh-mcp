# Story: Cancellation Timeout Detection

## User Story
As a system administrator, I want the SSH command system to detect when cancellation commands fail within 30 seconds so that hung commands never leave the system permanently unresponsive.

## Acceptance Criteria

### AC 1.1: Timeout Timer Implementation
**Given** a cancellation command is issued (browser SIGINT or MCP cancel)  
**When** the cancellation is processed  
**Then** a 30-second nuclear fallback timer must start  
**And** the timer must track which session and command is being cancelled  

### AC 1.2: Timeout Detection Triggering
**Given** a nuclear fallback timer is running  
**When** 30 seconds elapse without the command completing  
**Then** the timeout detection must trigger nuclear fallback protocol  
**And** the system must log the timeout event with session details  

### AC 1.3: Successful Cancellation Timer Cleanup
**Given** a command is successfully cancelled before timeout  
**When** the command completion is detected  
**Then** the nuclear fallback timer must be cleared  
**And** no nuclear fallback protocol must execute  

### AC 1.4: Multiple Session Timeout Support
**Given** multiple SSH sessions have active cancellation timeouts  
**When** individual sessions reach timeout  
**Then** nuclear fallback must trigger only for the timed-out session  
**And** other sessions must continue normal operation  

## Technical Requirements

- **Timer Management**: Use `setTimeout` with 30-second duration
- **Session Tracking**: Track timeouts per SSH session name
- **Cleanup Logic**: Clear timers on successful cancellation completion
- **Isolation**: Each session's timeout operates independently

## Testing Requirements

### Unit Tests
- Timer creation and cleanup mechanisms
- Multiple session timeout isolation
- Timer state management edge cases

### E2E Tests
- Real SSH command cancellation with timeout detection
- Hung command scenarios triggering nuclear fallback
- Multiple concurrent session timeout handling

## Definition of Done

- ✅ 30-second timeout timer starts on all cancellation commands
- ✅ Timeout detection triggers nuclear fallback protocol
- ✅ Successful cancellations clear timeout timers properly
- ✅ Multiple sessions handle timeouts independently
- ✅ Unit tests achieve >90% coverage
- ✅ E2E tests validate real SSH timeout scenarios