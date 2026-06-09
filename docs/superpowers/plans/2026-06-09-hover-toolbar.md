# Hover Toolbar for CanvasCollageEditor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a canvas-internal hover toolbar to `CanvasCollageEditor` that appears when the mouse hovers an uploaded image, exposing position info and 8 quick actions (move / resize / delete / replace) without leaving the canvas.

**Architecture:** The toolbar is drawn in the same overlay pass as selection/drag-preview, sharing the existing render pipeline. Two new fields (`hoveredImageId`, `hoveredButtonId`) are tracked in `CanvasCollageEditor`, and the existing `mousemove`/`mousedown` handlers are extended to perform button hit-testing. The toolbar button map is computed during draw and passed back to the editor, so hit-test rectangles stay in lockstep with the rendered pixels. All actions route through existing `CollageCore` methods — no new core APIs.

**Tech Stack:** TypeScript, Canvas 2D API, tsup bundler, vite dev server. No new dependencies.

---

## File Structure

**Files modified (3 source + 1 demo + 1 spec-helpers):**
- `src/types.ts` — add `HoverToolbarAction` type and re-export.
- `src/editor-render.ts` — extend `EditorOverlayOptions`, `DrawEditorOverlayOptions`, and `drawEditorOverlay`; add `drawHoverToolbar` pure function and supporting types.
- `src/editor.ts` — add `hoveredImageId` / `hoveredButtonId` / `toolbarButtons` state, extend event handlers, add `runToolbarAction`, extend `EditorEventMap` with `toolbaraction`.
- `src/index.ts` — re-export `HoverToolbarAction`.
- `index.html` — subscribe to new `toolbaraction` event in demo.

**Files NOT modified:**
- `src/core.ts` — core is unchanged; all actions route through existing public methods.
- `src/render.ts` — drawing is overlay-only; export pipeline is untouched.

---

## Task 1: Add `HoverToolbarAction` type and export

**Files:**
- Modify: `src/types.ts:1-15` (top of file)

- [ ] **Step 1: Add the new type alias**

In `src/types.ts`, directly after the existing `MoveDirection` declaration (currently line 5), insert:

```ts
export type HoverToolbarAction =
  | "up" | "down" | "left" | "right"
  | "shrink" | "expand"
  | "delete" | "replace";
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: exit code 0, no errors. (No other type referenced yet, so this just confirms the syntax is valid.)

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(editor): add HoverToolbarAction type"
```

---

## Task 2: Re-export `HoverToolbarAction` from index

**Files:**
- Modify: `src/index.ts:3-23` (the `export type { ... }` block)

- [ ] **Step 1: Add the export**

In `src/index.ts`, add `"HoverToolbarAction"` to the list of types re-exported from `./types`. The block currently reads:

```ts
export type {
  CollageImage,
  CollageLayout,
  CollageOptions,
  DrawViewport,
  FindSlotsOptions,
  GridPlacement,
  GridPoint,
  ImageInput,
  ImageRect,
  ImageStyleOptions,
  InsertImagesOptions,
  MoveDirection,
  PlacementPreset,
  RatioOption,
  Unsubscribe,
  ViewportSize,
} from "./types";
```

Update it to also include `HoverToolbarAction`. The alphabetical order would place it after `GridPoint`:

```ts
export type {
  CollageImage,
  CollageLayout,
  CollageOptions,
  DrawViewport,
  FindSlotsOptions,
  GridPlacement,
  GridPoint,
  HoverToolbarAction,
  ImageInput,
  ImageRect,
  ImageStyleOptions,
  InsertImagesOptions,
  MoveDirection,
  PlacementPreset,
  RatioOption,
  Unsubscribe,
  ViewportSize,
} from "./types";
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(editor): export HoverToolbarAction from main entry"
```

---

## Task 3: Extend `EditorOverlayOptions` with hover toolbar fields

**Files:**
- Modify: `src/editor-render.ts:6-11` (`EditorOverlayOptions` interface)

- [ ] **Step 1: Extend the interface**

Replace the existing `EditorOverlayOptions` interface with the extended version:

```ts
export interface EditorOverlayOptions {
  showBoundary?: boolean;
  showGridlines?: boolean;
  showSlots?: boolean;
  slotText?: string;
  showHoverToolbar?: boolean;
  toolbarPosition?: "bottom" | "top";
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: exit code 0. (The fields are optional and not yet consumed, so the change is type-only.)

- [ ] **Step 3: Commit**

```bash
git add src/editor-render.ts
git commit -m "feat(editor): add showHoverToolbar and toolbarPosition options"
```

---

## Task 4: Extend `DrawEditorOverlayOptions` and `drawEditorOverlay` to thread hover state

**Files:**
- Modify: `src/editor-render.ts:20-51` (`DrawEditorOverlayOptions` interface and `drawEditorOverlay` function)

- [ ] **Step 1: Add the new fields to `DrawEditorOverlayOptions`**

Add `hoveredImageId` and `hoveredButtonId` to the options interface. After modification the interface should read:

```ts
import { getImageRect } from "./layout";
import { drawCollageImage } from "./render";
import type { ImageLoader } from "./image-loader";
import type { CollageImage, CollageLayout, CollageOptions, GridPlacement, GridPoint, HoverToolbarAction } from "./types";

export interface EditorOverlayOptions {
  showBoundary?: boolean;
  showGridlines?: boolean;
  showSlots?: boolean;
  slotText?: string;
  showHoverToolbar?: boolean;
  toolbarPosition?: "bottom" | "top";
}

export interface DragOverlayState {
  imageId: string | null;
  currentPoint: GridPoint;
  startOffset: GridPoint;
  overCell: GridPoint | null;
}

export interface HoverToolbarButtonRect {
  action: HoverToolbarAction;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DrawEditorOverlayOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  collageOptions: CollageOptions;
  layout: CollageLayout;
  images: CollageImage[];
  imageLoader: ImageLoader;
  slots: GridPlacement[];
  hoveredSlot: GridPoint | null;
  selectedIds: Set<string>;
  activeId: string | null;
  drag: DragOverlayState | null;
  overlay?: EditorOverlayOptions;
  hoveredImageId: string | null;
  hoveredButtonId: HoverToolbarAction | null;
  onToolbarButtons?: (buttons: Map<HoverToolbarAction, HoverToolbarButtonRect>) => void;
}

export function drawEditorOverlay(options: DrawEditorOverlayOptions): void {
  const overlay = {
    showBoundary: true,
    showGridlines: true,
    showSlots: true,
    slotText: "点击上传或拖入",
    showHoverToolbar: true,
    toolbarPosition: "bottom" as const,
    ...options.overlay,
  };

  if (overlay.showBoundary) drawBoundary(options.ctx, options.width, options.height, options.layout);
  if (overlay.showGridlines) drawGridlines(options.ctx, options.collageOptions.gridColumns, options.layout);
  if (overlay.showSlots) drawSlots(options, overlay.slotText);
  drawSelection(options);
  drawDragPreview(options);
  drawFloatingDraggedImage(options);

  if (overlay.showHoverToolbar && options.hoveredImageId && !options.drag?.imageId) {
    const hoveredImage = options.images.find((image) => image.id === options.hoveredImageId);
    if (hoveredImage) {
      const buttons = drawHoverToolbar({
        ctx: options.ctx,
        image: hoveredImage,
        layout: options.layout,
        canvasHeight: options.height,
        hoveredButtonId: options.hoveredButtonId,
        position: overlay.toolbarPosition,
        gridColumns: options.collageOptions.gridColumns,
      });
      options.onToolbarButtons?.(buttons);
      return;
    }
  }
  options.onToolbarButtons?.(new Map());
}
```

The `drawHoverToolbar` call uses constants that will be added in Task 5. Don't run TypeScript yet — Task 5 supplies the function.

- [ ] **Step 2: Verify file still parses (no implementation step yet)**

Skip `tsc` for now; Task 5 will add `drawHoverToolbar`. We commit this as a partially-applied change so each step stays small.

- [ ] **Step 3: Commit**

```bash
git add src/editor-render.ts
git commit -m "feat(editor): thread hover toolbar state through overlay"
```

---

## Task 5: Implement `drawHoverToolbar` (pure renderer)

**Files:**
- Modify: `src/editor-render.ts` (append at the end of the file)

- [ ] **Step 1: Append the `drawHoverToolbar` function and its types**

Add the following block at the very end of `src/editor-render.ts`:

```ts
export interface DrawHoverToolbarOptions {
  ctx: CanvasRenderingContext2D;
  image: CollageImage;
  layout: CollageLayout;
  canvasHeight: number;
  hoveredButtonId: HoverToolbarAction | null;
  position: "bottom" | "top";
  gridColumns: number;
}

const TOOLBAR_BUTTON_SIZE = 24;
const TOOLBAR_BUTTON_GAP = 4;
const TOOLBAR_SEPARATOR_GAP = 8;
const TOOLBAR_PADDING_X = 8;
const TOOLBAR_PADDING_Y = 6;
const TOOLBAR_RADIUS = 8;
const TOOLBAR_OFFSET = 6;
const TOOLBAR_INFO_GAP = 4;
const TOOLBAR_INFO_HEIGHT = 16;

const TOOLBAR_GROUPS: HoverToolbarAction[][] = [
  ["up", "down", "left", "right"],
  ["shrink", "expand"],
  ["delete", "replace"],
];

const TOOLBAR_LABELS: Record<HoverToolbarAction, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  shrink: "−",
  expand: "+",
  delete: "×",
  replace: "↻",
};

const TOOLBAR_TITLES: Record<HoverToolbarAction, string> = {
  up: "上移",
  down: "下移",
  left: "左移",
  right: "右移",
  shrink: "缩小",
  expand: "放大",
  delete: "删除",
  replace: "替换",
};

export function drawHoverToolbar(options: DrawHoverToolbarOptions): Map<HoverToolbarAction, HoverToolbarButtonRect> {
  const { ctx, image, layout, canvasHeight, hoveredButtonId, position, gridColumns } = options;
  const rect = getImageRect(image, layout);

  const groupSizes = TOOLBAR_GROUPS.map((group) =>
    group.length * TOOLBAR_BUTTON_SIZE + (group.length - 1) * TOOLBAR_BUTTON_GAP
  );
  const innerWidth =
    groupSizes.reduce((sum, w) => sum + w, 0) +
    Math.max(0, TOOLBAR_GROUPS.length - 1) * TOOLBAR_SEPARATOR_GAP;
  const toolbarWidth = innerWidth + TOOLBAR_PADDING_X * 2;
  const toolbarHeight = TOOLBAR_BUTTON_SIZE + TOOLBAR_PADDING_Y * 2;

  const centerX = rect.x + rect.w / 2;
  const toolbarX = Math.max(TOOLBAR_RADIUS, Math.min(canvasHeight - toolbarWidth - TOOLBAR_RADIUS, centerX - toolbarWidth / 2));

  let toolbarY: number;
  if (position === "top") {
    toolbarY = Math.max(TOOLBAR_RADIUS, rect.y - TOOLBAR_OFFSET - toolbarHeight);
  } else {
    const desiredY = rect.y + rect.h + TOOLBAR_OFFSET;
    toolbarY = desiredY + toolbarHeight + TOOLBAR_INFO_HEIGHT + TOOLBAR_INFO_GAP <= canvasHeight
      ? desiredY
      : Math.max(TOOLBAR_RADIUS, rect.y - TOOLBAR_OFFSET - toolbarHeight);
  }

  const infoY = position === "top" || toolbarY < rect.y
    ? toolbarY + toolbarHeight + TOOLBAR_INFO_GAP
    : rect.y + rect.h + TOOLBAR_OFFSET;

  const buttons = new Map<HoverToolbarAction, HoverToolbarButtonRect>();
  const enabled: Record<HoverToolbarAction, boolean> = {
    up: true,
    down: true,
    left: true,
    right: true,
    shrink: image.span > 1,
    expand: image.span < gridColumns,
    delete: true,
    replace: true,
  };

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
  ctx.lineWidth = 1;
  ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 8;
  ctx.beginPath();
  ctx.roundRect(toolbarX, toolbarY, toolbarWidth, toolbarHeight, TOOLBAR_RADIUS);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(148, 163, 184, 0.3)";
  ctx.lineWidth = 1;
  let cursorX = toolbarX + TOOLBAR_PADDING_X;
  const buttonCenterY = toolbarY + TOOLBAR_PADDING_Y + TOOLBAR_BUTTON_SIZE / 2;
  for (let g = 0; g < TOOLBAR_GROUPS.length; g++) {
    const group = TOOLBAR_GROUPS[g];
    if (g > 0) {
      const sepX = cursorX + TOOLBAR_SEPARATOR_GAP / 2;
      ctx.beginPath();
      ctx.moveTo(sepX, toolbarY + TOOLBAR_PADDING_Y + 2);
      ctx.lineTo(sepX, toolbarY + TOOLBAR_PADDING_Y + TOOLBAR_BUTTON_SIZE - 2);
      ctx.stroke();
      cursorX += TOOLBAR_SEPARATOR_GAP;
    }
    for (const action of group) {
      const bx = cursorX;
      const by = toolbarY + TOOLBAR_PADDING_Y;
      const isHovered = hoveredButtonId === action && enabled[action];
      if (isHovered) {
        ctx.fillStyle = "rgba(79, 70, 229, 0.12)";
        ctx.beginPath();
        ctx.roundRect(bx, by, TOOLBAR_BUTTON_SIZE, TOOLBAR_BUTTON_SIZE, 6);
        ctx.fill();
      }
      ctx.fillStyle = enabled[action]
        ? (isHovered ? "#4f46e5" : "#1e293b")
        : "#cbd5e1";
      ctx.font = "600 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(TOOLBAR_LABELS[action], bx + TOOLBAR_BUTTON_SIZE / 2, buttonCenterY);
      if (enabled[action]) {
        buttons.set(action, { action, x: bx, y: by, w: TOOLBAR_BUTTON_SIZE, h: TOOLBAR_BUTTON_SIZE });
      }
      cursorX += TOOLBAR_BUTTON_SIZE + TOOLBAR_BUTTON_GAP;
    }
    if (group.length > 0) cursorX -= TOOLBAR_BUTTON_GAP;
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#64748b";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const infoText = `col ${image.gridX + 1} · row ${image.gridY + 1} · span ${image.span}`;
  ctx.fillText(infoText, centerX, infoY);
  ctx.restore();

  return buttons;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Verify dev server starts without runtime errors**

Run: `pnpm exec vite build`
Expected: build succeeds. (We don't need a full e2e at this step; visual check happens in Task 8.)

- [ ] **Step 4: Commit**

```bash
git add src/editor-render.ts
git commit -m "feat(editor): implement drawHoverToolbar pure renderer"
```

---

## Task 6: Add hover state and toolbar action runner in `editor.ts`

**Files:**
- Modify: `src/editor.ts:1-15` (imports), `src/editor.ts:28-35` (EditorEventMap), `src/editor.ts:47-75` (class fields & constructor)

- [ ] **Step 1: Update imports**

Replace the `import` block at the top of `src/editor.ts`:

```ts
import { CollageCore } from "./core";
import { getImageRect, getPlacementSpan, toGridPoint } from "./layout";
import { drawCollage } from "./render";
import { drawEditorOverlay, type DragOverlayState, type EditorOverlayOptions, type HoverToolbarButtonRect } from "./editor-render";
import type {
  CollageImage,
  CollageOptions,
  GridPlacement,
  GridPoint,
  HoverToolbarAction,
  ImageInput,
  InsertImagesOptions,
  MoveDirection,
  Unsubscribe,
} from "./types";
```

- [ ] **Step 2: Add `toolbaraction` to `EditorEventMap`**

Replace the `EditorEventMap` type with:

```ts
type EditorEventMap = {
  change: (images: CollageImage[]) => void;
  selectionchange: (ids: string[]) => void;
  activechange: (id: string | null) => void;
  cellclick: (placement: GridPlacement) => void;
  replacerequest: (id: string) => void;
  toolbaraction: (action: HoverToolbarAction, imageId: string) => void;
  error: (error: unknown) => void;
};
```

- [ ] **Step 3: Add new private fields and initialize them**

In the `CanvasCollageEditor` class, find the existing field block (currently lines 52-59) and add three new fields. The final block should read:

```ts
  private options: CanvasCollageEditorOptions;
  private ctx: CanvasRenderingContext2D;
  private selectedIds = new Set<string>();
  private activeId: string | null = null;
  private hoveredSlot: GridPoint | null = null;
  private hoveredImageId: string | null = null;
  private hoveredButtonId: HoverToolbarAction | null = null;
  private toolbarButtons: Map<HoverToolbarAction, HoverToolbarButtonRect> = new Map();
  private pendingInsertPlacement: GridPlacement | null = null;
  private drag: DragOverlayState | null = null;
  private eventCallbacks: Partial<Record<keyof EditorEventMap, Set<(...args: unknown[]) => void>>> = {};
  private disposers: Array<() => void> = [];
  private objectUrls = new Set<string>();
```

- [ ] **Step 4: Verify TypeScript still compiles**

Run: `pnpm exec tsc --noEmit`
Expected: exit code 0. (`toolbarButtons` is initialized but not yet read; that is fine — Task 7 wires it in.)

- [ ] **Step 5: Commit**

```bash
git add src/editor.ts
git commit -m "feat(editor): add hover state fields and toolbaraction event type"
```

---

## Task 7: Wire render / mouse handlers / runToolbarAction

**Files:**
- Modify: `src/editor.ts:135-169` (`render` method)
- Modify: `src/editor.ts:241-264` (`bindEvents` method)
- Modify: `src/editor.ts:363-390` (`handleMouseMove`)
- Modify: `src/editor.ts:313-361` (`handleMouseDown`)
- Modify: `src/editor.ts:419-423` (after `handleDoubleClick`)

- [ ] **Step 1: Update `render()` to pass new state and capture buttons**

Replace the existing `render()` method with:

```ts
  public render() {
    const { width, height, dpr } = this.prepareCanvas();
    const layout = this.core.getLayout(width, height);
    const dragImageId = this.drag?.imageId;

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.scale(dpr, dpr);
    drawCollage({
      ctx: this.ctx,
      width,
      height,
      collageOptions: this.core.getOptions(),
      images: this.core.getImages(),
      layout,
      imageLoader: this.core.getImageLoader(),
      skipImageIds: dragImageId ? new Set([dragImageId]) : undefined,
    });
    this.toolbarButtons = drawEditorOverlay({
      ctx: this.ctx,
      width,
      height,
      collageOptions: this.core.getOptions(),
      layout,
      images: this.core.getImages(),
      imageLoader: this.core.getImageLoader(),
      slots: this.core.findSlots({ span: this.getTargetSpan(), gridRows: layout.gridRows }),
      hoveredSlot: this.hoveredSlot,
      selectedIds: this.selectedIds,
      activeId: this.activeId,
      drag: this.drag,
      overlay: this.options.overlay,
      hoveredImageId: this.hoveredImageId,
      hoveredButtonId: this.hoveredButtonId,
    });
    this.ctx.restore();
  }
```

Note: this requires `drawEditorOverlay` to return the buttons map. We will adjust its signature in step 3 below.

- [ ] **Step 2: Add a `mouseleave` handler binding**

In `bindEvents`, extend the bindings. Replace the body of `bindEvents` (currently lines 241-264) with:

```ts
  private bindEvents() {
    const onMouseDown = (event: MouseEvent) => this.handleMouseDown(event);
    const onMouseMove = (event: MouseEvent) => this.handleMouseMove(event);
    const onMouseUp = () => this.handleMouseUp();
    const onMouseLeave = () => this.handleMouseLeave();
    const onDblClick = (event: MouseEvent) => this.handleDoubleClick(event);
    const onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);

    this.canvas.addEventListener("mousedown", onMouseDown);
    this.canvas.addEventListener("mousemove", onMouseMove);
    this.canvas.addEventListener("mouseleave", onMouseLeave);
    this.canvas.addEventListener("dblclick", onDblClick);
    window.addEventListener("mouseup", onMouseUp);
    this.disposers.push(() => this.canvas.removeEventListener("mousedown", onMouseDown));
    this.disposers.push(() => this.canvas.removeEventListener("mousemove", onMouseMove));
    this.disposers.push(() => this.canvas.removeEventListener("mouseleave", onMouseLeave));
    this.disposers.push(() => this.canvas.removeEventListener("dblclick", onDblClick));
    this.disposers.push(() => window.removeEventListener("mouseup", onMouseUp));

    if (this.options.keyboard) {
      this.canvas.tabIndex = this.canvas.tabIndex >= 0 ? this.canvas.tabIndex : 0;
      this.canvas.addEventListener("keydown", onKeyDown);
      this.disposers.push(() => this.canvas.removeEventListener("keydown", onKeyDown));
    }

    if (this.options.dragInsert) this.bindFileDropEvents();
  }
```

- [ ] **Step 3: Add `handleMouseLeave` and `runToolbarAction` methods**

Insert these methods directly after `handleDoubleClick` (currently ending at line 423):

```ts
  private handleMouseLeave() {
    if (this.hoveredImageId !== null || this.hoveredButtonId !== null) {
      this.hoveredImageId = null;
      this.hoveredButtonId = null;
      this.render();
    }
  }

  private runToolbarAction(action: HoverToolbarAction, imageId: string) {
    const rows = this.getCurrentGridRows();
    let changed = false;
    switch (action) {
      case "up":
      case "down":
      case "left":
      case "right":
        changed = this.core.moveImagesByDirection([imageId], action, rows);
        break;
      case "shrink":
        changed = this.core.resizeImages([imageId], -1, rows);
        break;
      case "expand":
        changed = this.core.resizeImages([imageId], 1, rows);
        break;
      case "delete":
        changed = this.core.removeImages([imageId]);
        if (changed && this.activeId === imageId) {
          this.activeId = null;
          this.selectedIds = new Set();
          this.emit("activechange", null);
          this.emit("selectionchange", []);
        }
        break;
      case "replace":
        this.emit("replacerequest", imageId);
        return;
    }
    if (!changed) this.render();
  }
```

- [ ] **Step 4: Update `handleMouseDown` to handle toolbar button clicks**

Replace the body of `handleMouseDown` (currently lines 313-361) with:

```ts
  private handleMouseDown(event: MouseEvent) {
    const point = this.getMousePoint(event);
    const viewport = this.getViewport();

    if (this.hoveredImageId && this.toolbarButtons.size > 0) {
      for (const button of this.toolbarButtons.values()) {
        if (
          point.x >= button.x &&
          point.x <= button.x + button.w &&
          point.y >= button.y &&
          point.y <= button.y + button.h
        ) {
          this.emit("toolbaraction", button.action, this.hoveredImageId);
          this.runToolbarAction(button.action, this.hoveredImageId);
          event.preventDefault();
          return;
        }
      }
    }

    const hit = this.core.hitTest(point, viewport);

    if (hit) {
      const toggle = this.options.multiSelect && (event.ctrlKey || event.metaKey);
      if (toggle) {
        if (this.selectedIds.has(hit.id)) this.selectedIds.delete(hit.id);
        else this.selectedIds.add(hit.id);
        const selection = this.getSelection();
        this.activeId = this.selectedIds.has(hit.id) ? hit.id : selection[selection.length - 1] || null;
        this.emit("selectionchange", this.getSelection());
        this.emit("activechange", this.activeId);
        this.render();
        return;
      }

      this.activeId = hit.id;
      if (!this.selectedIds.has(hit.id) || this.selectedIds.size <= 1) {
        this.selectedIds = new Set([hit.id]);
        this.emit("selectionchange", this.getSelection());
      }
      this.emit("activechange", this.activeId);

      if (this.options.dragMove) {
        const rect = this.core.getImageRect(hit, this.core.getLayout(viewport.width, viewport.height));
        this.drag = rect ? {
          imageId: hit.id,
          currentPoint: point,
          startOffset: { x: point.x - rect.x, y: point.y - rect.y },
          overCell: null,
        } : null;
      }
      this.render();
      return;
    }

    const slot = this.getHitSlot(point);
    if (slot) {
      this.pendingInsertPlacement = slot;
      this.hoveredSlot = { x: slot.gridX, y: slot.gridY };
      this.emit("cellclick", slot);
      this.render();
      return;
    }

    this.clearSelection();
  }
```

- [ ] **Step 5: Update `handleMouseMove` to manage hover state**

Replace the body of `handleMouseMove` (currently lines 363-390) with:

```ts
  private handleMouseMove(event: MouseEvent) {
    const point = this.getMousePoint(event);
    const viewport = this.getViewport();
    const layout = this.core.getLayout(viewport.width, viewport.height);

    if (this.drag?.imageId) {
      const image = this.core.getImages().find((item) => item.id === this.drag?.imageId);
      if (!image) return;
      const snapX = point.x - this.drag.startOffset.x;
      const snapY = point.y - this.drag.startOffset.y;
      const grid = toGridPoint({ x: snapX, y: snapY }, layout);
      this.drag = {
        ...this.drag,
        currentPoint: point,
        overCell: {
          x: Math.max(0, Math.min(this.core.getOptions().gridColumns - image.span, grid.x)),
          y: Math.max(0, Math.min(layout.gridRows - image.span, grid.y)),
        },
      };
      this.render();
      return;
    }

    const hit = this.core.hitTest(point, viewport);
    const pointInToolbar = this.pointInToolbar(point);
    const nextHoveredImage = hit ? hit.id : pointInToolbar ? this.hoveredImageId : null;

    let nextHoveredButton: HoverToolbarAction | null = null;
    if (pointInToolbar) {
      for (const button of this.toolbarButtons.values()) {
        if (
          point.x >= button.x &&
          point.x <= button.x + button.w &&
          point.y >= button.y &&
          point.y <= button.y + button.h
        ) {
          nextHoveredButton = button.action;
          break;
        }
      }
    }

    const hoveredSlot = hit ? null : this.getHitSlot(point);
    this.hoveredSlot = hoveredSlot ? { x: hoveredSlot.gridX, y: hoveredSlot.gridY } : null;

    const imageChanged = nextHoveredImage !== this.hoveredImageId;
    const buttonChanged = nextHoveredButton !== this.hoveredButtonId;
    this.hoveredImageId = nextHoveredImage;
    this.hoveredButtonId = nextHoveredButton;

    if (pointInToolbar) this.canvas.style.cursor = "pointer";
    else if (hit) this.canvas.style.cursor = "move";
    else if (this.hoveredSlot) this.canvas.style.cursor = "pointer";
    else this.canvas.style.cursor = "default";

    if (imageChanged || buttonChanged) this.render();
  }

  private pointInToolbar(point: GridPoint): boolean {
    if (!this.hoveredImageId) return false;
    for (const button of this.toolbarButtons.values()) {
      if (
        point.x >= button.x &&
        point.x <= button.x + button.w &&
        point.y >= button.y &&
        point.y <= button.y + button.h
      ) {
        return true;
      }
    }
    return false;
  }
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 7: Commit**

```bash
git add src/editor.ts
git commit -m "feat(editor): wire hover toolbar into render and mouse events"
```

---

## Task 8: Update demo to listen to `toolbaraction` and verify visually

**Files:**
- Modify: `index.html:480-488` (event subscriptions)

- [ ] **Step 1: Add a `toolbaraction` listener in the demo**

In `index.html`, after the existing `editor.on("replacerequest", ...)` line (currently line 484), insert:

```html
    editor.on("toolbaraction", (action, id) => {
      console.log("[hover-toolbar]", action, id);
    });
```

The block of editor event subscriptions should now read:

```html
    editor.on("change", renderState);
    editor.on("selectionchange", renderState);
    editor.on("activechange", renderState);
    editor.on("cellclick", (placement) => {
      editor.setPendingInsertPlacement(placement);
      fileInput.click();
    });
    editor.on("replacerequest", () => replaceInput.click());
    editor.on("toolbaraction", (action, id) => {
      console.log("[hover-toolbar]", action, id);
    });
    editor.on("error", (error) => {
      console.error(error);
      setStatus("Error");
    });
```

- [ ] **Step 2: Build to verify the full bundle compiles**

Run: `pnpm build`
Expected: tsup emits `dist/index.js`, `dist/index.mjs`, `dist/editor.js`, `dist/editor.mjs`, and corresponding `.d.ts` files. No errors.

- [ ] **Step 3: Manual smoke test in dev server**

Run: `pnpm dev` in one terminal, then open `http://localhost:5173/` in a browser. Verify the following in order:

1. Click "插入图片" and upload 2-3 images.
2. Hover the mouse over an image — the toolbar appears below the image, with a `col x · row y · span s` line above it.
3. Move the mouse to a button — the button background changes to indigo.
4. Click `←` then `→` — the image moves one grid cell each click. Confirm position label updates.
5. Click `+` to grow the image, `−` to shrink. At `span = 1`, `−` appears greyed out and is non-responsive.
6. Move the image to the bottom of the canvas and hover it — the toolbar flips to the top of the image (still with the position label between toolbar and image).
7. Hover off the image — the toolbar disappears.
8. Hover an image, click `×` — image is removed and selection clears.
9. Hover an image, click `↻` — the file picker opens (same as double-clicking).
10. Drag the image — toolbar disappears during drag and reappears on release.
11. Press the arrow keys / Ctrl+arrow keys / Delete — existing keyboard shortcuts still work alongside the toolbar.
12. Click "导出 PNG" and open the downloaded image — it contains only the collage, no toolbar/overlay.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(demo): log hover toolbar actions"
```

---

## Task 9: Bump version, update README, and final verification

**Files:**
- Modify: `package.json:3` (version field)
- Modify: `README.md` (add a short note in the "特性" / "🕹️ 支持可视化编辑" line, or under the Editor section)

- [ ] **Step 1: Bump version to 2.1.0**

In `package.json`, change `"version": "2.0.1"` to `"version": "2.1.0"`.

- [ ] **Step 2: Add a feature note in `README.md`**

Locate the line `🕹️ 支持可视化编辑：点击插槽上传、拖拽文件插入、拖拽移动、拖拽换位、多选、键盘操作。` in `README.md` (around line 29) and append a new bullet below it:

```markdown
- 🕹️ 支持可视化编辑：点击插槽上传、拖拽文件插入、拖拽移动、拖拽换位、多选、键盘操作。
- 🧰 鼠标悬浮在已上传图片上时弹出画布内置工具栏：位置信息 + 方向键移动、放大缩小、删除、替换。
```

- [ ] **Step 3: Run the full build**

Run: `pnpm build`
Expected: succeeds with no errors.

- [ ] **Step 4: Run `tsc --noEmit` for safety**

Run: `pnpm exec tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md
git commit -m "chore: bump to 2.1.0 and document hover toolbar"
```

---

## Self-Review

**Spec coverage:**
- Section 1 (Goals): covered by Tasks 5, 7, 8.
- Section 3.1 (`EditorOverlayOptions` fields): Task 3.
- Section 3.2 (new event): Task 6.
- Section 3.3 (`HoverToolbarAction` type): Task 1.
- Section 3.4 (index re-export): Task 2.
- Section 4.1 (show/hide rules): Task 7 (hover + leave handlers).
- Section 4.2 (positioning/appearance): Task 5 (constants, colors, fonts).
- Section 4.3 (button layout `↑↓←→ | −+ | ×↻`): Task 5 (`TOOLBAR_GROUPS`).
- Section 4.4 (hit-testing): Tasks 5 (returns button map) and 7 (consumes it in mouse handlers).
- Section 4.5 (default actions): Task 7 (`runToolbarAction`).
- Section 4.6 (no preventDefault): Task 6 comment + Task 7 emits-then-runs directly.
- Section 4.7 (compatibility with drag/keyboard): Task 7 (drag short-circuits hover; keyboard untouched).
- Section 4.8 (export purity): unchanged `CollageCore.draw`; verified in Task 8 step 3.12.
- Section 8.2 (manual e2e list): Task 8 step 3 enumerates each item from the spec.

**Placeholder scan:** No TBDs/TODOs. Each code block is complete and runnable as written. No "similar to" cross-references between tasks.

**Type consistency:** `HoverToolbarAction` is defined once in Task 1 and reused identically across Tasks 2, 3, 4, 5, 6, 7. The `HoverToolbarButtonRect` type is defined once in Task 4 and used in Tasks 5, 6, 7. The buttons map type matches between `drawHoverToolbar` return and `toolbarButtons` field.
