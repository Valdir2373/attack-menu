import { exec } from "child_process";
import { promisify } from "util";
import {
  IProxyManager,
  ProxyConfig,
  ProxyStatus,
} from "../../../domain/ports/IProxyManager";
import { InfrastructureError } from "../../../errors/index.js";

const execAsync = promisify(exec);

const CONTAINER_NAME = "attack-proxy";
const IMAGE_NAME = "attackmenu-proxy-tor";

export class DockerProxyManagerService implements IProxyManager {
  private config: ProxyConfig = { host: "127.0.0.1", port: 1080 };

  configure(config: ProxyConfig): void {
    this.config = { ...this.config, ...config };
  }

  async start(config?: ProxyConfig): Promise<void> {
    this.configure(config ?? {});

    const status = await this.status();
    if (status.running) {
      return;
    }

    await this.buildImageIfNeeded();

    const runCmd = [
      "docker run -d",
      `--name ${CONTAINER_NAME}`,
      `-p ${this.config.port}:${this.config.port}`,
      IMAGE_NAME,
    ].join(" ");

    try {
      await execAsync(runCmd);
    } catch (err: any) {
      throw new InfrastructureError(`Falha ao iniciar container Docker: ${err.message}`, err);
    }
  }

  async stop(): Promise<void> {
    try {
      await execAsync(`docker stop ${CONTAINER_NAME}`);
      await execAsync(`docker rm ${CONTAINER_NAME}`);
    } catch (err: any) {

      const msg = String(err.message || err);
      if (!msg.includes("No such container")) {
        throw new InfrastructureError(`Falha ao parar container Docker: ${err.message}`, err);
      }
    }
  }

  async status(): Promise<ProxyStatus> {
    try {
      const { stdout } = await execAsync(
        `docker ps --filter "name=${CONTAINER_NAME}" --format "{{.Names}}:{{.Status}}"`,
      );
      const running = stdout.trim().length > 0;
      return {
        running,
        port: this.config.port ?? 1080,
        containerName: CONTAINER_NAME,
      };
    } catch {
      return {
        running: false,
        port: this.config.port ?? 1080,
        containerName: CONTAINER_NAME,
      };
    }
  }

  private async buildImageIfNeeded(): Promise<void> {
    try {
      const { stdout } = await execAsync(`docker images -q ${IMAGE_NAME}`);
      if (!stdout.trim()) {
        await execAsync(`docker build -t ${IMAGE_NAME} ./proxy-manager`);
      }
    } catch (err: any) {
      throw new InfrastructureError(`Falha ao construir imagem Docker: ${err.message}`, err);
    }
  }
}

