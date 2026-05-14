# Agent Question Form Pro

基于 Mastra 框架的 AI 设计助手，支持流式对话、结构化问题表单、TodoWrite 进度卡片和历史对话管理。

## 技术栈

| 层 | 技术 |
| --- | --- |
| Agent 框架 | [Mastra](https://mastra.ai) |
| 模型 | DeepSeek v4 Pro |
| 后端 | Express (SSE 流式) |
| 前端 | React + TypeScript + Vite |
| 存储 | LibSQL + DuckDB |

## 快速开始

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY

# 2. 安装依赖
npm install
cd client && npm install && cd ..

# 3. 启动后端
npm run chat              # localhost:3000

# 4. 启动前端（新终端）
npm run dev:client        # localhost:5173

# 或一键启动
npm run dev:all
```

打开 http://localhost:5173 开始对话。

## 项目结构

```
├── src/
│   ├── mastra/              # Mastra 配置
│   │   ├── agents/          # Agent 定义
│   │   ├── workflows/       # 工作流
│   │   ├── prompts/         # 系统提示词
│   │   └── scorers/         # 评估器
│   ├── chat-server.ts       # Express 后端 (SSE API)
│   └── utils/               # 工具函数
├── client/                  # React 前端
│   └── src/
│       ├── components/      # UI 组件
│       ├── hooks/           # useChat hook
│       └── utils/           # markdown, question-form 解析
└── package.json
```

## API

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/api/chat` | POST | SSE 流式对话，body: `{ message, threadId? }` |
| `/api/threads` | GET | 获取历史线程列表 |
| `/api/threads/:id/messages` | GET | 获取指定线程消息 |
| `/api/health` | GET | 健康检查 |

## 特性

- **流式对话**：实时显示 Agent 回复，包含思考过程（reasoning）和文本内容
- **结构化表单**：Agent 输出 `<question-form>` 时自动切换为可交互表单卡片
- **TodoWrite 卡片**：Agent 输出任务列表时自动解析并渲染为进度卡片
- **代码块复制**：一键复制 Markdown 代码块
- **历史对话**：侧边栏展示线程历史，支持切换和新建
- **智能滚动**：默认跟随最新内容，用户滚动后自动接管
