import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { mastra } from "./mastra/index.js";
import {
  chunkToStreamEvent,
  printAgentOutput,
} from "./utils/print-agent-output.js";
import type { StreamEvent } from "./utils/print-agent-output.js";
import { ReadableStream } from "node:stream/web";

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
    const { message } = req.body as { message?: string };

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const agent = mastra.getAgent("questionFromAgent");
    if (!agent) {
      res.status(500).json({ error: "Agent not found" });
      return;
    }

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
        thread: "chat-thread",
        resource: "chat-user",
      },
    });

    const TAG_START = "<question-form";
    const TAG_END = "</question-form>";
    const PREFIXES = Array.from({ length: TAG_START.length }, (_, i) =>
      TAG_START.slice(0, i + 1)
    ); // ["<", "<q", "<qu", ... , "<question-form"]

    let fullText = "";
    let formState: "normal" | "collecting" = "normal";
    let formBuffer = "";
    let pendingText = "";

    for await (const chunk of streamToAsyncIterable(stream.fullStream)) {
      const event = chunkToStreamEvent(chunk);
      if (!event) continue;

      if (event.type === "text" && event.content) {
        fullText += event.content;

        if (formState === "normal") {
          pendingText += event.content;

          // 检测 <question-form（可能跨多个 chunk）
          const tagIdx = pendingText.indexOf(TAG_START);
          if (tagIdx !== -1) {
            // 标签之前的普通文本先发送
            if (tagIdx > 0) {
              send({ type: "text", content: pendingText.slice(0, tagIdx) });
            }
            // 进入收集模式
            formState = "collecting";
            formBuffer = pendingText.slice(tagIdx);
            pendingText = "";
            send({ type: "question-form-start" });
          } else {
            // 未找到完整标签，检查末尾是否可能是标签前缀
            const mayBePrefix = PREFIXES.some((p) => pendingText.endsWith(p));
            if (!mayBePrefix) {
              // 不可能是标签，安全发送
              send({ type: "text", content: pendingText });
              pendingText = "";
            }
            // 可能是前缀，保留在 pendingText 等待下一个 chunk
          }
        } else {
          // 收集模式：累积并检测 </question-form>
          formBuffer += event.content;
          const endIdx = formBuffer.indexOf(TAG_END);
          if (endIdx !== -1) {
            const formContent = formBuffer.slice(
              0,
              endIdx + TAG_END.length
            );
            const rest = formBuffer.slice(endIdx + TAG_END.length);
            send({ type: "question-form-complete", content: formContent });
            formState = "normal";
            formBuffer = "";
            pendingText = "";
            if (rest.trim()) {
              send({ type: "text", content: rest });
            }
          }
        }
      } else {
        // 非文本事件（reasoning / tool-call 等）先 flush pending text
        if (formState === "normal" && pendingText) {
          send({ type: "text", content: pendingText });
          pendingText = "";
        }
        send(event);
      }
    }

    // flush 残留的 pending text
    if (formState === "normal" && pendingText) {
      send({ type: "text", content: pendingText });
    }

    printAgentOutput(fullText, "Agent Response");

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
