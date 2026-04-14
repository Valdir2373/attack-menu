import { describe, it, expect } from "vitest";
import { ValidationBehavior } from "../../../src/application/common/ValidationBehavior.js";
import { Result } from "../../../src/shared/Result.js";
import type { IValidator } from "../../../src/application/common/IValidator.js";
import { ValidateEmailCommandValidator } from "../../../src/application/email/validators/ValidateEmailCommandValidator.js";
import { ValidateMongoCommandValidator } from "../../../src/application/mongo/validators/ValidateMongoCommandValidator.js";
import { ValidateSupabaseCommandValidator } from "../../../src/application/supabase/validators/ValidateSupabaseCommandValidator.js";
import { ValidateEmailCommand } from "../../../src/application/email/commands/ValidateEmailCommand.js";
import { ValidateMongoCommand } from "../../../src/application/mongo/commands/ValidateMongoCommand.js";
import { ValidateSupabaseCommand } from "../../../src/application/supabase/commands/ValidateSupabaseCommand.js";

interface FakeCommand { value: string }

function passingValidator(): IValidator<FakeCommand> {
  return { validate: () => Result.ok(undefined) };
}

function failingValidator(message: string): IValidator<FakeCommand> {
  return { validate: () => Result.fail(message) };
}

describe("ValidationBehavior", () => {
  describe("validate()", () => {
    it("should return ok when all validators pass", () => {
      const behavior = new ValidationBehavior<FakeCommand>([
        passingValidator(),
        passingValidator(),
      ]);

      expect(behavior.validate({ value: "test" }).isSuccess).toBe(true);
    });

    it("should return fail on the first validator that fails", () => {
      const behavior = new ValidationBehavior<FakeCommand>([
        passingValidator(),
        failingValidator("Valor inválido"),
        passingValidator(),
      ]);

      const result = behavior.validate({ value: "test" });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Valor inválido");
    });

    it("should return ok when there are no validators", () => {
      const behavior = new ValidationBehavior<FakeCommand>([]);

      expect(behavior.validate({ value: "anything" }).isSuccess).toBe(true);
    });

    it("should return the first failing validator's message, not the second", () => {
      const behavior = new ValidationBehavior<FakeCommand>([
        failingValidator("First error"),
        failingValidator("Second error"),
      ]);

      expect(behavior.validate({ value: "x" }).error).toBe("First error");
    });
  });

  describe("handle()", () => {
    it("should call next() when all validators pass", async () => {
      const behavior = new ValidationBehavior<FakeCommand>([passingValidator()]);
      let nextCalled = false;

      await behavior.handle({ value: "ok" }, async () => {
        nextCalled = true;
        return Result.ok("done");
      });

      expect(nextCalled).toBe(true);
    });

    it("should return the result from next() when validation passes", async () => {
      const behavior = new ValidationBehavior<FakeCommand>([passingValidator()]);

      const result = await behavior.handle({ value: "ok" }, async () => Result.ok("success"));

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe("success");
    });

    it("should NOT call next() when a validator fails", async () => {
      const behavior = new ValidationBehavior<FakeCommand>([failingValidator("Bad input")]);
      let nextCalled = false;

      await behavior.handle({ value: "bad" }, async () => {
        nextCalled = true;
        return Result.ok("should not reach");
      });

      expect(nextCalled).toBe(false);
    });

    it("should return Result.fail with the validator error when validation fails", async () => {
      const behavior = new ValidationBehavior<FakeCommand>([failingValidator("Campo obrigatório")]);

      const result = await behavior.handle({ value: "" }, async () => Result.ok("never"));

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Campo obrigatório");
    });

    it("should propagate errors thrown by next()", async () => {
      const behavior = new ValidationBehavior<FakeCommand>([passingValidator()]);

      await expect(
        behavior.handle({ value: "ok" }, async () => {
          throw new Error("Handler explodiu");
        }),
      ).rejects.toThrow("Handler explodiu");
    });
  });

  describe("ValidateEmailCommandValidator", () => {
    const validator = new ValidateEmailCommandValidator();

    it("should fail when email has no @", () => {
      const result = validator.validate(new ValidateEmailCommand("notanemail", "pass123"));
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Email inválido");
    });

    it("should fail when password is empty", () => {
      const result = validator.validate(new ValidateEmailCommand("user@test.com", "  "));
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Senha não pode ser vazia");
    });

    it("should pass with valid email and password", () => {
      const result = validator.validate(new ValidateEmailCommand("user@test.com", "mypassword"));
      expect(result.isSuccess).toBe(true);
    });
  });

  describe("ValidateMongoCommandValidator", () => {
    const validator = new ValidateMongoCommandValidator();

    it("should fail when URI is empty", () => {
      expect(validator.validate(new ValidateMongoCommand("")).isFailure).toBe(true);
    });

    it("should fail when URI does not start with mongodb:// or mongodb+srv://", () => {
      expect(validator.validate(new ValidateMongoCommand("http://invalid.com")).isFailure).toBe(true);
    });

    it("should pass with a valid mongodb:// URI", () => {
      expect(validator.validate(new ValidateMongoCommand("mongodb://user:pass@host:27017/db")).isSuccess).toBe(true);
    });

    it("should pass with a valid mongodb+srv:// URI", () => {
      expect(validator.validate(new ValidateMongoCommand("mongodb+srv://user:pass@cluster.mongodb.net")).isSuccess).toBe(true);
    });
  });

  describe("ValidateSupabaseCommandValidator", () => {
    const validator = new ValidateSupabaseCommandValidator();

    it("should fail when URL does not start with http", () => {
      expect(validator.validate(new ValidateSupabaseCommand("ftp://invalid", "eyJkey")).isFailure).toBe(true);
    });

    it("should fail when key is empty", () => {
      expect(validator.validate(new ValidateSupabaseCommand("https://abc.supabase.co", "  ")).isFailure).toBe(true);
    });

    it("should pass with valid URL and key", () => {
      expect(validator.validate(new ValidateSupabaseCommand("https://abc.supabase.co", "eyJsomekey")).isSuccess).toBe(true);
    });
  });
});
