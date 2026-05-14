# AGENTS.md

You are a TypeScript developer experienced with the Mastra framework. You build AI agents, tools, workflows, and scorers. You follow strict TypeScript practices and always consult up-to-date Mastra documentation before making changes.

## CRITICAL: Load `mastra` skill

**BEFORE doing ANYTHING with Mastra, load the `mastra` skill FIRST.** Never rely on cached knowledge as Mastra's APIs change frequently between versions. Use the skill to read up-to-date documentation from `node_modules`.

## Project Overview

This is a **Mastra** project written in TypeScript. Mastra is the Agent backend — the project does NOT use Mastra Studio as the UI. Instead, a custom Express server + Vite React frontend provides the chat interface.

The agent is a design assistant that follows a discovery-first interaction pattern: it asks structured questions via `<question-form>` before generating HTML design artifacts.

Node.js runtime: `>=22.13.0`

## Commands

```bash
# Mastra CLI
npm run dev          # Start Mastra Studio at localhost:4111
npm run build        # Build Mastra production server

# Custom Chat Server (uses Mastra as backend)
npm run chat         # Start Express backend at localhost:3000
npm run dev:client   # Start Vite React frontend at localhost:5173
npm run dev:server   # Alias for npm run chat
npm run dev:all      # Run backend + frontend concurrently

npm run build:client # Build React frontend to client/dist/
npm run preview      # Build client + serve from Express (production mode)
```

## Project Structure

| Path                         | Description |
| ---------------------------- | ----------- |
| `src/mastra/index.ts`        | Mastra instance: registers agents, workflows, scorers, storage, observability |
| `src/mastra/agents/`         | Agent definitions (question-from-agent) |
| `src/mastra/workflows/`      | Multi-step workflows (question-form-workflow: parse → generate → critique) |
| `src/mastra/scorers/`        | Eval scorers (toolCallAppropriateness, completeness, discoveryCompliance) |
| `src/mastra/prompts/`        | Agent system prompts (discovery.ts, directions.ts) |
| `src/mastra/utils/`          | Form parser utilities (form-parser.ts) |
| `src/chat-server.ts`         | Express server: SSE streaming `/api/chat`, thread history `/api/threads` |
| `src/utils/print-agent-output.ts` | StreamEvent types and chunk-to-event conversion |
| `client/`                    | Vite + React + TypeScript frontend |
| `client/src/components/`     | ChatApp, MessageBubble, Sidebar, QuestionForm, TodoCard, ProseBlock |
| `client/src/hooks/useChat.ts` | SSE streaming hook with thread management |
| `client/src/utils/`          | markdown.tsx, question-form.ts (parser) |

## Architecture

```
User → React UI (localhost:5173) → Vite proxy → Express (localhost:3000) → Mastra Agent (DeepSeek)
                                                                                  ↓
                                                                           LibSQL + DuckDB
```

- **Backend**: Express serves SSE stream via `agent.stream()`, parses `<question-form>` and `<function_calls>` blocks in-flight, and surfaces them as structured events
- **Frontend**: React components render markdown prose, QuestionForm cards, TodoWrite progress cards, and tool-call badges — all updated live via SSE
- **Memory**: Agent configured with `new Memory()`, messages persisted per `threadId` + `resourceId`, sidebar shows thread history via `agent.getMemory().listThreads()` / `memory.recall()`

## Stream Event Types

| Event | Description |
| ----- | ----------- |
| `start` | Stream begins |
| `thinking` / `thinking-done` | DeepSeek reasoning content |
| `text` | Regular prose output |
| `question-form-start` / `question-form-complete` | Structured question form block |
| `todo-update` | TodoWrite function call parsed into structured todos |
| `tool-call` / `tool-result` | Actual Mastra tool invocations |
| `finish` | Stream complete (includes token usage) |
| `error` | Stream error |

## Boundaries

### Always do

- Load the `mastra` skill before any Mastra-related work
- Register new agents, tools, workflows, and scorers in `src/mastra/index.ts`
- Run `npm run build:client` and TypeScript checks to verify changes compile
- Keep the backend stream event types in sync between `src/utils/print-agent-output.ts` and `client/src/types.ts`

### Never do

- Never commit `.env` files or secrets
- Never modify `node_modules` or Mastra's database files directly
- Never hardcode API keys (always use environment variables)

## Key Dependencies

| Package | Purpose |
| ------- | ------- |
| `@mastra/core` | Agent, Workflow, Storage, Streaming |
| `@mastra/memory` | Conversation persistence |
| `@mastra/libsql` / `@mastra/duckdb` | Storage backends |
| `express` | Custom HTTP server (transitive via @mastra/core) |
| `react` / `react-dom` | Frontend UI |
| `vite` | Frontend build tool |
| `zod` | Schema validation |
