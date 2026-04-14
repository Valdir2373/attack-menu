import type { IImapListener, ImapEventCallback } from "../../src/domain/ports/IImapListener.js";

export class MockImapListener implements IImapListener {
  private _connected = false;
  public connectCalls: Array<{ email: string; password: string }> = [];

  get isConnected(): boolean {
    return this._connected;
  }

  async connect(email: string, password: string, _onEvent: ImapEventCallback): Promise<void> {
    this.connectCalls.push({ email, password });
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
  }
}
