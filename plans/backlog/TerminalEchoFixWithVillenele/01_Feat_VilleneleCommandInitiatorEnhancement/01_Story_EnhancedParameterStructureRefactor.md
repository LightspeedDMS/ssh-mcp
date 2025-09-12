# Story 01: Enhanced Parameter Structure Refactor

## User Story

**As a** Villenele test developer  
**I want** postWebSocketCommands to accept enhanced `{initiator, command, cancel?, waitToCancelMs?}` objects  
**So that** I can specify command source, cancellation behavior, and work toward universal test suite compatibility

## Acceptance Criteria

### Basic Parameter Structure Validation

**AC 1.1**: Enhanced structure acceptance
- **Given** I provide postWebSocketCommands as `[{initiator: 'mcp-client', command: 'pwd'}]`
- **When** Villenele processes the configuration
- **Then** it should accept the enhanced structure without validation errors
- **And** the command should be properly typed and routed

**AC 1.2**: Invalid initiator validation
- **Given** I provide invalid initiator `{initiator: 'invalid-type', command: 'pwd'}`  
- **When** Villenele validates the configuration
- **Then** it should throw clear error: "Initiator must be 'browser' or 'mcp-client'"
- **And** indicate the valid options available

### Cancellation Parameter Structure

**AC 1.3**: Basic cancellation parameter acceptance
- **Given** I provide `{initiator: 'browser', command: 'nano /tmp/test', cancel: true}`
- **When** Villenele validates the configuration  
- **Then** it should accept the cancel parameter without errors
- **And** prepare for timeout-based cancellation logic

**AC 1.4**: Cancellation with custom timeout
- **Given** I provide `{initiator: 'mcp-client', command: 'sleep 30', cancel: true, waitToCancelMs: 5000}`
- **When** Villenele validates the configuration
- **Then** it should accept both cancel and waitToCancelMs parameters
- **And** prepare 5-second cancellation timeout

**AC 1.5**: Invalid timeout value rejection
- **Given** I provide `{command: 'pwd', cancel: true, waitToCancelMs: -100}`  
- **When** Villenele validates the configuration
- **Then** it should throw error: "waitToCancelMs must be positive number"
- **And** indicate minimum acceptable value

**AC 1.6**: Timeout without cancellation handling
- **Given** I provide `{command: 'pwd', cancel: false, waitToCancelMs: 5000}`
- **When** Villenele validates the configuration  
- **Then** it should accept but log warning: "waitToCancelMs ignored when cancel is false"
- **And** execute command normally without timeout logic

### Default Behavior Validation

**AC 1.7**: Default cancellation timeout
- **Given** command `{initiator: 'browser', command: 'sleep 20', cancel: true}` with no waitToCancelMs
- **When** Villenele processes the configuration
- **Then** it should default waitToCancelMs to 10000 (10 seconds)
- **And** prepare 10-second cancellation timeout

**AC 1.8**: Default cancel behavior
- **Given** command `{initiator: 'mcp-client', command: 'pwd'}` with no cancel parameter
- **When** Villenele processes the configuration
- **Then** it should default cancel to false
- **And** execute command normally without cancellation logic

**AC 1.9**: Minimal parameter command execution
- **Given** command with only required parameters `{initiator: 'browser', command: 'ls'}`
- **When** Villenele executes the configuration
- **Then** it should execute normally without timeout or cancellation logic
- **And** complete when command finishes naturally

### Parameter Type Validation

**AC 1.10**: Invalid cancel type rejection
- **Given** invalid cancel value `{initiator: 'browser', command: 'pwd', cancel: 'maybe'}`
- **When** Villenele validates the configuration
- **Then** it should throw error: "cancel must be boolean value (true or false)"

**AC 1.11**: Invalid timeout type rejection  
- **Given** invalid waitToCancelMs `{command: 'pwd', cancel: true, waitToCancelMs: 'soon'}`
- **When** Villenele validates the configuration
- **Then** it should throw error: "waitToCancelMs must be numeric value in milliseconds"

**AC 1.12**: Missing required initiator
- **Given** missing initiator `{command: 'pwd', cancel: true}`
- **When** Villenele validates the configuration
- **Then** it should throw error: "initiator field required: must be 'browser' or 'mcp-client'"

**AC 1.13**: Missing required command
- **Given** missing command `{initiator: 'browser', cancel: true}`  
- **When** Villenele validates the configuration
- **Then** it should throw error: "command field required: must be non-empty string"

### Complex Structure Validation

**AC 1.14**: Mixed parameter combinations handling
- **Given** complex configuration with all parameter variations:
```typescript
postWebSocketCommands: [
  { initiator: 'browser', command: 'pwd' },                           // Basic browser
  { initiator: 'mcp-client', command: 'date' },                      // Basic MCP  
  { initiator: 'browser', command: 'nano file.txt', cancel: true },  // Browser + default cancel
  { initiator: 'mcp-client', command: 'sleep 30', cancel: true, waitToCancelMs: 3000 }, // MCP + custom cancel
  { initiator: 'browser', command: 'echo done' }                     // Basic browser final
]
```
- **When** Villenele processes the configuration
- **Then** each command should be validated according to its specific parameters
- **And** prepare appropriate execution strategy for each command type
- **And** maintain sequential execution order regardless of parameter complexity

## Definition of Done

- [x] ✅ Enhanced parameter structure accepted and validated correctly
- [x] ✅ Backward compatibility layer functional for legacy string arrays  
- [x] ✅ Comprehensive parameter validation with clear error messages
- [x] ✅ Default value handling working as specified
- [x] ✅ Complex mixed parameter configurations handled properly
- [x] ✅ All validation edge cases covered with appropriate error handling
- [x] ✅ Configuration processing prepares correct execution strategy per command
- [x] ✅ Zero breaking changes to existing test suite during validation enhancement

## Technical Implementation Notes

### Configuration Processing Flow
```
Input Validation → Type Checking → Default Value Assignment → Strategy Preparation
```

### Validation Error Handling
- Provide specific error messages indicating exact validation failure
- Include examples of correct parameter format in error messages
- Fail fast with clear indication of parameter correction needed

### Backward Compatibility Strategy  
- Detect legacy string array format automatically
- Convert to enhanced structure transparently  
- Log deprecation warning for future migration planning
- Maintain identical execution behavior for converted commands

This story establishes the foundational parameter structure that enables all subsequent dual-channel command routing and cancellation capabilities while maintaining compatibility with existing test infrastructure.