import type { ChunkType } from "@mastra/core/stream";

export function printStreamChunk(chunk: ChunkType): void {
  switch (chunk.type) {
    case "start":
      console.log("[START] Agent run beginning...");
      break;

    case "step-start":
      console.log(`[STEP-START] Step started (messageId: ${chunk.payload.messageId ?? "N/A"})`);
      break;

    case "reasoning-start":
      console.log("[REASONING] Thinking...");
      break;

    case "reasoning-delta":
      process.stdout.write(chunk.payload.text);
      break;

    case "reasoning-end":
      console.log("\n[REASONING] Done thinking.");
      break;

    case "text-start":
      console.log("[TEXT] Generation started.");
      break;

    case "text-delta":
      process.stdout.write(chunk.payload.text);
      break;

    case "text-end":
      console.log("\n[TEXT] Generation complete.");
      break;

    case "tool-call":
      console.log(
        `[TOOL-CALL] ${chunk.payload.toolName}(${JSON.stringify(chunk.payload.args)})`
      );
      break;

    case "tool-result":
      console.log(
        `[TOOL-RESULT] ${chunk.payload.toolName}: ${JSON.stringify(chunk.payload.result)?.slice(0, 200)}`
      );
      break;

    case "step-finish":
      console.log(
        `[STEP-FINISH] Reason: ${chunk.payload.stepResult?.reason ?? "N/A"}`
      );
      break;

    case "finish":
      console.log(
        `[FINISH] Complete. Usage: ${JSON.stringify(chunk.payload.output?.usage ?? {})}`
      );
      break;

    case "error":
      console.error(`[ERROR] ${JSON.stringify(chunk.payload.error)}`);
      break;

    case "abort":
      console.log("[ABORT] Stream aborted.");
      break;

    default:
      console.log(`[UNHANDLED] type=${chunk.type}`);
      break;
  }
}

export function printAgentOutput(text: string, label?: string): void {
  const divider = "=".repeat(60);
  console.log(`\n${divider}`);
  console.log(`  ${label ?? "Agent Output"}`);
  console.log(divider);
  console.log(text);
  console.log(divider);
}

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
