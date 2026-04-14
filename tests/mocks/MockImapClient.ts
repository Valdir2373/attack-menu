import type { IImapClient, FetchedEmail } from "../../src/domain/ports/IImapClient.js";

export class MockImapClient implements IImapClient {
  verifyResult = true;
  fetchResult: FetchedEmail[] = [];

  async verifyCredential(_email: string, _password: string): Promise<boolean> {
    return this.verifyResult;
  }

  async fetchRecentEmails(_email: string, _password: string, _limit?: number): Promise<FetchedEmail[]> {
    return this.fetchResult;
  }
}
