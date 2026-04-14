import fs from "fs/promises";
import type { IFileStorage } from "../../../application/common/IFileStorage.js";

export class NodeFileStorage implements IFileStorage {
  async readFile(path: string): Promise<string> {
    return fs.readFile(path, "utf-8");
  }

  async appendFile(path: string, content: string): Promise<void> {
    await fs.appendFile(path, content);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

