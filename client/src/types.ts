export type StreamEventType =
  | "start"
  | "thinking"
  | "thinking-done"
  | "text"
  | "tool-call"
  | "tool-result"
  | "step-finish"
  | "finish"
  | "error"
  | "abort";

export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  usage?: Record<string, unknown>;
  error?: unknown;
}

export interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  thinking?: string;
  toolCalls?: Array<{ name: string; args?: Record<string, unknown>; result?: unknown }>;
  usage?: Record<string, unknown>;
  timestamp: number;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}
