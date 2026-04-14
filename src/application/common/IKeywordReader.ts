export interface IKeywordReader {
  read(filePath: string): Promise<string[]>;
}

