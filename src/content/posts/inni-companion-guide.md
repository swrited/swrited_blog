---
title: '将 Codex 宠物搬上博客'
summary: '记录如何将 Codex 生成的 AI 伴侣 inni 从桌面搬到网页，通过 GIF 动画实现可拖动、可交互的网页陪伴组件，以及 spritesheet 的处理方法。'
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

## 背景

Inni 是 swrited 和 inni 博客的 AI 伴侣，原本运行在桌面端（Electron + Live2D）。为了在网页上也能看到她，我们用 Codex 生成了像素风格的 spritesheet，并通过 GIF 动画实现了轻量的网页版陪伴效果。

## 像素精灵图结构

精灵图由 Codex 生成，排列方式为 **8列 × 9行**，共支持 4 个动作：

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
fw = spritesheet.width // 8   # 列数
fh = spritesheet.height // 9   # 行数

names = ['idle', 'waving', 'waiting', 'review']
row_frames = [0, 3, 6, 8]   # 每动作所在行
num_frames = [6, 4, 6, 6]  # 每动作帧数

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

导出时保留透明通道（RGBA 模式），不要加白色底，否则网页上会出现难看的白边。

## 网页端集成

### HTML

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

### CSS

```css
.inni-companion {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
}
.inni-sprite {
  pointer-events: all;
  cursor: grab;
  image-rendering: pixelated;
}
.inni-sprite:active { cursor: grabbing; }
```

### JavaScript 交互

```javascript
const anims = {
  idle: '/images/inni/idle.gif',
  waving: '/images/inni/waving.gif',
  waiting: '/images/inni/waiting.gif',
  review: '/images/inni/review.gif',
};

let isDragging = false;

sprite.addEventListener('mousedown', (e) => {
  isDragging = true;
  sprite.src = anims.waving;
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  inni.style.left = (e.clientX - 40) + 'px';
  inni.style.top = (e.clientY - 40) + 'px';
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  sprite.src = anims.idle;
});

window.addEventListener('scroll', () => {
  const atBottom = window.scrollY + window.innerHeight >= document.body.scrollHeight - 10;
  sprite.src = atBottom ? anims.review : anims.waiting;
});
```

## 动画触发规则

| 状态 | 触发条件 |
|------|---------|
| `idle` | 默认状态，停止交互 3 秒后恢复 |
| `waving` | 鼠标拖动 inni 时 |
| `waiting` | 页面滚动中（非底部） |
| `review` | 滚动到页面最底部 |

## 注意事项

1. **透明背景**：GIF 必须保留透明通道，否则像素角色周围会有白边
2. **Spritesheet 排列**：严格 8×9 网格，动作行连续排列
3. **帧尺寸**：确保切分时像素对齐，不要产生半像素模糊
4. **移动端**：将 `mousedown/mousemove/mouseup` 替换为 `touchstart/touchmove/touchend`
5. **z-index**：设为 9999 以上，避免被其他元素遮挡

## 相关文件

- 图片目录：`public/images/inni/`
- 组件代码：`src/pages/index.astro`
- 样式：`src/styles/global.css` 中的 `.inni-companion`
