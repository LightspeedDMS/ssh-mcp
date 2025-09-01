#!/usr/bin/env node

import { UnifiedMCPServer, UnifiedMCPServerConfig } from './unified-mcp-server.js';

// Main execution when run directly
async function main(): Promise<void> {
  const config: UnifiedMCPServerConfig = {
    webPort: process.env.WEB_PORT ? parseInt(process.env.WEB_PORT) : undefined, // Let it auto-discover
    sshTimeout: process.env.SSH_TIMEOUT ? parseInt(process.env.SSH_TIMEOUT) * 1000 : 30000,
    maxSessions: process.env.MAX_SESSIONS ? parseInt(process.env.MAX_SESSIONS) : 10,
    logLevel: process.env.LOG_LEVEL || 'info'
  };

  // Use the new unified server architecture
  const unifiedServer = new UnifiedMCPServer(config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await unifiedServer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await unifiedServer.stop();
    process.exit(0);
  });

  try {
    await unifiedServer.start();
  } catch (error) {
    console.error('Failed to start unified server:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}