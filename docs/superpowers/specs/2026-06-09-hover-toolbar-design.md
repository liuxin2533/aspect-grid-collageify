# Hover Toolbar for CanvasCollageEditor

**Date:** 2026-06-09
**Status:** Approved
**Target version:** 2.1.0

## 1. Background & Goals

`CanvasCollageEditor` 当前依赖键盘（方向键、Ctrl+方向键、Delete）和拖拽来操作已上传图片，对鼠标用户不够友好。希望增加一个**画布内悬浮工具栏**：当鼠标 hover 到某张已上传图片上时，在图片底部居中弹出一条包含位置信息和操作按钮的工具栏，让用户在不离开画布的情况下完成移动、缩放、删除和替换。

### Goals
- 鼠标 hover 到图片上时显示工具栏，移开时隐藏
- 提供 8 个动作：上/下/左/右移动、放大/缩小、删除、替换
- 与现有快捷键、拖拽、占位格、双击替换等行为共存不冲突
- 工具栏不进入最终 PNG/Blob 导出
- 允许通过 `EditorOverlayOptions` 关闭或配置位置
- 允许通过新事件 `toolbaraction` 监听并可选择性地阻止默认行为

### Non-goals
- 不做完全自定义的按钮列表（增减/换图标）
- 不做浮窗拖拽/钉住等复杂交互
- 不引入图标字体/SVG 资源；按钮用纯文本字符渲染
- 不修改 `CollageCore` 的状态机，只在 Editor 层叠加

## 2. Design Summary

工具栏整体由 `drawEditorOverlay` 中新增的 `drawHoverToolbar` 函数渲染。Editor 新增两个内部状态 `hoveredImageId` 和 `hoveredButtonId`，在现有的 `handleMouseMove` / `handleMouseDown` / `handleMouseLeave` 流程中维护，并通过 mousedown 命中检测触发动作。

所有动作最终调用 `CollageCore` 中已有的方法（`moveImagesByDirection`、`resizeImages`、`removeImages`）或 `editor` 已有的转发（`replaceFile`）。不引入新的核心方法。

## 3. API Changes

### 3.1 `EditorOverlayOptions` (extends existing, in `editor-render.ts`)

```ts
export interface EditorOverlayOptions {
  showBoundary?: boolean;
  showGridlines?: boolean;
  showSlots?: boolean;
  slotText?: string;

  // NEW
  showHoverToolbar?: boolean;     // default true
  toolbarPosition?: "bottom" | "top";  // default "bottom"
}
```

### 3.2 New event in `EditorEventMap` (in `editor.ts`)

```ts
type EditorEventMap = {
  // ... existing
  toolbaraction: (action: HoverToolbarAction, imageId: string) => void;
};
```

`CanvasCollageEditorOptions` 不新增字段（toolbar 始终是 hover 即出）。

### 3.3 New type in `types.ts`

```ts
export type HoverToolbarAction =
  | "up" | "down" | "left" | "right"
  | "shrink" | "expand"
  | "delete" | "replace";
```

### 3.4 Exported from `index.ts`

`HoverToolbarAction` 作为公共类型导出。

## 4. Behavior Specification

### 4.1 显示与隐藏

| 触发条件 | 行为 |
|---|---|
| 鼠标 hover 命中某张图片（hitTest 返回非 null） | `hoveredImageId` 设为该图片 id，工具栏显示 |
| 鼠标 hover 到该图片的工具栏矩形内部 | 维持 `hoveredImageId` 不变 |
| 鼠标移开图片矩形和工具栏矩形都不在的区域 | `hoveredImageId` 设为 null，工具栏隐藏 |
| 开始拖拽图片（`dragMove`） | 工具栏隐藏，拖拽期间不显示 |
| mouseleave canvas | `hoveredImageId` 设为 null |
| 配置 `showHoverToolbar: false` | 永不显示 |

### 4.2 工具栏位置与外观

- 默认位于图片底部下方 6px（CSS px）间隙
- 若图片底部 + 工具栏高度 + 6px 超过 canvas 高度，则翻折到图片顶部上方 6px
- 居中于图片水平方向
- 工具栏高度 ≈ 32px，按钮尺寸 24×24 px，圆角 8px
- 背景：`rgba(255,255,255,0.96)`，1px `rgba(148,163,184,0.4)` 边框
- 阴影：`0 8px 24px rgba(15,23,42,0.18)`
- 文字色：`#1e293b`，`12px sans-serif`，`font-weight: 600`
- Hover 按钮：`rgba(79,70,229,0.12)` 背景 + `#4f46e5` 文字
- Active 按钮：`rgba(79,70,229,0.2)` 背景
- 禁用按钮（如 `image.span === 1` 时 `−`）：`#cbd5e1` 文字，不响应 hover

### 4.3 按钮布局

从左到右，按钮间 4px 间距：
```
[↑] [↓] [←] [→] | [-] [+] | [×] [↻]
```

中间用 `|` 分隔符（仅视觉，垂直细线 `rgba(148,163,184,0.3)`）。

位置信息文本单独一行/独立展示：图片底部正下方 6px 是工具栏，位置信息以"col x · row y · span s"的形式附加在工具栏**上方 4px**（即图片与工具栏之间），居中显示，`#64748b` 颜色，`11px monospace`。

实际渲染顺序（从下到上）：图片 → 位置信息行 → 工具栏按钮行。当翻折到顶部时，位置信息跟随工具栏，但位于工具栏下方 4px。

### 4.4 命中检测

`drawHoverToolbar` 在渲染时构造并返回 `Map<HoverToolbarAction, Rect>`（屏幕坐标），存入实例字段 `toolbarButtons: Map<HoverToolbarAction, Rect> | null`。

`handleMouseMove` 流程增加：
```
if (drag) ...（保持原状，工具栏不显示）
else if (toolbarButtons) {
  检查 point 是否落在某个按钮矩形 → 更新 hoveredButtonId
  检查 point 是否落在图片矩形或任何按钮矩形内 → 维持 hoveredImageId
  否则 hoveredImageId = null
}
```

`handleMouseDown` 流程增加：
```
if (hoveredImageId && toolbarButtons) {
  检查点是否落在某个按钮矩形内
  → emit("toolbaraction", action, imageId)
  → 若未被 preventDefault：执行默认行为
  → return（不进入图片拖拽/选中逻辑）
}
```

### 4.5 默认动作实现

| Action | 默认行为 |
|---|---|
| `up` / `down` / `left` / `right` | `core.moveImagesByDirection([imageId], direction, currentGridRows)` |
| `shrink` / `expand` | `core.resizeImages([imageId], -1 / +1, currentGridRows)` |
| `delete` | `core.removeImages([imageId])` + 若 activeId 失效则 `clearSelection` |
| `replace` | `emit("replacerequest", imageId)`（与双击图片行为一致） |

执行后调用 `render()` 重绘。

### 4.6 工具栏事件与阻止默认

`emit("toolbaraction", action, imageId)` 允许消费者通过 `event.preventDefault?.()` 阻止默认行为。`editor.ts` 在执行前检查回调返回的最后一个值（约定用 `Symbol` 或简单 boolean 标志）。

简化实现：消费者**无法**阻止默认行为（不暴露 preventDefault）；可通过 `editor.on("toolbaraction", (action, id) => { /* 监听 */ })` 知晓发生了，但不干预。如果有自定义需求，用户可以直接调用 `core` 的方法并自己实现工具栏（通过 `showHoverToolbar: false` 关闭默认）。这避免了 API 复杂度。

> 决策：MVP 不提供 preventDefault，仅 emit 事件。文档说明可关闭默认工具栏并自渲染。

### 4.7 与现有交互的共存

| 现有行为 | 工具栏同时存在时的处理 |
|---|---|
| 键盘方向键 / Ctrl+方向键 / Delete | 保留，无改动 |
| 拖拽移动（dragMove） | 拖拽期间工具栏隐藏（drag 状态优先） |
| 双击替换（quickReplace） | 保留，工具栏的 `↻` 按钮行为一致 |
| 选中框（drawSelection） | 选中框继续显示，工具栏叠加在选中框外侧 |
| 占位格（drawSlots） | 占位格仍在空槽显示，工具栏在已有图片上，互不冲突 |

### 4.8 导出纯净性

`CollageCore.draw` / `renderToCanvas` / `exportPNG` / `exportBlob` 不调用 `drawEditorOverlay`，因此工具栏不进入导出。✅ 无需修改 core。

## 5. Component / Module Design

### 5.1 `src/editor-render.ts` 修改

新增：
```ts
export interface HoverToolbarButtonRect {
  action: HoverToolbarAction;
  x: number; y: number; w: number; h: number;
}

export interface DrawHoverToolbarResult {
  buttons: Map<HoverToolbarAction, HoverToolbarButtonRect>;
}

export function drawHoverToolbar(options: {
  ctx: CanvasRenderingContext2D;
  image: CollageImage;
  layout: CollageLayout;
  hoveredButtonId: HoverToolbarAction | null;
  position: "bottom" | "top";
}): DrawHoverToolbarResult;
```

`drawEditorOverlay` 在末尾追加：
```ts
if (options.overlay?.showHoverToolbar !== false && options.hoveredImageId) {
  // 查找 hovered image
  // 调用 drawHoverToolbar 并把 buttons map 传回 editor（通过 options 传出）
}
```

`DrawEditorOverlayOptions` 扩展：
```ts
hoveredImageId: string | null;
hoveredButtonId: HoverToolbarAction | null;
```

`drawEditorOverlay` 签名返回 `DrawEditorOverlayResult`，把 buttons map 传出。editor 在 render 后保存。

### 5.2 `src/editor.ts` 修改

- 新增 `private hoveredImageId: string | null = null;`
- 新增 `private hoveredButtonId: HoverToolbarAction | null = null;`
- 新增 `private toolbarButtons: Map<HoverToolbarAction, HoverToolbarButtonRect> | null = null;`
- `render()` 后保存 `this.toolbarButtons = result.buttons`
- `handleMouseMove` / `handleMouseDown` / `handleMouseLeave` 扩展
- 新增 `private runToolbarAction(action, imageId): void`
- `EditorEventMap` 增加 `toolbaraction`

### 5.3 `src/types.ts` 修改

新增 `HoverToolbarAction` 类型。

### 5.4 `src/index.ts` 修改

导出 `HoverToolbarAction` 类型。

## 6. Visual Reference (text mockup)

```
       ┌────────────────────────┐
       │                        │
       │     uploaded image     │
       │                        │
       │                        │
       └────────────────────────┘
            col 1 · row 1 · span 2       ← 位置信息行
       ┌──────────────────────────┐
       │  ↑  ↓  ←  → │ −  + │ × ↻  │  ← 工具栏
       └──────────────────────────┘
```

如果位置信息行 + 工具栏超过 canvas 底部：
```
       ┌──────────────────────────┐
       │  ↑  ↓  ←  → │ −  + │ × ↻  │  ← 工具栏（翻折到顶部）
       └──────────────────────────┘
            col 1 · row 1 · span 2       ← 位置信息行
       ┌────────────────────────┐
       │                        │
       │     uploaded image     │
       │                        │
       └────────────────────────┘
```

## 7. Edge Cases

| 场景 | 处理 |
|---|---|
| 图片 span = 1，`−` 按钮 | 渲染为禁用灰，命中检测返回 false |
| 图片 span = gridColumns，`+` 按钮 | 渲染为禁用灰 |
| 移动到边界导致 `canPlace` 失败 | 静默（与现有快捷键一致），调用 `render()` 即可 |
| canvas 高度不足以放下工具栏 | 仅渲染到能显示的部分，命中检测同步忽略溢出按钮 |
| 多张图片紧邻时 hover 切换 | `handleMouseMove` 中 hitTest 已按 z-order 返回最上层图片，无冲突 |
| 工具栏按钮被击中时是 mousedown 阶段 | mousedown 命中按钮后直接 return，不再走 `hitTest`/拖拽/选中逻辑；不调用 `event.preventDefault()` |

## 8. Testing Strategy

### 8.1 单元层面
- 把 `drawHoverToolbar` 设计为纯函数（输入 ctx + image + layout + state → 输出按钮 map）。可以在 node-canvas 跑（项目目前没有测试套件，暂不强制添加，但实现上保持纯函数特性以备未来测试）
- `runToolbarAction` 的逻辑相对简单（调用 core 方法），可手动验证

### 8.2 端到端 / 手动验证（`pnpm dev`）
1. 上传 2-3 张图片
2. hover 到某张图片上 → 工具栏出现，离开 → 消失
3. 点击各按钮 → 位置/尺寸/数量变化符合预期
4. resize 浏览器 → 工具栏跟随重新计算
5. 在画布边界附近的图片上 hover → 工具栏翻折到顶部
6. 拖拽图片 → 工具栏隐藏
7. 按方向键/Ctrl+方向键/Delete → 与工具栏共存
8. 双击图片 → 仍触发替换
9. 点击 `导出 PNG` → 下载的 PNG 不包含工具栏
10. 关闭工具栏（`overlay.showHoverToolbar: false`）→ 不显示

### 8.3 demo 增强
`index.html` 在 `editor.on(...)` 处增加：
```js
editor.on("toolbaraction", (action, id) => {
  console.log("[toolbar]", action, id);
});
```
便于用户看到事件触发。

## 9. Out of Scope (Future)

- 自定义按钮列表/图标
- 工具栏位置（左侧/右侧/悬浮卡片等）
- 钉住工具栏（鼠标离开图片后仍显示）
- 移动端触摸长按触发
- 国际化文案（按钮字符是通用符号，不需翻译）
