import { describe, it, expect } from "vitest";
import { SupabaseCredential } from "../../../src/domain/entities/SupabaseCredential.js";

describe("SupabaseCredential", () => {
  describe("criar()", () => {
    it("should create with valid url and key", () => {
      const result = SupabaseCredential.criar(
        "https://myproject.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.url.value).toBe("https://myproject.supabase.co");
      expect(result.value!.key.value).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    });

    it("should auto-generate id and createdAt", () => {
      const before = new Date();
      const result = SupabaseCredential.criar(
        "https://test.supabase.co",
        "1234567890abcdef",
      );
      const after = new Date();

      expect(result.value!.id).toBeDefined();
      expect(result.value!.id.length).toBeGreaterThan(0);
      expect(result.value!.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.value!.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should generate unique ids", () => {
      const r1 = SupabaseCredential.criar("https://a.supabase.co", "1234567890abc");
      const r2 = SupabaseCredential.criar("https://b.supabase.co", "1234567890def");

      expect(r1.value!.id).not.toBe(r2.value!.id);
    });

    it("should fail with empty url", () => {
      const result = SupabaseCredential.criar("", "1234567890abc");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("URL Supabase inválida");
    });

    it("should fail with url not containing supabase", () => {
      const result = SupabaseCredential.criar("https://example.com", "1234567890abc");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("URL Supabase inválida");
    });

    it("should fail with empty key", () => {
      const result = SupabaseCredential.criar("https://test.supabase.co", "");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Key Supabase inválida");
    });

    it("should fail with key shorter than 10 characters", () => {
      const result = SupabaseCredential.criar("https://test.supabase.co", "short");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Key Supabase inválida");
    });
  });
});
