import { describe, it, expect } from "vitest";
import {
  DomainError,
  NotFoundError,
  InvalidCommandError,
  ConfigError,
  InfrastructureError,
} from "../../../src/errors/index.js";

describe("Error Hierarchy", () => {
  describe("NotFoundError", () => {
    it("should extend DomainError", () => {
      const err = new NotFoundError("User");

      expect(err).toBeInstanceOf(DomainError);
      expect(err).toBeInstanceOf(Error);
    });

    it("should format message with resource name", () => {
      const err = new NotFoundError("EmailCredential");

      expect(err.message).toBe("EmailCredential não encontrado");
    });

    it("should set name to NotFoundError", () => {
      const err = new NotFoundError("Proxy");

      expect(err.name).toBe("NotFoundError");
    });

    it("should have a stack trace", () => {
      const err = new NotFoundError("Machine");

      expect(err.stack).toBeDefined();
    });
  });

  describe("InvalidCommandError", () => {
    it("should extend DomainError", () => {
      const err = new InvalidCommandError("Handler não encontrado: FooCommand");

      expect(err).toBeInstanceOf(DomainError);
      expect(err).toBeInstanceOf(Error);
    });

    it("should preserve exact message", () => {
      const err = new InvalidCommandError("Parâmetro obrigatório ausente: email");

      expect(err.message).toBe("Parâmetro obrigatório ausente: email");
    });

    it("should set name to InvalidCommandError", () => {
      const err = new InvalidCommandError("test");

      expect(err.name).toBe("InvalidCommandError");
    });
  });

  describe("ConfigError", () => {
    it("should extend Error but not DomainError", () => {
      const err = new ConfigError("DATABASE_URL não configurado");

      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(DomainError);
    });

    it("should preserve exact message", () => {
      const err = new ConfigError("COOKIE_GIT ausente no .env");

      expect(err.message).toBe("COOKIE_GIT ausente no .env");
    });

    it("should set name to ConfigError", () => {
      const err = new ConfigError("test");

      expect(err.name).toBe("ConfigError");
    });
  });

  describe("InfrastructureError", () => {
    it("should extend Error but not DomainError", () => {
      const err = new InfrastructureError("Falha ao conectar no Docker");

      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(DomainError);
    });

    it("should preserve message", () => {
      const err = new InfrastructureError("Redis timeout");

      expect(err.message).toBe("Redis timeout");
    });

    it("should set name to InfrastructureError", () => {
      const err = new InfrastructureError("test");

      expect(err.name).toBe("InfrastructureError");
    });

    it("should store cause when provided", () => {
      const cause = new Error("ECONNREFUSED");
      const err = new InfrastructureError("Falha no MongoDB", cause);

      expect(err.cause).toBe(cause);
      expect(err.cause!.message).toBe("ECONNREFUSED");
    });

    it("should have undefined cause when not provided", () => {
      const err = new InfrastructureError("Falha genérica");

      expect(err.cause).toBeUndefined();
    });
  });

  describe("instanceof checks for middleware routing", () => {
    it("should correctly distinguish error types", () => {
      const domain = new NotFoundError("X");
      const config = new ConfigError("Y");
      const infra = new InfrastructureError("Z");
      const command = new InvalidCommandError("W");

      expect(domain instanceof DomainError).toBe(true);
      expect(config instanceof DomainError).toBe(false);
      expect(infra instanceof DomainError).toBe(false);
      expect(command instanceof DomainError).toBe(true);
    });
  });
});
