export type StreamEventType =
  | "start"
  | "thinking"
  | "thinking-done"
  | "text"
  | "question-form-start"
  | "question-form-complete"
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
  questionForm?: { state: "generating" | "complete"; content?: string };
  toolCalls?: Array<{ name: string; args?: Record<string, unknown>; result?: unknown }>;
  usage?: Record<string, unknown>;
  timestamp: number;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}
