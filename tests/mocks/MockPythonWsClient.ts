import type { IPythonWsClient, WsResponse } from "../../src/domain/ports/IPythonWsClient.js";

export class MockPythonWsClient implements IPythonWsClient {
  public sendCalls: Array<{ action: string; payload: Record<string, unknown> }> = [];
  public sendResult: WsResponse = { success: true, data: { encrypted: 10, db: "MongoDB" } };
  public shouldThrow = false;
  public throwError = "Connection refused";
  private readonly _listeners = new Set<(res: WsResponse) => void>();

  async send(action: string, payload: Record<string, unknown> = {}): Promise<WsResponse> {
    this.sendCalls.push({ action, payload });
    if (this.shouldThrow) throw new Error(this.throwError);
    return this.sendResult;
  }

  onEvent(listener: (res: WsResponse) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  simulateEvent(event: WsResponse): void {
    this._listeners.forEach((l) => l(event));
  }

  reset(): void {
    this.sendCalls = [];
    this.sendResult = { success: true, data: { encrypted: 10, db: "MongoDB" } };
    this.shouldThrow = false;
    this._listeners.clear();
  }
}
