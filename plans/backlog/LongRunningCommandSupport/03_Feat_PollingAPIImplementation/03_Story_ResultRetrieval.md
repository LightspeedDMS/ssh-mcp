# Story: Result Retrieval

## Story Overview
**Story ID:** 03_Story_ResultRetrieval
**Feature:** 03_Feat_PollingAPIImplementation
**Epic:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning

## User Story
[Conversation Reference: User specified "Return completion results when task finishes"]

As an MCP client managing completed background tasks
I want to retrieve complete task results via ssh_get_command_status
So that I can access stdout, stderr, exit codes, and completion details

## Problem Context
[Conversation Reference: User's requirement for complete result retrieval after task completion]

When background tasks complete, clients need access to all execution results including output, errors, and exit codes that would normally be available from synchronous execution.

## Acceptance Criteria

### Complete Result Retrieval
[Conversation Reference: User specified "Return completion results when task finishes"]

```gherkin
Given a background task has completed successfully
When ssh_get_command_status is called
Then complete stdout output is returned
And complete stderr output is returned
And the exit code is provided
And completion timestamp is included
```

### Output Completeness
```gherkin
Given a task produced extensive output during execution
When results are retrieved
Then the complete stdout is returned without truncation
And the complete stderr is returned without truncation
And output ordering is preserved as it occurred during execution
```

### Exit Code Accuracy
```gherkin
Given a task completed with a specific exit code
When results are retrieved
Then the exact exit code is returned
And exit code interpretation is available
And success/failure status is clearly indicated
```

### Failed Task Results
```gherkin
Given a background task failed during execution
When results are retrieved
Then failure information is provided
And any output produced before failure is available
And error details and exit codes are included
```

## Technical Implementation

### Result Data Structure
[Conversation Reference: Based on user's complete result retrieval requirement]

```typescript
interface TaskResults {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  completionTime: Date;
  outputSize: {
    stdoutBytes: number;
    stderrBytes: number;
  };
  executionSummary: {
    totalDuration: number;
    completionStatus: 'success' | 'failure' | 'error';
  };
}
```

### Result Collection
- **Output Capture**: Collect complete stdout and stderr during execution
- **Exit Code Tracking**: Track final exit code from command execution
- **Completion Detection**: Detect when tasks complete successfully or fail
- **Result Storage**: Store complete results in session for retrieval

### Result Formatting
- **Output Preservation**: Preserve exact output formatting and content
- **Size Information**: Provide output size information for large results
- **Metadata Inclusion**: Include execution metadata and summary information
- **Error Context**: Provide context for failed executions

## Implementation Steps

1. **Result Storage Enhancement**: Enhance session storage for complete results
2. **Output Collection**: Implement comprehensive output collection
3. **Result Formatting**: Format complete results for API responses
4. **Retrieval Integration**: Integrate result retrieval with status API

## Testing Strategy

### Result Completeness Testing
- **Large Output**: Test with commands producing extensive output
- **Mixed Output**: Test commands with both stdout and stderr
- **Exit Code Validation**: Test various exit code scenarios

### Integration Testing
- **Storage Integration**: Test result storage in session data
- **Retrieval Integration**: Test result retrieval via status API
- **Threading Integration**: Test result collection from background threads

## Definition of Done

### Functional Requirements
- [ ] Complete stdout and stderr retrieval for completed tasks
- [ ] Accurate exit code reporting for all task completions
- [ ] Comprehensive result information including timing and metadata
- [ ] Failed task result retrieval with error context

### Technical Requirements
- [ ] Efficient storage and retrieval of large output results
- [ ] Preservation of output formatting and ordering
- [ ] Integration with session storage and status API
- [ ] Thread-safe result collection and access

### Validation Requirements
- [ ] Result completeness verified for various command types
- [ ] Exit code accuracy confirmed across different scenarios
- [ ] Large output handling validated without truncation
- [ ] Failed task result retrieval tested

## Result Examples

### Successful Command Results
```json
{
  "success": true,
  "sessionName": "user-session-123",
  "taskState": "completed",
  "results": {
    "stdout": "Processing complete\nTotal files: 1,234\nErrors: 0\n",
    "stderr": "",
    "exitCode": 0,
    "success": true,
    "completionTime": "2025-09-20T10:15:30.000Z",
    "outputSize": {
      "stdoutBytes": 45,
      "stderrBytes": 0
    },
    "executionSummary": {
      "totalDuration": 930000,
      "completionStatus": "success"
    }
  }
}
```

### Failed Command Results
```json
{
  "success": true,
  "sessionName": "user-session-123",
  "taskState": "failed",
  "results": {
    "stdout": "Starting backup process...\nConnecting to database...\n",
    "stderr": "Error: Connection timeout\nFailed to connect to database server\n",
    "exitCode": 1,
    "success": false,
    "completionTime": "2025-09-20T10:05:15.000Z",
    "outputSize": {
      "stdoutBytes": 52,
      "stderrBytes": 67
    },
    "executionSummary": {
      "totalDuration": 315000,
      "completionStatus": "failure"
    }
  }
}
```

## Integration Points

### Session Storage Integration
[Conversation Reference: User's session-based task storage for results]

- **Result Storage**: Store complete results in session data
- **Output Management**: Manage large output storage efficiently
- **Persistence**: Maintain results until explicitly cleared
- **Access Control**: Ensure session-based access to results

### Background Thread Integration
- **Output Collection**: Collect output from executing threads
- **Result Aggregation**: Aggregate results when tasks complete
- **State Synchronization**: Synchronize completion state with results
- **Error Handling**: Handle result collection errors gracefully

## Performance Considerations

### Large Output Handling
- **Memory Management**: Efficient handling of large stdout/stderr
- **Streaming Collection**: Stream output collection during execution
- **Storage Optimization**: Optimize storage of large result sets
- **Retrieval Performance**: Fast retrieval of large results

### Result Processing
- **Format Preservation**: Preserve output formatting efficiently
- **Metadata Generation**: Generate result metadata efficiently
- **Response Optimization**: Optimize result response formatting

## Risk Mitigation

### Data Integrity
- **Output Completeness**: Ensuring no output is lost during collection
  - *Mitigation*: Robust output streaming and buffering mechanisms
- **Result Accuracy**: Ensuring results accurately reflect execution
  - *Mitigation*: Comprehensive testing and validation procedures

### Performance Impact
- **Memory Usage**: Large results consuming excessive memory
  - *Mitigation*: Memory management and result size monitoring
- **Storage Overhead**: Result storage impacting system performance
  - *Mitigation*: Efficient storage mechanisms and cleanup procedures

### Error Handling
- **Collection Failures**: Failures in result collection process
  - *Mitigation*: Robust error handling and fallback mechanisms
- **Partial Results**: Handling scenarios with incomplete results
  - *Mitigation*: Clear indication of result completeness and error context