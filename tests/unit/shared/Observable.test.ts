import { describe, it, expect, vi } from "vitest";
import { Observable } from "../../../src/shared/Observable.js";

describe("Observable", () => {
  it("deve inicializar com valor fornecido", () => {
    const obs = new Observable(42);
    expect(obs.value).toBe(42);
  });

  it("deve atualizar valor ao emitir", () => {
    const obs = new Observable("a");
    obs.emit("b");
    expect(obs.value).toBe("b");
  });

  it("deve notificar listener ao emitir", () => {
    const obs = new Observable(0);
    const listener = vi.fn();

    obs.subscribe(listener);
    obs.emit(1);

    expect(listener).toHaveBeenCalledWith(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("deve notificar múltiplos listeners", () => {
    const obs = new Observable("");
    const l1 = vi.fn();
    const l2 = vi.fn();

    obs.subscribe(l1);
    obs.subscribe(l2);
    obs.emit("x");

    expect(l1).toHaveBeenCalledWith("x");
    expect(l2).toHaveBeenCalledWith("x");
  });

  it("deve parar de notificar após unsubscribe", () => {
    const obs = new Observable(0);
    const listener = vi.fn();

    const unsub = obs.subscribe(listener);
    obs.emit(1);
    unsub();
    obs.emit(2);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(1);
  });

  it("não deve notificar listeners antes de emitir", () => {
    const obs = new Observable(0);
    const listener = vi.fn();

    obs.subscribe(listener);

    expect(listener).not.toHaveBeenCalled();
  });

  it("deve funcionar com objetos complexos", () => {
    const obs = new Observable({ running: false, port: 0, containerName: "" });
    const listener = vi.fn();

    obs.subscribe(listener);
    obs.emit({ running: true, port: 1080, containerName: "tor-proxy" });

    expect(obs.value).toEqual({ running: true, port: 1080, containerName: "tor-proxy" });
    expect(listener).toHaveBeenCalledWith({ running: true, port: 1080, containerName: "tor-proxy" });
  });

  it("deve suportar múltiplos emits sequenciais", () => {
    const obs = new Observable(0);
    const values: number[] = [];

    obs.subscribe((v) => values.push(v));
    obs.emit(1);
    obs.emit(2);
    obs.emit(3);

    expect(values).toEqual([1, 2, 3]);
    expect(obs.value).toBe(3);
  });

  it("deve permitir unsubscribe idempotente", () => {
    const obs = new Observable(0);
    const listener = vi.fn();

    const unsub = obs.subscribe(listener);
    unsub();
    unsub();

    obs.emit(1);
    expect(listener).not.toHaveBeenCalled();
  });
});
