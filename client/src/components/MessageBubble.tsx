import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Message } from "../types";
import { splitOnQuestionForms } from "../utils/question-form";

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const thinkingRef = useRef<HTMLDivElement>(null);

  if (message.role === "agent") {
    const cleaned = useMemo(
      () => stripArtifact(message.content),
      [message.content],
    );
    const segments = useMemo(() => splitOnQuestionForms(cleaned), [cleaned]);
    console.log("segments", segments);
  }

  const isAtBottom = useCallback(() => {
    const el = thinkingRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 20;
  }, []);

  useEffect(() => {
    if (!userScrolled && thinkingRef.current && thinkingOpen) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [message.thinking, thinkingOpen, userScrolled]);

  const handleScroll = useCallback(() => {
    setUserScrolled(!isAtBottom());
  }, [isAtBottom]);

  if (message.role === "user") {
    return (
      <div className="message-row user">
        <div className="message-bubble user-bubble">{message.content}</div>
      </div>
    );
  }

  return (
    <div className="message-row agent">
      {message.thinking && (
        <div className={`thinking-box${thinkingOpen ? " open" : ""}`}>
          <div
            className="thinking-header"
            onClick={() => setThinkingOpen(!thinkingOpen)}
          >
            <span className="chevron">▶</span> 思考过程
            {!message.content && <span className="loading-dots" />}
          </div>
          <div
            className="thinking-content"
            ref={thinkingRef}
            onScroll={handleScroll}
          >
            {message.thinking}
          </div>
        </div>
      )}

      {message.questionForm && (
        <div className="question-form-box">
          {message.questionForm.state === "generating" ? (
            <div className="qf-generating">
              <div className="qf-pulse-ring" />
              <div className="qf-label">正在生成 Question Form</div>
              <div className="qf-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : (
            <div className="qf-complete">
              <div className="qf-badge">✓ Question Form</div>
              <pre className="qf-content">{message.questionForm.content}</pre>
            </div>
          )}
        </div>
      )}

      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="tool-calls-row">
          {message.toolCalls.map((tc, i) => (
            <span
              key={i}
              className={`tool-call-badge ${tc.result !== undefined ? "done" : ""}`}
              title={
                tc.result !== undefined
                  ? JSON.stringify(tc.result, null, 2).slice(0, 500)
                  : JSON.stringify(tc.args, null, 2)
              }
            >
              {tc.result !== undefined ? `✓ ${tc.name}` : `⚙ ${tc.name}`}
            </span>
          ))}
        </div>
      )}

      {message.content && (
        <div className="message-bubble agent-bubble">{message.content}</div>
      )}

      {!message.content && !message.thinking && !message.questionForm && (
        <div className="message-bubble agent-bubble">
          <span className="loading-dots-text">思考中</span>
        </div>
      )}

      {message.usage && (
        <div className="usage-line">
          Tokens — input: {String(message.usage?.inputTokens ?? "-")}, output:{" "}
          {String(message.usage?.outputTokens ?? "-")}, total:{" "}
          {String(message.usage?.totalTokens ?? "-")}
        </div>
      )}
    </div>
  );
}

function stripArtifact(content: string): string {
  const open = content.indexOf("<artifact");
  if (open === -1) return content;
  const closeTag = content.indexOf(">", open);
  const end = content.indexOf("</artifact>", closeTag);
  return (
    content.slice(0, open) +
    content.slice(end === -1 ? content.length : end + 11)
  ).trim();
}
