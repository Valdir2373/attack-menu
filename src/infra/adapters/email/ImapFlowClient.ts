import { ImapFlow } from "imapflow";
import type { IImapClient, FetchedEmail } from "../../../domain/ports/IImapClient.js";

function decodeBody(raw: string): string {
  const trimmed = raw.replace(/\r?\n/g, "");
  if (/^[A-Za-z0-9+/]+=*$/.test(trimmed) && trimmed.length > 40) {
    try { return Buffer.from(trimmed, "base64").toString("utf8"); } catch {  }
  }
  if (/=[0-9A-Fa-f]{2}/.test(raw)) {
    return raw
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return raw;
}

export class ImapFlowClient implements IImapClient {
  async verifyCredential(email: string, password: string): Promise<boolean> {
    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });
    try {
      await client.connect();
      await client.logout();
      return true;
    } catch {
      return false;
    }
  }

  async fetchRecentEmails(
    email: string,
    password: string,
    limit = 15,
  ): Promise<FetchedEmail[]> {
    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });
    const messages: FetchedEmail[] = [];
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const total = (client.mailbox as any)?.exists ?? 0;
        if (total > 0) {
          const seqFrom = Math.max(1, total - limit + 1);
          for await (const msg of (client as any).fetch(
            `${seqFrom}:${total}`,
            { envelope: true, bodyParts: ["1", "1.1", "1.2", "2", "TEXT"] },
          )) {
            const bodyBuf: Buffer | undefined =
              msg.bodyParts?.get("1") ??
              msg.bodyParts?.get("1.1") ??
              msg.bodyParts?.get("1.2") ??
              msg.bodyParts?.get("2") ??
              msg.bodyParts?.get("TEXT");
            let body = bodyBuf?.toString("utf8") ?? "(sem conteúdo)";
            body = decodeBody(body);
            messages.push({
              uid: msg.uid ?? 0,
              account: email,
              from: msg.envelope?.from?.[0]?.address ?? "(desconhecido)",
              subject: msg.envelope?.subject ?? "(sem assunto)",
              date: msg.envelope?.date instanceof Date
                ? msg.envelope.date.toLocaleString("pt-BR")
                : "",
              body: body.slice(0, 5000),
            });
          }
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch {

    }
    return messages.reverse();
  }
}

