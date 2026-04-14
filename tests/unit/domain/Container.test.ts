import { describe, it, expect } from "vitest";
import { Token, Container, createContainer, TOKENS } from "../../../src/shared/Container.js";
import { ConfigError } from "../../../src/errors/index.js";

describe("Token<T>", () => {
  it("should create a token with the given key", () => {
    const token = new Token<string>("MyService");

    expect(token.key).toBe("MyService");
  });

  it("should preserve distinct keys for different tokens", () => {
    const a = new Token<string>("A");
    const b = new Token<number>("B");

    expect(a.key).not.toBe(b.key);
  });

  it("should allow same key for different token instances", () => {
    const a = new Token<string>("Same");
    const b = new Token<number>("Same");

    expect(a.key).toBe(b.key);
  });
});

describe("Container", () => {
  it("should register and resolve a dependency", () => {
    const container = createContainer();
    const token = new Token<string>("greeting");

    container.register(token, () => "hello");

    expect(container.resolve(token)).toBe("hello");
  });

  it("should return the same singleton on multiple resolves", () => {
    const container = createContainer();
    const token = new Token<object>("obj");

    container.register(token, () => ({ x: 1 }));

    const first = container.resolve(token);
    const second = container.resolve(token);

    expect(first).toBe(second);
  });

  it("should throw ConfigError when resolving unregistered token", () => {
    const container = createContainer();
    const token = new Token<string>("Unregistered");

    expect(() => container.resolve(token)).toThrow(ConfigError);
    expect(() => container.resolve(token)).toThrow("não registrada");
  });

  it("should resolve multiple tokens independently", () => {
    const container = createContainer();
    const tokenA = new Token<string>("A");
    const tokenB = new Token<number>("B");
    const tokenC = new Token<boolean>("C");

    container.register(tokenA, () => "alpha");
    container.register(tokenB, () => 42);
    container.register(tokenC, () => true);

    expect(container.resolve(tokenA)).toBe("alpha");
    expect(container.resolve(tokenB)).toBe(42);
    expect(container.resolve(tokenC)).toBe(true);
  });

  it("should pass the container to the factory function", () => {
    const container = createContainer();
    const depToken = new Token<string>("dep");
    const serviceToken = new Token<string>("service");

    container.register(depToken, () => "dependency-value");
    container.register(serviceToken, (c) => `uses:${c.resolve(depToken)}`);

    expect(container.resolve(serviceToken)).toBe("uses:dependency-value");
  });

  it("should support chained register calls", () => {
    const container = createContainer();
    const a = new Token<number>("a");
    const b = new Token<number>("b");

    container.register(a, () => 1).register(b, () => 2);

    expect(container.resolve(a)).toBe(1);
    expect(container.resolve(b)).toBe(2);
  });

  it("should only call factory once (lazy singleton)", () => {
    const container = createContainer();
    const token = new Token<number>("counter");
    let callCount = 0;

    container.register(token, () => {
      callCount++;
      return callCount;
    });

    const first = container.resolve(token);
    const second = container.resolve(token);
    const third = container.resolve(token);

    expect(callCount).toBe(1);
    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(third).toBe(1);
  });

  it("should support factory returning undefined (void)", () => {
    const container = createContainer();
    const token = new Token<void>("void");

    container.register(token, () => undefined);

    expect(container.resolve(token)).toBeUndefined();
  });

  it("should support overwriting a registration", () => {
    const container = createContainer();
    const token = new Token<string>("overwrite");

    container.register(token, () => "first");
    container.register(token, () => "second");

    expect(container.resolve(token)).toBe("second");
  });

  it("should support transient factory pattern (factory of factory)", () => {
    const container = createContainer();
    const token = new Token<() => object>("factory");

    container.register(token, () => () => ({ created: true }));

    const factory = container.resolve(token);
    const a = factory();
    const b = factory();

    expect(a).not.toBe(b);
    expect(a).toEqual({ created: true });
  });

  it("should resolve dependency graph in correct order", () => {
    const container = createContainer();
    const dbToken = new Token<string>("db");
    const repoToken = new Token<string>("repo");
    const serviceToken = new Token<string>("service");

    container.register(dbToken, () => "postgres://localhost");
    container.register(repoToken, (c) => `repo(${c.resolve(dbToken)})`);
    container.register(serviceToken, (c) => `service(${c.resolve(repoToken)})`);

    expect(container.resolve(serviceToken)).toBe("service(repo(postgres://localhost))");
  });
});

describe("createContainer()", () => {
  it("should return a new Container instance", () => {
    const a = createContainer();
    const b = createContainer();

    expect(a).toBeInstanceOf(Container);
    expect(a).not.toBe(b);
  });
});

describe("TOKENS", () => {
  it("should have unique keys for all tokens", () => {
    const keys = Object.values(TOKENS).map((t) => t.key);
    const unique = new Set(keys);

    expect(unique.size).toBe(keys.length);
  });

  it("should include core domain port tokens", () => {
    expect(TOKENS.ILogger.key).toBe("ILogger");
    expect(TOKENS.IEmailValidator.key).toBe("IEmailValidator");
    expect(TOKENS.IMongoValidator.key).toBe("IMongoValidator");
    expect(TOKENS.ISupabaseValidator.key).toBe("ISupabaseValidator");
    expect(TOKENS.IGitHubScraper.key).toBe("IGitHubScraper");
    expect(TOKENS.IProxyManager.key).toBe("IProxyManager");
  });

  it("should include compiler tokens", () => {
    expect(TOKENS.IC2Compiler.key).toBe("IC2Compiler");
    expect(TOKENS.IRansomCompiler.key).toBe("IRansomCompiler");
  });

  it("should include controller tokens", () => {
    expect(TOKENS.EmailController.key).toBe("EmailController");
    expect(TOKENS.MongoController.key).toBe("MongoController");
    expect(TOKENS.SupabaseController.key).toBe("SupabaseController");
    expect(TOKENS.RansomController.key).toBe("RansomController");
    expect(TOKENS.C2Controller.key).toBe("C2Controller");
  });

  it("should include handler tokens", () => {
    expect(TOKENS.ValidateEmailHandler.key).toBe("ValidateEmailHandler");
    expect(TOKENS.ValidateMongoHandler.key).toBe("ValidateMongoHandler");
    expect(TOKENS.ValidateSupabaseHandler.key).toBe("ValidateSupabaseHandler");
  });

  it("should include transient factory tokens", () => {
    expect(TOKENS.ImapListenerFactory.key).toBe("ImapListenerFactory");
    expect(TOKENS.EmailMonitorServiceFactory.key).toBe("EmailMonitorServiceFactory");
  });
});
