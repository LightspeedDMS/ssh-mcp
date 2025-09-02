import * as net from "net";

/**
 * Find an available port starting from a base port
 */
export async function findAvailablePort(
  startPort: number = 8080,
): Promise<number> {
  if (startPort < 1 || startPort > 65535) {
    throw new Error("Invalid port: must be between 1 and 65535");
  }

  return new Promise((resolve, reject) => {
    function tryPort(port: number): void {
      if (port > 65534) {
        reject(new Error("No available ports found in range"));
        return;
      }

      const server = net.createServer();

      server.listen(port, () => {
        const assignedPort = (server.address() as net.AddressInfo)?.port;
        server.close(() => {
          if (assignedPort) {
            resolve(assignedPort);
          } else {
            reject(new Error("Failed to get assigned port"));
          }
        });
      });

      server.on("error", (err: { code?: string } & Error) => {
        if (err.code === "EADDRINUSE") {
          // Port is in use, try next port
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
    }

    tryPort(startPort);
  });
}

/**
 * Manages port reservations for unified server architecture
 */
export class PortManager {
  private reservedPorts: Set<number> = new Set();
  private portLock: Promise<number> = Promise.resolve(0);

  /**
   * Reserve a port, skipping already reserved ports
   */
  async reservePort(preferredPort: number): Promise<number> {
    if (preferredPort < 1 || preferredPort > 65535) {
      throw new Error("Invalid port: must be between 1 and 65535");
    }

    // Ensure sequential port reservation to avoid race conditions
    await this.portLock;

    this.portLock = this._reservePortInternal(preferredPort);
    return this.portLock;
  }

  private async _reservePortInternal(preferredPort: number): Promise<number> {
    let currentPort = preferredPort;

    while (currentPort <= 65535) {
      if (this.reservedPorts.has(currentPort)) {
        currentPort++;
        continue;
      }

      try {
        // Test if port is available
        await this.testPortAvailability(currentPort);
        this.reservedPorts.add(currentPort);
        return currentPort;
      } catch (error) {
        if ((error as { code?: string } & Error).code === "EADDRINUSE") {
          currentPort++;
          continue;
        } else {
          throw error;
        }
      }
    }

    throw new Error("No available ports found in range");
  }

  /**
   * Reserve a port directly without checking if it's available (for testing)
   */
  async reservePortDirectly(port: number): Promise<number> {
    if (port < 1 || port > 65535) {
      throw new Error("Invalid port: must be between 1 and 65535");
    }

    if (this.reservedPorts.has(port)) {
      throw new Error("Port already reserved");
    }

    this.reservedPorts.add(port);
    return port;
  }

  private testPortAvailability(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();

      server.listen(port, () => {
        server.close(() => resolve());
      });

      server.on("error", reject);
    });
  }

  /**
   * Get a single port for unified server (MCP + Web + WebSocket)
   */
  async getUnifiedPort(preferredPort: number = 8080): Promise<number> {
    return this.reservePort(preferredPort);
  }

  /**
   * Release a reserved port
   */
  releasePort(port: number): void {
    this.reservedPorts.delete(port);
  }

  /**
   * Check if a port is reserved
   */
  isReserved(port: number): boolean {
    return this.reservedPorts.has(port);
  }

  /**
   * Get all reserved ports
   */
  getReservedPorts(): number[] {
    return Array.from(this.reservedPorts);
  }

  /**
   * Cleanup all reserved ports
   */
  cleanup(): void {
    this.reservedPorts.clear();
  }
}
