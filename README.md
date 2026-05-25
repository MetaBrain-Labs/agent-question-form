# Agent Question Form

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.13.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![Mastra](https://img.shields.io/badge/Mastra-1.x-orange.svg)](https://mastra.ai)
[![DeepSeek](https://img.shields.io/badge/Model-DeepSeek%20V4%20Pro-4B8BF5.svg)](https://deepseek.com)

[English](./README_EN.md)

## 项目简介

一个基于 **Mastra** 框架的 AI 设计助手，核心创新是 **Question-Form（问答卡片）**——Agent 会根据用户输入自动分析需求，动态生成结构化的交互式问答卡片，用户通过简单的勾选、点选即可完成需求澄清，从而以最低沟通成本获得高质量的设计输出。

<p align="center">
  <img src="./docs/question-form-demo.png" alt="Question-Form 问答卡片演示" width="700" />
</p>

> **核心理念**：首次对话中，Agent 不急着写代码，而是先发一张智能卡片锁定需求变量。用户用点选代替打字，30 秒完成需求对齐，再进入 TodoWrite 规划 → 生成设计稿 → 五维自我批判的完整流程。

## 技术栈

| 层         | 技术                                                 |
| ---------- | ---------------------------------------------------- |
| Agent 框架 | [Mastra](https://mastra.ai)                          |
| 大模型     | DeepSeek V4 Pro                                      |
| 后端       | Express + SSE 流式传输                               |
| 前端       | React 19 + TypeScript + Vite 6 + Tailwind CSS 4      |
| 存储       | LibSQL（会话记忆）+ DuckDB（可观测性）               |
| 评估       | Mastra Evals（工具调用准确性 / 完整性 / 发现合规性） |

## 核心特性

### 智能问答卡片（Question-Form）

- Agent 分析用户首次输入后，**动态生成专属问答表单**，包含 radio、checkbox、select、text、textarea 等多种题型
- 用户通过**点选 + 简短输入**完成需求澄清，大幅降低沟通成本
- 表单回答自动格式化为 Agent 可识别的 `[form answers]` 格式，无缝衔接后续对话
- 历史对话中的表单保持**已提交/只读**状态，便于回顾

### 流式对话体验

- 基于 **SSE（Server-Sent Events）** 的实时流式传输，Agent 回复逐字呈现
- 支持 DeepSeek **思考过程（reasoning）** 实时展示
- `<question-form>` 标签在流式传输中被实时检测，前端立即切换为交互式表单卡片
- `<function_calls>` 标签被实时解析为 **TodoWrite 进度卡片**

### 多步设计工作流

Parse Brief → Generate Artifact → 5-Dim Critique

- **Parse**：解析用户设计需求为结构化 JSON
- **Generate**：基于需求生成完整 HTML 设计稿
- **Critique**：五维批判打分（哲学 / 层次 / 执行 / 特异性 / 克制）

### 历史对话管理

- 基于 Mastra Memory + LibSQL 的持久化对话存储
- 侧边栏展示历史线程，支持切换、回看
- 对话自动创建标题，按时间倒序排列

## 快速开始

### 环境要求

- Node.js >= 22.13.0
- DeepSeek API Key（或其他兼容 OpenAI 协议的 API）

### 安装与运行

```bash
# 1. 克隆项目
git clone https://github.com/MetaBrain-Labs/agent-question-form.git
cd agent-question-form

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY

# 3. 安装依赖
npm install
cd client && npm install && cd ..

# 4. 启动后端 (localhost:3000)
npm run chat

# 5. 启动前端 (localhost:5173，新终端)
npm run dev:client

# 或一键同时启动
npm run dev:all
```

打开 http://localhost:5173 开始对话。

## 项目结构

```
├── src/
│   ├── mastra/                    # Mastra 配置中心
│   │   ├── agents/                # Agent 定义（question-form-agent）
│   │   ├── workflows/             # 工作流（parse → generate → critique）
│   │   ├── prompts/               # 系统提示词（discovery 发现式对话策略）
│   │   ├── scorers/               # 评估器（工具调用 / 完整性 / 合规性）
│   │   └── utils/                 # 表单解析工具（form-parser）
│   ├── chat-server.ts             # Express 后端（SSE API + 流式解析）
│   └── utils/                     # 流式事件类型与转换
├── client/                        # React 前端
│   └── src/
│       ├── components/            # UI 组件
│       │   ├── QuestionForm.tsx   # 问答卡片核心组件
│       │   ├── ChatApp.tsx        # 主聊天界面
│       │   ├── MessageBubble.tsx  # 消息气泡（含内联表单渲染）
│       │   ├── TodoCard.tsx       # TodoWrite 进度卡片
│       │   ├── Sidebar.tsx        # 历史对话侧边栏
│       │   └── ProseBlock.tsx     # Markdown 渲染（含代码复制）
│       ├── hooks/                 # useChat（SSE 流式订阅）
│       └── utils/                 # Markdown 渲染、Question-Form 解析
└── package.json
```

## API

| 端点                        | 方法 | 说明                                         |
| --------------------------- | ---- | -------------------------------------------- |
| `/api/chat`                 | POST | SSE 流式对话，body: `{ message, threadId? }` |
| `/api/threads`              | GET  | 查询历史线程列表                             |
| `/api/threads/:id/messages` | GET  | 获取指定线程的消息历史                       |
| `/api/health`               | GET  | 健康检查                                     |

## 流式事件类型

| 事件                         | 说明                                  |
| ---------------------------- | ------------------------------------- |
| `start`                      | 流式传输开始                          |
| `thinking` / `thinking-done` | DeepSeek 思考过程                     |
| `text`                       | 普通文本输出                          |
| `question-form-start`        | 检测到 question-form 开始标签         |
| `question-form-complete`     | question-form 接收完成（含完整 JSON） |
| `todo-update`                | TodoWrite 进度更新                    |
| `tool-call` / `tool-result`  | Mastra 工具调用                       |
| `finish`                     | 流式完成（含 token 用量）             |
| `error`                      | 流式错误                              |

## 许可证

[MIT](./LICENSE) © 2026 MetaBrain-Labs
