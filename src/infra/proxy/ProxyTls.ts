import net from "net";
import tls from "tls";
import type { ILogger } from "../../application/common/ILogger.js";


function pipe(src: any, dst: any): void {
  src.on("data", (chunk: Buffer) => dst.write(chunk));
  src.on("end", () => dst.destroy());
  src.on("error", () => dst.destroy());
}


interface Backend {
  host: string;
  port: number;
}


export class ProxyTls {
  private backends: Backend[];
  private localPort: number;
  private _server: net.Server | null = null;

  private logger?: ILogger;

  constructor(backends: Backend[], localPort = 27018, logger?: ILogger) {
    this.backends = backends;
    this.localPort = localPort;
    this.logger = logger;
  }

  private _handleConnection(clientSocket: net.Socket): void {
    clientSocket.pause();

    const tryBackend = (index: number): void => {
      if (index >= this.backends.length) {
        clientSocket.destroy();
        return;
      }

      const { host, port } = this.backends[index];
      const backend = tls.connect(
        { host, port, servername: host, rejectUnauthorized: false },
        () => {
          pipe(clientSocket, backend);
          pipe(backend, clientSocket);
          clientSocket.resume();
        },
      );

      backend.on("error", (err) => {
        this.logger?.error(`[proxy] backend ${host}:${port} error`, err as Error);
        tryBackend(index + 1);
      });
    };

    clientSocket.on("error", () => {});
    tryBackend(0);
  }


  async start(): Promise<ProxyTls> {
    if (this._server) return this;

    await new Promise<void>((resolve, reject) => {
      this._server = net.createServer((s) => this._handleConnection(s));
      this._server.on("error", reject);
      this._server.listen(this.localPort, "127.0.0.1", () => resolve());
    });

    return this;
  }


  async stop(): Promise<void> {
    if (!this._server) return;
    await new Promise<void>((resolve) => this._server!.close(() => resolve()));
    this._server = null;
  }

  get running(): boolean {
    return !!this._server;
  }

  toString(): string {
    return `ProxyTls(port=${this.localPort}, backends=${this.backends.length}, running=${this.running})`;
  }
}

