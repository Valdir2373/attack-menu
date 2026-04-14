import { describe, it, expect } from "vitest";
import { MongoUri } from "../../../../src/domain/value-objects/MongoUri.js";

describe("MongoUri", () => {
  it("should create a valid mongodb URI", () => {
    const result = MongoUri.criar("mongodb://localhost:27017/db");
    expect(result.isSuccess).toBe(true);
    expect(result.value!.value).toBe("mongodb://localhost:27017/db");
  });

  it("should accept mongodb+srv URIs", () => {
    const result = MongoUri.criar("mongodb+srv://user:pass@cluster.net");
    expect(result.isSuccess).toBe(true);
  });

  it("should fail with empty string", () => {
    const result = MongoUri.criar("");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URI MongoDB inválida");
  });

  it("should fail with non-mongodb URI", () => {
    const result = MongoUri.criar("postgresql://localhost");
    expect(result.isFailure).toBe(true);
  });

  it("should be equal when values match", () => {
    const a = MongoUri.criar("mongodb://host/db").value!;
    const b = MongoUri.criar("mongodb://host/db").value!;
    expect(a.equals(b)).toBe(true);
  });
});
