#!/bin/bash

# SSH Key File Authentication Test Environment Setup Script
# This script sets up the test environment for manual e2e testing

set -e  # Exit on error

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}SSH Key File Authentication - Test Environment Setup${NC}"
echo "====================================================="
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check prerequisites
echo "Checking prerequisites..."

# Check if SSH server is installed
if command -v sshd &> /dev/null; then
    print_status "SSH server is installed"
else
    print_error "SSH server is not installed. Please install openssh-server"
    exit 1
fi

# Check if SSH service is running
if systemctl is-active --quiet ssh || systemctl is-active --quiet sshd; then
    print_status "SSH service is running"
else
    print_error "SSH service is not running. Please start it with: sudo systemctl start ssh"
    exit 1
fi

# Check if test_user exists
if id "test_user" &>/dev/null; then
    print_status "test_user account exists"
else
    print_info "test_user does not exist. Creating it now..."
    sudo useradd -m -s /bin/bash test_user
    echo "test_user:password123" | sudo chpasswd
    print_status "test_user created with password: password123"
fi

# Create test directory structure
echo ""
echo "Setting up test directory structure..."

TEST_KEY_DIR="$HOME/ssh-test-keys"

# Clean up if exists
if [ -d "$TEST_KEY_DIR" ]; then
    print_info "Removing existing test directory..."
    rm -rf "$TEST_KEY_DIR"
fi

mkdir -p "$TEST_KEY_DIR/valid"
mkdir -p "$TEST_KEY_DIR/invalid"
mkdir -p "$TEST_KEY_DIR/restricted"
chmod 700 "$TEST_KEY_DIR"
print_status "Created test directory structure at $TEST_KEY_DIR"

# Generate SSH keys
echo ""
echo "Generating test SSH keys..."

# Unencrypted RSA key
ssh-keygen -t rsa -b 2048 -f "$TEST_KEY_DIR/valid/test_rsa_unencrypted" -N "" -C "test_rsa_unencrypted" -q
print_status "Generated unencrypted RSA key"

# Encrypted RSA key
ssh-keygen -t rsa -b 2048 -f "$TEST_KEY_DIR/valid/test_rsa_encrypted" -N "testpass123" -C "test_rsa_encrypted" -q
print_status "Generated encrypted RSA key (passphrase: testpass123)"

# Unencrypted ED25519 key
ssh-keygen -t ed25519 -f "$TEST_KEY_DIR/valid/test_ed25519_unencrypted" -N "" -C "test_ed25519_unencrypted" -q
print_status "Generated unencrypted ED25519 key"

# Encrypted ED25519 key
ssh-keygen -t ed25519 -f "$TEST_KEY_DIR/valid/test_ed25519_encrypted" -N "secure456" -C "test_ed25519_encrypted" -q
print_status "Generated encrypted ED25519 key (passphrase: secure456)"

# Create invalid key for testing
echo "INVALID SSH KEY CONTENT" > "$TEST_KEY_DIR/invalid/not_a_key"
print_status "Created invalid key file for negative testing"

# Create restricted permission key
cp "$TEST_KEY_DIR/valid/test_rsa_unencrypted" "$TEST_KEY_DIR/restricted/test_rsa_restricted"
chmod 000 "$TEST_KEY_DIR/restricted/test_rsa_restricted"
print_status "Created restricted permission key for testing"

# Configure SSH for test_user
echo ""
echo "Configuring SSH authentication for test_user..."

# Create .ssh directory for test_user
sudo -u test_user mkdir -p /home/test_user/.ssh
sudo -u test_user chmod 700 /home/test_user/.ssh

# Create/clear authorized_keys
sudo -u test_user touch /home/test_user/.ssh/authorized_keys
sudo -u test_user chmod 600 /home/test_user/.ssh/authorized_keys
sudo -u test_user truncate -s 0 /home/test_user/.ssh/authorized_keys

# Add public keys to authorized_keys
sudo -u test_user bash -c "cat $TEST_KEY_DIR/valid/test_rsa_unencrypted.pub >> /home/test_user/.ssh/authorized_keys"
sudo -u test_user bash -c "cat $TEST_KEY_DIR/valid/test_rsa_encrypted.pub >> /home/test_user/.ssh/authorized_keys"
sudo -u test_user bash -c "cat $TEST_KEY_DIR/valid/test_ed25519_unencrypted.pub >> /home/test_user/.ssh/authorized_keys"
sudo -u test_user bash -c "cat $TEST_KEY_DIR/valid/test_ed25519_encrypted.pub >> /home/test_user/.ssh/authorized_keys"

print_status "Added all test public keys to test_user's authorized_keys"

# Verify SSH configuration
echo ""
echo "Verifying SSH server configuration..."

PUBKEY_AUTH=$(sudo grep "^PubkeyAuthentication" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}')
if [ "$PUBKEY_AUTH" = "yes" ] || [ -z "$PUBKEY_AUTH" ]; then
    print_status "PubkeyAuthentication is enabled"
else
    print_error "PubkeyAuthentication is not enabled in /etc/ssh/sshd_config"
    print_info "You may need to edit /etc/ssh/sshd_config and set: PubkeyAuthentication yes"
fi

# Test basic SSH connectivity
echo ""
echo "Testing SSH connectivity..."

# Test with password (non-interactive using sshpass if available)
if command -v sshpass &> /dev/null; then
    if sshpass -p "password123" ssh -o StrictHostKeyChecking=no test_user@localhost "echo 'Password auth works'" 2>/dev/null; then
        print_status "Password authentication works"
    else
        print_error "Password authentication failed"
    fi
else
    print_info "sshpass not installed, skipping password auth test"
fi

# Test with key
if ssh -o StrictHostKeyChecking=no -o PasswordAuthentication=no -i "$TEST_KEY_DIR/valid/test_rsa_unencrypted" test_user@localhost "echo 'Key auth works'" 2>/dev/null; then
    print_status "Key authentication works"
else
    print_error "Key authentication failed - manual investigation needed"
fi

# Display summary
echo ""
echo "====================================================="
echo -e "${GREEN}Test environment setup complete!${NC}"
echo ""
echo "Test Resources Created:"
echo "  - Test user: test_user (password: password123)"
echo "  - Test keys directory: $TEST_KEY_DIR"
echo "  - Unencrypted RSA key: $TEST_KEY_DIR/valid/test_rsa_unencrypted"
echo "  - Encrypted RSA key: $TEST_KEY_DIR/valid/test_rsa_encrypted (pass: testpass123)"
echo "  - Unencrypted ED25519 key: $TEST_KEY_DIR/valid/test_ed25519_unencrypted"
echo "  - Encrypted ED25519 key: $TEST_KEY_DIR/valid/test_ed25519_encrypted (pass: secure456)"
echo ""
echo "Next Steps:"
echo "  1. Navigate to project: cd /home/jsbattig/Dev/ls-ssh-mcp"
echo "  2. Build the project: npm run build"
echo "  3. Start MCP server: npm start"
echo "  4. Run the manual test plan from ssh-key-file-e2e-test-plan.md"
echo ""
echo "To clean up after testing, run: ./cleanup-test-environment.sh"