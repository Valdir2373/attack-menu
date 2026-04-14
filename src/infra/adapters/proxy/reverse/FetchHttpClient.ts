import {
  IHttpClient,
  HttpForwardRequest,
} from "../../../../application/proxy/reverse/IHttpClient.js";

export class FetchHttpClient implements IHttpClient {
  async forward(req: HttpForwardRequest): Promise<Response> {
    return fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body as BodyInit | undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
  }
}

