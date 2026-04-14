import { describe, it, expect, beforeEach } from "vitest";
import { createContainer, Container, Token, TOKENS } from "../../src/shared/Container.js";
import { LoggingBehavior } from "../../src/application/common/LoggingBehavior.js";
import { Mediator } from "../../src/application/common/Mediator.js";
import { ValidationBehavior } from "../../src/application/common/ValidationBehavior.js";
import { ValidateEmailHandler } from "../../src/application/email/handlers/ValidateEmailHandler.js";
import { ValidateMongoHandler } from "../../src/application/mongo/handlers/ValidateMongoHandler.js";
import { ValidateSupabaseHandler } from "../../src/application/supabase/handlers/ValidateSupabaseHandler.js";
import { ValidateEmailCommandValidator } from "../../src/application/email/validators/ValidateEmailCommandValidator.js";
import { ValidateMongoCommandValidator } from "../../src/application/mongo/validators/ValidateMongoCommandValidator.js";
import { ValidateSupabaseCommandValidator } from "../../src/application/supabase/validators/ValidateSupabaseCommandValidator.js";
import { ValidateEmailCommand } from "../../src/application/email/commands/ValidateEmailCommand.js";
import { ValidateMongoCommand } from "../../src/application/mongo/commands/ValidateMongoCommand.js";
import { ValidateSupabaseCommand } from "../../src/application/supabase/commands/ValidateSupabaseCommand.js";
import { MassiveValidationUseCase } from "../../src/application/scraping/use-cases/MassiveValidationUseCase.js";
import type { ICommandHandler } from "../../src/domain/patterns/ICommandHandler.js";
import type { IMediator } from "../../src/domain/patterns/IMediator.js";
import {
  MockLogger,
  MockEmailValidator,
  MockMongoValidator,
  MockSupabaseValidator,
  MockGitHubScraper,
  MockCredentialEngineFactory,
  MockProxyManager,
  MockReverseProxyModuleFactory,
  MockImapListener,
  MockEmailMonitorService,
  MockImapClient,
  MockEmailSender,
  MockFileStorage,
} from "../mocks/index.js";

function buildContainer(): {
  container: Container;
  mocks: {
    logger: MockLogger;
    emailValidator: MockEmailValidator;
    mongoValidator: MockMongoValidator;
    supabaseValidator: MockSupabaseValidator;
    scraper: MockGitHubScraper;
    engineFactory: MockCredentialEngineFactory;
    proxyManager: MockProxyManager;
    reverseProxyFactory: MockReverseProxyModuleFactory;
  };
} {
  const container = createContainer();

  const mocks = {
    logger: new MockLogger(),
    emailValidator: new MockEmailValidator(),
    mongoValidator: new MockMongoValidator(),
    supabaseValidator: new MockSupabaseValidator(),
    scraper: new MockGitHubScraper(),
    engineFactory: new MockCredentialEngineFactory(),
    proxyManager: new MockProxyManager(),
    reverseProxyFactory: new MockReverseProxyModuleFactory(),
  };

  container.register(TOKENS.ILogger, () => mocks.logger);
  container.register(TOKENS.IGitHubScraper, () => mocks.scraper);
  container.register(TOKENS.IEmailValidator, () => mocks.emailValidator);
  container.register(TOKENS.IMongoValidator, () => mocks.mongoValidator);
  container.register(TOKENS.ISupabaseValidator, () => mocks.supabaseValidator);
  container.register(TOKENS.IProxyManager, () => mocks.proxyManager);
  container.register(TOKENS.ICredentialEngineFactory, () => mocks.engineFactory);
  container.register(TOKENS.IReverseProxyModuleFactory, () => mocks.reverseProxyFactory);
  container.register(TOKENS.IImapClient, () => new MockImapClient());
  container.register(TOKENS.IEmailSender, () => new MockEmailSender());
  container.register(TOKENS.IFileStorage, () => new MockFileStorage());
  container.register(TOKENS.ImapListenerFactory, () => () => new MockImapListener());
  container.register(TOKENS.EmailMonitorServiceFactory, () => () => new MockEmailMonitorService());

  container.register(TOKENS.LoggingBehavior, (c) =>
    new LoggingBehavior(c.resolve(TOKENS.ILogger)),
  );

  container.register(TOKENS.ValidateEmailHandler, (c) =>
    new ValidateEmailHandler(c.resolve(TOKENS.IEmailValidator)),
  );
  container.register(TOKENS.ValidateMongoHandler, (c) =>
    new ValidateMongoHandler(c.resolve(TOKENS.IMongoValidator)),
  );
  container.register(TOKENS.ValidateSupabaseHandler, (c) =>
    new ValidateSupabaseHandler(c.resolve(TOKENS.ISupabaseValidator)),
  );

  container.register(TOKENS.IMediator, (c) => {
    const handlers = new Map<string, ICommandHandler<any, any>>();
    handlers.set("ValidateEmailCommand", c.resolve(TOKENS.ValidateEmailHandler));
    handlers.set("ValidateMongoCommand", c.resolve(TOKENS.ValidateMongoHandler));
    handlers.set("ValidateSupabaseCommand", c.resolve(TOKENS.ValidateSupabaseHandler));

    const validators = new Map<string, ValidationBehavior<any>>();
    validators.set("ValidateEmailCommand", new ValidationBehavior([new ValidateEmailCommandValidator()]));
    validators.set("ValidateMongoCommand", new ValidationBehavior([new ValidateMongoCommandValidator()]));
    validators.set("ValidateSupabaseCommand", new ValidationBehavior([new ValidateSupabaseCommandValidator()]));

    return new Mediator(handlers, c.resolve(TOKENS.LoggingBehavior), validators);
  });

  container.register(TOKENS.MassiveValidationUseCase, (c) =>
    new MassiveValidationUseCase(
      c.resolve(TOKENS.IGitHubScraper),
      c.resolve(TOKENS.ICredentialEngineFactory),
    ),
  );

  return { container, mocks };
}

describe("DI Container — Integration", () => {
  let container: Container;
  let mocks: ReturnType<typeof buildContainer>["mocks"];

  beforeEach(() => {
    const setup = buildContainer();
    container = setup.container;
    mocks = setup.mocks;
  });

  it("deve resolver todas as portas do Domain", () => {
    expect(container.resolve(TOKENS.ILogger)).toBe(mocks.logger);
    expect(container.resolve(TOKENS.IGitHubScraper)).toBe(mocks.scraper);
    expect(container.resolve(TOKENS.IEmailValidator)).toBe(mocks.emailValidator);
    expect(container.resolve(TOKENS.IMongoValidator)).toBe(mocks.mongoValidator);
    expect(container.resolve(TOKENS.ISupabaseValidator)).toBe(mocks.supabaseValidator);
    expect(container.resolve(TOKENS.IProxyManager)).toBe(mocks.proxyManager);
    expect(container.resolve(TOKENS.ICredentialEngineFactory)).toBe(mocks.engineFactory);
    expect(container.resolve(TOKENS.IReverseProxyModuleFactory)).toBe(mocks.reverseProxyFactory);
  });

  it("deve resolver singletons — mesma instância em múltiplas chamadas", () => {
    const first = container.resolve(TOKENS.ValidateEmailHandler);
    const second = container.resolve(TOKENS.ValidateEmailHandler);
    expect(first).toBe(second);
  });

  it("deve resolver factories transientes — cada chamada da factory cria nova instância", () => {
    const factory = container.resolve(TOKENS.ImapListenerFactory);
    const a = factory();
    const b = factory();
    expect(a).not.toBe(b);
    expect(a.isConnected).toBe(false);
  });

  it("deve lançar ConfigError ao resolver token não registrado", () => {
    const fakeToken = new Token<unknown>("TokenInexistente");
    expect(() => container.resolve(fakeToken)).toThrowError("não registrada");
  });

  it("Mediator — deve validar email via pipeline completo", async () => {
    mocks.emailValidator.result = true;

    const mediator = container.resolve(TOKENS.IMediator);
    const result = await mediator.send<{ isValid: boolean }>(
      new ValidateEmailCommand("user@test.com", "pass123"),
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value!.isValid).toBe(true);
    expect(mocks.emailValidator.calls).toHaveLength(1);
    expect(mocks.emailValidator.calls[0]).toEqual({ email: "user@test.com", password: "pass123" });
  });

  it("Mediator — deve rejeitar email inválido via ValidationBehavior", async () => {
    const mediator = container.resolve(TOKENS.IMediator);
    const result = await mediator.send<{ isValid: boolean }>(
      new ValidateEmailCommand("invalido", "pass123"),
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Email inválido");
    expect(mocks.emailValidator.calls).toHaveLength(0);
  });

  it("Mediator — deve validar URI MongoDB via pipeline completo", async () => {
    mocks.mongoValidator.result = true;

    const mediator = container.resolve(TOKENS.IMediator);
    const result = await mediator.send<{ isValid: boolean }>(
      new ValidateMongoCommand("mongodb+srv://host/db"),
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value!.isValid).toBe(true);
    expect(mocks.mongoValidator.calls).toEqual(["mongodb+srv://host/db"]);
  });

  it("Mediator — deve validar URL+key Supabase via pipeline completo", async () => {
    mocks.supabaseValidator.result = true;

    const mediator = container.resolve(TOKENS.IMediator);
    const result = await mediator.send<{ isValid: boolean }>(
      new ValidateSupabaseCommand("https://xyz.supabase.co", "eyJhbGciOiJIUzI1NiJ9.test"),
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value!.isValid).toBe(true);
    expect(mocks.supabaseValidator.calls).toHaveLength(1);
  });

  it("Mediator — deve logar via LoggingBehavior", async () => {
    mocks.emailValidator.result = true;

    const mediator = container.resolve(TOKENS.IMediator);
    await mediator.send<{ isValid: boolean }>(
      new ValidateEmailCommand("user@test.com", "pass"),
    );

    expect(mocks.logger.messages.some((m) =>
      m.level === "info" && m.message.includes("ValidateEmailCommand"),
    )).toBe(true);
  });

  it("MassiveValidationUseCase — deve orquestrar scraper + engine via DI", async () => {
    mocks.scraper.executeResult = { scraped: 5 };
    mocks.engineFactory.engine.countUniqueResult = 3;

    const useCase = container.resolve(TOKENS.MassiveValidationUseCase);
    const logs: string[] = [];

    const result = await useCase.execute({
      keywords: ["test"],
      tempFile: "/tmp/test.txt",
      patterns: [/(.+):(.+)/],
      validate: async () => true,
      outputFile: "/tmp/valid.txt",
      onLog: (msg) => logs.push(msg),
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value!.scraped).toBe(5);
    expect(mocks.scraper.executeCalls).toHaveLength(1);
    expect(mocks.engineFactory.engine.runFromFileCalls).toContain("/tmp/test.txt");
    expect(logs.some((l) => l.includes("scraping"))).toBe(true);
  });

  it("LoggingBehavior — deve usar ILogger resolvido pelo container", async () => {
    const behavior = container.resolve(TOKENS.LoggingBehavior);

    const result = await behavior.handle("TestCommand", async () => "ok");

    expect(result).toBe("ok");
    expect(mocks.logger.messages.some((m) => m.level === "info" && m.message.includes("TestCommand"))).toBe(true);
  });

  it("IProxyManager — deve start/stop/status via container", async () => {
    const proxy = container.resolve(TOKENS.IProxyManager) as MockProxyManager;

    await proxy.start({ port: 1080 });
    const running = await proxy.status();
    expect(running.running).toBe(true);
    expect(running.port).toBe(1080);

    await proxy.stop();
    const stopped = await proxy.status();
    expect(stopped.running).toBe(false);
  });
});
