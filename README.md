# aspect-grid-collageify

<p align="center">
  <a href="https://www.npmjs.com/package/aspect-grid-collageify">
    <img src="https://img.shields.io/npm/v/aspect-grid-collageify.svg?style=flat-square&color=6366f1" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/aspect-grid-collageify">
    <img src="https://img.shields.io/bundlephobia/min/aspect-grid-collageify?style=flat-square&color=indigo" alt="bundle size">
  </a>
  <a href="https://www.npmjs.com/package/aspect-grid-collageify">
    <img src="https://img.shields.io/npm/dm/aspect-grid-collageify.svg?style=flat-square&color=pink" alt="downloads">
  </a>
  <a href="file:///d:/Documents/Superme/npm/aspect-collageify/LICENSE">
    <img src="https://img.shields.io/npm/l/aspect-grid-collageify.svg?style=flat-square&color=emerald" alt="license">
  </a>
</p>

一款轻量级、高性能的纯前端 HTML5 Canvas 等比智能网格拼图引擎。支持可视化交互编辑与后台离屏无损渲染，所有图片在排版中均严格保持比例锁定。

[English](./README_EN.md) | 简体中文

---

## ✨ 特性

- 📐 **比例锁定**: 严格维持容器宽高比与单个图片格子比例，拉伸和缩放时绝不产生变形。
- 🎮 **可视化编辑器**: 支持拖拽自动吸附排版、选中高亮、悬停占位提示与实时画布重绘。
- 🎨 **单图美化调节**: 支持对**每一张图片单独调节**圆角半径、阴影模糊、阴影偏移及透明度，并拥有优雅的全局配置回退机制。
- ⚙️ **离屏渲染器**: 在后台静默渲染导出无辅助线和编辑高亮的超高分辨率 PNG 图像，完全脱离 DOM。
- 🛡️ **防碰撞与越界保护**: 内置几何数学网格算法，确保图片在缩放、移动时互不重叠且不越界。
- ↕️ **智能推拉排版**: 一键对目标图片下方的所有行进行整体下推或上拉，自动重整空白间隙。
- 📦 **零外部依赖**: 极小体积包（约 32KB IIFE），无任何第三方依赖，加载迅速。

---

## 📦 安装

```bash
npm install aspect-grid-collageify
# 或
pnpm add aspect-grid-collageify
# 或
yarn add aspect-grid-collageify
```

---

## ⚡ 快速上手

### 1. 离屏无痕渲染（Headless 模式）

在后台静默生成拼图的 PNG 图像：

```typescript
import { AspectGridCollageify } from "aspect-grid-collageify";

async function makeCollage() {
  const engine = new AspectGridCollageify({
    containerRatio: "3:4",
    imageRatio: "16:9",
    gridColumns: 8,
    padding2K: 60,
    gap2K: 24,
    containerBgColor: "#ffffff",
    images: [
      { id: "img-1", src: "https://example.com/beach.jpg", name: "Beach", gridX: 0, gridY: 0, span: 4 },
      { 
        id: "img-2", 
        src: "https://example.com/mountain.jpg", 
        name: "Mountain", 
        gridX: 4, 
        gridY: 0, 
        span: 4,
        borderRadius2K: 48, // 仅单独覆盖此图片的圆角半径
        shadowBlur2K: 30,   // 仅单独为此图片定制阴影模糊值
      },
      { id: "img-3", src: "https://example.com/forest.jpg", name: "Forest", gridX: 2, gridY: 4, span: 4 },
    ],
  });

  // 导出 2K 高清 PNG Base64 (宽度: 2048px, 高度: 2730px)
  const base64Png = await engine.exportPNG(2048);
  console.log("生成的拼图 Base64 编码:", base64Png);
}
```

### 2. 可视化编辑器（Visual 交互模式）

在原生 HTML 或前端框架组件中绑定一个 `<canvas>` 进行实时可视化编辑：

```html
<canvas id="collage-canvas" style="width: 100%; height: 100%;"></canvas>

<script type="module">
  import { AspectGridCollageify } from 'aspect-grid-collageify';

  const canvas = document.getElementById("collage-canvas");
  const engine = new AspectGridCollageify({
    containerRatio: "3:4",
    imageRatio: "16:9",
    gridColumns: 8,
    padding2K: 60,
    gap2K: 24,
    imageBorderRadius2K: 24, // 全局默认圆角半径
    images: []
  }, canvas);

  // 订阅图片数组变更
  engine.onImagesChanged((images) => {
    console.log("图片排版更新:", images);
  });

  // 订阅选中状态变更
  engine.onActiveImageChanged((activeId) => {
    console.log("当前选中图片 ID:", activeId);
  });

  // 订阅空白网格点击事件
  engine.onCellClicked((x, y) => {
    console.log("点击了空白网格的坐标:", x, y);
  });

  // 初始绘制
  engine.render();
</script>
```

---

## 📖 API 接口说明

### 1. 配置项选项 (`CollageConfig`)

在构造函数中传入，用于初始化拼图引擎状态：

| 配置属性 | 类型 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- |
| `containerRatio` | `string` | `"3:4"` | 画布的整体宽高比：`"1:1"`, `"3:4"`, `"4:3"`, `"16:9"`, `"9:16"` 或 `"custom"`（自定义）。 |
| `customContainerW` | `number` | - | 自定义画布宽比例值（在 `containerRatio` 为 `"custom"` 时必填）。 |
| `customContainerH` | `number` | - | 自定义画布高比例值（在 `containerRatio` 为 `"custom"` 时必填）。 |
| `imageRatio` | `string` | `"16:9"` | 单张图片格子的默认宽高比：`"1:1"`, `"4:3"`, `"16:9"` 或 `"custom"`。 |
| `customImageW` | `number` | - | 自定义单图格子宽比例值（在 `imageRatio` 为 `"custom"` 时必填）。 |
| `customImageH` | `number` | - | 自定义单图格子高比例值（在 `imageRatio` 为 `"custom"` 时必填）。 |
| `gridColumns` | `number` | `8` | 网格列密度数（可设置范围为 `4` 至 `48` 之间的双数）。 |
| `padding2K` | `number` | `60` | 拼图外边缘内边距（以 2K 物理宽度为基准按比例缩放，单位像素）。 |
| `gap2K` | `number` | `24` | 拼图格子之间的间距（以 2K 物理宽度为基准按比例缩放，单位像素）。 |
| `containerBgColor` | `string` | `"#ffffff"` | 画布背景颜色。 |
| `useTransparentBg` | `boolean` | `false` | 是否启用透明通道。为 `true` 时，导出 PNG 会保留透明背景。 |
| `images` | `PlacedImage[]` | `[]` | 初始载入排版的图片块数组。 |
| `showGridlines` | `boolean` | `true` | 是否在可视化编辑模式下显示虚线辅助网格线。 |
| `placementSize` | `string` | `"medium"` | 默认的空白格大小：`"small"`, `"medium"`, `"large"`。 |
| `imageBorderRadius2K`| `number` | `24` | 全局的图片卡片圆角半径（以 2K 为基准缩放）。 |
| `imageShadowBlur2K`  | `number` | `0` | 全局的图片卡片阴影模糊半径（以 2K 为基准缩放）。 |
| `imageShadowOffset2K`| `number` | `0` | 全局的图片卡片阴影位移大小（以 2K 为基准缩放）。 |
| `imageShadowOpacity` | `number` | `0.2` | 全局的图片卡片阴影不透明度（0 到 1）。 |

---

### 2. 已放置图片结构 (`PlacedImage`)

代表每一个已放置到网格中的图片卡片节点对象：

```typescript
export interface PlacedImage {
  id: string;              // 节点的唯一 ID
  src: string;             // 图片的访问链接/Base64/ObjectURL
  name: string;            // 文件名/描述标签
  gridX: number;           // 网格列起始索引（从 0 开始）
  gridY: number;           // 网格行起始索引（从 0 开始）
  span: number;            // 图片块在网格中所占用的横跨大小（正方形 span * span）
  
  // 可选：单张图片个体的外观配置覆写（覆盖全局 defaults）
  borderRadius2K?: number; // 覆写全局的 imageBorderRadius2K 圆角设置
  shadowBlur2K?: number;   // 覆写全局的 imageShadowBlur2K 阴影模糊设置
  shadowOffset2K?: number; // 覆写全局的 imageShadowOffset2K 阴影偏移设置
  shadowOpacity?: number;  // 覆写全局的 imageShadowOpacity 阴影透明度设置
}
```

---

### 3. 类方法 (`AspectGridCollageify`)

#### 🎨 视觉渲染与配置更新

- **`render(drawUI: boolean = true)`**: 触发 Canvas 画布渲染绘制。传入 `false` 时将渲染不带任何辅助虚线、选中边框的干净视图。

- **`updateConfig(config: Partial<CollageConfig>)`**: 动态更新配置参数，并自动重绘画布。
- **`getConfig(): CollageConfig`**: 获取当前生效的全部配置参数。

#### 📂 图片管理 API

- **`getImages(): PlacedImage[]`**: 获取当前画布中放置的所有图片节点数组。

- **`setImages(images: PlacedImage[])`**: 替换画布中的所有图片，并自动触发计算排版。
- **`addImage(img: PlacedImage)`**: 添加一张图片至拼图网格并默认激活选中它。
- **`removeImage(imgId: string)`**: 通过 ID 移出某张已放置的图片。
- **`updateImage(imgId: string, updates: Partial<PlacedImage>)`**: 动态更新目标图片的专属属性（如位置坐标、格跨大小，或单独覆写其圆角/阴影等样式），并立即调度 Canvas 画布重绘。

#### 🕹️ 坐标微调与排列对齐

- **`modifyImageSpan(imgId: string, delta: number, gridRows: number): boolean`**: 缩放目标图片的网格占比大小 (+1/-1)。如果计算防撞和出界检测成功则返回 `true`。

- **`stepImagePosition(imgId: string, dir: "up" | "down" | "left" | "right", gridRows: number): boolean`**: 使目标图片在网格坐标系中向指定方向平移 1 个单位。
- **`pushDownBelow(imgId: string, gridRows: number): boolean`**: 将当前选定图片底边以下的所有其他图片卡片，整体下推 1 个网格单位。
- **`pullUpBelow(imgId: string): boolean`**: 如果空间允许，将当前选定图片底边以下的所有图片卡片，整体上拉 1 个网格单位以消除空白行隙。

#### ⚡ 交互事件订阅

- **`onImagesChanged(callback: (images: PlacedImage[]) => void)`**: 当画布内图片发生增加、删除、位移、缩放或美化属性调整时触发。

- **`onActiveImageChanged(callback: (id: string | null) => void)`**: 当选中的图片节点发生改变时触发（传入 null 代表取消选中）。
- **`onCellClicked(callback: (x: number, y: number) => void)`**: 当点击空白辅助格子时触发，返回点击的网格坐标 $(X, Y)$。

#### 💾 离屏无损导出

- **`exportPNG(targetWidth: number = 2048): Promise<string>`**: 异步预加载所有拼图图片，自动创建一个独立的超高分辨率后台离屏 Canvas，绘制无辅助线的洁净画面，并 resolve 返回 PNG DataURL (Base64) 字符串。

---

## 📐 几何网格对齐与缩放数学

拼图的位置与尺寸转换由网格几何数学公式严格驱动，将离散的网格坐标转换为实际物理像素点：

1. **基准缩放比计算**：
   $$\text{scale} = \frac{\text{width}}{2048}$$
   该公式保证了在 2K 物理宽度基准下定义的 `padding`, `gap`, `radius`, `shadow` 等参数，在导出 4K 高清大图时能够得到同比的高清拉伸。
2. **格子物理像素尺寸换算**：
   $$\text{cellW} = \frac{\text{width} - 2 \cdot \text{padding} - (\text{gridColumns} - 1) \cdot \text{gap}}{\text{gridColumns}}$$
   $$\text{cellH} = \frac{\text{cellW} + \text{gap}}{\text{imageRatioVal}} - \text{gap}$$
3. **碰撞相交判断方程**：
   $$\text{Collision} = \neg (X_{1} + S_{1} \le X_{2} \lor X_{2} + S_{2} \le X_{1} \lor Y_{1} + S_{1} \le Y_{2} \lor Y_{2} + S_{2} \le Y_{1})$$

---

## 🛠️ 本地运行与开发调试

1. **编译打包构建库文件**：

   ```bash
   pnpm install
   pnpm build
   ```

2. **启动本地开发调试服务器 (Vite Dev Server)**：

   ```bash
   pnpm dev
   ```

   在浏览器中打开 `http://localhost:5173/`。修改 `./src/index.ts` 将会立即热重载刷新浏览器内的画布效果。
3. **静态文件本地预览 (免跨域 Offline 模式)**：
   你也可以直接双击 `index.html` 离线运行。双协议加载器会自动判定 `file://` 协议并动态注入打包好的 `./dist/index.global.js` UMD 库文件，无需本地 HTTP 代理即可预览调试全部功能，防止浏览器产生文件跨域拦截报错。

---

## 📄 开源许可证

MIT
