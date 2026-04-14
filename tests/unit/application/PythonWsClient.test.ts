import { describe, it, expect, beforeEach } from "vitest";
import { MockPythonWsClient } from "../../mocks/MockPythonWsClient.js";
import type { WsResponse } from "../../../src/domain/ports/IPythonWsClient.js";

describe("IPythonWsClient — Contrato", () => {
  let client: MockPythonWsClient;

  beforeEach(() => {
    client = new MockPythonWsClient();
  });

  describe("send", () => {
    it("deve enviar action e payload e receber resposta", async () => {
      client.sendResult = { success: true, data: { count: 5 } };

      const res = await client.send("ransom_db", { db: "MongoDB", mode: "single", uri: "mongodb://host/db" });

      expect(res.success).toBe(true);
      expect(res.data).toEqual({ count: 5 });
      expect(client.sendCalls).toHaveLength(1);
      expect(client.sendCalls[0].action).toBe("ransom_db");
    });

    it("deve enviar sem payload (default vazio)", async () => {
      await client.send("ping");

      expect(client.sendCalls[0].payload).toEqual({});
    });

    it("deve retornar resposta de erro", async () => {
      client.sendResult = { success: false, error: "Ação desconhecida" };

      const res = await client.send("invalid_action");

      expect(res.success).toBe(false);
      expect(res.error).toBe("Ação desconhecida");
    });

    it("deve lançar exceção quando configurado", async () => {
      client.shouldThrow = true;
      client.throwError = "ECONNREFUSED";

      await expect(client.send("ping")).rejects.toThrow("ECONNREFUSED");
    });

    it("deve rastrear múltiplas chamadas", async () => {
      await client.send("action1", { x: 1 });
      await client.send("action2", { y: 2 });
      await client.send("action3", { z: 3 });

      expect(client.sendCalls).toHaveLength(3);
      expect(client.sendCalls.map((c) => c.action)).toEqual(["action1", "action2", "action3"]);
    });
  });

  describe("onEvent", () => {
    it("deve receber push events", () => {
      const events: WsResponse[] = [];
      client.onEvent((e) => events.push(e));

      client.simulateEvent({ success: true, event: "ransom_db_log", data: { msg: "processando..." } });

      expect(events).toHaveLength(1);
      expect(events[0].event).toBe("ransom_db_log");
    });

    it("deve suportar múltiplos listeners", () => {
      const events1: WsResponse[] = [];
      const events2: WsResponse[] = [];
      client.onEvent((e) => events1.push(e));
      client.onEvent((e) => events2.push(e));

      client.simulateEvent({ success: true, event: "test" });

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
    });

    it("unsubscribe deve remover listener", () => {
      const events: WsResponse[] = [];
      const unsub = client.onEvent((e) => events.push(e));

      client.simulateEvent({ success: true, event: "before" });
      unsub();
      client.simulateEvent({ success: true, event: "after" });

      expect(events).toHaveLength(1);
      expect(events[0].event).toBe("before");
    });

    it("deve receber eventos com dados complexos", () => {
      const events: WsResponse[] = [];
      client.onEvent((e) => events.push(e));

      client.simulateEvent({
        success: true,
        event: "agent_message",
        data: {
          agent_id: "abc-123",
          data: { type: "register", name: "PC-01", os: "Windows" },
        },
      });

      expect((events[0].data as any).agent_id).toBe("abc-123");
    });
  });

  it("reset deve limpar estado e listeners", async () => {
    const events: WsResponse[] = [];
    client.onEvent((e) => events.push(e));
    await client.send("test");
    client.shouldThrow = true;

    client.reset();

    expect(client.sendCalls).toHaveLength(0);
    expect(client.shouldThrow).toBe(false);

    client.simulateEvent({ success: true, event: "ghost" });
    expect(events).toHaveLength(0);
  });
});
