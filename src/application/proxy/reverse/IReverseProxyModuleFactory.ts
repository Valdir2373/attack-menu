import { IReverseProxyServer } from './IReverseProxyServer.js';

export interface IReverseProxyModuleFactory {
  create(logger: (line: string) => void): IReverseProxyServer;
}

