import { useChat } from "./hooks/useChat";
import { ChatApp } from "./components/ChatApp";

export default function App() {
  const { messages, isLoading, error, sendMessage, clearMessages } = useChat();

  return (
    <ChatApp
      messages={messages}
      isLoading={isLoading}
      error={error}
      onSend={sendMessage}
      onClear={clearMessages}
    />
  );
}
