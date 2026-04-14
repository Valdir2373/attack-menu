import { ImapFlow } from "imapflow";
import { IEmailMonitorService } from "../../../domain/ports/IEmailMonitorService";
import { Email } from "../../../domain/entities/Email";

export class EmailMonitorService implements IEmailMonitorService {
  private _client: ImapFlow | null = null;
  private _running = false;
  private _emails: Email[] = [];
  private _onEmail?: (email: Email) => void;
  private _lastSeq = 0;
  private _pollResolve?: () => void;

  async start(email: string, password: string, onEmail?: (email: Email) => void): Promise<void> {
    if (this._running) return;
    this._emails = [];
    this._lastSeq = 0;
    this._onEmail = onEmail;

    this._client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });

    this._client.on("error", () => {});
    await this._client.connect();
    this._running = true;
    this._monitorInboxes();
  }

  private async _monitorInboxes(): Promise<void> {
    if (!this._client) return;

    const lock = await this._client.getMailboxLock("INBOX");
    this._lastSeq = (this._client.mailbox as any)?.exists ?? 0;

    try {
      while (this._running && this._client) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 5000);
          this._pollResolve = () => { clearTimeout(timer); resolve(); };
        });
        this._pollResolve = undefined;
        if (!this._running || !this._client) break;

        try {
          await this._client.noop();
          const total = (this._client.mailbox as any)?.exists ?? this._lastSeq;
          if (total > this._lastSeq) {
            const from = this._lastSeq + 1;
            this._lastSeq = total;

            await new Promise((r) => setTimeout(r, 2000));
            await this._fetchRange(from, total);
          }
        } catch {
          if (!this._running) break;
        }
      }
    } finally {
      try { lock.release(); } catch {  }
    }
  }

  private async _fetchRange(from: number, to: number): Promise<void> {
    if (!this._client) return;

    for (let attempt = 1; attempt <= 3; attempt++) {
      if (!this._running || !this._client) return;
      try {
        for await (const msg of this._client.fetch(`${from}:${to}`, {
          envelope: true,
          source: true,
        })) {
          const body = msg.source?.toString("utf8") ?? "";
          const result = Email.criar(
            msg.envelope?.subject ?? "(sem assunto)",
            msg.envelope?.from?.[0]?.address ?? "(desconhecido)",
            body,
          );
          if (result.isFailure) continue;
          this._emails.push(result.value!);
          this._onEmail?.(result.value!);
        }
        return;
      } catch {
        if (attempt < 3 && this._running) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }
  }

  async stop(): Promise<Email[]> {
    this._running = false;
    this._pollResolve?.();
    if (this._client) {
      this._client.close();
      this._client = null;
    }
    return [...this._emails];
  }

  get isRunning(): boolean {
    return this._running;
  }
}

