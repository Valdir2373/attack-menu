import type { IC2RelayClient, C2Event, C2Machine } from "../../src/domain/ports/IC2RelayClient.js";

export class MockC2RelayClient implements IC2RelayClient {
  public connectCalls: Array<{ url: string; token?: string }> = [];
  public disconnectCalls = 0;
  public commandCalls: Array<{ machineId: string; command: string }> = [];
  public fileListCalls: Array<{ machineId: string; path: string }> = [];
  public fileDownloadCalls: Array<{ machineId: string; path: string }> = [];
  public fileUploadCalls: Array<{ machineId: string; path: string; data: string }> = [];
  public fileExecCalls: Array<{ machineId: string; path: string }> = [];
  public blockInputCalls: string[] = [];
  public unblockInputCalls: string[] = [];
  public screenStartCalls: Array<{ machineId: string; fps?: number }> = [];
  public screenStopCalls: string[] = [];
  public listMachinesCalls = 0;

  private _connected = false;
  private readonly _listeners = new Set<(event: C2Event) => void>();

  async connect(serverUrl: string, token?: string): Promise<void> {
    this.connectCalls.push({ url: serverUrl, token });
    this._connected = true;
  }

  disconnect(): void {
    this.disconnectCalls++;
    this._connected = false;
  }

  isConnected(): boolean {
    return this._connected;
  }

  onEvent(listener: (event: C2Event) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  listMachines(): void { this.listMachinesCalls++; }
  sendCommand(machineId: string, command: string): void { this.commandCalls.push({ machineId, command }); }
  fileList(machineId: string, path: string): void { this.fileListCalls.push({ machineId, path }); }
  fileDownload(machineId: string, path: string): void { this.fileDownloadCalls.push({ machineId, path }); }
  fileUpload(machineId: string, path: string, data: string): void { this.fileUploadCalls.push({ machineId, path, data }); }
  fileExec(machineId: string, path: string): void { this.fileExecCalls.push({ machineId, path }); }
  blockInput(machineId: string): void { this.blockInputCalls.push(machineId); }
  unblockInput(machineId: string): void { this.unblockInputCalls.push(machineId); }
  screenStart(machineId: string, fps?: number): void { this.screenStartCalls.push({ machineId, fps }); }
  screenStop(machineId: string): void { this.screenStopCalls.push(machineId); }

  simulateEvent(event: C2Event): void {
    this._listeners.forEach((l) => l(event));
  }

  reset(): void {
    this.connectCalls = [];
    this.disconnectCalls = 0;
    this.commandCalls = [];
    this.fileListCalls = [];
    this.fileDownloadCalls = [];
    this.fileUploadCalls = [];
    this.fileExecCalls = [];
    this.blockInputCalls = [];
    this.unblockInputCalls = [];
    this.screenStartCalls = [];
    this.screenStopCalls = [];
    this.listMachinesCalls = 0;
    this._connected = false;
    this._listeners.clear();
  }
}
