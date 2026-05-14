import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import type { Message } from "../types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onClear: () => void;
}

export function ChatApp({ messages, isLoading, error, onSend, onClear }: Props) {
  const [input, setInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  return (
    <>
      <header>
        <span className="dot" />
        Question Form Agent
      </header>

      <div className="chat-container" ref={containerRef}>
        {messages.length === 0 && (
          <div className="empty-state">输入消息，开始与 Agent 对话</div>
        )}

        {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
        ))}

        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => onClear()}>✕</button>
          </div>
        )}
      </div>

      <form className="input-area" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="输入你的消息... (Enter 发送, Shift+Enter 换行)"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? <span className="spinner" /> : <span>发送</span>}
        </button>
        {messages.length > 0 && (
          <button
            type="button"
            className="clear-btn"
            onClick={onClear}
            disabled={isLoading}
          >
            清空
          </button>
        )}
      </form>
    </>
  );
}
