---
title: '将 Codex 宠物搬上博客'
summary: '记录如何将 Codex 生成的 AI 伴侣 inni 从桌面搬到博客，通过 GIF 动画实现可拖动、可交互的网页陪伴组件，包括 spritesheet 结构、动画触发逻辑与完整集成代码。'
pubDate: '2026-05-12'
tags:
  - Inni
  - Codex
  - 前端
  - 交互设计
  - GIF
cover: /images/covers/inni-companion-cover.png
coverAlt: Codex 宠物 inni 封面
---

## 功能概述

Inni Companion 是一只可拖动、可交互的 AI 伴侣小精灵，默认显示在页面右下角。支持 4 种动画状态：待机、挥手、等待、回顾，由 Codex 生成的像素 spritesheet 切分而来。

## 像素精灵图结构

精灵图由 Codex 生成，排列方式为 **8列 × 9行**，每行动画帧数不同：

| 动作 | 所在行 | 帧数 |
|------|--------|------|
| `idle` 待机 | 第 0 行 | 6 帧 |
| `waving` 挥手 | 第 3 行 | 4 帧 |
| `waiting` 等待 | 第 6 行 | 6 帧 |
| `review` 回顾 | 第 8 行 | 6 帧 |

每帧尺寸 = 原图宽度 ÷ 8，高 = 原图高度 ÷ 9。

## GIF 切分脚本

用 Python Pillow 从 spritesheet 中自动切分并导出为透明 GIF：

```python
from PIL import Image

spritesheet = Image.open('spritesheet.png')
fw = spritesheet.width // 8
fh = spritesheet.height // 9

names = ['idle', 'waving', 'waiting', 'review']
row_frames = [0, 3, 6, 8]
num_frames = [6, 4, 6, 6]

for name, row, nf in zip(names, row_frames, num_frames):
    frames = []
    for col in range(nf):
        frame = spritesheet.crop((col*fw, row*fh, (col+1)*fw, (row+1)*fh))
        if frame.mode != 'RGBA':
            frame = frame.convert('RGBA')
        frames.append(frame.convert('RGB'))

    frames[0].save(
        f'{name}.gif',
        save_all=True,
        append_images=frames[1:],
        duration=[600]*nf,
        loop=0,
        disposal=2
    )
```

导出时必须保留透明通道（RGBA 模式），否则像素角色周围会出现难看的白边。

## 添加到网页

### 1. HTML 部分

在页面底部添加一个固定定位的容器：

```html
<div id="inni-companion">
  <img
    id="inni-sprite"
    src="/images/inni/idle.gif"
    alt="inni"
    style="cursor: grab; width: 80px;"
  />
</div>
```

### 2. CSS 样式

```css
.inni-companion {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  pointer-events: none;
}

.inni-sprite {
  width: 80px;
  height: auto;
  pointer-events: all;
  cursor: grab;
  image-rendering: pixelated;
}

.inni-sprite:active {
  cursor: grabbing;
}
```

### 3. JavaScript 交互逻辑

```javascript
const inni = document.getElementById('inni-companion');
const sprite = document.getElementById('inni-sprite');

const anims = {
  idle: '/images/inni/idle.gif',
  waving: '/images/inni/waving.gif',
  waiting: '/images/inni/waiting.gif',
  review: '/images/inni/review.gif',
};

let isDragging = false;
let currentX = window.innerWidth - 130;
let currentY = window.innerHeight - 160;
let idleTimer;

// 初始化位置
inni.style.cssText = `position:fixed;left:${currentX}px;top:${currentY}px;z-index:9999;`;

// 拖动逻辑
sprite.addEventListener('mousedown', (e) => {
  isDragging = true;
  sprite.src = anims.waving;
  clearTimeout(idleTimer);
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  currentX = e.clientX - sprite.offsetWidth / 2;
  currentY = e.clientY - sprite.offsetHeight / 2;
  inni.style.left = currentX + 'px';
  inni.style.top = currentY + 'px';
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  idleTimer = setTimeout(() => sprite.src = anims.idle, 3000);
});

// 滚动到底部 → review
window.addEventListener('scroll', () => {
  const atBottom = window.scrollY + window.innerHeight >= document.body.scrollHeight - 10;
  sprite.src = atBottom ? anims.review : anims.waiting;
});
```

## 动画切换规则

| 状态 | 触发条件 | 动画 |
|------|---------|------|
| `idle` | 默认 / 停止交互 3 秒后 | `idle.gif` |
| `waving` | 鼠标拖动 inni 时 | `waving.gif` |
| `waiting` | 页面滚动中（非底部） | `waiting.gif` |
| `review` | 滚动到页面最底部 | `review.gif` |

## 位置持久化（可选）

使用 sessionStorage 记住用户上次的位置：

```javascript
// 读取
const savedX = sessionStorage.getItem('inni-x');
const savedY = sessionStorage.getItem('inni-y');
if (savedX && savedY) {
  currentX = parseFloat(savedX);
  currentY = parseFloat(savedY);
}

// 保存
document.addEventListener('mouseup', () => {
  sessionStorage.setItem('inni-x', currentX);
  sessionStorage.setItem('inni-y', currentY);
});
```

## 注意事项

1. **GIF 透明背景**：导出时保留透明通道（RGBA 模式），不要加白色底
2. **Spritesheet 排列**：精灵图必须严格按照 8×9 网格排列
3. **帧尺寸**：每格尺寸 = 原图宽÷8 × 高÷9
4. **移动端适配**：将 `mousedown/mousemove/mouseup` 替换为 `touchstart/touchmove/touchend`
5. **z-index**：设为 9999 以上，避免被其他元素遮挡

## 相关文件

- 组件代码：`src/pages/index.astro`（底部 script 区块）
- 样式：`src/styles/global.css` 中的 `.inni-companion`、`.inni-sprite`
- 图片目录：`public/images/inni/`
