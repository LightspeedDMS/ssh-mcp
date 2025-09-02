import { findAvailablePort, PortManager } from "../src/port-discovery";
import * as net from "net";

describe("Single Port Discovery Mechanism", () => {
  let occupiedServers: net.Server[] = [];

  afterEach(async () => {
    // Clean up any servers created during tests
    await Promise.all(
      occupiedServers.map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    );
    occupiedServers = [];
  });

  describe("findAvailablePort", () => {
    it("should find an available port starting from base port", async () => {
      // Use a higher port range to avoid conflicts
      const port = await findAvailablePort(9000);
      expect(port).toBeGreaterThanOrEqual(9000);
      expect(port).toBeLessThan(65536);
    });

    it("should skip occupied ports and find next available", async () => {
      // Use higher port range to avoid system conflicts
      const testPort = 9050;

      // Occupy the test port
      const server1 = net.createServer();
      occupiedServers.push(server1);

      await new Promise<void>((resolve, reject) => {
        server1.listen(testPort, () => resolve());
        server1.on("error", reject);
      });

      const port = await findAvailablePort(testPort);
      expect(port).toBeGreaterThan(testPort);
      expect(port).toBeLessThan(65536);
    });

    it("should handle multiple occupied ports", async () => {
      const startPort = 9100;

      // Occupy ports 9100-9102
      for (let i = 0; i < 3; i++) {
        const server = net.createServer();
        occupiedServers.push(server);
        await new Promise<void>((resolve, reject) => {
          server.listen(startPort + i, () => resolve());
          server.on("error", reject);
        });
      }

      const port = await findAvailablePort(startPort);
      expect(port).toBeGreaterThanOrEqual(startPort + 3);
    });

    it("should handle port range exhaustion", async () => {
      // Test with port at the limit
      await expect(findAvailablePort(65535)).rejects.toThrow(
        "No available ports found in range",
      );
    });
  });

  describe("PortManager", () => {
    let portManager: PortManager;

    beforeEach(() => {
      portManager = new PortManager();
    });

    it("should reserve and track ports using direct reservation", async () => {
      const testPort1 = 9200;
      const testPort2 = 9201;

      const port1 = await portManager.reservePortDirectly(testPort1);
      const port2 = await portManager.reservePortDirectly(testPort2);

      expect(port1).toBe(testPort1);
      expect(port2).toBe(testPort2);

      expect(portManager.isReserved(testPort1)).toBe(true);
      expect(portManager.isReserved(testPort2)).toBe(true);
    });

    it("should release reserved ports", async () => {
      const testPort = 9210;
      const port = await portManager.reservePortDirectly(testPort);
      expect(portManager.isReserved(port)).toBe(true);

      portManager.releasePort(port);
      expect(portManager.isReserved(port)).toBe(false);
    });

    it("should prevent double reservation of same port", async () => {
      const testPort = 9220;
      await portManager.reservePortDirectly(testPort);

      await expect(portManager.reservePortDirectly(testPort)).rejects.toThrow(
        "Port already reserved",
      );
    });

    it("should get single port for unified server", async () => {
      const port = await portManager.getUnifiedPort(9230);

      expect(port).toBeGreaterThanOrEqual(9230);
      expect(portManager.isReserved(port)).toBe(true);
    });

    it("should cleanup all reserved ports", async () => {
      await portManager.reservePortDirectly(9240);
      await portManager.reservePortDirectly(9241);

      expect(portManager.getReservedPorts()).toHaveLength(2);

      portManager.cleanup();

      expect(portManager.getReservedPorts()).toHaveLength(0);
    });

    it("should validate port range", async () => {
      await expect(portManager.reservePortDirectly(0)).rejects.toThrow(
        "Invalid port",
      );

      await expect(portManager.reservePortDirectly(70000)).rejects.toThrow(
        "Invalid port",
      );
    });

    it("should handle concurrent port reservation", async () => {
      const startPort = 9250;
      const promises = Array.from({ length: 5 }, (_, i) =>
        portManager.reservePortDirectly(startPort + i),
      );

      const ports = await Promise.all(promises);
      const uniquePorts = new Set(ports);

      expect(uniquePorts.size).toBe(5); // All should be unique
      expect(Math.min(...ports)).toBe(startPort);
      expect(Math.max(...ports)).toBe(startPort + 4);
    });
  });

  describe("Port Conflict Prevention", () => {
    it("should detect system port conflicts", async () => {
      const testPort = 9300;

      // Occupy the test port
      const conflictServer = net.createServer();
      occupiedServers.push(conflictServer);

      await new Promise<void>((resolve, reject) => {
        conflictServer.listen(testPort, () => resolve());
        conflictServer.on("error", reject);
      });

      // findAvailablePort should skip to next available port
      const port = await findAvailablePort(testPort);
      expect(port).toBeGreaterThan(testPort);
    });

    it("should handle port availability checking", async () => {
      // Test that PortManager can detect port conflicts
      const portManager = new PortManager();
      const testPort = 9310;

      // Occupy port with real server
      const server = net.createServer();
      occupiedServers.push(server);

      await new Promise<void>((resolve, reject) => {
        server.listen(testPort, () => resolve());
        server.on("error", reject);
      });

      // PortManager should skip occupied port
      const reservedPort = await portManager.reservePort(testPort);
      expect(reservedPort).toBeGreaterThan(testPort);
    });
  });
});
