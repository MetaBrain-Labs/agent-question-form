import type { ChunkType } from "@mastra/core/stream";

export type StreamEventType =
  | "start"
  | "thinking"
  | "thinking-done"
  | "text"
  | "question-form-start"
  | "question-form-complete"
  | "todo-update"
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
  todos?: Array<{ index: number; content: string; status: string }>;
}

export function chunkToStreamEvent(chunk: ChunkType): StreamEvent | null {
  switch (chunk.type) {
    case "start":
      return { type: "start" };
    case "reasoning-start":
      return { type: "thinking" };
    case "reasoning-delta":
      return { type: "thinking", content: chunk.payload.text };
    case "reasoning-end":
      return { type: "thinking-done" };
    case "text-delta":
      return { type: "text", content: chunk.payload.text };
    case "tool-call":
      return {
        type: "tool-call",
        toolName: chunk.payload.toolName,
        toolArgs: chunk.payload.args,
      };
    case "tool-result":
      return {
        type: "tool-result",
        toolName: chunk.payload.toolName,
        toolResult: chunk.payload.result,
      };
    case "step-finish":
      return {
        type: "step-finish",
        content: chunk.payload.stepResult?.reason,
      };
    case "finish":
      return {
        type: "finish",
        usage: chunk.payload.output?.usage,
      };
    case "error":
      return { type: "error", error: chunk.payload.error };
    case "abort":
      return { type: "abort" };
    default:
      return null;
  }
}
