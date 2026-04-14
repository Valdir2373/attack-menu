import { describe, it, expect, beforeEach } from "vitest";
import { ValidateMongoHandler } from "../../../src/application/mongo/handlers/ValidateMongoHandler.js";
import { ValidateMongoCommand } from "../../../src/application/mongo/commands/ValidateMongoCommand.js";
import { MockMongoValidator } from "../../mocks/MockMongoValidator.js";

describe("ValidateMongoHandler", () => {
  let validator: MockMongoValidator;
  let handler: ValidateMongoHandler;

  beforeEach(() => {
    validator = new MockMongoValidator();
    handler = new ValidateMongoHandler(validator);
  });

  it("should return ok({ isValid: true }) when validator succeeds", async () => {
    validator.result = true;
    const result = await handler.execute(new ValidateMongoCommand("mongodb://localhost:27017/mydb"));

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({ isValid: true });
    expect(validator.calls).toHaveLength(1);
  });

  it("should return ok({ isValid: false }) when validator fails", async () => {
    validator.result = false;
    const result = await handler.execute(new ValidateMongoCommand("mongodb://localhost:27017/mydb"));

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({ isValid: false });
  });

  it("should fail with empty URI", async () => {
    const result = await handler.execute(new ValidateMongoCommand(""));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URI MongoDB inválida");
    expect(validator.calls).toHaveLength(0);
  });

  it("should fail with non-mongodb URI", async () => {
    const result = await handler.execute(new ValidateMongoCommand("postgresql://localhost"));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URI MongoDB inválida");
  });

  it("should accept mongodb+srv URIs", async () => {
    validator.result = true;
    const result = await handler.execute(new ValidateMongoCommand("mongodb+srv://user:pass@cluster.net"));

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({ isValid: true });
  });
});
