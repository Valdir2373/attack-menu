import express from "express";
import { IReverseProxyServer } from "../../../../application/proxy/reverse/IReverseProxyServer.js";
import { ReverseProxyConfig } from "../../../../application/proxy/commands/StartReverseProxyCommand.js";
import { ProcessProxyRequestUseCase } from "../../../../application/proxy/reverse/ProcessProxyRequestUseCase.js";
import { ReverseProxyContext } from "../../../../application/proxy/reverse/ReverseProxyContext.js";

export class ExpressReverseProxyServer implements IReverseProxyServer {
  private _server: ReturnType<ReturnType<typeof express>["listen"]> | null = null;

  constructor(
    private readonly useCase: ProcessProxyRequestUseCase,
    private readonly logger: (line: string) => void = console.log,
  ) {}

  start(config: ReverseProxyConfig, onError?: (err: Error) => void): void {
    const targetDomain = config.targetUrl.replace(/\/$/, "");
    const targetHost   = new URL(targetDomain).hostname;
    const localDomain  = `http://localhost:${config.port}`;

    const app = express();


    app.get("/__blocked__", (_req, res) => res.status(200).send(""));

    app.use(async (req: express.Request, res: express.Response) => {
      try {
        let rawBody: Buffer | undefined;
        if (!["GET", "HEAD"].includes(req.method)) {
          rawBody = await this.readBody(req);
        }

        const ctx: ReverseProxyContext = {
          targetDomain,
          targetHost,
          localDomain,
          method:  req.method,
          url:     req.url,
          headers: req.headers as Record<string, string | string[] | undefined>,
          rawBody,
        };

        const result = await this.useCase.execute(ctx);

        if (result.blocked) {
          this.logger(`\x1b[31m[BLOQUEADO]\x1b[0m ${req.url}`);
          return res.status(200).send("");
        }


        for (const [k, v] of Object.entries(result.headers)) {
          if (Array.isArray(v)) {
            v.forEach((val) => res.append(k, val));
          } else {
            res.set(k, v);
          }
        }

        if (result.redirect) {
          res.set("Location", result.redirect);
          return res.status(result.status).end();
        }

        if (typeof result.body === "string") {
          this.logger(`\x1b[32m[OK]\x1b[0m ${req.method} ${req.url}`);
        } else {
          this.logger(`\x1b[34m[BIN]\x1b[0m ${req.method} ${req.url}`);
        }

        return res.status(result.status).send(result.body);
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        if (msg.includes("aborted") || msg.includes("timeout")) {
          this.logger(`\x1b[33m[TIMEOUT]\x1b[0m ${req.url}`);
          return res.status(504).send("");
        }
        this.logger(`\x1b[31m[ERRO]\x1b[0m ${req.url} — ${msg}`);
        if (!res.headersSent) res.status(502).send("");
      }
    });

    this._server = app.listen(config.port, () => {
      this.logger(`
\x1b[31m  ██████╗ ██████╗  ██████╗ ██╗  ██╗██╗   ██╗\x1b[0m
\x1b[31m  ██╔══██╗██╔══██╗██╔═══██╗╚██╗██╔╝╚██╗ ██╔╝\x1b[0m
\x1b[31m  ██████╔╝██████╔╝██║   ██║ ╚███╔╝  ╚████╔╝ \x1b[0m
\x1b[31m  ██╔═══╝ ██╔══██╗██║   ██║ ██╔██╗   ╚██╔╝  \x1b[0m
\x1b[31m  ██║     ██║  ██║╚██████╔╝██╔╝ ██╗   ██║   \x1b[0m
\x1b[31m  ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝  \x1b[0m

  \x1b[90mLocal  :\x1b[0m \x1b[37m${localDomain}\x1b[0m
  \x1b[90mAlvo   :\x1b[0m \x1b[31m${targetDomain}\x1b[0m
  \x1b[90mRules  :\x1b[0m \x1b[37m./rules.json\x1b[0m
  \x1b[90m──────────────────────────────────\x1b[0m
  `);
    });


    this._server.unref();

    this._server.on("error", (err: Error) => {
      this.logger(`\x1b[31m[ERRO]\x1b[0m Servidor falhou: ${err.message}`);
      this._server = null;
      onError?.(err);
    });
  }

  stop(): void {
    this._server?.close();
    this._server = null;
  }

  private readBody(req: express.Request): Promise<Buffer> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", () => resolve(Buffer.alloc(0)));
    });
  }
}

