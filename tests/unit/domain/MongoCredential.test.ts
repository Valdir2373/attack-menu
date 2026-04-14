import { describe, it, expect } from "vitest";
import { MongoCredential } from "../../../src/domain/entities/MongoCredential.js";

describe("MongoCredential", () => {
  describe("criar()", () => {
    it("should create with valid mongodb URI", () => {
      const result = MongoCredential.criar("mongodb://localhost:27017/mydb");

      expect(result.isSuccess).toBe(true);
      expect(result.value!.uri.value).toBe("mongodb://localhost:27017/mydb");
    });

    it("should accept mongodb+srv URI", () => {
      const result = MongoCredential.criar("mongodb+srv://user:pass@cluster.mongodb.net");

      expect(result.isSuccess).toBe(true);
      expect(result.value!.uri.value).toContain("mongodb+srv");
    });

    it("should auto-generate id and createdAt", () => {
      const before = new Date();
      const result = MongoCredential.criar("mongodb://localhost:27017");
      const after = new Date();

      expect(result.value!.id).toBeDefined();
      expect(result.value!.id.length).toBeGreaterThan(0);
      expect(result.value!.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.value!.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should generate unique ids", () => {
      const r1 = MongoCredential.criar("mongodb://host1:27017");
      const r2 = MongoCredential.criar("mongodb://host2:27017");

      expect(r1.value!.id).not.toBe(r2.value!.id);
    });

    it("should fail with empty URI", () => {
      const result = MongoCredential.criar("");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("URI MongoDB inválida");
    });

    it("should fail with non-mongodb URI", () => {
      const result = MongoCredential.criar("postgresql://localhost:5432");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("URI MongoDB inválida");
    });
  });
});
