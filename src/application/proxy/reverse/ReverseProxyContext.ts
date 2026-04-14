export interface ReverseProxyContext {
  targetDomain: string;
  targetHost: string;
  localDomain: string;
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
}

export interface ReverseProxyResult {
  blocked: boolean;
  status: number;
  headers: Record<string, string | string[]>;
  body: string | Buffer;
  redirect?: string;
}

