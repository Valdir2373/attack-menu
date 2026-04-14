import { describe, it, expect, beforeEach, vi } from "vitest";
import { MassiveValidationUseCase } from "../../../src/application/scraping/use-cases/MassiveValidationUseCase.js";
import type { MassiveValidationInput } from "../../../src/application/scraping/use-cases/MassiveValidationUseCase.js";
import { ExecuteGitHubScrapingHandler } from "../../../src/application/scraping/handlers/ExecuteGitHubScrapingHandler.js";
import { ExecuteGitHubScrapingCommand } from "../../../src/application/scraping/commands/ExecuteGitHubScrapingCommand.js";
import { ValidateGitHubBotHandler } from "../../../src/application/scraping/handlers/ValidateGitHubBotHandler.js";
import { ValidateGitHubBotCommand } from "../../../src/application/scraping/commands/ValidateGitHubBotCommand.js";
import { ReadKeywordsHandler } from "../../../src/application/scraping/handlers/ReadKeywordsHandler.js";
import { ReadKeywordsCommand } from "../../../src/application/scraping/commands/ReadKeywordsCommand.js";
import { ExecuteScrapValidatePipelineHandler } from "../../../src/application/scraping/handlers/ExecuteScrapValidatePipelineHandler.js";
import { ExecuteScrapValidatePipelineCommand } from "../../../src/application/scraping/commands/ExecuteScrapValidatePipelineCommand.js";
import { CredentialEngine } from "../../../src/infra/engine/CredentialEngine.js";
import { CredentialEngineFactory } from "../../../src/infra/engine/CredentialEngineFactory.js";
import { MockGitHubScraper } from "../../mocks/MockGitHubScraper.js";
import { MockCredentialEngineFactory, MockCredentialEngine } from "../../mocks/MockCredentialEngineFactory.js";
import { MockFileStorage } from "../../mocks/MockFileStorage.js";
import { MockLogger } from "../../mocks/MockLogger.js";
import type { IMediator } from "../../../src/domain/patterns/IMediator.js";
import type { IKeywordReader } from "../../../src/application/common/IKeywordReader.js";
import { Result } from "../../../src/shared/Result.js";

const noop = async () => false;

function makeInput(overrides: Partial<MassiveValidationInput> = {}): MassiveValidationInput {
  return {
    keywords: ["smtp credentials"],
    tempFile: "/tmp/scrape.txt",
    patterns: [/([^\s:]+@[^\s:]+)/i, /pass(?:word)?[:\s]+([^\s]+)/i],
    validate: noop,
    outputFile: "/tmp/valid.txt",
    ...overrides,
  };
}

describe("ScraperModule", () => {
  describe("MassiveValidationUseCase", () => {
    let useCase: MassiveValidationUseCase;
    let scraper: MockGitHubScraper;
    let engineFactory: MockCredentialEngineFactory;

    beforeEach(() => {
      scraper = new MockGitHubScraper();
      engineFactory = new MockCredentialEngineFactory();
      useCase = new MassiveValidationUseCase(scraper, engineFactory);
    });

    it("returns scraped count matching scraper output for single keyword", async () => {
      scraper.executeResult = { scraped: 15 };
      const result = await useCase.execute(makeInput({ keywords: ["db password"] }));
      expect(result.value!.scraped).toBe(15);
    });

    it("returns scraped=0 for empty keywords array", async () => {
      scraper.executeResult = { scraped: 0 };
      const result = await useCase.execute(makeInput({ keywords: [] }));
      expect(result.value!.scraped).toBe(0);
    });

    it("passes all keywords to the scraper in a single call", async () => {
      const keywords = ["key1", "key2", "key3", "key4", "key5"];
      await useCase.execute(makeInput({ keywords }));
      expect(scraper.executeCalls[0].keywords).toEqual(keywords);
    });

    it("handles scraper throwing network error gracefully", async () => {
      scraper.shouldThrow = new Error("net::ERR_CONNECTION_REFUSED");
      const result = await useCase.execute(makeInput());
      expect(result.isSuccess).toBe(true);
      expect(result.value!.scraped).toBe(0);
    });

    it("handles scraper throwing timeout error gracefully", async () => {
      scraper.shouldThrow = new Error("Navigation timeout of 30000ms exceeded");
      const result = await useCase.execute(makeInput());
      expect(result.value!.scraped).toBe(0);
    });

    it("counts validated credentials when validate returns true", async () => {
      engineFactory.engine.countUniqueResult = 4;
      engineFactory.engine.validateCallArgs = [
        ["a@b.com", "pass1"],
        ["c@d.com", "pass2"],
        ["e@f.com", "pass3"],
        ["g@h.com", "pass4"],
      ];
      const result = await useCase.execute(makeInput({ validate: async () => true }));
      expect(result.value!.validated).toBe(4);
    });

    it("counts only partial validated credentials based on validate return", async () => {
      engineFactory.engine.countUniqueResult = 3;
      engineFactory.engine.validateCallArgs = [
        ["a@b.com", "p1"],
        ["c@d.com", "p2"],
        ["e@f.com", "p3"],
      ];
      let i = 0;
      const result = await useCase.execute(makeInput({
        validate: async () => ++i % 2 === 0,
      }));
      expect(result.value!.validated).toBe(1);
    });

    it("invokes onProgress callback during scraping", async () => {
      const progressValues: number[] = [];
      scraper.executeResult = { scraped: 2 };
      await useCase.execute(makeInput({
        onProgress: (remaining) => progressValues.push(remaining),
      }));
      expect(scraper.executeCalls[0].onProgress).toBeDefined();
    });

    it("invokes onLog with scraping start message", async () => {
      const logs: string[] = [];
      await useCase.execute(makeInput({ onLog: (m) => logs.push(m) }));
      expect(logs.some((l) => l.includes("scraping") || l.includes("Scraping"))).toBe(true);
    });

    it("invokes onLog with validation start message", async () => {
      const logs: string[] = [];
      await useCase.execute(makeInput({ onLog: (m) => logs.push(m) }));
      expect(logs.some((l) => l.toLowerCase().includes("validação") || l.toLowerCase().includes("validacao"))).toBe(true);
    });

    it("invokes onLog with final summary message", async () => {
      const logs: string[] = [];
      scraper.executeResult = { scraped: 7 };
      await useCase.execute(makeInput({ onLog: (m) => logs.push(m) }));
      expect(logs.some((l) => l.includes("Concluído") || l.includes("Concluido"))).toBe(true);
    });

    it("passes whitelist to scraper when provided", async () => {
      await useCase.execute(makeInput({ whitelist: ["gmail.com", "yahoo.com"] }));
      expect(scraper.executeCalls[0].whitelist).toEqual(["gmail.com", "yahoo.com"]);
    });

    it("passes blacklist to scraper when provided", async () => {
      await useCase.execute(makeInput({ blacklist: ["test.com"] }));
      expect(scraper.executeCalls[0].blacklist).toEqual(["test.com"]);
    });

    it("leaves whitelist and blacklist undefined when not provided", async () => {
      await useCase.execute(makeInput());
      expect(scraper.executeCalls[0].whitelist).toBeUndefined();
      expect(scraper.executeCalls[0].blacklist).toBeUndefined();
    });

    it("forwards saveFn to engine factory create call", async () => {
      const saveFn = async (creds: string[]) => {};
      await useCase.execute(makeInput({ saveFn }));
      expect(engineFactory.createCalls[0].saveFn).toBe(saveFn);
    });

    it("uses tempFile for both scraping and validation", async () => {
      engineFactory.engine.countUniqueResult = 1;
      await useCase.execute(makeInput({ tempFile: "/shared/data.txt" }));
      expect(scraper.executeCalls[0].tempFile).toBe("/shared/data.txt");
      expect(engineFactory.engine.runFromFileCalls[0]).toBe("/shared/data.txt");
    });

    it("returns fail result when patterns array is empty", async () => {
      const result = await useCase.execute(makeInput({ patterns: [] }));
      expect(result.isFailure).toBe(true);
      expect(result.error).toBeDefined();
    });

    it("does not call scraper when patterns are empty", async () => {
      await useCase.execute(makeInput({ patterns: [] }));
      expect(scraper.executeCalls).toHaveLength(0);
    });

    it("skips runFromFile when engine countUnique returns zero", async () => {
      engineFactory.engine.countUniqueResult = 0;
      await useCase.execute(makeInput());
      expect(engineFactory.engine.runFromFileCalls).toHaveLength(0);
    });

    it("logs unique credential count before validation", async () => {
      const logs: string[] = [];
      engineFactory.engine.countUniqueResult = 42;
      await useCase.execute(makeInput({ onLog: (m) => logs.push(m) }));
      expect(logs.some((l) => l.includes("42"))).toBe(true);
    });

    it("logs nothing-to-validate message when countUnique is zero", async () => {
      const logs: string[] = [];
      engineFactory.engine.countUniqueResult = 0;
      await useCase.execute(makeInput({ onLog: (m) => logs.push(m) }));
      expect(logs.some((l) => l.toLowerCase().includes("nada") || l.includes("[i]"))).toBe(true);
    });

    it("logs error message when engine.runFromFile throws", async () => {
      const logs: string[] = [];
      engineFactory.engine.countUniqueResult = 5;
      engineFactory.engine.shouldThrow = new Error("disk full");
      await useCase.execute(makeInput({ onLog: (m) => logs.push(m) }));
      expect(logs.some((l) => l.includes("[ERROR]"))).toBe(true);
    });

    it("continues gracefully without onLog callback", async () => {
      scraper.executeResult = { scraped: 3 };
      const result = await useCase.execute(makeInput({ onLog: undefined }));
      expect(result.isSuccess).toBe(true);
    });

    it("passes patterns array to engine factory create", async () => {
      const patterns = [/foo/, /bar/];
      await useCase.execute(makeInput({ patterns }));
      expect(engineFactory.createCalls[0].patterns).toEqual(patterns);
    });

    it("passes outputFile to engine factory create", async () => {
      await useCase.execute(makeInput({ outputFile: "/results/hits.txt" }));
      expect(engineFactory.createCalls[0].outputFilePath).toBe("/results/hits.txt");
    });
  });

  describe("ExecuteGitHubScrapingHandler", () => {
    let handler: ExecuteGitHubScrapingHandler;
    let scraper: MockGitHubScraper;

    beforeEach(() => {
      scraper = new MockGitHubScraper();
      handler = new ExecuteGitHubScrapingHandler(scraper);
    });

    it("returns Result.ok with scraped count", async () => {
      scraper.executeResult = { scraped: 10 };
      const result = await handler.execute(new ExecuteGitHubScrapingCommand(["test"], "/tmp/t.txt"));
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(10);
    });

    it("passes keywords to scraper", async () => {
      await handler.execute(new ExecuteGitHubScrapingCommand(["kw1", "kw2"], "/tmp/t.txt"));
      expect(scraper.executeCalls[0].keywords).toEqual(["kw1", "kw2"]);
    });

    it("passes tempFile to scraper", async () => {
      await handler.execute(new ExecuteGitHubScrapingCommand(["kw"], "/data/out.txt"));
      expect(scraper.executeCalls[0].tempFile).toBe("/data/out.txt");
    });

    it("handles empty keywords array", async () => {
      scraper.executeResult = { scraped: 0 };
      const result = await handler.execute(new ExecuteGitHubScrapingCommand([], "/tmp/t.txt"));
      expect(result.value).toBe(0);
    });

    it("passes whitelist to scraper", async () => {
      await handler.execute(new ExecuteGitHubScrapingCommand(["kw"], "/tmp/t.txt", ["allowed.com"]));
      expect(scraper.executeCalls[0].whitelist).toEqual(["allowed.com"]);
    });

    it("passes blacklist to scraper", async () => {
      await handler.execute(new ExecuteGitHubScrapingCommand(["kw"], "/tmp/t.txt", undefined, ["blocked.com"]));
      expect(scraper.executeCalls[0].blacklist).toEqual(["blocked.com"]);
    });

    it("forwards onLog callback to scraper", async () => {
      const onLog = vi.fn();
      await handler.execute(new ExecuteGitHubScrapingCommand(["kw"], "/tmp/t.txt", undefined, undefined, onLog));
      expect(scraper.executeCalls[0].onLog).toBe(onLog);
    });

    it("forwards onProgress callback to scraper", async () => {
      const onProgress = vi.fn();
      await handler.execute(new ExecuteGitHubScrapingCommand(["kw"], "/tmp/t.txt", undefined, undefined, undefined, onProgress));
      expect(scraper.executeCalls[0].onProgress).toBe(onProgress);
    });

    it("returns high scraped count for large result sets", async () => {
      scraper.executeResult = { scraped: 9999 };
      const result = await handler.execute(new ExecuteGitHubScrapingCommand(["massive search"], "/tmp/t.txt"));
      expect(result.value).toBe(9999);
    });

    it("propagates scraper exception as unhandled rejection", async () => {
      scraper.shouldThrow = new Error("Puppeteer crash");
      await expect(handler.execute(new ExecuteGitHubScrapingCommand(["kw"], "/tmp/t.txt")))
        .rejects.toThrow("Puppeteer crash");
    });

    it("passes both whitelist and blacklist simultaneously", async () => {
      await handler.execute(new ExecuteGitHubScrapingCommand(
        ["kw"], "/tmp/t.txt", ["a.com"], ["b.com"],
      ));
      expect(scraper.executeCalls[0].whitelist).toEqual(["a.com"]);
      expect(scraper.executeCalls[0].blacklist).toEqual(["b.com"]);
    });

    it("does not set headless in command (handler delegates raw options)", async () => {
      await handler.execute(new ExecuteGitHubScrapingCommand(["kw"], "/tmp/t.txt"));
      expect(scraper.executeCalls[0].headless).toBeUndefined();
    });

    it("returns zero when scraper finds nothing", async () => {
      scraper.executeResult = { scraped: 0 };
      const result = await handler.execute(new ExecuteGitHubScrapingCommand(["obscure query"], "/tmp/t.txt"));
      expect(result.value).toBe(0);
    });

    it("handles multiple sequential executions", async () => {
      scraper.executeResult = { scraped: 5 };
      await handler.execute(new ExecuteGitHubScrapingCommand(["kw1"], "/tmp/a.txt"));
      await handler.execute(new ExecuteGitHubScrapingCommand(["kw2"], "/tmp/b.txt"));
      expect(scraper.executeCalls).toHaveLength(2);
    });

    it("keeps keyword order as provided", async () => {
      await handler.execute(new ExecuteGitHubScrapingCommand(["z", "a", "m"], "/tmp/t.txt"));
      expect(scraper.executeCalls[0].keywords).toEqual(["z", "a", "m"]);
    });
  });

  describe("ValidateGitHubBotHandler", () => {
    let handler: ValidateGitHubBotHandler;
    let scraper: MockGitHubScraper;

    beforeEach(() => {
      scraper = new MockGitHubScraper();
      handler = new ValidateGitHubBotHandler(scraper);
    });

    it("returns isValid=true when cookie exists and scraper validates it", async () => {
      process.env.COOKIE_GIT0 = "valid_session_cookie";
      scraper.validateCookieResult = true;
      const result = await handler.execute(new ValidateGitHubBotCommand(0));
      expect(result.value!.isValid).toBe(true);
      delete process.env.COOKIE_GIT0;
    });

    it("returns isValid=false when cookie exists but scraper rejects it", async () => {
      process.env.COOKIE_GIT0 = "expired_cookie";
      scraper.validateCookieResult = false;
      const result = await handler.execute(new ValidateGitHubBotCommand(0));
      expect(result.value!.isValid).toBe(false);
      delete process.env.COOKIE_GIT0;
    });

    it("returns isValid=false when cookie env var does not exist", async () => {
      delete process.env.COOKIE_GIT99;
      const result = await handler.execute(new ValidateGitHubBotCommand(99));
      expect(result.value!.isValid).toBe(false);
    });

    it("returns Result.ok regardless of validation outcome", async () => {
      delete process.env.COOKIE_GIT50;
      const result = await handler.execute(new ValidateGitHubBotCommand(50));
      expect(result.isSuccess).toBe(true);
    });

    it("resolves cookie by botIndex from environment", async () => {
      process.env.COOKIE_GIT3 = "cookie_for_bot_3";
      scraper.validateCookieResult = true;
      const result = await handler.execute(new ValidateGitHubBotCommand(3));
      expect(result.value!.isValid).toBe(true);
      delete process.env.COOKIE_GIT3;
    });

    it("returns isValid=false for negative bot index", async () => {
      const result = await handler.execute(new ValidateGitHubBotCommand(-1));
      expect(result.value!.isValid).toBe(false);
    });

    it("handles bot index zero correctly", async () => {
      process.env.COOKIE_GIT0 = "session_zero";
      scraper.validateCookieResult = true;
      const result = await handler.execute(new ValidateGitHubBotCommand(0));
      expect(result.isSuccess).toBe(true);
      expect(result.value!.isValid).toBe(true);
      delete process.env.COOKIE_GIT0;
    });

    it("does not throw when cookie is missing", async () => {
      delete process.env.COOKIE_GIT100;
      await expect(handler.execute(new ValidateGitHubBotCommand(100))).resolves.toBeDefined();
    });

    it("validates with the actual cookie string from env", async () => {
      process.env.COOKIE_GIT1 = "abc123";
      scraper.validateCookieResult = false;
      const result = await handler.execute(new ValidateGitHubBotCommand(1));
      expect(result.value!.isValid).toBe(false);
      delete process.env.COOKIE_GIT1;
    });

    it("returns isValid=false for very large bot index without env var", async () => {
      const result = await handler.execute(new ValidateGitHubBotCommand(999999));
      expect(result.value!.isValid).toBe(false);
    });
  });

  describe("ReadKeywordsHandler", () => {
    let handler: ReadKeywordsHandler;
    let reader: MockKeywordReader;

    class MockKeywordReader implements IKeywordReader {
      result: string[] = [];
      calls: string[] = [];
      shouldThrow: Error | null = null;

      async read(filePath: string): Promise<string[]> {
        this.calls.push(filePath);
        if (this.shouldThrow) throw this.shouldThrow;
        return this.result;
      }
    }

    beforeEach(() => {
      reader = new MockKeywordReader();
      handler = new ReadKeywordsHandler(reader);
    });

    it("returns keywords from file", async () => {
      reader.result = ["smtp", "ftp", "database"];
      const result = await handler.execute(new ReadKeywordsCommand("/data/keywords.txt"));
      expect(result.value).toEqual(["smtp", "ftp", "database"]);
    });

    it("returns empty array for empty file", async () => {
      reader.result = [];
      const result = await handler.execute(new ReadKeywordsCommand("/data/empty.txt"));
      expect(result.value).toEqual([]);
    });

    it("passes correct file path to reader", async () => {
      await handler.execute(new ReadKeywordsCommand("/custom/path/kw.txt"));
      expect(reader.calls[0]).toBe("/custom/path/kw.txt");
    });

    it("returns Result.ok on successful read", async () => {
      reader.result = ["test"];
      const result = await handler.execute(new ReadKeywordsCommand("/f.txt"));
      expect(result.isSuccess).toBe(true);
    });

    it("propagates reader exception when file not found", async () => {
      reader.shouldThrow = new Error("ENOENT: no such file or directory");
      await expect(handler.execute(new ReadKeywordsCommand("/missing.txt")))
        .rejects.toThrow("ENOENT");
    });

    it("handles single keyword file", async () => {
      reader.result = ["one"];
      const result = await handler.execute(new ReadKeywordsCommand("/f.txt"));
      expect(result.value).toHaveLength(1);
    });

    it("handles large keyword list", async () => {
      reader.result = Array.from({ length: 500 }, (_, i) => `keyword_${i}`);
      const result = await handler.execute(new ReadKeywordsCommand("/f.txt"));
      expect(result.value).toHaveLength(500);
    });

    it("preserves keyword order from reader", async () => {
      reader.result = ["z_last", "a_first", "m_middle"];
      const result = await handler.execute(new ReadKeywordsCommand("/f.txt"));
      expect(result.value).toEqual(["z_last", "a_first", "m_middle"]);
    });

    it("handles keywords with special characters", async () => {
      reader.result = ["email:password", "user@domain", "key=value"];
      const result = await handler.execute(new ReadKeywordsCommand("/f.txt"));
      expect(result.value).toEqual(["email:password", "user@domain", "key=value"]);
    });

    it("calls reader exactly once per execute", async () => {
      reader.result = ["kw"];
      await handler.execute(new ReadKeywordsCommand("/a.txt"));
      await handler.execute(new ReadKeywordsCommand("/b.txt"));
      expect(reader.calls).toEqual(["/a.txt", "/b.txt"]);
    });
  });

  describe("ExecuteScrapValidatePipelineHandler", () => {
    let handler: ExecuteScrapValidatePipelineHandler;
    let scraper: MockGitHubScraper;
    let engineFactory: MockCredentialEngineFactory;
    let fileStorage: MockFileStorage;
    let massiveUseCase: MassiveValidationUseCase;
    let mockMediator: IMediator;

    beforeEach(() => {
      scraper = new MockGitHubScraper();
      engineFactory = new MockCredentialEngineFactory();
      fileStorage = new MockFileStorage();
      massiveUseCase = new MassiveValidationUseCase(scraper, engineFactory);
      mockMediator = {
        send: vi.fn().mockResolvedValue(Result.ok({ isValid: true })),
      };
      handler = new ExecuteScrapValidatePipelineHandler(
        () => mockMediator,
        massiveUseCase,
        fileStorage,
      );
    });

    it("returns Result.ok with scraped and validated counts", async () => {
      scraper.executeResult = { scraped: 5 };
      engineFactory.engine.countUniqueResult = 0;
      const logs: string[] = [];
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], [], [], (m) => logs.push(m));
      const result = await handler.execute(cmd);
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveProperty("scraped");
      expect(result.value).toHaveProperty("validated");
    });

    it("calls onLog with pipeline start message", async () => {
      const logs: string[] = [];
      engineFactory.engine.countUniqueResult = 0;
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], [], [], (m) => logs.push(m));
      await handler.execute(cmd);
      expect(logs.some((l) => l.includes("pipeline"))).toBe(true);
    });

    it("loads existing emails from fileStorage to skip duplicates", async () => {
      fileStorage.setFile("emails_validos.txt", "existing@gmail.com:password\n");
      scraper.executeResult = { scraped: 1 };
      engineFactory.engine.countUniqueResult = 1;
      engineFactory.engine.validateCallArgs = [["existing@gmail.com", "newpass"]];
      const logs: string[] = [];
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], [], [], (m) => logs.push(m));
      await handler.execute(cmd);
      expect(logs.some((l) => l.includes("ja existe") || l.includes("já existe"))).toBe(true);
    });

    it("logs empty bank message when email file does not exist", async () => {
      const logs: string[] = [];
      engineFactory.engine.countUniqueResult = 0;
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], [], [], (m) => logs.push(m));
      await handler.execute(cmd);
      expect(logs.some((l) => l.includes("vazio") || l.includes("zero"))).toBe(true);
    });

    it("passes empty whitelist as undefined to massive use case", async () => {
      engineFactory.engine.countUniqueResult = 0;
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], [], ["blocked.com"], () => {});
      await handler.execute(cmd);
      expect(scraper.executeCalls[0].whitelist).toBeUndefined();
    });

    it("passes non-empty whitelist to massive use case", async () => {
      engineFactory.engine.countUniqueResult = 0;
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], ["gmail.com"], [], () => {});
      await handler.execute(cmd);
      expect(scraper.executeCalls[0].whitelist).toEqual(["gmail.com"]);
    });

    it("passes empty blacklist as undefined to massive use case", async () => {
      engineFactory.engine.countUniqueResult = 0;
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], ["a.com"], [], () => {});
      await handler.execute(cmd);
      expect(scraper.executeCalls[0].blacklist).toBeUndefined();
    });

    it("passes non-empty blacklist to massive use case", async () => {
      engineFactory.engine.countUniqueResult = 0;
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], [], ["spam.com"], () => {});
      await handler.execute(cmd);
      expect(scraper.executeCalls[0].blacklist).toEqual(["spam.com"]);
    });

    it("delegates email validation to mediator via ValidateEmailCommand", async () => {
      scraper.executeResult = { scraped: 1 };
      engineFactory.engine.countUniqueResult = 1;
      engineFactory.engine.validateCallArgs = [["new@gmail.com", "apppass"]];
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], [], [], () => {});
      await handler.execute(cmd);
      expect(mockMediator.send).toHaveBeenCalled();
    });

    it("returns scraped=0 validated=0 when massive validation fails", async () => {
      const brokenUseCase = new MassiveValidationUseCase(scraper, engineFactory);
      const brokenHandler = new ExecuteScrapValidatePipelineHandler(
        () => mockMediator,
        brokenUseCase,
        fileStorage,
      );
      engineFactory.engine.countUniqueResult = 0;
      const logs: string[] = [];
      const cmd = new ExecuteScrapValidatePipelineCommand([], [], [], (m) => logs.push(m));
      const result = await brokenHandler.execute(cmd);
      expect(result.value!.scraped).toBe(0);
    });

    it("forwards onProgress to the massive validation input", async () => {
      engineFactory.engine.countUniqueResult = 0;
      const progress = vi.fn();
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], [], [], () => {}, progress);
      await handler.execute(cmd);
      expect(scraper.executeCalls[0].onProgress).toBeDefined();
    });

    it("logs validated email as OK when mediator returns isValid true", async () => {
      scraper.executeResult = { scraped: 1 };
      engineFactory.engine.countUniqueResult = 1;
      engineFactory.engine.validateCallArgs = [["valid@gmail.com", "pass"]];
      (mockMediator.send as ReturnType<typeof vi.fn>).mockResolvedValue(Result.ok({ isValid: true }));
      const logs: string[] = [];
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], [], [], (m) => logs.push(m));
      await handler.execute(cmd);
      expect(logs.some((l) => l.includes("[OK]"))).toBe(true);
    });

    it("logs rejected email as x when mediator returns isValid false", async () => {
      scraper.executeResult = { scraped: 1 };
      engineFactory.engine.countUniqueResult = 1;
      engineFactory.engine.validateCallArgs = [["bad@gmail.com", "wrong"]];
      (mockMediator.send as ReturnType<typeof vi.fn>).mockResolvedValue(Result.ok({ isValid: false }));
      const logs: string[] = [];
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], [], [], (m) => logs.push(m));
      await handler.execute(cmd);
      expect(logs.some((l) => l.includes("[x]"))).toBe(true);
    });

    it("adds validated email to existing set to prevent revalidation", async () => {
      scraper.executeResult = { scraped: 1 };
      engineFactory.engine.countUniqueResult = 2;
      engineFactory.engine.validateCallArgs = [
        ["new@gmail.com", "pass"],
        ["new@gmail.com", "pass"],
      ];
      (mockMediator.send as ReturnType<typeof vi.fn>).mockResolvedValue(Result.ok({ isValid: true }));
      const logs: string[] = [];
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], [], [], (m) => logs.push(m));
      await handler.execute(cmd);
      expect(logs.filter((l) => l.includes("ja existe") || l.includes("já existe")).length).toBeGreaterThanOrEqual(1);
    });

    it("uses email regex and password regex as patterns", async () => {
      engineFactory.engine.countUniqueResult = 0;
      const cmd = new ExecuteScrapValidatePipelineCommand(["kw"], [], [], () => {});
      await handler.execute(cmd);
      const patterns = engineFactory.createCalls[0].patterns;
      expect(patterns).toHaveLength(2);
    });
  });

  describe("CredentialEngine contract", () => {
    let logger: MockLogger;

    beforeEach(() => {
      logger = new MockLogger();
    });

    it("extracts credentials matching single pattern from raw data", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/([^\s]+@[^\s]+)/],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      await engine.runFromRaw("user@test.com");
      expect(saved).toHaveLength(1);
      expect(saved[0][0]).toContain("@");
    });

    it("extracts credentials matching multiple patterns from raw data", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/([^\s:]+@[^\s:]+)/, /pass:([^\s]+)/],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      await engine.runFromRaw("user@mail.com pass:secret123");
      expect(saved).toHaveLength(1);
      expect(saved[0]).toEqual(["user@mail.com", "secret123"]);
    });

    it("skips blocks that do not match all patterns", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/([^\s:]+@[^\s:]+)/, /password:([^\s]+)/],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      await engine.runFromRaw("user@mail.com no_password_here");
      expect(saved).toHaveLength(0);
    });

    it("deduplicates identical credentials across blocks", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/([^\s]+@[^\s]+)/],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      const data = "user@test.com\n------------------------------------------------------------\nuser@test.com";
      await engine.runFromRaw(data);
      expect(saved).toHaveLength(1);
    });

    it("processes distinct credentials from separate blocks", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/([^\s]+@[^\s]+)/],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      const data = "a@test.com\n------------------------------------------------------------\nb@test.com";
      await engine.runFromRaw(data);
      expect(saved).toHaveLength(2);
    });

    it("calls validate function for each unique credential", async () => {
      const validated: string[][] = [];
      const engine = new CredentialEngine(
        [/([^\s]+@[^\s]+)/],
        async (...args) => { validated.push(args); return false; },
        "/tmp/out.txt",
        undefined,
        logger,
      );
      const data = "a@t.com\n------------------------------------------------------------\nb@t.com\n------------------------------------------------------------\nc@t.com";
      await engine.runFromRaw(data);
      expect(validated).toHaveLength(3);
    });

    it("saves only credentials for which validate returns true", async () => {
      const saved: string[][] = [];
      let callCount = 0;
      const engine = new CredentialEngine(
        [/([^\s]+@[^\s]+)/],
        async () => ++callCount <= 1,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      const data = "a@t.com\n------------------------------------------------------------\nb@t.com";
      await engine.runFromRaw(data);
      expect(saved).toHaveLength(1);
      expect(saved[0][0]).toBe("a@t.com");
    });

    it("does not save credentials when validate returns false", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/([^\s]+@[^\s]+)/],
        async () => false,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      await engine.runFromRaw("user@mail.com");
      expect(saved).toHaveLength(0);
    });

    it("countUnique returns zero for nonexistent file", async () => {
      const engine = new CredentialEngine(
        [/([^\s]+@[^\s]+)/],
        async () => true,
        "/tmp/out.txt",
        undefined,
        logger,
      );
      const count = await engine.countUnique("/tmp/definitely_nonexistent_" + Date.now() + ".txt");
      expect(count).toBe(0);
    });

    it("runFromFile does nothing for nonexistent file", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/([^\s]+@[^\s]+)/],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      await engine.runFromFile("/tmp/definitely_nonexistent_" + Date.now() + ".txt");
      expect(saved).toHaveLength(0);
    });

    it("runFromFile logs warning for nonexistent file", async () => {
      const engine = new CredentialEngine(
        [/([^\s]+@[^\s]+)/],
        async () => true,
        "/tmp/out.txt",
        undefined,
        logger,
      );
      await engine.runFromFile("/tmp/definitely_nonexistent_" + Date.now() + ".txt");
      expect(logger.messages.some((m) => m.level === "warn")).toBe(true);
    });

    it("handles empty raw data without errors", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/([^\s]+@[^\s]+)/],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      await engine.runFromRaw("");
      expect(saved).toHaveLength(0);
    });

    it("handles raw data with only separator lines", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/([^\s]+@[^\s]+)/],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      const seps = "------------------------------------------------------------\n------------------------------------------------------------";
      await engine.runFromRaw(seps);
      expect(saved).toHaveLength(0);
    });

    it("trims whitespace around extracted credential values", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/(\S+@\S+)/],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      await engine.runFromRaw("   user@test.com   ");
      expect(saved).toHaveLength(1);
      expect(saved[0][0]).toBe("user@test.com");
    });

    it("processes many blocks efficiently", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/([^\s]+@[^\s]+)/],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      const blocks = Array.from({ length: 50 }, (_, i) => `user${i}@test.com`);
      const data = blocks.join("\n------------------------------------------------------------\n");
      await engine.runFromRaw(data);
      expect(saved).toHaveLength(50);
    });

    it("resets regex lastIndex between blocks for global patterns", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/([^\s]+@[^\s]+)/g],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      const data = "a@t.com\n------------------------------------------------------------\nb@t.com";
      await engine.runFromRaw(data);
      expect(saved).toHaveLength(2);
    });

    it("returns null from extract when no pattern matches the block", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/NOMATCH/],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      await engine.runFromRaw("some random text");
      expect(saved).toHaveLength(0);
    });

    it("extract uses match group 1 when available", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/email:([^\s]+)/],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      await engine.runFromRaw("email:user@test.com");
      expect(saved[0][0]).toBe("user@test.com");
    });

    it("extract uses match group 0 when no capture group", async () => {
      const saved: string[][] = [];
      const engine = new CredentialEngine(
        [/[^\s]+@[^\s]+/],
        async () => true,
        "/tmp/out.txt",
        async (creds) => { saved.push(creds); },
        logger,
      );
      await engine.runFromRaw("user@test.com");
      expect(saved[0][0]).toBe("user@test.com");
    });

    it("CredentialEngineFactory creates an engine with correct constructor args", () => {
      const factory = new CredentialEngineFactory(logger);
      const patterns = [/test/];
      const validate = async () => true;
      const engine = factory.create(patterns, validate, "/out.txt");
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(CredentialEngine);
    });

    it("CredentialEngineFactory passes saveFn to engine", async () => {
      const factory = new CredentialEngineFactory(logger);
      const saved: string[][] = [];
      const engine = factory.create(
        [/([^\s]+@[^\s]+)/],
        async () => true,
        "/out.txt",
        async (creds) => { saved.push(creds); },
      );
      await engine.runFromRaw("a@b.com");
      expect(saved.length).toBeGreaterThan(0);
    });

    it("MockCredentialEngineFactory records create calls", () => {
      const factory = new MockCredentialEngineFactory();
      const patterns = [/test/];
      const validate = async () => true;
      factory.create(patterns, validate, "/out.txt");
      expect(factory.createCalls).toHaveLength(1);
      expect(factory.createCalls[0].patterns).toEqual(patterns);
    });

    it("MockCredentialEngine tracks runFromFile calls", async () => {
      const engine = new MockCredentialEngine();
      await engine.runFromFile("/a.txt");
      await engine.runFromFile("/b.txt");
      expect(engine.runFromFileCalls).toEqual(["/a.txt", "/b.txt"]);
    });

    it("MockCredentialEngine returns configured countUniqueResult", async () => {
      const engine = new MockCredentialEngine();
      engine.countUniqueResult = 77;
      const count = await engine.countUnique("/any.txt");
      expect(count).toBe(77);
    });

    it("MockCredentialEngine reset clears all state", () => {
      const engine = new MockCredentialEngine();
      engine.countUniqueResult = 10;
      engine.shouldThrow = new Error("x");
      engine.reset();
      expect(engine.countUniqueResult).toBe(0);
      expect(engine.shouldThrow).toBeNull();
      expect(engine.runFromFileCalls).toHaveLength(0);
    });
  });
});
