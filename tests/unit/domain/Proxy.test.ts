import { describe, it, expect } from "vitest";
import { Proxy } from "../../../src/domain/entities/Proxy.js";

describe("Proxy", () => {
  it("should start with stopped status", () => {
    const proxy = Proxy.criar();

    expect(proxy.status).toBe("stopped");
    expect(proxy.port).toBe(0);
    expect(proxy.containerName).toBe("");
  });

  describe("transitionTo()", () => {
    it("should transition stopped → starting", () => {
      const proxy = Proxy.criar();
      const result = proxy.transitionTo("starting");

      expect(result.isSuccess).toBe(true);
      expect(proxy.status).toBe("starting");
    });

    it("should transition starting → running with info", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      const result = proxy.transitionTo("running", { port: 9050, containerName: "tor-proxy" });

      expect(result.isSuccess).toBe(true);
      expect(proxy.status).toBe("running");
      expect(proxy.port).toBe(9050);
      expect(proxy.containerName).toBe("tor-proxy");
    });

    it("should transition running → stopping", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running");
      const result = proxy.transitionTo("stopping");

      expect(result.isSuccess).toBe(true);
      expect(proxy.status).toBe("stopping");
    });

    it("should transition stopping → stopped", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running");
      proxy.transitionTo("stopping");
      const result = proxy.transitionTo("stopped");

      expect(result.isSuccess).toBe(true);
      expect(proxy.status).toBe("stopped");
    });

    it("should transition to error from starting", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      const result = proxy.transitionTo("error");

      expect(result.isSuccess).toBe(true);
      expect(proxy.status).toBe("error");
    });

    it("should transition to error from running", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running");
      const result = proxy.transitionTo("error");

      expect(result.isSuccess).toBe(true);
      expect(proxy.status).toBe("error");
    });

    it("should recover from error → starting", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("error");
      const result = proxy.transitionTo("starting");

      expect(result.isSuccess).toBe(true);
      expect(proxy.status).toBe("starting");
    });

    it("should recover from error → stopped", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("error");
      const result = proxy.transitionTo("stopped");

      expect(result.isSuccess).toBe(true);
      expect(proxy.status).toBe("stopped");
    });

    it("should fail invalid transition stopped → running", () => {
      const proxy = Proxy.criar();
      const result = proxy.transitionTo("running");

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain("Transição inválida");
      expect(proxy.status).toBe("stopped");
    });

    it("should fail invalid transition stopped → stopping", () => {
      const proxy = Proxy.criar();
      const result = proxy.transitionTo("stopping");

      expect(result.isFailure).toBe(true);
      expect(proxy.status).toBe("stopped");
    });

    it("should fail invalid transition running → starting", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running");
      const result = proxy.transitionTo("starting");

      expect(result.isFailure).toBe(true);
      expect(proxy.status).toBe("running");
    });
  });
});
