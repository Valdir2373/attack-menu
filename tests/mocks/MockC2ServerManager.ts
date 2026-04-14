import type { IC2ServerManager, C2ServerInfo } from "../../src/domain/ports/IC2ServerManager.js";
import { Result } from "../../src/shared/Result.js";

export class MockC2ServerManager implements IC2ServerManager {
  public startCalls = 0;
  public stopCalls = 0;
  public isRunningResult = false;
  public startResult: Result<C2ServerInfo> = Result.ok({ wsUrl: "ws://localhost:4444", token: "" });

  async start(): Promise<Result<C2ServerInfo>> {
    this.startCalls++;
    return this.startResult;
  }

  async stop(): Promise<void> {
    this.stopCalls++;
  }

  async isRunning(): Promise<boolean> {
    return this.isRunningResult;
  }
}
