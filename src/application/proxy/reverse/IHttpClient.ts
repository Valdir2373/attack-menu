export interface HttpForwardRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Uint8Array;
}

export interface IHttpClient {
  forward(req: HttpForwardRequest): Promise<Response>;
}

