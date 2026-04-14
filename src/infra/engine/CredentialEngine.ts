import fs from "fs/promises";
import fsSync from "fs";
import type { ILogger } from "../../application/common/ILogger.js";

export class CredentialEngine {
  constructor(
    private patterns: RegExp[],
    private validate: (...args: string[]) => Promise<boolean>,
    private outputFilePath: string = "hits.txt",
    private saveFn?: (creds: string[]) => Promise<void>,
    private logger?: ILogger,
  ) {}

  async runFromRaw(rawData: string): Promise<void> {
    const blocks = rawData.split("------------------------------------------------------------");
    for (const creds of this.extractUnique(blocks)) {
      if (await this.validate(...creds)) {
        if (this.saveFn) {
          await this.saveFn(creds);
        } else {
          await fs.appendFile(this.outputFilePath, "\n" + creds.join(":"));
        }
      }
    }
  }

  private extractUnique(blocks: string[]): string[][] {
    const seen = new Set<string>();
    const unique: string[][] = [];
    for (const block of blocks) {
      const c = block.trim() ? this.extract(block) : null;
      if (!c || seen.has(c.join(":"))) continue;
      seen.add(c.join(":")); unique.push(c);
    }
    return unique;
  }

  async countUnique(filePath: string): Promise<number> {
    if (!fsSync.existsSync(filePath)) return 0;
    const content = await fs.readFile(filePath, "utf-8");
    return this.extractUnique(content.split("------------------------------------------------------------")).length;
  }

  async runFromFile(filePath: string): Promise<void> {
    if (!fsSync.existsSync(filePath)) {
      this.logger?.warn(`Arquivo não encontrado: ${filePath}`);
      return;
    }
    const content = await fs.readFile(filePath, "utf-8");
    await this.runFromRaw(content);
  }

  private extract(block: string): string[] | null {
    const results: string[] = [];
    for (const pattern of this.patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(block);
      if (match) results.push((match[1] || match[0]).trim());
    }
    return results.length === this.patterns.length ? results : null;
  }
}

