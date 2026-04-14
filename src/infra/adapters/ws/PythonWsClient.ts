import WebSocket from "ws";
import type { IPythonWsClient, WsResponse } from "../../../domain/ports/IPythonWsClient.js";

const DEFAULT_URL = "ws://localhost:4445";

export class PythonWsClient implements IPythonWsClient {
  private _ws: WebSocket | null = null;
  private _pending: ((res: WsResponse) => void) | null = null;
  private readonly _eventListeners = new Set<(res: WsResponse) => void>();
  private readonly _url: string;

  constructor(url: string = DEFAULT_URL) {
    this._url = url;
  }


  async send(
    action: string,
    payload: Record<string, unknown> = {},
  ): Promise<WsResponse> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this._ensureConnected();

        const result = await new Promise<WsResponse>((resolve) => {
          const timer = setTimeout(() => {
            this._pending = null;
            resolve({ success: false, error: "Timeout: servidor Python não respondeu em 10s" });
          }, 10_000);

          this._pending = (res) => {
            clearTimeout(timer);
            resolve(res);
          };

          this._ws!.send(JSON.stringify({ action, payload }));
        });

        if (result.success || attempt === maxAttempts) return result;
        if (!result.error?.includes("Timeout")) return result;

        this._ws?.terminate();
        this._ws = null;
        await new Promise<void>((r) => setTimeout(r, 1_000));
      } catch {
        if (attempt === maxAttempts) {
          return { success: false, error: "Falha de conexão após 3 tentativas" };
        }

        this._ws?.terminate();
        this._ws = null;
        await new Promise<void>((r) => setTimeout(r, 1_000));
      }
    }

    return { success: false, error: "Falha de conexão após 3 tentativas" };
  }

  onEvent(listener: (res: WsResponse) => void): () => void {
    this._eventListeners.add(listener);
    return () => this._eventListeners.delete(listener);
  }


  private _ensureConnected(): Promise<void> {
    if (this._ws?.readyState === WebSocket.OPEN) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this._url);

      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error("Timeout: conexão com servidor Python excedeu 5s"));
      }, 5_000);

      ws.once("open", () => {
        clearTimeout(timer);
        this._ws = ws;
        resolve();
      });

      ws.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      ws.on("message", (raw) => {
        const res = JSON.parse(raw.toString()) as WsResponse;

        if (this._pending) {
          const cb = this._pending;
          this._pending = null;
          cb(res);
        } else {
          this._eventListeners.forEach((l) => l(res));
        }
      });

      ws.on("close", () => {
        this._ws = null;
      });
    });
  }
}

