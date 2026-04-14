import type { IC2Compiler, C2BuildResult } from "../../src/domain/ports/IC2Compiler.js";
import { Result } from "../../src/shared/Result.js";

export class MockC2Compiler implements IC2Compiler {
  public calls: string[] = [];
  public result: Result<C2BuildResult> = Result.ok({
    binaryPath: "/tmp/builds/123/c2_agent.exe",
    buildId: "123",
  });

  async compile(serverUrl: string): Promise<Result<C2BuildResult>> {
    this.calls.push(serverUrl);
    return this.result;
  }

  reset(): void {
    this.calls = [];
    this.result = Result.ok({
      binaryPath: "/tmp/builds/123/c2_agent.exe",
      buildId: "123",
    });
  }
}
