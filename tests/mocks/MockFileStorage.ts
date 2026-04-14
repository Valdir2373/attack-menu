import type { IFileStorage } from "../../src/application/common/IFileStorage.js";

export class MockFileStorage implements IFileStorage {
  private _files = new Map<string, string>();

  setFile(path: string, content: string): void {
    this._files.set(path, content);
  }

  async readFile(path: string): Promise<string> {
    const content = this._files.get(path);
    if (content === undefined) throw new Error(`File not found: ${path}`);
    return content;
  }

  async appendFile(path: string, content: string): Promise<void> {
    const existing = this._files.get(path) ?? "";
    this._files.set(path, existing + content);
  }

  async exists(path: string): Promise<boolean> {
    return this._files.has(path);
  }
}
