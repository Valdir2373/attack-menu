import { describe, it, expect, beforeEach } from "vitest";
import { MockC2RelayClient } from "../../mocks/MockC2RelayClient.js";
import type { C2Event, C2Machine } from "../../../src/domain/ports/IC2RelayClient.js";

describe("IC2RelayClient — Contrato", () => {
  let relay: MockC2RelayClient;

  beforeEach(() => {
    relay = new MockC2RelayClient();
  });

  describe("conexão", () => {
    it("deve iniciar desconectado", () => {
      expect(relay.isConnected()).toBe(false);
    });

    it("deve conectar com URL e token", async () => {
      await relay.connect("ws://192.168.1.1:4444", "operator-token-123");

      expect(relay.isConnected()).toBe(true);
      expect(relay.connectCalls[0]).toEqual({
        url: "ws://192.168.1.1:4444",
        token: "operator-token-123",
      });
    });

    it("deve conectar sem token (open access)", async () => {
      await relay.connect("ws://localhost:4444");

      expect(relay.isConnected()).toBe(true);
      expect(relay.connectCalls[0].token).toBeUndefined();
    });

    it("deve desconectar corretamente", async () => {
      await relay.connect("ws://localhost:4444");
      relay.disconnect();

      expect(relay.isConnected()).toBe(false);
      expect(relay.disconnectCalls).toBe(1);
    });
  });

  describe("eventos", () => {
    it("deve receber evento welcome com lista de máquinas", () => {
      const events: C2Event[] = [];
      relay.onEvent((e) => events.push(e));

      const machines: C2Machine[] = [
        { id: "m1", name: "PC-OFFICE", os: "Windows 10", ip: "192.168.1.10", connected_at: "2026-04-10T10:00:00Z" },
        { id: "m2", name: "LAPTOP-DEV", os: "Windows 11", ip: "192.168.1.20", connected_at: "2026-04-10T11:00:00Z" },
      ];

      relay.simulateEvent({ type: "welcome", machines });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("welcome");
      if (events[0].type === "welcome") {
        expect(events[0].machines).toHaveLength(2);
        expect(events[0].machines[0].name).toBe("PC-OFFICE");
      }
    });

    it("deve receber cmd_result de máquina específica", () => {
      const events: C2Event[] = [];
      relay.onEvent((e) => events.push(e));

      relay.simulateEvent({
        type: "cmd_result",
        machine_id: "m1",
        output: "NT AUTHORITY\\SYSTEM",
      });

      expect(events[0].type).toBe("cmd_result");
      if (events[0].type === "cmd_result") {
        expect(events[0].output).toBe("NT AUTHORITY\\SYSTEM");
      }
    });

    it("deve receber file_list_result com entradas", () => {
      const events: C2Event[] = [];
      relay.onEvent((e) => events.push(e));

      relay.simulateEvent({
        type: "file_list_result",
        machine_id: "m1",
        path: "C:\\Users",
        entries: [
          { name: "Admin", dir: true, size: 0 },
          { name: "desktop.ini", dir: false, size: 174 },
        ],
      });

      if (events[0].type === "file_list_result") {
        expect(events[0].entries).toHaveLength(2);
        expect(events[0].entries[0].dir).toBe(true);
      }
    });

    it("deve receber screen_frame com dados base64", () => {
      const events: C2Event[] = [];
      relay.onEvent((e) => events.push(e));

      relay.simulateEvent({
        type: "screen_frame",
        machine_id: "m1",
        data: "/9j/4AAQSkZJRg==",
      });

      if (events[0].type === "screen_frame") {
        expect(events[0].data).toContain("/9j/");
      }
    });

    it("deve receber erro genérico", () => {
      const events: C2Event[] = [];
      relay.onEvent((e) => events.push(e));

      relay.simulateEvent({ type: "error", error: "Machine not found" });

      if (events[0].type === "error") {
        expect(events[0].error).toBe("Machine not found");
      }
    });

    it("deve suportar múltiplos listeners", () => {
      const events1: C2Event[] = [];
      const events2: C2Event[] = [];
      relay.onEvent((e) => events1.push(e));
      relay.onEvent((e) => events2.push(e));

      relay.simulateEvent({ type: "machines", list: [] });

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
    });

    it("unsubscribe deve parar de receber eventos", () => {
      const events: C2Event[] = [];
      const unsub = relay.onEvent((e) => events.push(e));

      relay.simulateEvent({ type: "machines", list: [] });
      unsub();
      relay.simulateEvent({ type: "machines", list: [] });

      expect(events).toHaveLength(1);
    });
  });

  describe("comandos", () => {
    it("deve rastrear todas as operações de arquivo", () => {
      relay.fileList("m1", "C:\\");
      relay.fileDownload("m1", "C:\\secrets.txt");
      relay.fileUpload("m1", "C:\\payload.exe", "YmFzZTY0");
      relay.fileExec("m1", "C:\\payload.exe");

      expect(relay.fileListCalls).toHaveLength(1);
      expect(relay.fileDownloadCalls).toHaveLength(1);
      expect(relay.fileUploadCalls).toHaveLength(1);
      expect(relay.fileExecCalls).toHaveLength(1);
    });

    it("deve rastrear block/unblock de input", () => {
      relay.blockInput("m1");
      relay.blockInput("m2");
      relay.unblockInput("m1");

      expect(relay.blockInputCalls).toEqual(["m1", "m2"]);
      expect(relay.unblockInputCalls).toEqual(["m1"]);
    });

    it("deve rastrear screen start/stop com fps", () => {
      relay.screenStart("m1", 30);
      relay.screenStart("m2");
      relay.screenStop("m1");

      expect(relay.screenStartCalls).toEqual([
        { machineId: "m1", fps: 30 },
        { machineId: "m2", fps: undefined },
      ]);
      expect(relay.screenStopCalls).toEqual(["m1"]);
    });
  });

  it("reset deve limpar todo o estado", async () => {
    await relay.connect("ws://localhost:4444");
    relay.sendCommand("m1", "whoami");
    relay.fileList("m1", "/");
    relay.blockInput("m1");
    relay.screenStart("m1");

    relay.reset();

    expect(relay.isConnected()).toBe(false);
    expect(relay.connectCalls).toHaveLength(0);
    expect(relay.commandCalls).toHaveLength(0);
    expect(relay.fileListCalls).toHaveLength(0);
    expect(relay.blockInputCalls).toHaveLength(0);
    expect(relay.screenStartCalls).toHaveLength(0);
  });
});
