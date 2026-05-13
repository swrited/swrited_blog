---
title: 'Live2D 桌面宠物开发日记②：桌面部署与 AI 接入'
published: 2026-05-11
description: Day 1 完成了绘制和基础动态，今天聊硬核的——怎么把 Live2D 模型变成桌面宠物。从 Cubism 导出、Electron 窗口到鼠标追踪和自定义动作，完整拆解。
cover: /images/covers/live2d-day2-cover.jpg
coverInContent: false
tags:
  - Live2D
  - Electron
  - PixiJS
  - inni-pet
category: 前端
comment: true
draft: false
---

> Day 1 我们完成了角色的绘制和基础动态。今天来聊点硬核的——**怎么把你做好的 Live2D 模型变成桌面宠物**。我会以 `inni-pet` 项目为例，拆解从 Cubism 导出到桌面应用落地的完整链路。
>
> 📂 项目代码：**[github.com/swrited/inni-pet](https://github.com/swrited/inni-pet)**

---

## 一、从 Cubism 到桌面：inni-pet 项目概览

Day 1 做的模型现在还只能在 Cubism 编辑器里看。如果想让它常驻桌面、能聊天、能跟随鼠标，就需要一个**桌面应用壳子**来承载。

我的选择是 **Electron + PixiJS + Live2D Cubism 4**，项目开源在 GitHub 上，可以直接 clone 下来跑。

技术选型原因很简单：
- **Electron** — 做无边框透明窗口最成熟，跨平台也容易
- **PixiJS** — 高性能 2D WebGL 渲染，Live2D 官方底层依赖就是它
- **pixi-live2d-display** — 把 Live2D 模型接入 PixiJS 的桥接库
- **JSZip** — 用于解压 .zip 模型文件（如果模型是压缩包分发的话）

> 💡 为什么不用 Tauri 或 nw.js？因为 Electron 技术栈最成熟，遇到坑的时候社区方案最多，Live2D 相关的现成参考也基本都是 Electron 的。

---

## 二、从 Cubism 导出模型文件

在写代码之前，先从 Cubism 编辑器里把模型导出来。

### 导出步骤

1. 在 Cubism 编辑器中，菜单选择：

```
File → Export → Export as moc3 file
```

2. 勾选导出选项：
   - **moc3 文件**（模型几何数据）
   - **model3.json**（模型配置文件，描述了部件、参数、贴图路径等）
   - **cdi3.json**（参数和部件的显示名称，方便在代码里识别）
   - **贴图文件夹**（.png 纹理文件）

3. 把导出的文件放在项目目录的 `inni_model/` 文件夹下：

```
inni_model/
├── inni_2_eye.model3.json     # 模型入口配置
├── inni_2_eye.moc3            # 核心模型数据
├── inni_2_eye.cdi3.json       # 参数/部件定义
└── inni_2_eye.1024/
    └── texture_00.png          # 贴图
```

> ⚠️ **关键提醒**：moc3 的版本和运行时版本必须严格对应！如果你的 Cubism 编辑器是 5.x 版本导出的 moc3，而代码里用的是 Cubism 4 的 runtime，加载时会直接报错 `The Core unsupport later than moc3 ver`。要么降级编辑器导出，要么升级 runtime。
>
> `inni-pet` 仓库里用的是 Cubism 4 runtime，所以导出时也请用 Cubism Editor 4.x 版本。

---

## 三、搭建 Electron 窗口：透明、置顶、无边框

`inni-pet` 的窗口配置在 `main.js` 里，目标是让模型像"悬浮"在桌面上一样：

```javascript
const { BrowserWindow } = require('electron');

mainWindow = new BrowserWindow({
  width: 380,
  height: 380,
  frame: false,           // 去掉系统标题栏和边框
  transparent: true,      // 透明背景，只显示模型本身
  alwaysOnTop: true,      // 始终置顶
  resizable: false,
  skipTaskbar: true,      // 不在任务栏显示图标
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: './preload.js',
    webSecurity: false,
    allowRunningInsecureContent: true,
    devTools: true
  }
});

// 让窗口在所有工作空间都可见
mainWindow.setVisibleOnAllWorkspaces(true);

// 默认放在屏幕右下角
const primaryDisplay = screen.getPrimaryDisplay();
const { width, height } = primaryDisplay.workAreaSize;
mainWindow.setPosition(width - 400, height - 400);
```

这样配置后，窗口就是一块 380x380 的透明区域，Live2D 模型居中显示，没有白边黑边，完美"挂"在桌面上。

---

## 四、加载 Live2D 模型：脚本顺序是生命线

`index.html` 里加载 Live2D 的脚本顺序**绝对不能乱**，这是 `inni-pet` 踩坑最久的地方。

### 正确的加载顺序

```html
<!-- 1. PixiJS 核心库 -->
<script src="./pixi.min.js"></script>
<script>window.process = window.process || { env: { NODE_ENV: 'production' } };</script>

<!-- 2. Live2D Cubism 核心运行时 -->
<script src="./live2dcubismcore.min.js"></script>

<!-- 3. pixi-live2d-display 桥接库 -->
<script src="./cubism4.min.js"></script>
```

### 初始化代码

```javascript
// 1. 创建 Pixi 应用
const pixiApp = new PIXI.Application({
  width: 400,
  height: 600,
  transparent: true,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true
});

// 2. 注册 Ticker（这是 Key！漏了就永远不动）
Live2DModel.registerTicker(PIXI.Ticker);

// 3. 加载模型
const model = await Live2DModel.from('/inni_model/inni_2_eye.model3.json');

// 4. 设置缩放和位置
const scaleX = 400 / model.width;
const scaleY = 600 / model.height;
model.scale.set(Math.min(scaleX, scaleY) * 0.9);
model.anchor.set(0.5, 1.0);
model.position.set(200, 850);
pixiApp.stage.addChild(model);

// 5. 停止自带的待机动画，防止覆盖自定义参数
model.internalModel.motionManager?.stopAllMotions?.();
```

> ⚠️ **最容易踩的坑**：`Live2DModel.registerTicker(PIXI.Ticker)` 如果不调用，模型的帧循环不会驱动，你看到的永远只是一张静态贴图。`inni-pet` 早期就是漏了这行，模型加载成功但完全不动，排查了好久。

---

## 五、让 inni 看向你：鼠标视线追踪

桌面宠物最灵魂的功能就是**视线跟随鼠标**。实现方式是 Electron 主进程每 33ms 获取一次鼠标坐标，通过 IPC 发送给渲染进程，再映射到模型的眼珠参数上。

### 主进程发送鼠标位置（main.js）

```javascript
const { screen } = require('electron');

function startCursorTracking() {
  setInterval(() => {
    const cursor = screen.getCursorScreenPoint();
    mainWindow.webContents.send('cursor-position', {
      cursor: cursor,
      windowBounds: mainWindow.getBounds()
    });
  }, 33);  // 约 30fps
}
```

### 渲染进程接收并驱动眼珠（index.html）

```javascript
window.electronAPI.onCursorPosition(({ cursor, windowBounds }) => {
  const rect = live2dContainer.getBoundingClientRect();

  // 把屏幕坐标转换成模型坐标系
  const pageX = cursor.x - windowBounds.x;
  const pageY = cursor.y - windowBounds.y;
  const stageX = (pageX - rect.left) * (400 / rect.width);
  const rawStageY = 600 - (pageY - rect.top) * (600 / rect.height);
  const stageY = 300 + (rawStageY - 300) * 2.2;

  // 调用 Live2D 内置方法，自动计算 EyeBall X/Y
  model.focus(stageX, stageY);
});
```

这里的坐标转换稍微复杂，是因为要把**屏幕绝对坐标**映射到**模型内部 400x600 的坐标系**里。`model.focus()` 是 `pixi-live2d-display` 提供的便利方法，内部会自动计算 `ParamEyeBallX` 和 `ParamEyeBallY` 的值。

---

## 六、自定义动作：摇摆、眨眼、耳朵动

`inni-pet` 没有依赖 Cubism 编辑器里做的内置动画，而是**在代码里用关键帧系统自己实现了一套动作**，好处是更灵活，可以动态组合。

### 关键帧动作系统

```javascript
// 定义一个"随节奏摇摆"的动作
gesturePresets.shake = (source) => startGesture('随节奏摇摆', [
  { time: 0,    values: { ParamAngleZ: 0 } },
  { time: 750,  values: { ParamAngleZ: -14 } },
  { time: 1500, values: { ParamAngleZ: 14 } },
  { time: 2250, values: { ParamAngleZ: -10 } },
  { time: 3000, values: { ParamAngleZ: 10 } },
  { time: 3750, values: { ParamAngleZ: 0 } }
], source);

// 定义一个"闭眼休息"的动作
gesturePresets.sleep = (source) => startGesture('闭眼休息', [
  { time: 0,    values: { ParamEyeLOpen: 1, ParamEyeROpen: 1 } },
  { time: 300,  values: { ParamEyeLOpen: 0, ParamEyeROpen: 0 } },
  { time: 2700, values: { ParamEyeLOpen: 0, ParamEyeROpen: 0 } },
  { time: 3000, values: { ParamEyeLOpen: 1, ParamEyeROpen: 1 } }
], source);
```

每一帧的 `beforeModelUpdate` 事件里，系统会根据当前时间插值计算出参数值，写入模型：

```javascript
model.internalModel.on('beforeModelUpdate', updateGesture);
```

### 自定义眨眼系统

`inni-pet` 也没有用 Live2D 自带的眨眼，而是自己实现了一套更可控的：

```javascript
let blinkState = 'open';      // 'open' | 'closing' | 'opening'
let nextBlinkAt = 0;
const BLINK_CLOSE_MS = 75;    // 闭眼耗时 75ms
const BLINK_OPEN_MS = 75;     // 睁眼耗时 75ms
const BLINK_INTERVAL_MIN = 2000;
const BLINK_INTERVAL_MAX = 5000;
```

每隔 2~5 秒随机触发一次眨眼，控制 `ParamEyeLOpen` 和 `ParamEyeROpen` 从 1 渐变到 0 再渐变回 1。左右眼可以独立控制，不会出现机械同步眨眼的感觉。

### 可调参数一览

从 `inni_model/inni_2_eye.cdi3.json` 里可以看到模型暴露的所有参数：

| 参数 ID | 用途 |
|---------|------|
| `ear_left` / `ear_right` | 左右狐狸耳的角度（自定义参数） |
| `ParamAngleX/Y/Z` | 头部旋转 |
| `ParamEyeBallX/Y` | 眼珠位置 |
| `ParamEyeLOpen/ROpen` | 左右眼开闭程度 |
| `ParamBrowLY/RY` | 眉毛上下 |
| `ParamMouthForm/OpenY` | 嘴型变形和张开程度 |
| `ParamCheek` | 脸颊泛红（害羞表情用） |
| `ParamHairFront/Side/Back` | 各层头发的摇摆 |
| `ParamBodyAngleX/Y/Z` | 身体旋转 |
| `ParamBreath` | 呼吸起伏 |

---

## 七、让模型活起来：桥接服务器和聊天链路

`inni-pet` 不只是个会动的模型，它还是个**AI 桌面宠物**。聊天链路走的是一个本地桥接服务器 `bridge-server.js`：

```
Inni Pet UI (Electron)
    ↓ HTTP POST /v1/chat/completions
bridge-server.js (本地 1234 端口)
    ↓
LLM Gateway (MiniMax / Hermes / OpenAI-compatible)
    ↓
MiniMax TTS
    ↓
回复文字 + 语音播放
```

这样配置的好处是：
- 前端只负责渲染和交互，不直接对接各家 API
- 后端可以灵活切换 LLM 供应商，前端无感知
- 兼容 Ollama 的 11434 端口，本地模型也能跑

### 启动方式

```bash
# 一键启动 Electron + bridge server
npm start

# 或者单独启动 bridge
npm run start:bridge

# 指定不同的 LLM 供应商
npm run start:openclaw   # 使用 OpenClaw/QClaw
npm run start:hermes     # 使用 Hermes
```

### 环境变量配置

```bash
# 使用自定义 gateway
INNI_CHAT_PROVIDER=hermes \
INNI_CHAT_BASE_URL=http://127.0.0.1:8000/v1 \
INNI_CHAT_API_KEY=*** \
INNI_CHAT_MODEL=你的模型 \
npm start
```

---

## 八、踩坑实录：FIX_GUIDE 精华

项目仓库里有一份 `FIX_GUIDE.md`，记录了从 0 到跑通过程中遇到的各种坑。这里挑几个最容易遇到的：

### 坑 1：脚本加载顺序错乱

如果看到 `PIXI.Application is not a constructor` 或 `Cannot read properties of undefined`，99% 是脚本顺序错了。正确顺序必须是：

1. PixiJS
2. JSZip（如果用 zip 加载模型）
3. `live2dcubismcore.min.js`
4. `cubism4.min.js`

### 坑 2：moc3 版本不匹配

```
The Core unsupport later than moc3 ver
```

编辑器导出的 moc3 版本必须和 runtime 对应。`inni-pet` 用 Cubism 4 runtime，导出时也请用 Cubism Editor 4.x。

### 坑 3：Electron 安全策略拦截 CDN

Electron 默认的 `webSecurity` 会阻止从 CDN 加载脚本。项目里已经设置 `webSecurity: false`，但如果你自己改造，注意这一点。

### 坑 4：忘记 registerTicker

模型加载成功但完全不动。检查是否调用了 `Live2DModel.registerTicker(PIXI.Ticker)`。

### 坑 5：本地路径 hardcode

原稿里写了很多 `/Users/user1/Desktop/...` 的本地路径，clone 到别的机器上直接跑会报错。建议统一用相对路径，或者通过环境变量配置。

---

## 九、Day 2 的感悟

今天的主题从"怎么画"转到了"怎么跑"。Live2D 模型做完只是 50%，让它在桌面环境里稳定运行才是另一半工作量。

看到 inni 终于能挂在桌面上、眼睛跟着鼠标转、偶尔眨个眼的时候，之前的坑都值了。

---

## 十、Day 3 预告

模型跑起来之后，下一步是让它更"聪明"：
- **口型同步**：根据 TTS 语音的音量或音素，实时驱动 `ParamMouthOpenY`
- **语音识别**：接入 Whisper 或 Web Speech API，让 inni 能"听见"你说话
- **表情系统**：根据聊天内容自动切换表情（开心、疑惑、害羞）
- **拖拽互动**：点击拖拽模型，让它在桌面上跟着你走

如果你也在做 Live2D 桌面宠物，欢迎来交流 `inni-pet` 的代码 👉 **[github.com/swrited/inni-pet](https://github.com/swrited/inni-pet)**

---

*本文为 inni Live2D 制作系列的第二篇。从画到跑，路还长，慢慢走。*
