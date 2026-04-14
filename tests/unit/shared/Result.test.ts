import { describe, it, expect } from "vitest";
import { Result } from "../../../src/shared/Result.js";

describe("Result<T>", () => {
  describe("Result.ok()", () => {
    it("should create a successful result with the provided value", () => {
      const result = Result.ok(42);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(42);
    });

    it("should have isFailure=false for a successful result", () => {
      const result = Result.ok("hello");

      expect(result.isFailure).toBe(false);
    });

    it("should have error=undefined for a successful result", () => {
      const result = Result.ok(true);

      expect(result.error).toBeUndefined();
    });

    it("should accept undefined as a valid value (Result<void>)", () => {
      const result = Result.ok<void>(undefined);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it("should accept null as a valid value", () => {
      const result = Result.ok(null);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it("should accept objects as value", () => {
      const payload = { scraped: 10, validated: 5 };
      const result = Result.ok(payload);

      expect(result.value).toEqual({ scraped: 10, validated: 5 });
    });

    it("should accept arrays as value", () => {
      const result = Result.ok([1, 2, 3]);

      expect(result.value).toEqual([1, 2, 3]);
    });
  });

  describe("Result.fail()", () => {
    it("should create a failed result with the provided error message", () => {
      const result = Result.fail<string>("Something went wrong");

      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe("Something went wrong");
    });

    it("should have isFailure=true for a failed result", () => {
      const result = Result.fail<number>("Error");

      expect(result.isFailure).toBe(true);
    });

    it("should have value=undefined for a failed result", () => {
      const result = Result.fail<number>("Error");

      expect(result.value).toBeUndefined();
    });

    it("should preserve the exact error message", () => {
      const message = "Email inválido — deve conter @";
      const result = Result.fail<void>(message);

      expect(result.error).toBe(message);
    });
  });

  describe("isFailure getter", () => {
    it("should be the logical inverse of isSuccess for ok result", () => {
      const result = Result.ok(1);

      expect(result.isFailure).toBe(!result.isSuccess);
    });

    it("should be the logical inverse of isSuccess for fail result", () => {
      const result = Result.fail<number>("err");

      expect(result.isFailure).toBe(!result.isSuccess);
    });
  });

  describe("usage patterns", () => {
    it("should allow safe value extraction after isSuccess check", () => {
      const result = Result.ok({ scraped: 3, validated: 1 });

      if (result.isSuccess) {
        expect(result.value!.scraped).toBe(3);
        expect(result.value!.validated).toBe(1);
      } else {
        throw new Error("Expected success");
      }
    });

    it("should allow safe error extraction after isFailure check", () => {
      const result = Result.fail<boolean>("Senha obrigatória");

      if (result.isFailure) {
        expect(result.error).toBe("Senha obrigatória");
      } else {
        throw new Error("Expected failure");
      }
    });

    it("should work as return type in async functions", async () => {
      async function validate(email: string): Promise<Result<boolean>> {
        if (!email.includes("@")) return Result.fail("Email inválido");
        return Result.ok(true);
      }

      const valid   = await validate("user@test.com");
      const invalid = await validate("notanemail");

      expect(valid.isSuccess).toBe(true);
      expect(valid.value).toBe(true);
      expect(invalid.isFailure).toBe(true);
      expect(invalid.error).toBe("Email inválido");
    });
  });
});
