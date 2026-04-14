import { describe, it, expect, beforeEach } from "vitest";
import { ValidateSupabaseHandler } from "../../../src/application/supabase/handlers/ValidateSupabaseHandler.js";
import { ValidateSupabaseCommand } from "../../../src/application/supabase/commands/ValidateSupabaseCommand.js";
import { MockSupabaseValidator } from "../../mocks/MockSupabaseValidator.js";

describe("ValidateSupabaseHandler", () => {
  let validator: MockSupabaseValidator;
  let handler: ValidateSupabaseHandler;

  beforeEach(() => {
    validator = new MockSupabaseValidator();
    handler = new ValidateSupabaseHandler(validator);
  });

  it("should return ok({ isValid: true }) when validator succeeds", async () => {
    validator.result = true;
    const result = await handler.execute(
      new ValidateSupabaseCommand("https://myproject.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"),
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({ isValid: true });
    expect(validator.calls).toHaveLength(1);
  });

  it("should return ok({ isValid: false }) when validator fails", async () => {
    validator.result = false;
    const result = await handler.execute(
      new ValidateSupabaseCommand("https://myproject.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"),
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({ isValid: false });
  });

  it("should fail with invalid URL (no supabase)", async () => {
    const result = await handler.execute(
      new ValidateSupabaseCommand("https://example.com", "1234567890abcdef"),
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URL Supabase inválida");
    expect(validator.calls).toHaveLength(0);
  });

  it("should fail with short key", async () => {
    const result = await handler.execute(
      new ValidateSupabaseCommand("https://test.supabase.co", "short"),
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Key Supabase inválida");
  });

  it("should fail with empty URL", async () => {
    const result = await handler.execute(
      new ValidateSupabaseCommand("", "1234567890abcdef"),
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URL Supabase inválida");
  });
});
