# Story 06: Dynamic Expected Value Construction

## User Story

**As a** Villenele test developer  
**I want** runtime generation of expected command outputs with parameterized values  
**So that** tests work across different environments, user accounts, and directory structures without hardcoded expectations

## Acceptance Criteria

### Environment-Specific Value Construction

**AC 6.1**: Dynamic username value construction
- **Given** test execution requiring username validation
- **When** Villenele constructs expected values for `whoami` command  
- **Then** expected result should be dynamically generated as `${process.env.USER}`
- **And** runtime value should resolve to actual current username (e.g., "jsbattig", "testuser", "ubuntu")
- **And** assertion should compare against resolved runtime value, not hardcoded string
- **And** test should pass regardless of which user account executes the test

**AC 6.2**: Dynamic working directory value construction
- **Given** test execution requiring current directory validation
- **When** Villenele constructs expected values for `pwd` command
- **Then** expected result should be dynamically generated as `${process.env.PWD}`
- **And** runtime value should resolve to actual current working directory
- **And** assertion should handle directory path variations across different execution environments
- **And** test should pass when executed from different project locations

**AC 6.3**: Dynamic hostname value construction
- **Given** test execution requiring hostname validation  
- **When** Villenele constructs expected values involving hostname
- **Then** expected result should be dynamically generated using runtime hostname resolution
- **And** hostname should be resolved via `os.hostname()` or equivalent system call
- **And** assertions should work across different machines and containerized environments
- **And** test should pass on localhost, containers, and remote systems

### Runtime Value Resolution Strategy

**AC 6.4**: Pre-execution environment preparation
- **Given** test configuration requiring dynamic expected values
- **When** Villenele begins test execution
- **Then** environment preparation phase should execute before main test commands
- **And** preparation should capture: current user, working directory, hostname, system info
- **And** captured values should be available for expected value construction throughout test
- **And** preparation should be cached for test session to avoid repeated system calls

**AC 6.5**: Dynamic value substitution in expected outputs
- **Given** command expected output: `Expected: [${process.env.USER}@${process.env.HOSTNAME} ${process.env.PWD}]$ ls`
- **When** runtime value substitution is performed
- **Then** template should resolve to actual values: `[jsbattig@localhost /home/jsbattig/Dev/ls-ssh-mcp]$ ls`
- **And** substitution should handle all environment variables correctly
- **And** missing environment variables should be handled gracefully with appropriate defaults or errors

**AC 6.6**: Cross-platform compatibility handling
- **Given** test execution across different operating systems
- **When** dynamic value construction involves system-specific behavior
- **Then** path separators should be normalized appropriately (Unix vs Windows)
- **And** user account naming conventions should be handled correctly
- **And** system command outputs should be adapted for platform differences
- **And** tests should provide consistent behavior across Linux, macOS, and Windows environments

### Command Output Pattern Matching

**AC 6.7**: Volatile output handling with regex patterns
- **Given** commands producing volatile outputs like timestamps: `{initiator: 'browser', command: 'date'}`
- **When** expected value construction encounters timestamp outputs
- **Then** expected pattern should use regex: `/\w{3} \w{3} \d{1,2} \d{2}:\d{2}:\d{2} \w{3} \d{4}/`
- **And** assertion should validate format rather than exact timestamp match
- **And** test should pass despite temporal variations in command execution
- **And** pattern matching should be robust across different locale settings

**AC 6.8**: Directory listing dynamic validation
- **Given** command requiring directory content validation: `{initiator: 'browser', command: 'ls'}`
- **When** expected value construction processes directory listing
- **Then** expected contents should be dynamically determined by executing preparatory `ls` command
- **And** file/directory presence should be validated rather than hardcoded list
- **And** ordering variations should be handled appropriately (name vs time sorting)
- **And** test should adapt to actual project directory contents

**AC 6.9**: Process information dynamic validation
- **Given** commands involving process information: `{initiator: 'mcp-client', command: 'ps aux | grep ssh'}`
- **When** expected value construction handles process listing
- **Then** expected pattern should focus on process existence rather than specific PIDs
- **And** dynamic process IDs and memory usage should be handled with regex patterns
- **And** assertion should validate process presence and basic characteristics
- **And** test should work regardless of system load and process variations

### Template System Implementation

**AC 6.10**: Template variable expansion system
- **Given** template string with variables: `"User: ${USER}, Directory: ${PWD}, Files: ${LS_OUTPUT}"`
- **When** template expansion is performed
- **Then** system should resolve `${USER}` to current username
- **And** resolve `${PWD}` to current working directory
- **And** resolve `${LS_OUTPUT}` to actual directory contents
- **And** handle nested variable references and complex expressions

**AC 6.11**: Custom variable definition and usage
- **Given** test requiring custom computed values
- **When** Villenele defines custom template variables
- **Then** custom variables should be computed via preparatory command execution
- **And** custom variable: `${SSH_SESSION_COUNT}` should resolve via `who | wc -l`
- **And** custom variable: `${CURRENT_BRANCH}` should resolve via `git branch --show-current`
- **And** custom variables should be available throughout test execution

**AC 6.12**: Conditional template resolution
- **Given** template requiring conditional logic: `"${FILE_EXISTS:myfile.txt ? 'File found' : 'File missing'}"`
- **When** conditional template expansion is performed
- **Then** system should evaluate file existence condition
- **And** return appropriate conditional result based on actual file state
- **And** support multiple conditional operators: exists, not-exists, equals, contains
- **And** handle nested conditional expressions appropriately

### Integration with Test Assertions

**AC 6.13**: Dynamic expected value integration with Jest matchers
- **Given** test assertion requiring dynamic expected value
- **When** using custom Jest matcher: `expect(output).toMatchDynamicPattern(template)`
- **Then** matcher should perform runtime template resolution
- **And** compare actual output against resolved expected pattern
- **And** provide clear error messages showing both template and resolved values
- **And** support regex pattern matching within template system

**AC 6.14**: Assertion error diagnostics with dynamic values
- **Given** test failure with dynamic expected values
- **When** assertion fails to match expected pattern
- **Then** error message should show: original template, resolved expected value, actual output
- **And** highlight specific mismatches between expected and actual results
- **And** provide guidance for fixing template or understanding output variations
- **And** include environment context that might affect expected value resolution

**AC 6.15**: Performance optimization for repeated template resolution
- **Given** multiple test cases using same dynamic values
- **When** template resolution is performed repeatedly
- **Then** computed values should be cached per test session
- **And** expensive system calls should be minimized through caching strategy
- **And** cache invalidation should occur when environment changes
- **And** overall test execution time should not be significantly impacted by dynamic resolution

### Complex Scenario Integration

**AC 6.16**: Multi-command expected value coordination
- **Given** command sequence requiring coordinated expected values:
```typescript
postWebSocketCommands: [
  {initiator: 'browser', command: 'echo "test_${TIMESTAMP}"'},
  {initiator: 'mcp-client', command: 'echo "test_${TIMESTAMP}" | wc -c'},
  {initiator: 'browser', command: 'date "+%Y-%m-%d %H:%M:%S"'}
]
```
- **When** dynamic value construction handles command interdependencies
- **Then** `${TIMESTAMP}` should be consistent across all commands in sequence
- **And** second command expected output should include dynamically created directory name
- **And** command sequence coordination should maintain value consistency

**AC 6.17**: Environment state change handling
- **Given** commands that modify environment state during execution
- **When** dynamic expected values depend on environment state
- **Then** value construction should detect state changes mid-execution
- **And** update expected values based on new environment state
- **And** maintain accuracy across state transitions within single test
- **And** handle directory changes, file creation/deletion appropriately

**AC 6.18**: Cross-environment test portability validation
- **Given** complete test suite using dynamic expected value construction
- **When** test suite is executed across different environments:
  - Different user accounts (jsbattig, testuser, ubuntu, etc.)
  - Different directory locations (/home/user/project, /opt/app, /tmp/test)
  - Different hostnames (localhost, container-name, server-hostname)
- **Then** all tests should pass without modification
- **And** no hardcoded values should cause environment-specific failures
- **And** test behavior should be consistent while adapting to environmental differences
- **And** zero manual configuration should be required for cross-environment execution

## Definition of Done

- [x] ✅ Dynamic value construction working for all environment-specific variables
- [x] ✅ Runtime template resolution system implemented with variable expansion
- [x] ✅ Volatile output pattern matching handles timestamps, PIDs, and dynamic content
- [x] ✅ Cross-platform compatibility ensures tests work across different operating systems
- [x] ✅ Jest matcher integration provides clear error diagnostics with resolved values
- [x] ✅ Performance optimization through caching prevents test execution slowdown
- [x] ✅ Complex multi-command scenarios maintain value consistency throughout execution
- [x] ✅ Cross-environment portability validated across different user accounts and systems

## Technical Implementation Notes

### Template Resolution Architecture
- **Variable Registry**: Central registry of available template variables
- **Resolution Engine**: Template string parser with variable substitution
- **Caching Layer**: Efficient caching of computed values during test session
- **Error Handling**: Clear error messages for missing or invalid template variables

### Environment Value Sources
```typescript
interface EnvironmentValues {
  USER: string;           // process.env.USER || os.userInfo().username
  PWD: string;            // process.cwd()
  HOSTNAME: string;       // os.hostname()
  HOME: string;           // os.homedir()
  LS_OUTPUT: string[];    // fs.readdirSync(process.cwd())
  TIMESTAMP: string;      // Date.now().toString()
  GIT_BRANCH: string;     // exec('git branch --show-current')
}
```

### Template Syntax Design
- **Simple Variables**: `${VARIABLE_NAME}`
- **Command Execution**: `${exec:command here}`
- **Conditional Logic**: `${condition ? true_value : false_value}`
- **Regex Patterns**: `${pattern:/regex_here/flags}`

### Jest Integration Strategy
```typescript
expect(actualOutput).toMatchDynamicTemplate('Expected: ${USER}@${HOSTNAME} in ${PWD}');
```

### Cross-Platform Considerations
- **Path Normalization**: Handle Unix vs Windows path separators
- **Command Variations**: Account for different command outputs across platforms
- **Environment Differences**: Handle varying environment variable availability
- **Locale Handling**: Account for different date/time formats and language outputs

This story ensures that Villenele tests are truly portable and environment-independent while maintaining accuracy and reliability across diverse execution contexts.