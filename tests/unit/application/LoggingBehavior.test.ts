import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoggingBehavior } from "../../../src/application/common/LoggingBehavior.js";
import type { ILogger } from "../../../src/application/common/ILogger.js";

function makeMockLogger(): ILogger {
  return {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

describe("LoggingBehavior", () => {
  let logger: ILogger;
  let behavior: LoggingBehavior;

  beforeEach(() => {
    logger = makeMockLogger();
    behavior = new LoggingBehavior(logger);
  });

  describe("successful execution", () => {
    it("should return the result from next()", async () => {
      const result = await behavior.handle("TestOperation", async () => 42);

      expect(result).toBe(42);
    });

    it("should log info at the start of execution", async () => {
      await behavior.handle("CriarUsuario", async () => "ok");

      const firstCall = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(firstCall[0]).toContain("CriarUsuario");
      expect(firstCall[0]).toContain("iniciado");
    });

    it("should log info at the end of a successful execution", async () => {
      await behavior.handle("CriarUsuario", async () => "ok");

      const calls = (logger.info as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toContain("CriarUsuario");
      expect(lastCall[0]).toContain("concluído");
    });

    it("should log the command name in the completion message", async () => {
      await behavior.handle("MassiveValidation", async () => ({ scraped: 5 }));

      const infoMessages = (logger.info as ReturnType<typeof vi.fn>).mock.calls
        .map((c) => c[0] as string);
      expect(infoMessages.some((m) => m.includes("MassiveValidation"))).toBe(true);
    });

    it("should include elapsed time in the completion message", async () => {
      await behavior.handle("SlowOp", async () => "done");

      const completionMsg = (logger.info as ReturnType<typeof vi.fn>).mock.calls
        .map((c) => c[0] as string)
        .find((m) => m.includes("concluído"));

      expect(completionMsg).toMatch(/\d+ms/);
    });

    it("should not call logger.error for a successful execution", async () => {
      await behavior.handle("SuccessOp", async () => true);

      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should work with async operations that return objects", async () => {
      const result = await behavior.handle("ValidateEmail", async () => ({
        isSuccess: true,
        value: true,
      }));

      expect(result.isSuccess).toBe(true);
    });
  });

  describe("failed execution (next throws)", () => {
    it("should re-throw the error after logging", async () => {
      const boom = new Error("Explodiu");

      await expect(
        behavior.handle("FailingOp", async () => { throw boom; }),
      ).rejects.toThrow("Explodiu");
    });

    it("should call logger.error when next() throws", async () => {
      const err = new Error("DB offline");

      await behavior.handle("DBOp", async () => { throw err; }).catch(() => {});

      expect(logger.error).toHaveBeenCalledOnce();
    });

    it("should include command name in the error log", async () => {
      await behavior
        .handle("ProcessPayment", async () => { throw new Error("timeout"); })
        .catch(() => {});

      const errorCall = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(errorCall[0]).toContain("ProcessPayment");
    });

    it("should include elapsed time in the error message", async () => {
      await behavior
        .handle("SlowFail", async () => { throw new Error("err"); })
        .catch(() => {});

      const errorMsg = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(errorMsg).toMatch(/\d+ms/);
    });

    it("should pass the error object to logger.error", async () => {
      const err = new Error("Original error");

      await behavior
        .handle("ErrOp", async () => { throw err; })
        .catch(() => {});

      const errorCall = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(errorCall[1]).toBe(err);
    });

    it("should log start before the error log", async () => {
      await behavior
        .handle("Op", async () => { throw new Error("fail"); })
        .catch(() => {});

      const infoCallCount  = (logger.info  as ReturnType<typeof vi.fn>).mock.calls.length;
      const errorCallCount = (logger.error as ReturnType<typeof vi.fn>).mock.calls.length;

      expect(infoCallCount).toBeGreaterThanOrEqual(1);
      expect(errorCallCount).toBe(1);
    });
  });
});
