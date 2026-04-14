import { describe, it, expect, vi, beforeEach } from "vitest";
import { Proxy, type ProxyStatusType } from "../../../src/domain/entities/Proxy.js";
import { StartAmbientProxyHandler } from "../../../src/application/proxy/handlers/StartAmbientProxyHandler.js";
import { StopAmbientProxyHandler } from "../../../src/application/proxy/handlers/StopAmbientProxyHandler.js";
import { RefreshProxyStatusHandler } from "../../../src/application/proxy/handlers/RefreshProxyStatusHandler.js";
import { StartReverseProxyHandler } from "../../../src/application/proxy/handlers/StartReverseProxyHandler.js";
import { StopReverseProxyHandler } from "../../../src/application/proxy/handlers/StopReverseProxyHandler.js";
import { ProcessProxyRequestUseCase } from "../../../src/application/proxy/reverse/ProcessProxyRequestUseCase.js";
import { StartAmbientProxyCommand } from "../../../src/application/proxy/commands/StartAmbientProxyCommand.js";
import { StopAmbientProxyCommand } from "../../../src/application/proxy/commands/StopAmbientProxyCommand.js";
import { RefreshProxyStatusCommand } from "../../../src/application/proxy/commands/RefreshProxyStatusCommand.js";
import { StartReverseProxyCommand } from "../../../src/application/proxy/commands/StartReverseProxyCommand.js";
import { StopReverseProxyCommand } from "../../../src/application/proxy/commands/StopReverseProxyCommand.js";
import { MockProxyManager } from "../../mocks/MockProxyManager.js";
import { MockReverseProxyModuleFactory, MockReverseProxyServer } from "../../mocks/MockReverseProxyModuleFactory.js";
import type { MergedRules, ReplaceRule } from "../../../src/domain/proxy/reverse/ProxyRules.js";
import type { IBlockEngine } from "../../../src/domain/proxy/reverse/IBlockEngine.js";
import type { IReplaceEngine } from "../../../src/domain/proxy/reverse/IReplaceEngine.js";
import type { IHtmlSanitizer } from "../../../src/domain/proxy/reverse/IHtmlSanitizer.js";
import type { IRulesRepository } from "../../../src/domain/proxy/reverse/IRulesRepository.js";
import type { IHttpClient } from "../../../src/application/proxy/reverse/IHttpClient.js";
import type { ReverseProxyContext } from "../../../src/application/proxy/reverse/ReverseProxyContext.js";

function emptyMerged(overrides: Partial<MergedRules> = {}): MergedRules {
  return {
    blockUrls: [],
    blockPatterns: [],
    replace: [],
    stripHeaders: [],
    ...overrides,
  };
}

function makeCtx(overrides: Partial<ReverseProxyContext> = {}): ReverseProxyContext {
  return {
    targetDomain: "https://example.com",
    targetHost: "example.com",
    localDomain: "http://localhost:3000",
    method: "GET",
    url: "/page",
    headers: {},
    ...overrides,
  };
}

function fakeResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    status: init?.status ?? 200,
    headers: {
      "content-type": "text/html",
      ...(init?.headers as Record<string, string> ?? {}),
    },
  });
}

class StubRulesRepo implements IRulesRepository {
  constructor(public rules: MergedRules = emptyMerged()) {}
  getMerged(_host: string): MergedRules { return this.rules; }
}

class StubBlockEngine implements IBlockEngine {
  public blocked = new Set<string>();
  isBlocked(text: string, _rules: MergedRules): boolean {
    for (const b of this.blocked) {
      if (text.includes(b)) return true;
    }
    return false;
  }
}

class StubReplaceEngine implements IReplaceEngine {
  apply(text: string, rules: ReplaceRule[], phase: "request" | "response"): string {
    for (const r of rules) {
      const target = r.on ?? "response";
      if (target !== phase && target !== "both") continue;
      text = text.replaceAll(r.from, r.to);
    }
    return text;
  }
}

class StubHtmlSanitizer implements IHtmlSanitizer {
  sanitize(html: string, _rules: MergedRules): string { return html; }
}

class StubHttpClient implements IHttpClient {
  public response: Response = fakeResponse("");
  async forward(): Promise<Response> { return this.response; }
}

describe("Proxy Entity — State Machine", () => {
  it("starts with status stopped, port 0, and empty containerName", () => {
    const p = Proxy.criar();
    expect(p.status).toBe("stopped");
    expect(p.port).toBe(0);
    expect(p.containerName).toBe("");
  });

  it("allows stopped -> starting", () => {
    const p = Proxy.criar();
    expect(p.transitionTo("starting").isSuccess).toBe(true);
    expect(p.status).toBe("starting");
  });

  it("allows starting -> running and stores port + containerName", () => {
    const p = Proxy.criar();
    p.transitionTo("starting");
    const r = p.transitionTo("running", { port: 8080, containerName: "tor-1" });
    expect(r.isSuccess).toBe(true);
    expect(p.port).toBe(8080);
    expect(p.containerName).toBe("tor-1");
  });

  it("allows starting -> error", () => {
    const p = Proxy.criar();
    p.transitionTo("starting");
    expect(p.transitionTo("error").isSuccess).toBe(true);
    expect(p.status).toBe("error");
  });

  it("allows running -> stopping", () => {
    const p = Proxy.criar();
    p.transitionTo("starting");
    p.transitionTo("running");
    expect(p.transitionTo("stopping").isSuccess).toBe(true);
  });

  it("allows running -> error", () => {
    const p = Proxy.criar();
    p.transitionTo("starting");
    p.transitionTo("running");
    expect(p.transitionTo("error").isSuccess).toBe(true);
  });

  it("allows stopping -> stopped", () => {
    const p = Proxy.criar();
    p.transitionTo("starting");
    p.transitionTo("running");
    p.transitionTo("stopping");
    expect(p.transitionTo("stopped").isSuccess).toBe(true);
  });

  it("allows stopping -> error", () => {
    const p = Proxy.criar();
    p.transitionTo("starting");
    p.transitionTo("running");
    p.transitionTo("stopping");
    expect(p.transitionTo("error").isSuccess).toBe(true);
  });

  it("allows error -> starting (retry)", () => {
    const p = Proxy.criar();
    p.transitionTo("starting");
    p.transitionTo("error");
    expect(p.transitionTo("starting").isSuccess).toBe(true);
  });

  it("allows error -> stopped (give up)", () => {
    const p = Proxy.criar();
    p.transitionTo("starting");
    p.transitionTo("error");
    expect(p.transitionTo("stopped").isSuccess).toBe(true);
  });

  it("rejects stopped -> running (must go through starting)", () => {
    const p = Proxy.criar();
    const r = p.transitionTo("running");
    expect(r.isFailure).toBe(true);
    expect(r.error).toContain("Transição inválida");
    expect(p.status).toBe("stopped");
  });

  it("rejects stopped -> stopping", () => {
    const p = Proxy.criar();
    expect(p.transitionTo("stopping").isFailure).toBe(true);
  });

  it("rejects starting -> stopped (must go through running or error)", () => {
    const p = Proxy.criar();
    p.transitionTo("starting");
    expect(p.transitionTo("stopped").isFailure).toBe(true);
    expect(p.status).toBe("starting");
  });

  it("rejects running -> starting (must stop first)", () => {
    const p = Proxy.criar();
    p.transitionTo("starting");
    p.transitionTo("running");
    expect(p.transitionTo("starting").isFailure).toBe(true);
  });

  it("preserves port and containerName across valid transitions", () => {
    const p = Proxy.criar();
    p.transitionTo("starting");
    p.transitionTo("running", { port: 9050, containerName: "tor-proxy" });
    p.transitionTo("stopping");
    p.transitionTo("stopped");
    expect(p.port).toBe(9050);
    expect(p.containerName).toBe("tor-proxy");
  });

  it("does not overwrite port when info is omitted", () => {
    const p = Proxy.criar();
    p.transitionTo("starting");
    p.transitionTo("running", { port: 9050 });
    p.transitionTo("error");
    expect(p.port).toBe(9050);
  });
});

describe("StartAmbientProxyHandler", () => {
  let mock: MockProxyManager;
  let handler: StartAmbientProxyHandler;

  beforeEach(() => {
    mock = new MockProxyManager();
    handler = new StartAmbientProxyHandler(mock);
  });

  it("calls proxyManager.start and returns success", async () => {
    const result = await handler.execute(new StartAmbientProxyCommand());
    expect(result.isSuccess).toBe(true);
    expect(mock.startCalls).toBe(1);
  });

  it("passes config to proxyManager.start", async () => {
    const cfg = { port: 9050, exitNodes: "{us}" };
    await handler.execute(new StartAmbientProxyCommand(cfg));
    expect(mock.config).toEqual(cfg);
  });

  it("sets running to true after start", async () => {
    await handler.execute(new StartAmbientProxyCommand());
    expect(mock.running).toBe(true);
  });

  it("starts with default config when none provided", async () => {
    await handler.execute(new StartAmbientProxyCommand());
    expect(mock.startCalls).toBe(1);
  });

  it("starts with host config", async () => {
    await handler.execute(new StartAmbientProxyCommand({ host: "0.0.0.0" }));
    expect(mock.config.host).toBe("0.0.0.0");
  });

  it("propagates error from proxyManager.start", async () => {
    const failing = {
      start: vi.fn().mockRejectedValue(new Error("Docker not found")),
      stop: vi.fn(),
      status: vi.fn(),
      configure: vi.fn(),
    };
    const h = new StartAmbientProxyHandler(failing);
    await expect(h.execute(new StartAmbientProxyCommand())).rejects.toThrow("Docker not found");
  });

  it("increments startCalls on each invocation", async () => {
    await handler.execute(new StartAmbientProxyCommand());
    await handler.execute(new StartAmbientProxyCommand());
    expect(mock.startCalls).toBe(2);
  });

  it("merges config when called with partial config", async () => {
    await handler.execute(new StartAmbientProxyCommand({ port: 1234 }));
    expect(mock.config.port).toBe(1234);
    expect(mock.config.exitNodes).toBeUndefined();
  });
});

describe("StopAmbientProxyHandler", () => {
  let mock: MockProxyManager;
  let handler: StopAmbientProxyHandler;

  beforeEach(() => {
    mock = new MockProxyManager();
    handler = new StopAmbientProxyHandler(mock);
  });

  it("calls proxyManager.stop and returns success", async () => {
    const result = await handler.execute(new StopAmbientProxyCommand());
    expect(result.isSuccess).toBe(true);
    expect(mock.stopCalls).toBe(1);
  });

  it("sets running to false after stop", async () => {
    mock.running = true;
    await handler.execute(new StopAmbientProxyCommand());
    expect(mock.running).toBe(false);
  });

  it("can stop even when already stopped", async () => {
    const result = await handler.execute(new StopAmbientProxyCommand());
    expect(result.isSuccess).toBe(true);
  });

  it("increments stopCalls on each invocation", async () => {
    await handler.execute(new StopAmbientProxyCommand());
    await handler.execute(new StopAmbientProxyCommand());
    expect(mock.stopCalls).toBe(2);
  });

  it("propagates error from proxyManager.stop", async () => {
    const failing = {
      start: vi.fn(),
      stop: vi.fn().mockRejectedValue(new Error("Container stuck")),
      status: vi.fn(),
      configure: vi.fn(),
    };
    const h = new StopAmbientProxyHandler(failing);
    await expect(h.execute(new StopAmbientProxyCommand())).rejects.toThrow("Container stuck");
  });

  it("returns Result.ok regardless of prior state", async () => {
    mock.running = true;
    const r1 = await handler.execute(new StopAmbientProxyCommand());
    const r2 = await handler.execute(new StopAmbientProxyCommand());
    expect(r1.isSuccess).toBe(true);
    expect(r2.isSuccess).toBe(true);
  });

  it("does not affect startCalls counter", async () => {
    await handler.execute(new StopAmbientProxyCommand());
    expect(mock.startCalls).toBe(0);
  });
});

describe("RefreshProxyStatusHandler", () => {
  let mock: MockProxyManager;
  let handler: RefreshProxyStatusHandler;

  beforeEach(() => {
    mock = new MockProxyManager();
    handler = new RefreshProxyStatusHandler(mock);
  });

  it("returns running=false when proxy is stopped", async () => {
    const result = await handler.execute(new RefreshProxyStatusCommand());
    expect(result.isSuccess).toBe(true);
    expect(result.value!.running).toBe(false);
  });

  it("returns running=true when proxy is running", async () => {
    mock.running = true;
    mock.config = { port: 9050 };
    const result = await handler.execute(new RefreshProxyStatusCommand());
    expect(result.value!.running).toBe(true);
    expect(result.value!.port).toBe(9050);
  });

  it("returns correct containerName when running", async () => {
    mock.running = true;
    const result = await handler.execute(new RefreshProxyStatusCommand());
    expect(result.value!.containerName).toBe("mock-proxy");
  });

  it("returns empty containerName when stopped", async () => {
    const result = await handler.execute(new RefreshProxyStatusCommand());
    expect(result.value!.containerName).toBe("");
  });

  it("propagates error from proxyManager.status", async () => {
    const failing = {
      start: vi.fn(),
      stop: vi.fn(),
      status: vi.fn().mockRejectedValue(new Error("Docker daemon down")),
      configure: vi.fn(),
    };
    const h = new RefreshProxyStatusHandler(failing);
    await expect(h.execute(new RefreshProxyStatusCommand())).rejects.toThrow("Docker daemon down");
  });
});

describe("StartReverseProxyHandler + StopReverseProxyHandler", () => {
  let factory: MockReverseProxyModuleFactory;
  let handler: StartReverseProxyHandler;

  beforeEach(() => {
    factory = new MockReverseProxyModuleFactory();
    handler = new StartReverseProxyHandler(factory);
  });

  it("creates a module via factory and starts it", async () => {
    const cmd = new StartReverseProxyCommand({ targetUrl: "https://example.com", port: 3000 });
    const result = await handler.execute(cmd);
    expect(result.isSuccess).toBe(true);
    expect(handler.module).not.toBeNull();
    expect(factory.server.running).toBe(true);
  });

  it("is idempotent — second execute reuses existing module", async () => {
    const cmd = new StartReverseProxyCommand({ targetUrl: "https://example.com", port: 3000 });
    await handler.execute(cmd);
    const first = handler.module;
    await handler.execute(cmd);
    expect(handler.module).toBe(first);
  });

  it("handler.stop() sets module to null", async () => {
    const cmd = new StartReverseProxyCommand({ targetUrl: "https://example.com", port: 3000 });
    await handler.execute(cmd);
    handler.stop();
    expect(handler.module).toBeNull();
  });

  it("handler.stop() calls module.stop()", async () => {
    const cmd = new StartReverseProxyCommand({ targetUrl: "https://example.com", port: 3000 });
    await handler.execute(cmd);
    handler.stop();
    expect(factory.server.running).toBe(false);
  });

  it("handler.stop() is safe to call when no module exists", () => {
    expect(() => handler.stop()).not.toThrow();
  });

  it("fires onExit callback with 0 on graceful stop", async () => {
    const onExit = vi.fn();
    const cmd = Object.assign(
      new StartReverseProxyCommand({ targetUrl: "https://example.com", port: 3000 }),
      { onExit },
    );
    await handler.execute(cmd);
    handler.stop();
    expect(onExit).toHaveBeenCalledWith(0);
  });

  it("StopReverseProxyHandler returns Result.ok", async () => {
    const stopHandler = new StopReverseProxyHandler();
    const result = await stopHandler.execute(new StopReverseProxyCommand());
    expect(result.isSuccess).toBe(true);
  });

  it("can start a new module after stop", async () => {
    const cmd = new StartReverseProxyCommand({ targetUrl: "https://example.com", port: 3000 });
    await handler.execute(cmd);
    handler.stop();
    expect(handler.module).toBeNull();
    factory.server = new MockReverseProxyServer();
    await handler.execute(cmd);
    expect(handler.module).not.toBeNull();
  });
});

describe("ProcessProxyRequestUseCase", () => {
  let rulesRepo: StubRulesRepo;
  let blockEngine: StubBlockEngine;
  let replaceEngine: StubReplaceEngine;
  let sanitizer: StubHtmlSanitizer;
  let httpClient: StubHttpClient;
  let useCase: ProcessProxyRequestUseCase;

  beforeEach(() => {
    rulesRepo = new StubRulesRepo();
    blockEngine = new StubBlockEngine();
    replaceEngine = new StubReplaceEngine();
    sanitizer = new StubHtmlSanitizer();
    httpClient = new StubHttpClient();
    useCase = new ProcessProxyRequestUseCase(rulesRepo, blockEngine, replaceEngine, sanitizer, httpClient);
  });

  it("returns blocked result when URL matches block list", async () => {
    blockEngine.blocked.add("ads.tracker.com");
    const ctx = makeCtx({ url: "/pixel?host=ads.tracker.com" });
    const result = await useCase.execute(ctx);
    expect(result.blocked).toBe(true);
    expect(result.status).toBe(200);
  });

  it("forwards request and returns response body for non-blocked URL", async () => {
    httpClient.response = fakeResponse("<h1>Hello</h1>");
    const result = await useCase.execute(makeCtx());
    expect(result.blocked).toBe(false);
    expect(result.body).toContain("Hello");
  });

  it("applies replace rules on response body", async () => {
    rulesRepo.rules = emptyMerged({
      replace: [{ from: "secret", to: "REDACTED" }],
    });
    httpClient.response = fakeResponse("the secret value");
    const result = await useCase.execute(makeCtx());
    expect(result.body).toContain("REDACTED");
    expect(result.body).not.toContain("secret");
  });

  it("rewrites target domain to local domain in response", async () => {
    httpClient.response = fakeResponse('<a href="https://example.com/path">link</a>');
    const result = await useCase.execute(makeCtx());
    expect(result.body).toContain("http://localhost:3000/path");
    expect(result.body).not.toContain("https://example.com");
  });

  it("handles redirect responses by rewriting location", async () => {
    httpClient.response = new Response("", {
      status: 302,
      headers: {
        location: "https://example.com/login",
        "content-type": "text/html",
      },
    });
    const result = await useCase.execute(makeCtx());
    expect(result.status).toBe(302);
    expect(result.redirect).toBe("http://localhost:3000/login");
  });

  it("strips blocked URLs from HTML response body", async () => {
    rulesRepo.rules = emptyMerged({ blockUrls: ["evil.js"] });
    blockEngine.blocked.add("evil.js");
    httpClient.response = fakeResponse('<script src="https://cdn.evil.js/track"></script>');
    const ctx = makeCtx();
    const result = await useCase.execute(ctx);
    expect(result.body).not.toContain("evil.js");
  });

  it("passes binary content through untouched", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    httpClient.response = new Response(bytes, {
      status: 200,
      headers: { "content-type": "image/png" },
    });
    const result = await useCase.execute(makeCtx());
    expect(result.blocked).toBe(false);
    expect(result.body).toBeInstanceOf(Buffer);
  });
});
