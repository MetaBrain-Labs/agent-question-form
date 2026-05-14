import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { mastra } from "./mastra/index.js";
import {
  chunkToStreamEvent,
} from "./utils/print-agent-output.js";
import type { StreamEvent } from "./utils/print-agent-output.js";
import { ReadableStream } from "node:stream/web";

// ── Helpers ──

/** Parse <function_calls><invoke name="TodoWrite">…</invoke></function_calls> */
function parseTodoWrite(block: string): StreamEvent["todos"] | null {
  const invokeMatch = /<invoke\s+name="(todo_write|todowrite)"\s*>/i;
  if (!invokeMatch.test(block)) return null;
  const bodyMatch = /<invoke[^>]*>([\s\S]*?)<\/invoke>/i.exec(block);
  if (!bodyMatch) return null;
  const body = bodyMatch[1] ?? "";
  const paramRe = /<parameter\s+name="todos"[^>]*\s*>\s*(\[[\s\S]*?\])\s*<\/parameter>/i;
  const paramMatch = paramRe.exec(body);
  if (paramMatch) {
    try {
      const arr: Array<{ content: string; status: string }> = JSON.parse(paramMatch[1] ?? "[]");
      return arr.map((t, i) => ({
        index: i,
        content: t.content ?? "",
        status: t.status ?? "pending",
      }));
    } catch { /* fall through */ }
  }
  // Fallback: parse individual <parameter name="todos" index="N">...</parameter>
  const paramRe2 = /<parameter\s+name="todos"\s+index="(\d+)"\s*>(.*?)<\/parameter>/gi;
  const todos: Array<{ index: number; content: string; status: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = paramRe2.exec(body)) !== null) {
    todos.push({
      index: parseInt(m[1] ?? "0", 10),
      content: (m[2] ?? "").trim(),
      status: "pending",
    });
  }
  return todos.length > 0 ? todos : null;
}

/** Strip <function_calls> blocks from text and return cleaned text + parsed todos */
function extractFnCalls(
  text: string
): { cleaned: string; todos: StreamEvent["todos"] | null } {
  const fnRe = /<function_calls>([\s\S]*?)<\/function_calls>/g;
  let cleaned = text;
  let todos: StreamEvent["todos"] | null = null;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(text)) !== null) {
    const block = m[0] ?? "";
    const parsed = parseTodoWrite(block);
    if (parsed) todos = parsed;
    cleaned = cleaned.replace(block, "");
  }
  return { cleaned, todos };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ?? 3000;
const isDev = process.env.NODE_ENV !== "production";

async function* streamToAsyncIterable<T>(
  rs: ReadableStream<T>,
): AsyncIterable<T> {
  const reader = rs.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

app.use(express.json());

// CORS
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", agents: ["questionFromAgent"] });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, threadId } = req.body as { message?: string; threadId?: string };

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const agent = mastra.getAgent("questionFromAgent");
    if (!agent) {
      res.status(500).json({ error: "Agent not found" });
      return;
    }

    const thread = threadId ?? "default";

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const send = (event: StreamEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    send({ type: "start" });

    const stream = await agent.stream(message, {
      memory: {
        thread,
        resource: "chat-user",
      },
    });

    const QF_START = "<question-form";
    const QF_END = "</question-form>";
    const QF_PREFIXES = Array.from({ length: QF_START.length }, (_, i) =>
      QF_START.slice(0, i + 1)
    );
    const FN_START = "<function_calls>";
    const FN_END = "</function_calls>";

    let qfState: "normal" | "collecting" = "normal";
    let qfBuffer = "";
    let pendingText = "";

    for await (const chunk of streamToAsyncIterable(stream.fullStream)) {
      const event = chunkToStreamEvent(chunk);
      if (!event) continue;

      if (event.type === "text" && event.content) {

        if (qfState === "collecting") {
          qfBuffer += event.content;
          const endIdx = qfBuffer.indexOf(QF_END);
          if (endIdx !== -1) {
            const formContent = qfBuffer.slice(0, endIdx + QF_END.length);
            const rest = qfBuffer.slice(endIdx + QF_END.length);
            send({ type: "question-form-complete", content: formContent });
            qfState = "normal";
            qfBuffer = "";
            // Check rest for function_calls
            const { cleaned, todos } = extractFnCalls(rest);
            if (todos) send({ type: "todo-update", todos });
            if (cleaned.trim()) send({ type: "text", content: cleaned });
          }
        } else {
          pendingText += event.content;

          // 1) Check for <question-form>
          const qfIdx = pendingText.indexOf(QF_START);
          if (qfIdx !== -1) {
            if (qfIdx > 0) {
              const before = pendingText.slice(0, qfIdx);
              const { cleaned, todos } = extractFnCalls(before);
              if (todos) send({ type: "todo-update", todos });
              if (cleaned.trim()) send({ type: "text", content: cleaned });
            }
            qfState = "collecting";
            qfBuffer = pendingText.slice(qfIdx);
            pendingText = "";
            send({ type: "question-form-start" });
            continue;
          }

          // 2) Check for <function_calls>
          const fnIdx = pendingText.indexOf(FN_START);
          if (fnIdx !== -1) {
            const fnEnd = pendingText.indexOf(FN_END, fnIdx);
            if (fnEnd !== -1) {
              // Complete block found — extract, parse, send remaining
              const before = pendingText.slice(0, fnIdx);
              const fnBlock = pendingText.slice(fnIdx, fnEnd + FN_END.length);
              const after = pendingText.slice(fnEnd + FN_END.length);
              if (before.trim()) send({ type: "text", content: before });
              const todos = parseTodoWrite(fnBlock);
              if (todos) send({ type: "todo-update", todos });
              pendingText = after;
              continue;
            }
            // Partial — might span chunks, buffer. Just let pendingText accumulate.
            // If we haven't found FN_END, text stays in pendingText for next chunk.
            if (pendingText.length > 10000) {
              // Safety: flush if buffer gets too large without finding end tag
              const quoteMatch = pendingText.lastIndexOf('"');
              if (quoteMatch > fnIdx) {
                const safeCut = pendingText.lastIndexOf("\n", quoteMatch);
                if (safeCut > fnIdx) {
                  const before = pendingText.slice(0, safeCut);
                  const { cleaned } = extractFnCalls(before);
                  if (cleaned.trim()) send({ type: "text", content: cleaned });
                  pendingText = pendingText.slice(safeCut);
                }
              }
            }
            continue;
          }

          // 3) Check if pendingText end might be a prefix of <question-form or <function_calls
          const mayBePrefix =
            QF_PREFIXES.some((p) => pendingText.endsWith(p)) ||
            FN_START.startsWith(pendingText.slice(-Math.min(pendingText.length, 10))) ||
            Array.from({ length: Math.min(FN_START.length, pendingText.length) }, (_, i) =>
              FN_START.slice(0, i + 1)
            ).some((p) => pendingText.endsWith(p));

          if (!mayBePrefix) {
            send({ type: "text", content: pendingText });
            pendingText = "";
          }
        }
      } else {
        if (qfState === "normal" && pendingText) {
          const { cleaned, todos } = extractFnCalls(pendingText);
          if (todos) send({ type: "todo-update", todos });
          if (cleaned.trim()) send({ type: "text", content: cleaned });
          pendingText = "";
        }
        send(event);
      }
    }

    // flush
    if (qfState === "normal" && pendingText) {
      const { cleaned, todos } = extractFnCalls(pendingText);
      if (todos) send({ type: "todo-update", todos });
      if (cleaned.trim()) send({ type: "text", content: cleaned });
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Chat stream error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: String(error) });
    } else {
      res.write(
        `data: ${JSON.stringify({ type: "error", error: String(error) })}\n\n`,
      );
      res.end();
    }
  }
});

// ── Thread History ──

app.get("/api/threads", async (req, res) => {
  try {
    const agent = mastra.getAgent("questionFromAgent");
    if (!agent) {
      res.status(500).json({ error: "Agent not found" });
      return;
    }
    const memory = await agent.getMemory();
    if (!memory) {
      res.json({ threads: [] });
      return;
    }

    const result = await memory.listThreads({
      filter: { resourceId: String(req.query.resourceId ?? "chat-user") },
      perPage: 50,
      orderBy: { field: "createdAt", direction: "DESC" },
    });

    res.json({
      threads: result.threads.map((t) => ({
        id: t.id,
        title: t.title ?? t.id.slice(0, 8),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error) {
    console.error("List threads error:", error);
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/threads/:threadId/messages", async (req, res) => {
  try {
    const agent = mastra.getAgent("questionFromAgent");
    if (!agent) {
      res.status(500).json({ error: "Agent not found" });
      return;
    }
    const memory = await agent.getMemory();
    if (!memory) {
      res.json({ messages: [] });
      return;
    }

    const { threadId } = req.params;
    const result = await memory.recall({
      threadId,
      perPage: 200,
      includeSystemReminders: false,
    });

    res.json({
      messages: result.messages.map((m) => ({
        id: m.id,
        role: m.role === "assistant" ? "agent" : m.role,
        content: extractMessageText(m),
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: String(error) });
  }
});

/** Extract plain text from a MastraDBMessage, stripping <function_calls> blocks */
function extractMessageText(m: any): string {
  let text = "";
  if (typeof m.content === "string") {
    text = m.content;
  } else if (m.content && typeof m.content === "object") {
    if (typeof m.content.content === "string") text = m.content.content;
    else if (Array.isArray(m.content.parts)) {
      text = m.content.parts
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text ?? "")
        .join("");
    }
  }
  if (!text) return typeof m.content === "string" ? m.content : JSON.stringify(m.content);
  // Strip <function_calls> blocks from stored text
  const { cleaned } = extractFnCalls(text);
  return cleaned.trim();
}

// 开发模式：API only，前端由 Vite dev server 提供
// 生产模式：serve React 构建产物
if (!isDev) {
  const clientDist = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.json({
      message: "Chat API server running. Use Vite dev server for frontend.",
    });
  });
}

app.listen(PORT, () => {
  console.log(`Chat server running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
