import { describe, it, expect } from "vitest";
import { EmailCredential } from "../../../src/domain/entities/EmailCredential.js";

describe("EmailCredential", () => {
  describe("criar()", () => {
    it("should create with valid email and password", () => {
      const result = EmailCredential.criar("user@example.com", "secret123");

      expect(result.isSuccess).toBe(true);
      expect(result.value!.email.value).toBe("user@example.com");
      expect(result.value!.password).toBe("secret123");
    });

    it("should auto-generate id and createdAt", () => {
      const before = new Date();
      const result = EmailCredential.criar("user@test.com", "pass");
      const after = new Date();

      expect(result.value!.id).toBeDefined();
      expect(result.value!.id.length).toBeGreaterThan(0);
      expect(result.value!.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.value!.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should generate unique ids", () => {
      const r1 = EmailCredential.criar("a@test.com", "p1");
      const r2 = EmailCredential.criar("b@test.com", "p2");

      expect(r1.value!.id).not.toBe(r2.value!.id);
    });

    it("should fail with empty email", () => {
      const result = EmailCredential.criar("", "password");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Email inválido");
    });

    it("should fail with email without @", () => {
      const result = EmailCredential.criar("invalid-email", "password");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Email inválido");
    });

    it("should fail with empty password", () => {
      const result = EmailCredential.criar("user@test.com", "");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Password não pode ser vazio");
    });
  });
});
