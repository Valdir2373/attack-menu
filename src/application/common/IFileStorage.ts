export interface IFileStorage {
  readFile(path: string): Promise<string>;
  appendFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

