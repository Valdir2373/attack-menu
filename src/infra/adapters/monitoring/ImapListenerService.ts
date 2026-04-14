import { ImapFlow } from "imapflow";
import {
  IImapListener,
  ImapEvent,
  ImapEventCallback,
} from "../../../domain/ports/IImapListener";

export class ImapListenerService implements IImapListener {
  private _client: ImapFlow | null = null;
  private _running = false;

  async connect(
    email: string,
    password: string,
    onEvent: ImapEventCallback,
  ): Promise<void> {
    if (this._running) return;

    this._client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });

    this._registerClientEvents(onEvent);

    onEvent({ type: "connecting", message: `[>] Conectando ${email}...` });
    await this._client.connect();
    onEvent({ type: "connected", message: `[OK] Conectado com sucesso` });

    const lock = await this._client.getMailboxLock("INBOX");
    onEvent({
      type: "connected",
      message: `[◆] INBOX aberto — aguardando emails`,
    });

    this._running = true;
    this._runIdleLoop(lock, onEvent);
  }

  async disconnect(): Promise<void> {
    this._running = false;
    if (this._client) {
      try {
        await this._client.logout();
      } catch {}
      this._client = null;
    }
  }

  get isConnected(): boolean {
    return this._running;
  }

  private _registerClientEvents(onEvent: ImapEventCallback): void {
    if (!this._client) return;

    this._client.on("exists", (data: any) => {
      onEvent({
        type: "exists",
        message: `[+] NOVO EMAIL | ${data.path} | total: ${data.count}`,
      });
    });

    this._client.on("expunge", (data: any) => {
      onEvent({
        type: "expunge",
        message: `[-] EMAIL REMOVIDO | seq: ${data.seq}`,
      });
    });

    this._client.on("flags", (data: any) => {
      onEvent({
        type: "flags",
        message: `[~] FLAGS ALTERADAS | seq: ${data.seq}`,
      });
    });
  }

  private async _runIdleLoop(
    lock: any,
    onEvent: ImapEventCallback,
  ): Promise<void> {
    try {
      while (this._running && this._client) {
        await this._client.idle();
      }
    } catch (err: any) {
      if (this._running) {
        onEvent({ type: "error", message: `[ERROR] ${err.message}` });
      }
    } finally {
      lock.release();
      this._running = false;
      onEvent({ type: "disconnected", message: `[x] IMAP desconectado` });
    }
  }
}

