import { describe, it, expect, beforeEach } from "vitest";
import { MassiveValidationUseCase } from "../../../src/application/scraping/use-cases/MassiveValidationUseCase.js";
import { MockGitHubScraper } from "../../mocks/MockGitHubScraper.js";
import { MockCredentialEngineFactory } from "../../mocks/MockCredentialEngineFactory.js";
import type { MassiveValidationInput } from "../../../src/application/scraping/use-cases/MassiveValidationUseCase.js";

const noop = async () => false;

function makeInput(overrides: Partial<MassiveValidationInput> = {}): MassiveValidationInput {
  return {
    keywords: ["test@mail.com"],
    tempFile: "/tmp/test.txt",
    patterns: [/.+/],
    validate: noop,
    outputFile: "/tmp/out.txt",
    ...overrides,
  };
}

describe("MassiveValidationUseCase", () => {
  let useCase: MassiveValidationUseCase;
  let mockScraper: MockGitHubScraper;
  let mockEngineFactory: MockCredentialEngineFactory;

  beforeEach(() => {
    mockScraper = new MockGitHubScraper();
    mockEngineFactory = new MockCredentialEngineFactory();
    useCase = new MassiveValidationUseCase(mockScraper, mockEngineFactory);
  });

  describe("Result<T> contract", () => {
    it("should return Result.ok() on normal execution", async () => {
      const result = await useCase.execute(makeInput());

      expect(result.isSuccess).toBe(true);
    });

    it("should return Result.fail() when patterns array is empty", async () => {
      const result = await useCase.execute(makeInput({ patterns: [] }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain("padrão");
    });

    it("should have value with scraped and validated on success", async () => {
      mockScraper.executeResult = { scraped: 5 };

      const result = await useCase.execute(makeInput());

      expect(result.value).toBeDefined();
      expect(typeof result.value!.scraped).toBe("number");
      expect(typeof result.value!.validated).toBe("number");
    });
  });

  describe("scraping phase", () => {
    it("should call scraper with the provided keywords", async () => {
      await useCase.execute(makeInput({ keywords: ["keyword1", "keyword2"] }));

      expect(mockScraper.executeCalls).toHaveLength(1);
      expect(mockScraper.executeCalls[0].keywords).toEqual(["keyword1", "keyword2"]);
    });

    it("should pass tempFile to the scraper", async () => {
      await useCase.execute(makeInput({ tempFile: "/custom/path.txt" }));

      expect(mockScraper.executeCalls[0].tempFile).toBe("/custom/path.txt");
    });

    it("should always pass headless=true to the scraper", async () => {
      await useCase.execute(makeInput());

      expect(mockScraper.executeCalls[0].headless).toBe(true);
    });

    it("should return the scraped count from the scraper result", async () => {
      mockScraper.executeResult = { scraped: 42 };

      const result = await useCase.execute(makeInput());

      expect(result.value!.scraped).toBe(42);
    });

    it("should return scraped=0 when scraper throws", async () => {
      mockScraper.shouldThrow = new Error("Network failure");

      const result = await useCase.execute(makeInput());

      expect(result.value!.scraped).toBe(0);
    });

    it("should forward the onProgress callback to the scraper", async () => {
      const onProgress = (_remaining: number) => {};

      await useCase.execute(makeInput({ onProgress }));

      expect(mockScraper.executeCalls[0].onProgress).toBe(onProgress);
    });

    it("should forward whitelist and blacklist to the scraper", async () => {
      const whitelist = ["allowed.com"];
      const blacklist = ["blocked.com"];

      await useCase.execute(makeInput({ whitelist, blacklist }));

      expect(mockScraper.executeCalls[0].whitelist).toEqual(whitelist);
      expect(mockScraper.executeCalls[0].blacklist).toEqual(blacklist);
    });

    it("should call scraper with empty keywords array when none provided", async () => {
      await useCase.execute(makeInput({ keywords: [] }));

      expect(mockScraper.executeCalls[0].keywords).toEqual([]);
    });

    it("should continue to validation phase even when scraper throws", async () => {
      mockScraper.shouldThrow = new Error("Puppeteer crashed");
      mockEngineFactory.engine.countUniqueResult = 0;

      await useCase.execute(makeInput());

      expect(mockEngineFactory.createCalls).toHaveLength(1);
    });
  });

  describe("validation phase", () => {
    it("should create the engine with the provided patterns and outputFile", async () => {
      const patterns = [/(\w+):(\w+)/];

      await useCase.execute(makeInput({ patterns, outputFile: "/out/valid.txt" }));

      expect(mockEngineFactory.createCalls[0].patterns).toEqual(patterns);
      expect(mockEngineFactory.createCalls[0].outputFilePath).toBe("/out/valid.txt");
    });

    it("should pass saveFn to the engine factory when provided", async () => {
      const saveFn = async (_creds: string[]) => {};

      await useCase.execute(makeInput({ saveFn }));

      expect(mockEngineFactory.createCalls[0].saveFn).toBe(saveFn);
    });

    it("should not call runFromFile when countUnique returns 0", async () => {
      mockEngineFactory.engine.countUniqueResult = 0;

      await useCase.execute(makeInput());

      expect(mockEngineFactory.engine.runFromFileCalls).toHaveLength(0);
    });

    it("should call runFromFile with tempFile when countUnique returns > 0", async () => {
      mockEngineFactory.engine.countUniqueResult = 5;

      await useCase.execute(makeInput({ tempFile: "/tmp/scrape.txt" }));

      expect(mockEngineFactory.engine.runFromFileCalls).toHaveLength(1);
      expect(mockEngineFactory.engine.runFromFileCalls[0]).toBe("/tmp/scrape.txt");
    });

    it("should return validated=0 when no unique credentials are found", async () => {
      mockEngineFactory.engine.countUniqueResult = 0;

      const result = await useCase.execute(makeInput());

      expect(result.value!.validated).toBe(0);
    });

    it("should count validated=N when validate returns true for N credentials", async () => {
      mockEngineFactory.engine.countUniqueResult = 3;
      mockEngineFactory.engine.validateCallArgs = [
        ["user1@test.com", "pass1"],
        ["user2@test.com", "pass2"],
        ["user3@test.com", "pass3"],
      ];

      const result = await useCase.execute(makeInput({ validate: async () => true }));

      expect(result.value!.validated).toBe(3);
    });

    it("should count validated=0 when validate always returns false", async () => {
      mockEngineFactory.engine.countUniqueResult = 2;
      mockEngineFactory.engine.validateCallArgs = [
        ["user1@test.com", "pass1"],
        ["user2@test.com", "pass2"],
      ];

      const result = await useCase.execute(makeInput({ validate: async () => false }));

      expect(result.value!.validated).toBe(0);
    });

    it("should count only the credentials for which validate returns true", async () => {
      let callCount = 0;
      mockEngineFactory.engine.countUniqueResult = 3;
      mockEngineFactory.engine.validateCallArgs = [
        ["u1@t.com", "p1"],
        ["u2@t.com", "p2"],
        ["u3@t.com", "p3"],
      ];
      const validate = async () => callCount++ === 0;

      const result = await useCase.execute(makeInput({ validate }));

      expect(result.value!.validated).toBe(1);
    });

    it("should return validated=0 and not throw when engine.runFromFile throws", async () => {
      mockEngineFactory.engine.countUniqueResult = 3;
      mockEngineFactory.engine.shouldThrow = new Error("Engine IO error");

      const result = await useCase.execute(makeInput());

      expect(result.value!.validated).toBe(0);
    });
  });

  describe("logging", () => {
    it("should call onLog at least once during execution", async () => {
      const logs: string[] = [];
      mockScraper.executeResult = { scraped: 3 };
      mockEngineFactory.engine.countUniqueResult = 0;

      await useCase.execute(makeInput({ onLog: (msg) => logs.push(msg) }));

      expect(logs.length).toBeGreaterThan(0);
    });

    it("should log a message containing scraping info", async () => {
      const logs: string[] = [];
      mockScraper.executeResult = { scraped: 5 };

      await useCase.execute(makeInput({ onLog: (msg) => logs.push(msg) }));

      expect(logs.some((l) => l.toLowerCase().includes("scraping"))).toBe(true);
    });

    it("should log an error message when scraper throws", async () => {
      const logs: string[] = [];
      mockScraper.shouldThrow = new Error("Timeout");

      await useCase.execute(makeInput({ onLog: (msg) => logs.push(msg) }));

      expect(logs.some((l) => l.includes("[ERROR]"))).toBe(true);
    });

    it("should log an error message when engine throws", async () => {
      const logs: string[] = [];
      mockEngineFactory.engine.countUniqueResult = 1;
      mockEngineFactory.engine.shouldThrow = new Error("FS error");

      await useCase.execute(makeInput({ onLog: (msg) => logs.push(msg) }));

      expect(logs.some((l) => l.includes("[ERROR]"))).toBe(true);
    });

    it("should not throw when onLog is not provided", async () => {
      await expect(useCase.execute(makeInput())).resolves.toBeDefined();
    });
  });

  describe("combined result", () => {
    it("should return both scraped and validated counts together", async () => {
      mockScraper.executeResult = { scraped: 10 };
      mockEngineFactory.engine.countUniqueResult = 2;
      mockEngineFactory.engine.validateCallArgs = [
        ["u1@t.com", "p1"],
        ["u2@t.com", "p2"],
      ];

      const result = await useCase.execute(makeInput({ validate: async () => true }));

      expect(result.value!.scraped).toBe(10);
      expect(result.value!.validated).toBe(2);
    });

    it("should return {scraped:0, validated:0} when both scraper and engine find nothing", async () => {
      mockScraper.executeResult = { scraped: 0 };
      mockEngineFactory.engine.countUniqueResult = 0;

      const result = await useCase.execute(makeInput());

      expect(result.value).toEqual({ scraped: 0, validated: 0 });
    });

    it("should return {scraped:0, validated:0} when scraper throws", async () => {
      mockScraper.shouldThrow = new Error("Fatal error");
      mockEngineFactory.engine.countUniqueResult = 0;

      const result = await useCase.execute(makeInput());

      expect(result.value).toEqual({ scraped: 0, validated: 0 });
    });
  });
});
