import { describe, it, expect, beforeEach } from "vitest";
import { CompileC2UseCase } from "../../../src/application/c2/use-cases/CompileC2UseCase.js";
import { MockC2Compiler } from "../../mocks/MockC2Compiler.js";
import { Result } from "../../../src/shared/Result.js";

describe("CompileC2UseCase", () => {
  let compiler: MockC2Compiler;
  let useCase: CompileC2UseCase;
  let logs: string[];

  beforeEach(() => {
    compiler = new MockC2Compiler();
    useCase = new CompileC2UseCase(compiler);
    logs = [];
  });

  const onLog = (msg: string) => logs.push(msg);

  it("deve compilar com sucesso e retornar binaryPath + buildId", async () => {
    const result = await useCase.execute("ws://localhost:4444", onLog);

    expect(result.isSuccess).toBe(true);
    expect(result.value!.binaryPath).toBe("/tmp/builds/123/c2_agent.exe");
    expect(result.value!.buildId).toBe("123");
    expect(compiler.calls).toEqual(["ws://localhost:4444"]);
  });

  it("deve logar início da compilação", async () => {
    await useCase.execute("ws://10.0.0.1:4444", onLog);

    expect(logs[0]).toContain("Iniciando compilação");
    expect(logs[1]).toContain("ws://10.0.0.1:4444");
  });

  it("deve logar sucesso com o path do binário", async () => {
    await useCase.execute("ws://localhost:4444", onLog);

    expect(logs.some((l) => l.includes("Build concluído"))).toBe(true);
    expect(logs.some((l) => l.includes("c2_agent.exe"))).toBe(true);
  });

  it("deve retornar falha e logar erro quando compilador falha", async () => {
    compiler.result = Result.fail("Docker não encontrado");

    const result = await useCase.execute("ws://localhost:4444", onLog);

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Docker não encontrado");
    expect(logs.some((l) => l.includes("Erro"))).toBe(true);
    expect(logs.some((l) => l.includes("Docker não encontrado"))).toBe(true);
  });

  it("deve passar diferentes URLs para o compilador", async () => {
    await useCase.execute("ws://192.168.1.100:9999/c2", onLog);

    expect(compiler.calls).toEqual(["ws://192.168.1.100:9999/c2"]);
  });

  it("deve funcionar com URL wss://", async () => {
    await useCase.execute("wss://secure.example.com:4444", onLog);

    expect(compiler.calls).toEqual(["wss://secure.example.com:4444"]);
    expect(result => result.isSuccess);
  });
});
