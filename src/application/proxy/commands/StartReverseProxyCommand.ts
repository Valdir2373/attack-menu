export interface ReverseProxyConfig {
  targetUrl: string;
  port: number;
}

export class StartReverseProxyCommand {
  constructor(public readonly config: ReverseProxyConfig) {}
}

