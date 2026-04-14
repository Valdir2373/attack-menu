export interface ProxyStatus {
  running: boolean;
  port: number;
  containerName: string;
}

export interface ProxyConfig {
  host?: string;
  port?: number;
  exitNodes?: string;
}

export interface IProxyManager {
  start(config?: ProxyConfig): Promise<void>;
  stop(): Promise<void>;
  status(): Promise<ProxyStatus>;
  configure(config: ProxyConfig): void;
}

