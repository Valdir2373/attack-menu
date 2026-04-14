import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IKeywordReader } from "../../common/IKeywordReader.js";
import type { ReadKeywordsCommand } from "../commands/ReadKeywordsCommand.js";
import { Result } from "../../../shared/Result.js";

export class ReadKeywordsHandler implements ICommandHandler<ReadKeywordsCommand, string[]> {
  constructor(private readonly _keywordReader: IKeywordReader) {}

  async execute(command: ReadKeywordsCommand): Promise<Result<string[]>> {
    const keywords = await this._keywordReader.read(command.filePath);
    return Result.ok(keywords);
  }
}

