---
title: 'Inni Pet 部署指南：将 Live2D 桌面宠物搬上博客'
summary: '记录 Inni Pet 的部署过程，基于 Electron + PixiJS + Live2D Cubism，将 AI 伴侣 inni 变成可交互的网页组件，支持鼠标追踪、动作触发与 AI 对话。'
pubDate: '2026-05-12'
tags:
  - Inni
  - Live2D
  - Electron
  - PixiJS
  - AI
cover: /images/covers/inni-companion-cover.png
coverAlt: Inni Pet 部署封面
---

## 项目概述

Inni Pet 是一个基于 **Electron + PixiJS + Live2D Cubism** 的桌面宠物项目，模型使用仓库内的 `inni_model/inni_2_eye.model3.json`，支持以下功能：

- Live2D 桌面宠物窗口
- 鼠标追踪视线
- 点击模型随机触发动作
- 终端输入动作命令
- 内置聊天桥接服务
- 支持 MiniMax、OpenClaw、OpenAI-compatible gateway
- MiniMax TTS 接口

## 快速启动

### 安装依赖

```bash
git clone https://github.com/swrited/inni-pet.git
cd inni-pet
npm install
```

### 启动宠物

```bash
npm start
```

`npm start` 会同时启动：
- Electron 桌宠窗口
- 本地 bridge server：`http://127.0.0.1:1234`
- 兼容 Ollama 端口：`http://127.0.0.1:11434`

> 如果提示 `electron: command not found`，先执行 `npm install`

## Gateway 选择

### MiniMax（默认）

```bash
MINIMAX_API_KEY=你的key npm start
```

### OpenClaw / QClaw

先保证 QClaw/OpenClaw 本地 gateway 运行，启用 `/v1/chat/completions`：

```bash
npm run start:openclaw
```

默认读取 `~/.qclaw/openclaw.json`，调用地址：

```
http://127.0.0.1:28789/v1/chat/completions
```

## Live2D 模型结构

```
inni_model/
├── inni_2_eye.1024/      # 纹理贴图
├── inni_2_eye.cdi3.json   # 动作数据
├── inni_2_eye.moc3        # 模型文件
└── inni_2_eye.model3.json # 模型配置
```

## 网页端集成（原理）

将 Live2D 嵌入网页的核心流程：

```javascript
// 加载 Live2D Cubism Core
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';

// 初始化 PIXI 应用
const app = new PIXI.Application({
  view: document.getElementById('canvas'),
  width: 400,
  height: 600,
  transparent: true,
});

// 加载模型
const model = await Live2DModel.from('/path/to/inni_2_eye.model3.json');
app.stage.addChild(model);

// 鼠标追踪
app.view.addEventListener('mousemove', (e) => {
  model.internal.motionManager.modelCore.setRandomExpression();
});
```

## 相关资源

- 模型仓库：[swrited/inni-pet](https://github.com/swrited/inni-pet)
- Live2D Cubism：[Live2D Cubism Core](https://www.live2d.com/)
- PixiJS：[pixi-live2d-display](https://github.com/guansss/pixi-live2d-display)

## 附录：文件说明

| 文件 | 说明 |
|------|------|
| `bundle-live2d.js` | Live2D 核心包 |
| `pixi.min.js` | PixiJS 渲染引擎 |
| `live2dcubismcore.min.js` | Cubism 核心 |
| `bridge-server.js` | 与 AI gateway 通信的桥接服务 |
| `local-live2d.js` | 独立运行的网页版 |
