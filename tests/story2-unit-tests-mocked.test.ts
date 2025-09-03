import { SSHConnectionManager } from "../src/ssh-connection-manager";
import { CommandOptions, CommandSource } from "../src/types";

describe("Story 2: Unit Tests - Command Source Validation", () => {
  let sshManager: SSHConnectionManager;
  
  beforeEach(() => {
    sshManager = new SSHConnectionManager();
  });

  afterEach(() => {
    sshManager.cleanup();
  });

  describe("Command Source Validation", () => {
    it("should validate command source parameter types correctly", () => {
      // Create a test method that calls the private validateCommandSource method
      const testValidation = (options: CommandOptions) => {
        return (sshManager as any).validateCommandSource(options.source);
      };

      // Valid sources should not throw
      expect(() => testValidation({ source: 'user' as CommandSource })).not.toThrow();
      expect(() => testValidation({ source: 'claude' as CommandSource })).not.toThrow();

      // Invalid sources should throw
      expect(() => testValidation({ source: 'invalid' as any })).toThrow('Invalid command source');
      expect(() => testValidation({ source: 123 as any })).toThrow('Command source must be a string');
      expect(() => testValidation({ source: null as any })).toThrow('Command source must be a string');
    });

    it("should have proper command source type definitions", () => {
      const validSources: CommandSource[] = ['user', 'claude'];
      
      validSources.forEach(source => {
        const options: CommandOptions = { source };
        expect(options.source).toBe(source);
      });
    });
  });
});