import { useState, useCallback, useRef } from "react";
import type { Message, StreamEvent } from "../types";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);

    const agentMsgId = crypto.randomUUID();
    const agentMsg: Message = {
      id: agentMsgId,
      role: "agent",
      content: "",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, agentMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`Server error: ${resp.status}`);
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const event: StreamEvent = JSON.parse(payload);
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== agentMsgId) return m;

                switch (event.type) {
                  case "thinking":
                    return { ...m, thinking: (m.thinking ?? "") + (event.content ?? "") };
                  case "text":
                    return { ...m, content: m.content + (event.content ?? "") };
                  case "tool-call":
                    return {
                      ...m,
                      toolCalls: [
                        ...(m.toolCalls ?? []),
                        { name: event.toolName ?? "unknown", args: event.toolArgs },
                      ],
                    };
                  case "tool-result":
                    return {
                      ...m,
                      toolCalls: (m.toolCalls ?? []).map((tc, i) =>
                        i === (m.toolCalls?.length ?? 1) - 1
                          ? { ...tc, result: event.toolResult }
                          : tc
                      ),
                    };
                  case "finish":
                    return { ...m, usage: event.usage };
                  case "error":
                    return { ...m, content: m.content + `\n[Error: ${JSON.stringify(event.error)}]` };
                  default:
                    return m;
                }
              })
            );
          } catch {
            // 忽略 JSON 解析错误
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? { ...m, content: m.content + `\n[错误: ${msg}]` }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [isLoading]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages };
}
