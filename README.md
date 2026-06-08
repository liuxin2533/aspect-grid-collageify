# aspect-grid-collageify

<p align="center">
  <a href="https://www.npmjs.com/package/aspect-grid-collageify"><img src="https://img.shields.io/npm/v/aspect-grid-collageify?style=flat-square&color=6366f1" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/aspect-grid-collageify"><img src="https://img.shields.io/npm/dm/aspect-grid-collageify?style=flat-square&color=0ea5e9" alt="npm downloads"></a>
  <a href="https://bundlephobia.com/package/aspect-grid-collageify"><img src="https://img.shields.io/bundlephobia/minzip/aspect-grid-collageify?style=flat-square&color=22c55e" alt="minzip size"></a>
  <img src="https://img.shields.io/badge/TypeScript-ready-3178c6?style=flat-square" alt="TypeScript ready">
  <img src="https://img.shields.io/badge/Canvas-powered-f97316?style=flat-square" alt="Canvas powered">
  <img src="https://img.shields.io/badge/sideEffects-false-8b5cf6?style=flat-square" alt="sideEffects false">
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/aspect-grid-collageify?style=flat-square&color=10b981" alt="license"></a>
</p>

[English](./README_EN.md) | 简体中文

`aspect-grid-collageify` 是一个轻量级、纯前端、基于 Canvas 的图片拼图工具库。它提供两层能力：

- `CollageCore`：无 UI 的拼图核心，负责状态、网格布局、碰撞检测、图片变更、最终渲染和导出。
- `CanvasCollageEditor`：基于 `CollageCore` 的可视化编辑器，负责 canvas 交互、选区、拖拽移动、拖拽插入、快捷键和编辑覆盖层。

Core 输出永远是干净的最终拼图；网格线、占位符、选中框、拖拽预览等编辑 UI 只属于 Editor，不会进入导出结果。

## ✨ 特性

- 🎨 纯前端 Canvas 渲染，无服务端依赖。
- 🖼️ 支持离屏导出 PNG / Blob。
- 📐 支持自定义容器比例、图片比例、网格列数、间距和内边距。
- ✨ 支持透明背景、图片圆角、阴影样式。
- 🧩 支持按网格插入、移动、缩放、交换、删除和替换图片。
- 🕹️ 支持可视化编辑：点击插槽上传、拖拽文件插入、拖拽移动、拖拽换位、多选、键盘操作。
- 🧠 TypeScript 类型完整导出。
- 📦 多入口导出，便于只使用 Core 或只引入 Editor。

## 📦 安装

```bash
npm install aspect-grid-collageify
```

```bash
pnpm add aspect-grid-collageify
```

```bash
yarn add aspect-grid-collageify
```

## 🚀 导入方式

推荐按能力入口导入：

```typescript
import { CollageCore } from "aspect-grid-collageify/core";
import { CanvasCollageEditor } from "aspect-grid-collageify/editor";
```

也可以从主入口导入：

```typescript
import { CollageCore, CanvasCollageEditor } from "aspect-grid-collageify";
```

| 入口 | 导出 | 说明 |
| --- | --- | --- |
| `aspect-grid-collageify` | `CollageCore`, `CanvasCollageEditor`, 全部公共类型 | 主入口。 |
| `aspect-grid-collageify/core` | `CollageCore` | 只使用离屏渲染和拼图核心能力时使用。 |
| `aspect-grid-collageify/editor` | `CanvasCollageEditor` | 需要 canvas 可视化编辑能力时使用。 |

## 🖼️ 快速开始：离屏生成拼图

```typescript
import { CollageCore } from "aspect-grid-collageify/core";

const core = new CollageCore({
  containerRatio: "3:4",
  imageRatio: "16:9",
  gridColumns: 8,
  padding2K: 60,
  gap2K: 24,
  background: {
    color: "#ffffff",
    transparent: false,
  },
  imageStyle: {
    borderRadius2K: 24,
    shadowBlur2K: 12,
    shadowOffset2K: 8,
    shadowOpacity: 0.2,
  },
  images: [
    {
      id: "image-1",
      src: "/images/a.jpg",
      name: "A",
      gridX: 0,
      gridY: 0,
      span: 4,
    },
    {
      id: "image-2",
      src: "/images/b.jpg",
      name: "B",
      gridX: 4,
      gridY: 0,
      span: 4,
    },
  ],
});

const dataUrl = await core.exportPNG(2048);
```

## 🎛️ 快速开始：可视化编辑器

```typescript
import { CollageCore } from "aspect-grid-collageify/core";
import { CanvasCollageEditor } from "aspect-grid-collageify/editor";

const canvas = document.querySelector("canvas")!;

const core = new CollageCore({
  containerRatio: "3:4",
  imageRatio: "16:9",
  gridColumns: 8,
  padding2K: 60,
  gap2K: 24,
  images: [],
});

const editor = new CanvasCollageEditor(canvas, core, {
  multiSelect: true,
  keyboard: true,
  dragMove: true,
  dragSwap: true,
  dragInsert: true,
  quickReplace: true,
});

editor.on("change", (images) => {
  console.log("images changed", images);
});

editor.on("cellclick", (placement) => {
  // 调用方可以打开文件选择器，然后调用 editor.insertFiles(files)。
  editor.setPendingInsertPlacement(placement);
});
```

也可以使用便捷构造：

```typescript
const editor = CanvasCollageEditor.create(canvas, options, editorOptions);
const core = editor.core;
```

## ⚙️ 配置示例

```typescript
const options = {
  containerRatio: "3:4",
  imageRatio: "16:9",
  gridColumns: 12,
  padding2K: 60,
  gap2K: 24,
  background: {
    color: "#ffffff",
    transparent: false,
  },
  imageStyle: {
    borderRadius2K: 24,
    shadowBlur2K: 12,
    shadowOffset2K: 8,
    shadowOpacity: 0.2,
  },
  placementPreset: "medium",
  images: [],
};
```

## 📚 API

### `CollageCore`

`CollageCore` 是拼图状态和最终渲染的核心。它不绑定 DOM 事件，不维护选区，不绘制编辑覆盖层。

#### 构造函数

| API | 位置 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- | --- |
| `new CollageCore(options)` | `aspect-grid-collageify/core` | `options: CollageOptions` | `CollageCore` | 创建一个拼图核心实例，并初始化配置和图片列表。 |

#### 状态 API

| API | 位置 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- | --- |
| `getOptions()` | `CollageCore` | 无 | `CollageOptions` | 获取当前拼图配置。 |
| `setOptions(options)` | `CollageCore` | `options: CollageOptions` | `void` | 替换完整配置，并触发变更事件。 |
| `updateOptions(options)` | `CollageCore` | `options: Partial<CollageOptions>` | `void` | 合并更新部分配置，并触发变更事件。 |
| `getImages()` | `CollageCore` | 无 | `CollageImage[]` | 获取当前图片列表。 |
| `setImages(images)` | `CollageCore` | `images: CollageImage[]` | `void` | 替换图片列表；会根据当前网格列数约束图片位置。 |
| `onChange(callback)` | `CollageCore` | `callback: (images: CollageImage[], options: CollageOptions) => void` | `Unsubscribe` | 监听配置或图片变化。返回取消监听函数。 |
| `destroy()` | `CollageCore` | 无 | `void` | 清理监听器和图片缓存。 |

#### 几何 API

| API | 位置 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- | --- |
| `getLayout(width, height)` | `CollageCore` | `width: number`, `height: number` | `CollageLayout` | 根据视口尺寸和当前配置计算布局。 |
| `toGridPoint(point, viewport)` | `CollageCore` | `point: GridPoint`, `viewport: DrawViewport` | `GridPoint` | 将 canvas 坐标转换为网格坐标。 |
| `getImageRect(imageOrId, layout)` | `CollageCore` | `imageOrId: CollageImage \| string`, `layout: CollageLayout` | `ImageRect \| null` | 获取指定图片在 canvas 中的矩形区域。 |
| `hitTest(point, viewport)` | `CollageCore` | `point: GridPoint`, `viewport: DrawViewport` | `CollageImage \| null` | 根据 canvas 坐标命中图片。 |
| `getPlacementSpan(preset?)` | `CollageCore` | `preset?: PlacementPreset` | `number` | 根据当前网格列数和预设计算插入图片的 span。 |
| `findSlots(options)` | `CollageCore` | `options: FindSlotsOptions` | `GridPlacement[]` | 查找当前布局中可放置图片的空插槽。 |
| `findFirstSlot(options)` | `CollageCore` | `options: FindSlotsOptions` | `GridPlacement \| null` | 查找第一个可用空插槽。 |
| `canPlace(placement, gridRows, ignoreIds?)` | `CollageCore` | `placement: GridPlacement`, `gridRows: number`, `ignoreIds?: string[]` | `boolean` | 判断指定位置是否可放置图片，可忽略指定图片 id。 |

#### 图片与布局 API

| API | 位置 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- | --- |
| `insertImage(image)` | `CollageCore` | `image: CollageImage` | `CollageImage` | 插入完整图片对象。调用方负责提供 id、src、gridX、gridY 和 span。 |
| `insertImageAt(input, placement)` | `CollageCore` | `input: ImageInput`, `placement: GridPlacement` | `CollageImage` | 根据图片输入和明确位置创建并插入图片。 |
| `insertImages(inputs, options)` | `CollageCore` | `inputs: ImageInput[]`, `options: InsertImagesOptions` | `CollageImage[]` | 批量插入图片，按空插槽自动排布。 |
| `updateImage(id, patch)` | `CollageCore` | `id: string`, `patch: Partial<CollageImage>` | `boolean` | 更新指定图片。成功返回 `true`。 |
| `removeImage(id)` | `CollageCore` | `id: string` | `boolean` | 删除单张图片。成功返回 `true`。 |
| `removeImages(ids)` | `CollageCore` | `ids: string[]` | `boolean` | 批量删除图片。成功返回 `true`。 |
| `replaceImage(id, input)` | `CollageCore` | `id: string`, `input: ImageInput` | `boolean` | 替换指定图片的 src、name 和样式。 |
| `moveImage(id, target, gridRows)` | `CollageCore` | `id: string`, `target: GridPoint`, `gridRows: number` | `boolean` | 将单张图片移动到指定网格坐标。 |
| `moveImages(ids, delta, gridRows)` | `CollageCore` | `ids: string[]`, `delta: GridPoint`, `gridRows: number` | `boolean` | 按网格偏移量批量移动图片。 |
| `moveImagesByDirection(ids, direction, gridRows)` | `CollageCore` | `ids: string[]`, `direction: MoveDirection`, `gridRows: number` | `boolean` | 按方向批量移动图片。 |
| `resizeImage(id, delta, gridRows)` | `CollageCore` | `id: string`, `delta: number`, `gridRows: number` | `boolean` | 调整单张图片 span。 |
| `resizeImages(ids, delta, gridRows)` | `CollageCore` | `ids: string[]`, `delta: number`, `gridRows: number` | `boolean` | 批量调整图片 span。 |
| `swapImages(sourceId, targetId)` | `CollageCore` | `sourceId: string`, `targetId: string` | `boolean` | 交换两张图片的位置和 span。 |
| `pushBelow(id, rows, gridRows)` | `CollageCore` | `id: string`, `rows: number`, `gridRows: number` | `boolean` | 将指定图片下方的图片整体向下推。 |
| `pullBelow(id, rows?)` | `CollageCore` | `id: string`, `rows?: number` | `boolean` | 将指定图片下方的图片整体向上拉。 |

#### 渲染与导出 API

| API | 位置 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- | --- |
| `draw(ctx, viewport)` | `CollageCore` | `ctx: CanvasRenderingContext2D`, `viewport: DrawViewport` | `void` | 在指定 canvas 上绘制最终拼图。 |
| `renderToCanvas(width?)` | `CollageCore` | `width?: number` | `Promise<HTMLCanvasElement>` | 离屏渲染并返回 canvas。高度由容器比例自动计算。 |
| `exportPNG(width?)` | `CollageCore` | `width?: number` | `Promise<string>` | 导出 PNG Data URL。 |
| `exportBlob(width?, type?, quality?)` | `CollageCore` | `width?: number`, `type?: string`, `quality?: number` | `Promise<Blob>` | 导出 Blob。支持 PNG、JPEG、WebP 等 canvas 支持的类型。 |
| `getImageLoader()` | `CollageCore` | 无 | `ImageLoader` | 获取内部图片加载器。通常仅高级场景使用。 |

### `CanvasCollageEditor`

`CanvasCollageEditor` 是 canvas 可视化编辑引擎。它通过 `core` 读写拼图状态，并额外维护选区、活动图片、拖拽状态和编辑覆盖层。

#### 构造函数

| API | 位置 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- | --- |
| `new CanvasCollageEditor(canvas, core, options?)` | `aspect-grid-collageify/editor` | `canvas: HTMLCanvasElement`, `core: CollageCore`, `options?: CanvasCollageEditorOptions` | `CanvasCollageEditor` | 基于已有 Core 创建可视化编辑器。 |
| `CanvasCollageEditor.create(canvas, options, editorOptions?)` | `CanvasCollageEditor` | `canvas: HTMLCanvasElement`, `options: CollageOptions`, `editorOptions?: CanvasCollageEditorOptions` | `CanvasCollageEditor` | 便捷构造：内部创建 `CollageCore` 并返回 editor。 |

#### 基础 API

| API | 位置 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- | --- |
| `core` | `CanvasCollageEditor` | 无 | `CollageCore` | 底层 Core 实例。 |
| `getCore()` | `CanvasCollageEditor` | 无 | `CollageCore` | 获取底层 Core 实例。 |
| `render()` | `CanvasCollageEditor` | 无 | `void` | 重绘最终拼图和编辑覆盖层。 |
| `resize()` | `CanvasCollageEditor` | 无 | `void` | 根据 canvas 当前尺寸重新渲染。 |
| `destroy()` | `CanvasCollageEditor` | 无 | `void` | 移除事件监听并释放由 editor 创建的 Object URL。 |

#### 选区 API

| API | 位置 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- | --- |
| `getSelection()` | `CanvasCollageEditor` | 无 | `string[]` | 获取当前选中的图片 id 列表。 |
| `setSelection(ids)` | `CanvasCollageEditor` | `ids: string[]` | `void` | 设置选区。无效 id 会被忽略。 |
| `getActiveId()` | `CanvasCollageEditor` | 无 | `string \| null` | 获取当前活动图片 id。 |
| `setActiveId(id)` | `CanvasCollageEditor` | `id: string \| null` | `void` | 设置当前活动图片，并同步选区。 |
| `clearSelection()` | `CanvasCollageEditor` | 无 | `void` | 清空选区和活动图片。 |

#### 输入与文件 API

| API | 位置 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- | --- |
| `handleKeyDown(event)` | `CanvasCollageEditor` | `event: KeyboardEvent` | `boolean` | 处理删除、方向移动、快捷缩放等键盘操作。 |
| `insertFiles(files, options?)` | `CanvasCollageEditor` | `files: FileList \| File[]`, `options?: Partial<InsertImagesOptions>` | `Promise<CollageImage[]>` | 解析并插入文件。若存在 pending placement，则优先插入该位置。 |
| `insertFilesAt(files, point)` | `CanvasCollageEditor` | `files: FileList \| File[]`, `point: GridPoint` | `Promise<CollageImage[]>` | 按 canvas 坐标插入文件；优先命中空插槽，否则回退到网格落点。 |
| `replaceActiveFile(file)` | `CanvasCollageEditor` | `file: File` | `Promise<boolean>` | 用文件替换当前活动图片。 |
| `replaceFile(id, file)` | `CanvasCollageEditor` | `id: string`, `file: File` | `Promise<boolean>` | 用文件替换指定图片。 |
| `setPendingInsertPlacement(placement)` | `CanvasCollageEditor` | `placement: GridPlacement \| null` | `void` | 设置下一次 `insertFiles()` 优先使用的插入位置。 |

#### 事件 API

| API | 位置 | 参数 | 返回值 | 描述 |
| --- | --- | --- | --- | --- |
| `on("change", callback)` | `CanvasCollageEditor` | `callback: (images: CollageImage[]) => void` | `Unsubscribe` | Core 变化并完成 editor 重绘后触发。 |
| `on("selectionchange", callback)` | `CanvasCollageEditor` | `callback: (ids: string[]) => void` | `Unsubscribe` | 选区变化时触发。 |
| `on("activechange", callback)` | `CanvasCollageEditor` | `callback: (id: string \| null) => void` | `Unsubscribe` | 活动图片变化时触发。 |
| `on("cellclick", callback)` | `CanvasCollageEditor` | `callback: (placement: GridPlacement) => void` | `Unsubscribe` | 点击空插槽时触发。 |
| `on("replacerequest", callback)` | `CanvasCollageEditor` | `callback: (id: string) => void` | `Unsubscribe` | 双击图片请求替换时触发。 |
| `on("error", callback)` | `CanvasCollageEditor` | `callback: (error: unknown) => void` | `Unsubscribe` | 文件解析、拖拽插入等异步错误发生时触发。 |

### 类型 API

#### 基础类型

| 类型 | 位置 | 字段 / 参数 | 描述 |
| --- | --- | --- | --- |
| `RatioOption` | `aspect-grid-collageify` | `"1:1" \| "3:4" \| "4:3" \| "16:9" \| "9:16" \| "custom" \| string` | 比例配置。普通字符串应为 `w:h` 格式。 |
| `PlacementPreset` | `aspect-grid-collageify` | `"small" \| "medium" \| "large"` | 自动插入图片时使用的尺寸预设。 |
| `MoveDirection` | `aspect-grid-collageify` | `"up" \| "down" \| "left" \| "right"` | 方向移动枚举。 |
| `GridPoint` | `aspect-grid-collageify` | `{ x: number; y: number }` | 网格点或 canvas 点。语义由 API 参数决定。 |
| `GridPlacement` | `aspect-grid-collageify` | `{ gridX: number; gridY: number; span: number }` | 图片在网格中的位置和尺寸。 |
| `ViewportSize` | `aspect-grid-collageify` | `{ width: number; height: number }` | 视口尺寸。 |
| `DrawViewport` | `aspect-grid-collageify` | `{ width: number; height: number }` | 绘制视口尺寸。 |
| `Unsubscribe` | `aspect-grid-collageify` | `() => void` | 取消监听函数。 |

#### 配置与图片类型

| 类型 | 位置 | 字段 / 参数 | 描述 |
| --- | --- | --- | --- |
| `ImageStyleOptions` | `aspect-grid-collageify` | `borderRadius2K?: number`, `shadowBlur2K?: number`, `shadowOffset2K?: number`, `shadowOpacity?: number` | 图片样式配置。数值以 2K 画布为基准缩放。 |
| `CollageImage` | `aspect-grid-collageify` | `id: string`, `src: string`, `name: string`, `gridX: number`, `gridY: number`, `span: number`, `ImageStyleOptions` | 拼图中的图片模型。 |
| `ImageInput` | `aspect-grid-collageify` | `id?: string`, `src: string`, `name?: string`, `style?: ImageStyleOptions` | 插入或替换图片时的输入模型。 |
| `CollageOptions` | `aspect-grid-collageify` | `containerRatio`, `imageRatio`, `gridColumns`, `padding2K`, `gap2K`, `background?`, `imageStyle?`, `images?`, `placementPreset?` | 拼图核心配置。 |

#### 布局与操作类型

| 类型 | 位置 | 字段 / 参数 | 描述 |
| --- | --- | --- | --- |
| `CollageLayout` | `aspect-grid-collageify` | `scale`, `padding`, `gap`, `cellW`, `cellH`, `gridRows`, `offsetX`, `offsetY`, `gridW`, `gridH`, `containerRatioVal`, `imageRatioVal` | 根据配置和视口计算出的布局数据。 |
| `ImageRect` | `aspect-grid-collageify` | `{ x: number; y: number; w: number; h: number }` | 图片在 canvas 中的矩形区域。 |
| `FindSlotsOptions` | `aspect-grid-collageify` | `{ span: number; gridRows: number }` | 查找空插槽的参数。 |
| `InsertImagesOptions` | `aspect-grid-collageify` | `{ span?: number; placementPreset?: PlacementPreset; gridRows: number }` | 批量插入图片的参数。 |
| `CanvasCollageEditorOptions` | `aspect-grid-collageify/editor` | `multiSelect?`, `keyboard?`, `dragMove?`, `dragSwap?`, `dragInsert?`, `quickReplace?`, `preventDefaultFileDrop?`, `fileResolver?`, `overlay?` | Editor 交互配置。 |
| `EditorOverlayOptions` | `aspect-grid-collageify` | `showBoundary?`, `showGridlines?`, `showSlots?`, `slotText?` | Editor 覆盖层显示配置。 |

## 🛠️ 本地开发

```bash
pnpm install
pnpm dev
```

打开 demo 页面后可以测试 canvas 可视化编辑能力。

构建发布产物：

```bash
pnpm build
```

当前构建会输出 ESM、CommonJS 和类型声明，并支持以下包入口：

```text
aspect-grid-collageify
aspect-grid-collageify/core
aspect-grid-collageify/editor
```

## 🗂️ 目录结构

```text
src/
  core.ts           # CollageCore：状态、几何、布局变更、最终渲染和导出
  editor.ts         # CanvasCollageEditor：canvas 可视化编辑能力
  editor-render.ts  # 编辑覆盖层渲染
  image-loader.ts   # 图片加载和缓存
  layout.ts         # 纯几何、网格、碰撞、空位查找
  render.ts         # 最终拼图渲染
  types.ts          # 公共类型
  index.ts          # 主导出入口
```

## 📄 协议

本项目使用 [MIT License](./LICENSE)。

Copyright (c) 2026 liuxin2533