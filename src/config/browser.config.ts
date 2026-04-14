import { ConfigError } from "../errors/index.js";

export class BrowserConfig {
  static getEdgePath(): string {
    return process.env.EDGE_PATH
      ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  }
}

