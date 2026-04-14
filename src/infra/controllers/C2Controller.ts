import type { IC2Controller, C2BuildDTO } from "../../application/c2/IC2Controller.js";
import type { CompileC2UseCase } from "../../application/c2/use-cases/CompileC2UseCase.js";
import type { IC2RelayClient } from "../../domain/ports/IC2RelayClient.js";
import type { IC2ServerManager, C2ServerInfo } from "../../domain/ports/IC2ServerManager.js";
import type { Result } from "../../shared/Result.js";

export class C2Controller implements IC2Controller {
  readonly relay: IC2RelayClient;

  constructor(
    private readonly _compileUseCase: CompileC2UseCase,
    relay: IC2RelayClient,
    private readonly _serverManager: IC2ServerManager,
  ) {
    this.relay = relay;
  }

  compile(serverUrl: string, onLog: (msg: string) => void): Promise<Result<C2BuildDTO>> {
    return this._compileUseCase.execute(serverUrl, onLog);
  }

  async startServer(onLog: (msg: string) => void): Promise<Result<C2ServerInfo>> {
    onLog("[c2] Verificando servidor Ruby...");
    const running = await this._serverManager.isRunning();
    if (running) {
      onLog("[c2] Servidor já está rodando");
      return this._serverManager.start();
    }
    onLog("[c2] Subindo rb-server via docker compose...");
    const result = await this._serverManager.start();
    if (result.isSuccess) {
      onLog(`[+] Servidor pronto: ${result.value!.wsUrl}`);
    } else {
      onLog(`[!] Falha: ${result.error}`);
    }
    return result;
  }

  async stopServer(): Promise<void> {
    await this._serverManager.stop();
  }
}

