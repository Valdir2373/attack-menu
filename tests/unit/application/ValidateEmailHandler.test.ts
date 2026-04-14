import { describe, it, expect, beforeEach } from "vitest";
import { ValidateEmailHandler } from "../../../src/application/email/handlers/ValidateEmailHandler.js";
import { ValidateEmailCommand } from "../../../src/application/email/commands/ValidateEmailCommand.js";
import { MockEmailValidator } from "../../mocks/MockEmailValidator.js";

describe("ValidateEmailHandler", () => {
  let validator: MockEmailValidator;
  let handler: ValidateEmailHandler;

  beforeEach(() => {
    validator = new MockEmailValidator();
    handler = new ValidateEmailHandler(validator);
  });

  it("should return ok({ isValid: true }) when validator succeeds", async () => {
    validator.result = true;
    const result = await handler.execute(new ValidateEmailCommand("user@test.com", "password123"));

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({ isValid: true });
    expect(validator.calls).toHaveLength(1);
    expect(validator.calls[0]).toEqual({ email: "user@test.com", password: "password123" });
  });

  it("should return ok({ isValid: false }) when validator fails", async () => {
    validator.result = false;
    const result = await handler.execute(new ValidateEmailCommand("user@test.com", "wrongpass"));

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({ isValid: false });
  });

  it("should fail with invalid email (no @)", async () => {
    const result = await handler.execute(new ValidateEmailCommand("invalid-email", "pass"));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Email inválido");
    expect(validator.calls).toHaveLength(0);
  });

  it("should fail with empty email", async () => {
    const result = await handler.execute(new ValidateEmailCommand("", "pass"));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Email inválido");
  });

  it("should fail with empty password", async () => {
    const result = await handler.execute(new ValidateEmailCommand("user@test.com", ""));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Password não pode ser vazio");
  });
});
