import { describe, it, expect } from "vitest";
import { ScrapingResult } from "../../../src/domain/entities/ScrapingResult.js";

describe("ScrapingResult", () => {
  describe("criar()", () => {
    it("should create with valid keyword and repository", () => {
      const result = ScrapingResult.criar("smtp credentials", "user/repo");

      expect(result.isSuccess).toBe(true);
      expect(result.value!.keyword).toBe("smtp credentials");
      expect(result.value!.repository).toBe("user/repo");
    });

    it("should auto-generate id and createdAt", () => {
      const before = new Date();
      const result = ScrapingResult.criar("keyword", "owner/repo");
      const after = new Date();

      expect(result.value!.id).toBeDefined();
      expect(result.value!.id.length).toBeGreaterThan(0);
      expect(result.value!.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.value!.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should generate unique ids", () => {
      const r1 = ScrapingResult.criar("k1", "repo1");
      const r2 = ScrapingResult.criar("k2", "repo2");

      expect(r1.value!.id).not.toBe(r2.value!.id);
    });

    it("should fail with empty keyword", () => {
      const result = ScrapingResult.criar("", "user/repo");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Keyword não pode ser vazia");
    });

    it("should fail with empty repository", () => {
      const result = ScrapingResult.criar("keyword", "");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Repository não pode ser vazio");
    });
  });
});
