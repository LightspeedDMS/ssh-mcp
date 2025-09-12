# Story 04: Complete Test Suite Migration

## User Story

**As a** Villenele framework maintainer  
**I want** universal migration of ALL existing test files to the enhanced parameter structure  
**So that** the entire test suite uses the new `{initiator, command, cancel?, waitToCancelMs?}` format with no backward compatibility dependencies

## Acceptance Criteria

### Universal Test File Migration Validation

**AC 4.1**: All existing test file identification and conversion
- **Given** the current Villenele test suite with legacy string array commands
- **When** migration process analyzes all test files
- **Then** every test file using `postWebSocketCommands: ['command1', 'command2']` should be identified
- **And** converted to `postWebSocketCommands: [{initiator: 'mcp-client', command: 'command1'}, {initiator: 'mcp-client', command: 'command2'}]`
- **And** zero legacy string array formats should remain in any test file

**AC 4.2**: Test file migration completeness validation
- **Given** migration process completion
- **When** scanning entire test directory structure
- **Then** search for legacy patterns should return zero results
- **And** all test configurations should use enhanced parameter structure
- **And** migration should cover 100% of existing test files without exceptions

**AC 4.3**: Converted test execution validation
- **Given** all migrated test files
- **When** executing the complete test suite
- **Then** all tests should pass with identical behavior to legacy format
- **And** no test functionality should be lost during migration
- **And** test execution time should remain within acceptable variance

### File-Specific Migration Requirements

**AC 4.4**: `terminal-history-validation.test.ts` migration
- **Given** the core terminal history validation test file
- **When** migration is applied to this file
- **Then** all command configurations should use enhanced parameter structure
- **And** test assertions should remain identical
- **And** all test scenarios should continue to pass with converted parameters

**AC 4.5**: `terminal-history-command-permutations-e2e.test.ts` migration
- **Given** the command permutation E2E test file  
- **When** migration is applied to complex test scenarios
- **Then** all command permutation scenarios should use enhanced structure
- **And** permutation logic should work correctly with object-based commands
- **And** E2E test coverage should be preserved exactly

**AC 4.6**: `bracket-prompt-format.test.ts` migration
- **Given** the bracket prompt format validation test
- **When** migration converts command parameters
- **Then** bracket prompt detection should work with enhanced parameter structure
- **And** prompt format validation logic should remain functional
- **And** CRLF preservation tests should continue to pass

### Configuration Migration Standards

**AC 4.7**: Simple command configuration migration
- **Given** basic configuration: 
```typescript
// Before migration
postWebSocketCommands: ['pwd', 'whoami', 'date']
```
- **When** migration process converts the configuration
- **Then** result should be:
```typescript
// After migration  
postWebSocketCommands: [
  {initiator: 'mcp-client', command: 'pwd'},
  {initiator: 'mcp-client', command: 'whoami'},
  {initiator: 'mcp-client', command: 'date'}
]
```
- **And** default initiator should be 'mcp-client' for all legacy commands

**AC 4.8**: Complex configuration migration
- **Given** complex test configuration with multiple command arrays:
```typescript
// Before migration
const configs = [
  { preWebSocketCommands: ['ssh_connect {...}'], postWebSocketCommands: ['pwd', 'ls'] },
  { preWebSocketCommands: ['ssh_connect {...}'], postWebSocketCommands: ['whoami'] }
];
```
- **When** migration processes complex nested configurations
- **Then** all command arrays should be converted to enhanced format
- **And** nested configuration structures should be preserved
- **And** test iteration logic should continue to function correctly

**AC 4.9**: Dynamic configuration migration
- **Given** dynamically generated command configurations:
```typescript
// Before migration  
const commands = someLogic.generateCommands(); // Returns string[]
const config = { postWebSocketCommands: commands };
```
- **When** migration encounters dynamic configurations
- **Then** migration should handle dynamic generation patterns
- **And** provide conversion utilities for runtime string-to-object transformation
- **And** maintain dynamic configuration functionality

### Migration Process Validation

**AC 4.10**: Backward compatibility removal confirmation
- **Given** completed migration process
- **When** attempting to use legacy string array format in any test
- **Then** test framework should reject legacy format with clear error
- **And** error message should guide toward enhanced parameter structure
- **And** no fallback to legacy format should be available

**AC 4.11**: Migration rollback capability
- **Given** migration process implementation
- **When** migration needs to be reversed for troubleshooting
- **Then** migration should provide rollback capability to restore original formats
- **And** rollback should be complete and accurate
- **And** rollback validation should confirm restoration of original functionality

**AC 4.12**: Migration audit and verification
- **Given** completed migration with all files converted
- **When** performing post-migration audit
- **Then** audit should generate report of all converted files
- **And** report should confirm zero remaining legacy patterns
- **And** audit should verify all tests pass in converted state

### Enhanced Parameter Structure Integration

**AC 4.13**: Default parameter handling in migrated tests
- **Given** migrated test configurations using only required parameters
- **When** tests execute with minimal parameter sets
- **Then** default values should be applied correctly (cancel: false)
- **And** all migrated tests should execute successfully
- **And** behavior should match original legacy test behavior

**AC 4.14**: Parameter validation in migrated configurations
- **Given** migrated test configurations
- **When** tests are executed with enhanced parameter structure
- **Then** parameter validation should work correctly for all migrated tests
- **And** any invalid parameters should be caught with clear error messages
- **And** validation should ensure all required parameters are present

**AC 4.15**: Future-proof parameter structure
- **Given** complete migration to enhanced parameter structure
- **When** new optional parameters are added to command structure
- **Then** all migrated tests should continue to work without modification
- **And** new parameters should have appropriate default values
- **And** migration should support future parameter extensions

### Framework Integration Validation

**AC 4.16**: Jest integration after migration
- **Given** migrated test suite using enhanced parameter structure
- **When** tests are executed via Jest runner
- **Then** Jest integration should work correctly with object-based commands
- **And** Jest test utilities should handle enhanced parameters appropriately
- **And** test reporting should remain clear and accurate

**AC 4.17**: Error diagnostics compatibility
- **Given** migrated tests with enhanced parameter structure
- **When** test failures occur
- **Then** error diagnostics should provide clear information for object-based commands
- **And** troubleshooting guidance should reference enhanced parameter structure
- **And** diagnostic information should be as helpful as with legacy format

**AC 4.18**: Performance validation after migration
- **Given** complete migrated test suite
- **When** executing full test suite
- **Then** test execution performance should be equivalent to legacy format
- **And** memory usage should not significantly increase
- **And** test suite should complete within expected time bounds

## Definition of Done

- [x] ✅ 100% of existing test files migrated to enhanced parameter structure
- [x] ✅ Zero legacy string array command formats remaining in codebase
- [x] ✅ All migrated tests pass with identical behavior to original format
- [x] ✅ Backward compatibility support completely removed from framework
- [x] ✅ Migration audit confirms complete conversion with zero gaps
- [x] ✅ Enhanced parameter validation working correctly for all migrated tests
- [x] ✅ Jest integration and error diagnostics functional with migrated structure
- [x] ✅ Migration provides rollback capability for troubleshooting scenarios
- [x] ✅ Complete inventory of all existing Villenele test files documented and confirmed for migration coverage

### Complete File Inventory for Migration Coverage

**Core Villenele Framework Files (Implementation):**
- `tests/integration/terminal-history-framework/mcp-server-manager.ts`
- `tests/integration/terminal-history-framework/mcp-client.ts`
- `tests/integration/terminal-history-framework/pre-websocket-command-executor.ts`
- `tests/integration/terminal-history-framework/websocket-connection-discovery.ts`
- `tests/integration/terminal-history-framework/initial-history-replay-capture.ts`
- `tests/integration/terminal-history-framework/post-websocket-command-executor.ts`
- `tests/integration/terminal-history-framework/comprehensive-response-collector.ts`
- `tests/integration/terminal-history-framework/flexible-command-configuration.ts`
- `tests/integration/terminal-history-framework/robust-error-diagnostics.ts`
- `tests/integration/terminal-history-framework/jest-test-utilities.ts`

**Core Villenele Test Files (Primary Migration Targets):**
- `tests/terminal-history-validation.test.ts`
- `tests/terminal-history-command-permutations-e2e.test.ts`
- `tests/bracket-prompt-format.test.ts`
- `tests/villenele-double-echo-detection.test.ts`
- `tests/terminal-display-diagnosis-villenele.test.ts`

**Story-Based Framework Test Files:**
- `tests/integration/terminal-history-framework/mcp-server-manager.test.ts`
- `tests/integration/terminal-history-framework/mcp-server-lifecycle-integration.test.ts`
- `tests/integration/terminal-history-framework/mcp-client.test.ts`
- `tests/integration/terminal-history-framework/pre-websocket-command-executor.test.ts`
- `tests/integration/terminal-history-framework/story2-acceptance-criteria.test.ts`
- `tests/integration/terminal-history-framework/initial-history-replay-capture.test.ts`
- `tests/integration/terminal-history-framework/post-websocket-command-executor.test.ts`
- `tests/integration/terminal-history-framework/post-websocket-command-executor-integration.test.ts`
- `tests/integration/terminal-history-framework/story5-acceptance-criteria.test.ts`
- `tests/integration/terminal-history-framework/comprehensive-response-collector.test.ts`
- `tests/integration/terminal-history-framework/comprehensive-response-collector-integration.test.ts`
- `tests/integration/terminal-history-framework/story6-acceptance-criteria.test.ts`
- `tests/integration/terminal-history-framework/flexible-command-configuration.test.ts`
- `tests/integration/terminal-history-framework/flexible-command-configuration-integration.test.ts`
- `tests/integration/terminal-history-framework/story7-acceptance-criteria.test.ts`
- `tests/integration/terminal-history-framework/robust-error-diagnostics.test.ts`
- `tests/integration/terminal-history-framework/robust-error-diagnostics-integration.test.ts`
- `tests/integration/terminal-history-framework/initial-history-replay-capture-integration.test.ts`
- `tests/integration/terminal-history-framework/jest-test-utilities.test.ts`

**Extended Villenele-Utilizing Test Files:**
- `tests/story3-websocket-connection-discovery-integration.test.ts`
- `tests/story3-websocket-connection-discovery-e2e.test.ts`
- `tests/story3-websocket-connection-discovery-unit.test.ts`
- `tests/terminal-history-integration-simple.test.ts`
- `tests/websocket-crlf-debug.test.ts`
- `tests/debug-session-management.test.ts`
- `tests/terminal-fixes-verification.test.ts`

**Total Files Requiring Migration: 39 files**

## Technical Implementation Notes

### Migration Strategy
- **Automated Conversion**: Create automated migration tool to convert all test files
- **Pattern Recognition**: Identify all instances of legacy string array formats
- **Safe Transformation**: Preserve test functionality while converting parameter structure
- **Validation Integration**: Ensure converted tests pass validation and execute correctly

### Conversion Algorithm
```typescript
// Migration conversion logic
function migrateCommands(legacyCommands: string[]): EnhancedCommand[] {
  return legacyCommands.map(command => ({
    initiator: 'mcp-client',
    command: command,
    // cancel and waitToCancelMs will use defaults
  }));
}
```

### File Processing Approach
- **Directory Traversal**: Recursively process all test files in test directories
- **Backup Creation**: Create backups before migration for rollback capability
- **Batch Processing**: Process files in batches with progress reporting
- **Verification Loop**: Verify each converted file passes tests before proceeding

### Post-Migration Validation
- **Automated Testing**: Run complete test suite after migration
- **Pattern Search**: Search for any remaining legacy patterns
- **Performance Benchmarking**: Compare test execution performance before/after
- **Documentation Updates**: Update any test documentation referencing legacy formats

This story ensures complete transition to the enhanced parameter structure across the entire Villenele test suite, eliminating backward compatibility requirements and establishing the new format as the universal standard.