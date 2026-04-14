import type { IReverseProxyModuleFactory } from "../../src/application/proxy/reverse/IReverseProxyModuleFactory.js";
import type { IReverseProxyServer } from "../../src/application/proxy/reverse/IReverseProxyServer.js";
import type { ReverseProxyConfig } from "../../src/application/proxy/commands/StartReverseProxyCommand.js";

export class MockReverseProxyServer implements IReverseProxyServer {
  public running = false;
  start(_config: ReverseProxyConfig): void {
    this.running = true;
  }
  stop(): void {
    this.running = false;
  }
}

export class MockReverseProxyModuleFactory implements IReverseProxyModuleFactory {
  public server = new MockReverseProxyServer();

  create(_logger: (line: string) => void): IReverseProxyServer {
    return this.server;
  }
}
