import { describe, it, expect } from "vitest";
import { SupabaseKey } from "../../../../src/domain/value-objects/SupabaseKey.js";

describe("SupabaseKey", () => {
  it("should create a valid supabase key", () => {
    const result = SupabaseKey.criar("eyJhbGciOiJIUzI1NiJ9");
    expect(result.isSuccess).toBe(true);
    expect(result.value!.value).toBe("eyJhbGciOiJIUzI1NiJ9");
  });

  it("should fail with empty string", () => {
    const result = SupabaseKey.criar("");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Key Supabase inválida");
  });

  it("should fail with key shorter than 10 chars", () => {
    const result = SupabaseKey.criar("short");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Key Supabase inválida");
  });

  it("should be equal when values match", () => {
    const a = SupabaseKey.criar("1234567890ab").value!;
    const b = SupabaseKey.criar("1234567890ab").value!;
    expect(a.equals(b)).toBe(true);
  });
});
