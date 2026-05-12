# Inni Companion 组件说明

## 功能概述

Inni Companion 是一只可拖动、可交互的 AI 助手小精灵，默认显示在页面右下角。支持 4 种动画状态：待机、挥手、等待、回顾。

## 目录结构

```
public/images/inni/
├── idle.gif      # 待机动画（默认）
├── waving.gif    # 挥手动画（拖动时触发）
├── waiting.gif   # 等待动画（滚动时触发）
├── review.gif    # 回顾动画（滚动到底部时触发）
├── inni-logo.svg # 网站 logo
├── logo-文字.svg  # 花体文字 logo
└── swrited.png   # swrited 头像
```

> **帧数要求**：每个动作从同一张 spritesheet 中切分，排列方式为 **8列 × 9行**，每行动画数不同：
> - `idle` → 第 0 行，6 帧
> - `waving` → 第 3 行，4 帧
> - `waiting` → 第 6 行，6 帧
> - `review` → 第 8 行，6 帧

## 添加到网页

### 1. HTML 部分

在页面中添加一个固定定位的容器：

```html
<div id="inni-companion">
  <img
    id="inni-sprite"
    src="/images/inni/idle.gif"
    alt="inni"
    style="cursor: grab; width: 80px; height: auto;"
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
  transition: right 0.1s ease, bottom 0.1s ease;
}

.inni-sprite {
  width: 80px;
  height: auto;
  pointer-events: all;
  cursor: grab;
  image-rendering: -webkit-optimize-contrast;
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
  sprite.src = anims.waving; // 切换到挥手动画
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
  sprite.src = anims.idle;
  idleTimer = setTimeout(() => sprite.src = anims.idle, 3000);
});

// 滚动到底部 → review
window.addEventListener('scroll', () => {
  const scrolled = window.scrollY + window.innerHeight;
  if (scrolled >= document.body.scrollHeight - 10) {
    sprite.src = anims.review;
  } else {
    sprite.src = anims.waiting;
  }
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
// 保存位置
sessionStorage.setItem('inni-x', currentX);
sessionStorage.setItem('inni-y', currentY);

// 读取位置
const savedX = sessionStorage.getItem('inni-x');
const savedY = sessionStorage.getItem('inni-y');
if (savedX && savedY) {
  currentX = parseFloat(savedX);
  currentY = parseFloat(savedY);
}
```

## 注意事项

1. **GIF 透明背景**：确保导出时保留透明通道（RGBA 模式），不要加白色底
2. **Spritesheet 排列**：精灵图必须严格按照 8×9 网格排列，每行动画帧数不同
3. **帧尺寸**：每格尺寸 = 原图宽÷8 × 高÷9，帧数少的动作占同一行的连续列
4. **移动端适配**：如需支持触屏拖动，将 `mousedown/mousemove/mouseup` 替换为 `touchstart/touchmove/touchend`
5. **z-index**：确保 inni 的层级足够高（9999），不会被其他元素遮挡

## 相关文件

- 组件代码：`src/pages/index.astro`（底部 `<script>` 区块）
- 样式：`src/styles/global.css` 中的 `.inni-companion`、`.inni-sprite`
- 图片目录：`public/images/inni/`