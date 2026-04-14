import type { IRansomCompiler, RansomSO, RansomBuildResult } from "../../src/domain/ports/IRansomCompiler.js";
import { Result } from "../../src/shared/Result.js";

export class MockRansomCompiler implements IRansomCompiler {
  public calls: RansomSO[] = [];
  public result: Result<RansomBuildResult> = Result.ok({
    binaryPath: "/tmp/builds/456/locker_linux",
    buildId: "456",
    privKeyPem: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n",
  });

  async compile(so: RansomSO): Promise<Result<RansomBuildResult>> {
    this.calls.push(so);
    return this.result;
  }

  reset(): void {
    this.calls = [];
    this.result = Result.ok({
      binaryPath: "/tmp/builds/456/locker_linux",
      buildId: "456",
      privKeyPem: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n",
    });
  }
}
