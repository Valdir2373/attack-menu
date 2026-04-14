import { describe, it, expect } from "vitest";
import { Result } from "../../../src/shared/Result.js";

describe("Result<T> — extended", () => {
  describe("chaining pattern", () => {
    it("should support mapping over successful result", () => {
      const result = Result.ok(10);
      const mapped = result.isSuccess ? Result.ok(result.value! * 2) : result;

      expect(mapped.isSuccess).toBe(true);
      expect(mapped.value).toBe(20);
    });

    it("should propagate failure without executing map", () => {
      const result = Result.fail<number>("Erro");
      const mapped = result.isSuccess ? Result.ok(result.value! * 2) : result;

      expect(mapped.isFailure).toBe(true);
      expect(mapped.error).toBe("Erro");
    });
  });

  describe("type inference", () => {
    it("should infer number type", () => {
      const result = Result.ok(42);

      expect(typeof result.value).toBe("number");
    });

    it("should infer string type", () => {
      const result = Result.ok("hello");

      expect(typeof result.value).toBe("string");
    });

    it("should infer boolean type", () => {
      const result = Result.ok(true);

      expect(typeof result.value).toBe("boolean");
    });

    it("should infer array type", () => {
      const result = Result.ok([1, 2, 3]);

      expect(Array.isArray(result.value)).toBe(true);
    });

    it("should infer complex nested type", () => {
      const result = Result.ok({
        users: [{ name: "alice", scores: [100, 90] }],
        total: 1,
      });

      expect(result.value!.users[0].name).toBe("alice");
      expect(result.value!.total).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string error", () => {
      const result = Result.fail<void>("");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("");
    });

    it("should handle zero as a valid value", () => {
      const result = Result.ok(0);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(0);
    });

    it("should handle false as a valid value", () => {
      const result = Result.ok(false);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
    });

    it("should handle empty string as a valid value", () => {
      const result = Result.ok("");

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe("");
    });

    it("should handle Date as a valid value", () => {
      const date = new Date("2026-04-10");
      const result = Result.ok(date);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(date);
    });

    it("should handle Map as a valid value", () => {
      const map = new Map([["key", "value"]]);
      const result = Result.ok(map);

      expect(result.isSuccess).toBe(true);
      expect(result.value!.get("key")).toBe("value");
    });
  });
});
