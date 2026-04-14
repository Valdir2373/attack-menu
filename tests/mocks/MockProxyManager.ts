import type {
  IProxyManager,
  ProxyStatus,
  ProxyConfig,
} from "../../src/domain/ports/IProxyManager.js";

export class MockProxyManager implements IProxyManager {
  public running = false;
  public config: ProxyConfig = {};
  public startCalls = 0;
  public stopCalls = 0;

  async start(config?: ProxyConfig): Promise<void> {
    this.startCalls++;
    if (config) this.config = config;
    this.running = true;
  }

  async stop(): Promise<void> {
    this.stopCalls++;
    this.running = false;
  }

  async status(): Promise<ProxyStatus> {
    return {
      running: this.running,
      port: this.config.port ?? 0,
      containerName: this.running ? "mock-proxy" : "",
    };
  }

  configure(config: ProxyConfig): void {
    this.config = config;
  }
}
