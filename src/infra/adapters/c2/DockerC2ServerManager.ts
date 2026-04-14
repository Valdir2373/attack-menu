import { execFile } from "child_process";
import { promisify } from "util";
import type { IC2ServerManager, C2ServerInfo } from "../../../domain/ports/IC2ServerManager.js";
import { Result } from "../../../shared/Result.js";

const execFileAsync = promisify(execFile);

const WS_PORT = process.env.RB_WS_PORT ?? "4444";
const WS_URL  = `ws://localhost:${WS_PORT}`;
const HEALTH  = `http://localhost:${WS_PORT}/health`;
const TOKEN   = process.env.OPERATOR_TOKEN ?? "";

export class DockerC2ServerManager implements IC2ServerManager {
  async start(): Promise<Result<C2ServerInfo>> {
    try {
      if (await this.isRunning()) {
        return Result.ok({ wsUrl: WS_URL, token: TOKEN });
      }

      await execFileAsync("docker", [
        "compose", "up", "rb-server", "-d", "--build",
      ], { timeout: 120_000 });

      const healthy = await this._waitForHealth(30_000);
      if (!healthy) {
        return Result.fail("Servidor Ruby iniciou mas não respondeu ao health check em 30s");
      }

      return Result.ok({ wsUrl: WS_URL, token: TOKEN });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return Result.fail(`Erro ao iniciar servidor Ruby: ${msg}`);
    }
  }

  async stop(): Promise<void> {
    try {
      await execFileAsync("docker", [
        "compose", "stop", "rb-server",
      ], { timeout: 30_000 });
    } catch { /* best-effort */ }
  }

  async isRunning(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync("docker", [
        "compose", "ps", "rb-server", "--format", "json",
      ], { timeout: 10_000 });

      const lines = stdout.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        const info = JSON.parse(line);
        if (info.State === "running") return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async _waitForHealth(timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(HEALTH);
        if (res.ok) return true;
      } catch { /* retry */ }
      await new Promise<void>((r) => setTimeout(r, 1_000));
    }
    return false;
  }
}
