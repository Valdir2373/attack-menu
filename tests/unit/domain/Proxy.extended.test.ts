import { describe, it, expect } from "vitest";
import { Proxy } from "../../../src/domain/entities/Proxy.js";

describe("Proxy — extended state machine", () => {
  describe("full lifecycle: stopped -> starting -> running -> stopping -> stopped", () => {
    it("should complete a full start-stop cycle", () => {
      const proxy = Proxy.criar();

      expect(proxy.transitionTo("starting").isSuccess).toBe(true);
      expect(proxy.transitionTo("running", { port: 9050, containerName: "tor" }).isSuccess).toBe(true);
      expect(proxy.transitionTo("stopping").isSuccess).toBe(true);
      expect(proxy.transitionTo("stopped").isSuccess).toBe(true);

      expect(proxy.status).toBe("stopped");
    });
  });

  describe("error recovery cycles", () => {
    it("should recover from error via starting", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("error");
      proxy.transitionTo("starting");
      proxy.transitionTo("running", { port: 8080 });

      expect(proxy.status).toBe("running");
      expect(proxy.port).toBe(8080);
    });

    it("should recover from error via stopped", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running");
      proxy.transitionTo("error");
      proxy.transitionTo("stopped");

      expect(proxy.status).toBe("stopped");
    });

    it("should not allow error -> running directly", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("error");

      const result = proxy.transitionTo("running");

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain("Transição inválida");
    });

    it("should not allow error -> stopping directly", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("error");

      const result = proxy.transitionTo("stopping");

      expect(result.isFailure).toBe(true);
    });

    it("should not allow error -> error", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("error");

      const result = proxy.transitionTo("error");

      expect(result.isFailure).toBe(true);
    });
  });

  describe("info preservation", () => {
    it("should preserve port across transitions", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running", { port: 1080 });
      proxy.transitionTo("stopping");

      expect(proxy.port).toBe(1080);
    });

    it("should preserve containerName across transitions", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running", { containerName: "socks-proxy" });

      expect(proxy.containerName).toBe("socks-proxy");
    });

    it("should update port on new transition with info", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running", { port: 1080 });
      proxy.transitionTo("error");
      proxy.transitionTo("starting");
      proxy.transitionTo("running", { port: 9050 });

      expect(proxy.port).toBe(9050);
    });

    it("should not reset port when transitioning without info", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running", { port: 8080, containerName: "proxy-1" });
      proxy.transitionTo("stopping");

      expect(proxy.port).toBe(8080);
      expect(proxy.containerName).toBe("proxy-1");
    });
  });

  describe("invalid transitions from each state", () => {
    it("stopped cannot go to running", () => {
      const proxy = Proxy.criar();
      expect(proxy.transitionTo("running").isFailure).toBe(true);
    });

    it("stopped cannot go to stopping", () => {
      const proxy = Proxy.criar();
      expect(proxy.transitionTo("stopping").isFailure).toBe(true);
    });

    it("stopped cannot go to error", () => {
      const proxy = Proxy.criar();
      expect(proxy.transitionTo("error").isFailure).toBe(true);
    });

    it("stopped cannot go to stopped", () => {
      const proxy = Proxy.criar();
      expect(proxy.transitionTo("stopped").isFailure).toBe(true);
    });

    it("starting cannot go to starting", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      expect(proxy.transitionTo("starting").isFailure).toBe(true);
    });

    it("starting cannot go to stopping", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      expect(proxy.transitionTo("stopping").isFailure).toBe(true);
    });

    it("starting cannot go to stopped", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      expect(proxy.transitionTo("stopped").isFailure).toBe(true);
    });

    it("running cannot go to starting", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running");
      expect(proxy.transitionTo("starting").isFailure).toBe(true);
    });

    it("running cannot go to running", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running");
      expect(proxy.transitionTo("running").isFailure).toBe(true);
    });

    it("running cannot go to stopped directly", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running");
      expect(proxy.transitionTo("stopped").isFailure).toBe(true);
    });

    it("stopping cannot go to starting", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running");
      proxy.transitionTo("stopping");
      expect(proxy.transitionTo("starting").isFailure).toBe(true);
    });

    it("stopping cannot go to running", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running");
      proxy.transitionTo("stopping");
      expect(proxy.transitionTo("running").isFailure).toBe(true);
    });

    it("stopping cannot go to stopping", () => {
      const proxy = Proxy.criar();
      proxy.transitionTo("starting");
      proxy.transitionTo("running");
      proxy.transitionTo("stopping");
      expect(proxy.transitionTo("stopping").isFailure).toBe(true);
    });
  });

  describe("error message format", () => {
    it("should include current and target status in error message", () => {
      const proxy = Proxy.criar();
      const result = proxy.transitionTo("running");

      expect(result.error).toContain("stopped");
      expect(result.error).toContain("running");
    });

    it("should include arrow symbol in error message", () => {
      const proxy = Proxy.criar();
      const result = proxy.transitionTo("stopping");

      expect(result.error).toContain("→");
    });
  });
});
