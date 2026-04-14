export interface FetchedEmail {
  uid: number;
  account: string;
  from: string;
  subject: string;
  date: string;
  body: string;
}

export interface IImapClient {
  verifyCredential(email: string, password: string): Promise<boolean>;
  fetchRecentEmails(email: string, password: string, limit?: number): Promise<FetchedEmail[]>;
}

