# User Story: SSH Key File Path Support

## Story

**As a** user of the SSH MCP server  
**I want to** specify SSH key file paths instead of pasting key content  
**So that** I can use my existing SSH keys without manual copy-pasting

## Acceptance Criteria

### AC1: Key File Path Parameter
**Given** I have an SSH private key file at `~/.ssh/id_rsa`  
**When** I call `ssh_connect` with `keyFilePath="~/.ssh/id_rsa"`  
**Then** the server reads the key file and uses it for authentication  
**And** I don't need to provide the `privateKey` parameter

### AC2: Encrypted Key with Passphrase  
**Given** I have an encrypted SSH private key at `~/.ssh/id_rsa`  
**When** I call `ssh_connect` with `keyFilePath="~/.ssh/id_rsa"` and `passphrase="mypassword"`  
**Then** the server decrypts the key using the passphrase and connects successfully  
**And** the passphrase is only used for decryption, not stored

### AC3: Path Expansion
**Given** I specify a key path with tilde expansion like `~/keys/mykey`  
**When** I call `ssh_connect` with the tilde path  
**Then** the server expands `~` to the user's home directory and reads the correct file

### AC4: Error Handling
**Given** I specify a non-existent key file path  
**When** I call `ssh_connect` with invalid `keyFilePath`  
**Then** I receive a clear error message indicating the file was not found  
**And** the connection attempt fails gracefully

### AC5: Backward Compatibility
**Given** I want to use the current approach  
**When** I call `ssh_connect` with `privateKey` parameter (current method)  
**Then** the connection works exactly as before  
**And** the new parameters are ignored

### AC6: Parameter Priority
**Given** I provide both `privateKey` and `keyFilePath` parameters  
**When** I call `ssh_connect`  
**Then** the server uses `privateKey` and ignores `keyFilePath`  
**And** logs a warning about conflicting parameters

## Technical Implementation Notes

### Enhanced Tool Schema
```
ssh_connect parameters:
- name (required): session identifier
- host (required): target hostname  
- username (required): SSH username
- password (optional): SSH password
- privateKey (optional): SSH private key content (current approach)
- keyFilePath (optional): path to SSH private key file
- passphrase (optional): passphrase for encrypted keys
```

### Key Processing Algorithm
```
1. IF privateKey provided → use directly (current flow)
2. ELSE IF keyFilePath provided:
   a. Expand tilde and resolve absolute path
   b. Read key file content
   c. IF key is encrypted AND passphrase provided → decrypt
   d. Use resulting key content for connection
3. ELSE → require password authentication
```

### Libraries Required
- Built-in `fs` module for file reading
- Built-in `os` module for home directory expansion  
- `crypto` module or `ssh2` built-in decryption for encrypted keys

## Definition of Done

- [ ] Enhanced `ssh_connect` tool accepts `keyFilePath` and `passphrase` parameters
- [ ] File path expansion works for tilde paths (`~/.ssh/id_rsa`) 
- [ ] Encrypted key decryption works with user-provided passphrase
- [ ] Backward compatibility maintained for existing `privateKey` approach
- [ ] Comprehensive error handling for file operations and decryption
- [ ] Manual testing completed against real SSH server using file-based keys
- [ ] E2E tests validate new functionality with various key types and encryption states