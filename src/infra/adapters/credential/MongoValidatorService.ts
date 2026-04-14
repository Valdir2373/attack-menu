import dns from "dns";
import { MongoClient } from "mongodb";
import { ProxyTls } from "../../proxy/ProxyTls.js";
import { IMongoValidator } from "../../../domain/ports/IMongoValidator";
import { InfrastructureError } from "../../../errors/index.js";

interface Backend {
  host: string;
  port: number;
}

export class MongoValidatorService implements IMongoValidator {
  private _proxy: ProxyTls | null = null;
  private _proxyPort = 27018;
  private _cachedHostname: string | null = null;

  async validateCredentials(uri: string): Promise<boolean> {
    const { backends, url, extraParams } = await this._parseUri(uri);


    if (!this._proxy?.running || this._cachedHostname !== url.hostname) {
      if (this._proxy?.running) await this._proxy.stop();
      await this._startProxy(backends, url.hostname);
    }

    const proxyUri = this._buildProxyUri(url, extraParams);
    const client = new MongoClient(proxyUri, { serverSelectionTimeoutMS: 15000 });
    try {
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      return true;
    } catch {
      return false;
    } finally {
      await client.close();
    }
  }

  private async _startProxy(backends: Backend[], hostname: string): Promise<void> {
    for (let i = 0; i < 5; i++) {
      try {
        const port = 27018 + i;
        this._proxy = new ProxyTls(backends, port);
        await this._proxy.start();
        this._proxyPort = port;
        this._cachedHostname = hostname;
        return;
      } catch {}
    }
    throw new InfrastructureError("Não foi possível iniciar o ProxyTls após 5 tentativas");
  }

  private async _parseUri(
    uri: string,
  ): Promise<{ backends: Backend[]; url: URL; extraParams: Record<string, string> }> {
    const url = new URL(uri);

    if (url.protocol === "mongodb+srv:") {
      const { backends, extraParams } = await this._resolveSrv(url.hostname);
      return { backends, url, extraParams };
    }

    const backends = url.host.split(",").map((h) => {
      const [host, port] = h.split(":");
      return { host, port: parseInt(port || "27017") };
    });

    return { backends, url, extraParams: {} };
  }

  private async _resolveSrv(
    hostname: string,
  ): Promise<{ backends: Backend[]; extraParams: Record<string, string> }> {
    const resolver = new dns.promises.Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1"]);

    const srv = await resolver.resolveSrv(`_mongodb._tcp.${hostname}`);
    const backends = srv.map((r) => ({ host: r.name, port: r.port }));

    const extraParams: Record<string, string> = {};
    try {
      const txt = await resolver.resolveTxt(hostname);
      txt
        .flat()
        .join("")
        .split("&")
        .forEach((part) => {
          const [k, v] = part.split("=");
          if (k && v) extraParams[k] = v;
        });
    } catch {}

    return { backends, extraParams };
  }

  private _buildProxyUri(url: URL, extraParams: Record<string, string>): string {
    const params = new URLSearchParams(url.searchParams);
    Object.entries(extraParams).forEach(([k, v]) => params.set(k, v));
    params.delete("tls");
    params.delete("tlsInsecure");
    params.set("directConnection", "true");

    const creds = url.username
      ? `${url.username}${url.password ? ":" + url.password : ""}@`
      : "";

    return `mongodb://${creds}127.0.0.1:${this._proxyPort}${url.pathname}?${params}`;
  }
}

