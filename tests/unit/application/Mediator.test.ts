import { describe, it, expect, beforeEach } from "vitest";
import { Mediator } from "../../../src/application/common/Mediator.js";
import { LoggingBehavior } from "../../../src/application/common/LoggingBehavior.js";
import { ValidationBehavior } from "../../../src/application/common/ValidationBehavior.js";
import type { ICommandHandler } from "../../../src/domain/patterns/ICommandHandler.js";
import type { IValidator } from "../../../src/application/common/IValidator.js";
import { Result } from "../../../src/shared/Result.js";
import { MockLogger } from "../../mocks/MockLogger.js";

class TestCommand {
  constructor(public readonly value: string) {}
}

class UnknownCommand {
  constructor(public readonly data: string) {}
}

class MockHandler implements ICommandHandler<TestCommand, string> {
  public calls: TestCommand[] = [];
  public result: Result<string> = Result.ok("success");

  async execute(command: TestCommand): Promise<Result<string>> {
    this.calls.push(command);
    return this.result;
  }
}

function passingValidator(): IValidator<TestCommand> {
  return { validate: () => Result.ok(undefined) };
}

function failingValidator(msg: string): IValidator<TestCommand> {
  return { validate: () => Result.fail(msg) };
}

describe("Mediator", () => {
  let logger: MockLogger;
  let logging: LoggingBehavior;
  let handler: MockHandler;

  beforeEach(() => {
    logger = new MockLogger();
    logging = new LoggingBehavior(logger);
    handler = new MockHandler();
  });

  function createMediator(
    validators?: Map<string, ValidationBehavior<any>>,
  ): Mediator {
    const handlers = new Map<string, ICommandHandler<any, any>>();
    handlers.set("TestCommand", handler);
    return new Mediator(handlers, logging, validators ?? new Map());
  }

  it("should route command to correct handler", async () => {
    const mediator = createMediator();
    const result = await mediator.send<string>(new TestCommand("hello"));

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe("success");
    expect(handler.calls).toHaveLength(1);
    expect(handler.calls[0].value).toBe("hello");
  });

  it("should throw InvalidCommandError for unknown command", async () => {
    const mediator = createMediator();

    await expect(
      mediator.send(new UnknownCommand("test")),
    ).rejects.toThrow("Handler não encontrado: UnknownCommand");
  });

  it("should apply LoggingBehavior", async () => {
    const mediator = createMediator();
    await mediator.send<string>(new TestCommand("logged"));

    expect(logger.messages.some((m) =>
      m.level === "info" && m.message.includes("TestCommand"),
    )).toBe(true);
  });

  it("should apply ValidationBehavior before handler", async () => {
    const validators = new Map<string, ValidationBehavior<any>>();
    validators.set("TestCommand", new ValidationBehavior([failingValidator("Campo inválido")]));

    const mediator = createMediator(validators);
    const result = await mediator.send<string>(new TestCommand("invalid"));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Campo inválido");
    expect(handler.calls).toHaveLength(0);
  });

  it("should call handler when validation passes", async () => {
    const validators = new Map<string, ValidationBehavior<any>>();
    validators.set("TestCommand", new ValidationBehavior([passingValidator()]));

    const mediator = createMediator(validators);
    const result = await mediator.send<string>(new TestCommand("valid"));

    expect(result.isSuccess).toBe(true);
    expect(handler.calls).toHaveLength(1);
  });

  it("should propagate handler failure result", async () => {
    handler.result = Result.fail("Handler error");
    const mediator = createMediator();
    const result = await mediator.send<string>(new TestCommand("fail"));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Handler error");
  });
});
