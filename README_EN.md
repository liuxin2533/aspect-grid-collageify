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

A lightweight, high-performance, pure-frontend HTML5 Canvas-based smart photo collage engine supporting visual interactive editing and headless offscreen rendering. All images maintain their locked aspect ratios dynamically.

English | [简体中文](./README.md)

---

## ✨ Features

- 📐 **Proportional Locking**: Rigid adherence to container aspect ratios and individual image aspect ratios during placement.
- 🎮 **Interactive Visual Editor**: Drag-and-drop snapping layout, selection highlighting, hover slot indicators, and live redrawing.
- 🎨 **Per-Image Visual Aesthetics**: Customize border radius, drop shadow blur, offsets, and opacity **individually per image**, with a clean rollback structure to global configurations.
- ⚙️ **Offscreen Headless Renderer**: Generate clean, high-resolution PNGs (Base64) silently in the background using identical layout algorithms, completely independent of the DOM.
- 🛡️ **Anti-Overlap Safeguards**: Built-in geometric grid math guarantees that images cannot overlap or exceed boundaries during movement or resizing.
- ↕️ **Smart Row Shifting**: Shift all rows below a specific image node downward or pull them up to reclaim empty vertical gaps in a single operation.
- 📦 **Zero Dependencies**: Ultra-compact bundled footprint (~32KB IIFE), extremely fast loading.

---

## 📦 Installation

```bash
npm install aspect-grid-collageify
# or
pnpm add aspect-grid-collageify
# or
yarn add aspect-grid-collageify
```

---

## ⚡ Quick Start

### 1. Offscreen Rendering (Headless Mode)

Generate a collage PNG silently in the background:

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
        borderRadius2K: 48, // Override global radius for this image
        shadowBlur2K: 30,   // Customize drop shadow for this image
      },
      { id: "img-3", src: "https://example.com/forest.jpg", name: "Forest", gridX: 2, gridY: 4, span: 4 },
    ],
  });

  // Export to 2K High-Res PNG Base64 (width: 2048px, height: 2730px)
  const base64Png = await engine.exportPNG(2048);
  console.log("Clean output Image Base64:", base64Png);
}
```

### 2. Interactive Editor (Visual Mode)

Bind an interactive canvas in vanilla HTML or framework components:

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
    imageBorderRadius2K: 24, // Global default radius
    images: []
  }, canvas);

  // Subscribe to updates
  engine.onImagesChanged((images) => {
    console.log("Images array updated:", images);
  });

  engine.onActiveImageChanged((activeId) => {
    console.log("Selected image changed to:", activeId);
  });

  engine.onCellClicked((x, y) => {
    console.log("Clicked empty slot coordinates:", x, y);
  });

  // Initial draw
  engine.render();
</script>
```

---

## 📖 API References

### 1. Configuration Options (`CollageConfig`)

Passed to the constructor to initialize the engine state:

| Attribute | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `containerRatio` | `string` | `"3:4"` | Canvas aspect ratio: `"1:1"`, `"3:4"`, `"4:3"`, `"16:9"`, `"9:16"`, or `"custom"`. |
| `customContainerW` | `number` | - | Width ratio value (required if `containerRatio` is `"custom"`). |
| `customContainerH` | `number` | - | Height ratio value (required if `containerRatio` is `"custom"`). |
| `imageRatio` | `string` | `"16:9"` | Aspect ratio of grid item: `"1:1"`, `"4:3"`, `"16:9"`, or `"custom"`. |
| `customImageW` | `number` | - | Image width ratio value (required if `imageRatio` is `"custom"`). |
| `customImageH` | `number` | - | Image height ratio value (required if `imageRatio` is `"custom"`). |
| `gridColumns` | `number` | `8` | Column partition density (ranges from `4` to `48`). |
| `padding2K` | `number` | `60` | Edge border padding in pixels (scaled relative to 2K width). |
| `gap2K` | `number` | `24` | Inner spacing gap between items in pixels (scaled relative to 2K). |
| `containerBgColor` | `string` | `"#ffffff"` | Solid background color for the canvas layout. |
| `useTransparentBg` | `boolean` | `false` | If true, clear color channel for transparent alpha exports. |
| `images` | `PlacedImage[]` | `[]` | Initial photo elements loaded in the layout. |
| `showGridlines` | `boolean` | `true` | Show helper dashed gridlines in interactive edit mode. |
| `placementSize` | `string` | `"medium"` | Default span size for empty slots: `"small"`, `"medium"`, `"large"`. |
| `imageBorderRadius2K`| `number` | `24` | Global fallback image corner radius (scaled to 2K width). |
| `imageShadowBlur2K`  | `number` | `0` | Global fallback drop shadow blur size (scaled to 2K width). |
| `imageShadowOffset2K`| `number` | `0` | Global fallback drop shadow directional offset (scaled to 2K). |
| `imageShadowOpacity` | `number` | `0.2` | Global fallback drop shadow opacity value (0 to 1). |

---

### 2. Placed Image Structure (`PlacedImage`)

Represents each image block placed on the canvas:

```typescript
export interface PlacedImage {
  id: string;              // Unique block ID
  src: string;             // Photo URL / DataURI / ObjectURL
  name: string;            // Display filename/label
  gridX: number;           // Column starting index (0-based)
  gridY: number;           // Row starting index (0-based)
  span: number;            // Width/height block scale span in grid coordinates
  
  // Optional Individual Aesthetics overrides
  borderRadius2K?: number; // Overrides global imageBorderRadius2K
  shadowBlur2K?: number;   // Overrides global imageShadowBlur2K
  shadowOffset2K?: number; // Overrides global imageShadowOffset2K
  shadowOpacity?: number;  // Overrides global imageShadowOpacity
}
```

---

### 3. Class Methods (`AspectGridCollageify`)

#### 🎨 Visual Render & Config
*   **`render(drawUI: boolean = true)`**: Trigger a render pass on the interactive canvas. Pass `false` to render clean content without helpers.
*   **`updateConfig(config: Partial<CollageConfig>)`**: Dynamically modify config options and trigger auto-redraw.
*   **`getConfig(): CollageConfig`**: Get the current active configuration.

#### 📂 Image Node Management
*   **`getImages(): PlacedImage[]`**: Returns the list of placed images.
*   **`setImages(images: PlacedImage[])`**: Replaces all images and triggers layout updates.
*   **`addImage(img: PlacedImage)`**: Add a new image node to the collage and select it.
*   **`removeImage(imgId: string)`**: Delete an image node by ID.
*   **`updateImage(imgId: string, updates: Partial<PlacedImage>)`**: Updates specific image configuration fields (e.g. coordinates, span, or per-image radius/shadow overrides) and schedules an immediate canvas repaint.

#### 🕹️ Micro-Adjustments & Alignment
*   **`modifyImageSpan(imgId: string, delta: number, gridRows: number): boolean`**: Scale target image span (+1/-1). Returns `true` if operation was successful (bounds and collisions checked).
*   **`stepImagePosition(imgId: string, dir: "up" | "down" | "left" | "right", gridRows: number): boolean`**: Step coordinate position by 1 cell in grid coordinates.
*   **`pushDownBelow(imgId: string, gridRows: number): boolean`**: Shift all images below the target block's bottom border downwards by 1 row.
*   **`pullUpBelow(imgId: string): boolean`**: Pull up all images below the target block's bottom border upwards by 1 row if empty space permits.

#### ⚡ Event Subscriptions
*   **`onImagesChanged(callback: (images: PlacedImage[]) => void)`**: Triggered when any image is added, moved, scaled, updated, or deleted.
*   **`onActiveImageChanged(callback: (id: string | null) => void)`**: Triggered when a grid node selection changes.
*   **`onCellClicked(callback: (x: number, y: number) => void)`**: Triggered when clicking empty helper grid placeholder slots.

#### 💾 Exporter
*   **`exportPNG(targetWidth: number = 2048): Promise<string>`**: Asynchronously preloads all grid images, constructs a high-resolution headless Canvas, renders clean output, and resolves to a PNG DataURL.

---

## 📐 Geometric Alignment & Rendering Math

The collage layouts are calculated dynamically. The grid formulas convert grid coordinates into logical pixels:

1. **Resolution Scale Calculation**:
   $$\text{scale} = \frac{\text{width}}{2048}$$
   This ensures visual sizing metrics defined as "2K" (padding, gap, radius, shadow) scale proportionally at higher resolutions.
2. **Cell Geometric Formulations**:
   $$\text{cellW} = \frac{\text{width} - 2 \cdot \text{padding} - (\text{gridColumns} - 1) \cdot \text{gap}}{\text{gridColumns}}$$
   $$\text{cellH} = \frac{\text{cellW} + \text{gap}}{\text{imageRatioVal}} - \text{gap}$$
3. **Collision Checks**:
   $$\text{Collision} = \neg (X_{1} + S_{1} \le X_{2} \lor X_{2} + S_{2} \le X_{1} \lor Y_{1} + S_{1} \le Y_{2} \lor Y_{2} + S_{2} \le Y_{1})$$

---

## 🛠️ Run The Interactive Demo

To test the library locally inside a browser:

1. **Build the packages**:
   ```bash
   pnpm install
   pnpm build
   ```
2. **Launch Developer Dev Server (Hot Module Reloading)**:
   ```bash
   pnpm dev
   ```
   Open `http://localhost:5173/` in a browser. Any updates to `./src/index.ts` will trigger instant updates in the browser canvas.
3. **Static File Testing (CORS-free Offline mode)**:
   You can also double-click `index.html` to open it in a browser directly via `file://`. The dual-protocol loader automatically loads the precompiled `./dist/index.global.js` UMD bundle, preventing local filesystem CORS blocks.

---

## License

MIT
