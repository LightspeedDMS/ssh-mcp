#!/bin/bash

# SSH MCP Server - Complete Linting Script
# Runs all code quality checks and fixes

set -e

echo "🔍 SSH MCP Server - Full Linting Suite"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "Installing dependencies..."
    npm install
fi

echo
echo "🔧 TypeScript Compilation Check"
echo "------------------------------"
if npm run build; then
    print_status "TypeScript compilation successful"
else
    print_error "TypeScript compilation failed"
    exit 1
fi

echo
echo "📝 ESLint Check"
echo "---------------"
if npx eslint . --ext .ts,.js --max-warnings 0; then
    print_status "ESLint check passed - no violations"
else
    print_warning "ESLint found violations - attempting to fix..."
    if npx eslint . --ext .ts,.js --fix; then
        print_status "ESLint auto-fix completed"
        # Run again to check if issues remain
        if npx eslint . --ext .ts,.js --max-warnings 0; then
            print_status "All ESLint issues resolved"
        else
            print_error "ESLint issues remain after auto-fix"
            exit 1
        fi
    else
        print_error "ESLint auto-fix failed"
        exit 1
    fi
fi

echo
echo "🎨 Prettier Check"
echo "----------------"
if npx prettier --check "src/**/*.ts" "tests/**/*.ts" "*.js" "*.json" "*.md"; then
    print_status "Prettier formatting is correct"
else
    print_warning "Prettier found formatting issues - fixing..."
    npx prettier --write "src/**/*.ts" "tests/**/*.ts" "*.js" "*.json" "*.md"
    print_status "Prettier formatting applied"
fi

echo
echo "🔍 TypeScript Type Check (strict)"
echo "--------------------------------"
if npx tsc --noEmit --strict; then
    print_status "TypeScript strict type check passed"
else
    print_error "TypeScript strict type check failed"
    exit 1
fi

echo
echo "📦 Package Audit"
echo "----------------"
if npm audit --audit-level=moderate; then
    print_status "No moderate+ security vulnerabilities found"
else
    print_warning "Security vulnerabilities found - review npm audit output"
fi

echo
echo "🧹 Unused Dependencies Check"
echo "----------------------------"
if command -v depcheck >/dev/null 2>&1; then
    if depcheck --ignores="@types/*,eslint-*,prettier"; then
        print_status "No unused dependencies found"
    else
        print_warning "Unused dependencies detected - review depcheck output"
    fi
else
    print_warning "depcheck not installed - skipping unused dependency check"
    echo "Install with: npm install -g depcheck"
fi

echo
echo "🏗️  Build Verification"
echo "---------------------"
if [ -d "dist" ] && [ -f "dist/src/mcp-server.js" ]; then
    print_status "Build output verified"
else
    print_error "Build output missing or incomplete"
    exit 1
fi

echo
echo "📊 Project Statistics"
echo "--------------------"
echo "TypeScript files: $(find src -name '*.ts' | wc -l)"
echo "Test files: $(find tests -name '*.test.ts' 2>/dev/null | wc -l || echo 0)"
echo "Total lines of code: $(find src -name '*.ts' -exec wc -l {} + | tail -1 | awk '{print $1}')"

echo
print_status "All linting checks completed successfully!"
echo "Repository is ready for commit/deployment."