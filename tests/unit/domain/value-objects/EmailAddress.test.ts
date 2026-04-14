import { describe, it, expect } from "vitest";
import { EmailAddress } from "../../../../src/domain/value-objects/EmailAddress.js";

describe("EmailAddress", () => {
  it("should create a valid email address", () => {
    const result = EmailAddress.criar("user@test.com");
    expect(result.isSuccess).toBe(true);
    expect(result.value!.value).toBe("user@test.com");
  });

  it("should fail with empty string", () => {
    const result = EmailAddress.criar("");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Email inválido");
  });

  it("should fail without @", () => {
    const result = EmailAddress.criar("invalidemail");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Email inválido");
  });

  it("should be equal when values match", () => {
    const a = EmailAddress.criar("user@test.com").value!;
    const b = EmailAddress.criar("user@test.com").value!;
    expect(a.equals(b)).toBe(true);
  });

  it("should not be equal when values differ", () => {
    const a = EmailAddress.criar("a@test.com").value!;
    const b = EmailAddress.criar("b@test.com").value!;
    expect(a.equals(b)).toBe(false);
  });
});
