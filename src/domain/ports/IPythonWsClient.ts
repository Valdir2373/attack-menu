export interface WsResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  event?: string;
}

export interface IPythonWsClient {
  send(action: string, payload?: Record<string, unknown>): Promise<WsResponse>;
  onEvent(listener: (res: WsResponse) => void): () => void;
}

