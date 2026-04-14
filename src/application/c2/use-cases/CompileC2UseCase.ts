import type { IC2Compiler, C2BuildResult } from "../../../domain/ports/IC2Compiler.js";
import { Result } from "../../../shared/Result.js";

export class CompileC2UseCase {
  constructor(private readonly compiler: IC2Compiler) {}

  async execute(serverUrl: string, onLog: (msg: string) => void): Promise<Result<C2BuildResult>> {
    if (!this.isValidUrl(serverUrl)) {
      return Result.fail(`URL inválida: "${serverUrl}". Use ws://, wss://, http:// ou https://`);
    }

    onLog("[c2] Iniciando compilação do C2 agent (Windows .exe)...");
    onLog(`[c2] Server URL: ${serverUrl}`);
    const result = await this.compiler.compile(serverUrl);
    if (result.isFailure) {
      onLog(`[c2] Erro: ${result.error}`);
    } else {
      onLog(`[c2] Build concluído: ${result.value!.binaryPath}`);
    }
    return result;
  }

  private isValidUrl(url: string): boolean {
    try {
      const trimmed = url.trim();
      if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://") &&
          !trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        return false;
      }
      const forParse = trimmed
        .replace(/^wss:\/\//, "https://")
        .replace(/^ws:\/\//, "http://");
      new URL(forParse);
      return true;
    } catch {
      return false;
    }
  }
}

