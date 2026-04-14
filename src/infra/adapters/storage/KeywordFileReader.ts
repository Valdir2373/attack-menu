import type { IKeywordReader } from "../../../application/common/IKeywordReader.js";
import type { IFileStorage } from "../../../application/common/IFileStorage.js";

export class KeywordFileReader implements IKeywordReader {
  constructor(private readonly _fileStorage: IFileStorage) {}

  async read(filePath: string): Promise<string[]> {
    try {
      const content = await this._fileStorage.readFile(filePath);
      return content.trim().split("\n").map((k) => k.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
}

