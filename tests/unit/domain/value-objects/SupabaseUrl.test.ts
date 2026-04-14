import { describe, it, expect } from "vitest";
import { SupabaseUrl } from "../../../../src/domain/value-objects/SupabaseUrl.js";

describe("SupabaseUrl", () => {
  it("should create a valid supabase URL", () => {
    const result = SupabaseUrl.criar("https://abc.supabase.co");
    expect(result.isSuccess).toBe(true);
    expect(result.value!.value).toBe("https://abc.supabase.co");
  });

  it("should fail with empty string", () => {
    const result = SupabaseUrl.criar("");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URL Supabase inválida");
  });

  it("should fail without supabase in URL", () => {
    const result = SupabaseUrl.criar("https://example.com");
    expect(result.isFailure).toBe(true);
  });

  it("should be equal when values match", () => {
    const a = SupabaseUrl.criar("https://abc.supabase.co").value!;
    const b = SupabaseUrl.criar("https://abc.supabase.co").value!;
    expect(a.equals(b)).toBe(true);
  });
});
