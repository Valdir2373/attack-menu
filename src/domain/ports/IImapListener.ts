export type ImapEventType =
  | "connecting"
  | "connected"
  | "exists"
  | "expunge"
  | "flags"
  | "disconnected"
  | "error";

export interface ImapEvent {
  type: ImapEventType;
  message: string;
}

export type ImapEventCallback = (event: ImapEvent) => void;


export interface IImapListener {
  connect(
    email: string,
    password: string,
    onEvent: ImapEventCallback,
  ): Promise<void>;
  disconnect(): Promise<void>;
  readonly isConnected: boolean;
}

