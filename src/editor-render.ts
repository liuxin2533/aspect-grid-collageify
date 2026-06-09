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
}

export function drawEditorOverlay(options: DrawEditorOverlayOptions): Map<HoverToolbarAction, HoverToolbarButtonRect> {
  const overlay = {
    showBoundary: true,
    showGridlines: true,
    showSlots: true,
    slotText: "点击上传或拖入",
    showHoverToolbar: true,
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
      return drawHoverToolbar({
        ctx: options.ctx,
        image: hoveredImage,
        layout: options.layout,
        canvasWidth: options.width,
        canvasHeight: options.height,
        hoveredButtonId: options.hoveredButtonId,
        showInfo: true,
        gridColumns: options.collageOptions.gridColumns,
      });
    }
  }
  return new Map();
}

function drawBoundary(ctx: CanvasRenderingContext2D, width: number, height: number, layout: CollageLayout) {
  ctx.save();
  ctx.strokeStyle = "rgba(79, 70, 229, 0.15)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.roundRect(layout.padding, layout.padding, width - layout.padding * 2, height - layout.padding * 2, 12);
  ctx.stroke();
  ctx.restore();
}

function drawGridlines(ctx: CanvasRenderingContext2D, gridColumns: number, layout: CollageLayout) {
  ctx.save();
  ctx.strokeStyle = "rgba(203, 213, 225, 0.35)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (let i = 1; i < gridColumns; i++) {
    const lineX = layout.offsetX + i * layout.cellW + (i - 1) * layout.gap + layout.gap / 2;
    ctx.beginPath();
    ctx.moveTo(lineX, layout.padding);
    ctx.lineTo(lineX, layout.padding + layout.gridH);
    ctx.stroke();
  }

  for (let i = 1; i < layout.gridRows; i++) {
    const lineY = layout.offsetY + i * layout.cellH + (i - 1) * layout.gap + layout.gap / 2;
    ctx.beginPath();
    ctx.moveTo(layout.padding, lineY);
    ctx.lineTo(layout.padding + layout.gridW, lineY);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSlots(options: DrawEditorOverlayOptions, slotText?: string) {
  const { ctx, layout, slots, hoveredSlot, collageOptions } = options;
  for (const slot of slots) {
    const rect = getImageRect(slot, layout);
    const isHovered = hoveredSlot?.x === slot.gridX && hoveredSlot?.y === slot.gridY;
    const radius = Math.max(6, (collageOptions.imageStyle?.borderRadius2K ?? 24) * layout.scale);

    ctx.save();
    ctx.strokeStyle = isHovered ? "rgba(79, 70, 229, 0.5)" : "rgba(79, 70, 229, 0.2)";
    ctx.lineWidth = isHovered ? 2 : 1.5;
    ctx.setLineDash([5, 5]);
    ctx.fillStyle = isHovered ? "rgba(79, 70, 229, 0.05)" : "transparent";
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
    ctx.fill();
    ctx.stroke();

    const color = isHovered ? "rgba(79, 70, 229, 0.8)" : "rgba(148, 163, 184, 0.5)";
    const centerX = rect.x + rect.w / 2;
    const showText = rect.w >= 90 && rect.h >= 65;
    const centerY = showText ? rect.y + rect.h / 2 - 10 : rect.y + rect.h / 2;
    const plusSize = 7;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(centerX - plusSize, centerY);
    ctx.lineTo(centerX + plusSize, centerY);
    ctx.moveTo(centerX, centerY - plusSize);
    ctx.lineTo(centerX, centerY + plusSize);
    ctx.stroke();

    if (showText) {
      ctx.fillStyle = isHovered ? "rgba(79, 70, 229, 1)" : "rgba(148, 163, 184, 0.7)";
      ctx.font = "500 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(slotText || "", centerX, centerY + plusSize + 6);
      ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
      ctx.font = "10px monospace";
      ctx.fillText(`(${slot.gridX + 1}, ${slot.gridY + 1})`, centerX, centerY + plusSize + 22);
    }

    ctx.restore();
  }
}

function drawSelection(options: DrawEditorOverlayOptions) {
  const { ctx, images, selectedIds, activeId, layout, collageOptions } = options;
  const ids = selectedIds.size > 0 ? selectedIds : new Set(activeId ? [activeId] : []);

  for (const id of ids) {
    const image = images.find((item) => item.id === id);
    if (!image) continue;
    const rect = getImageRect(image, layout);
    const isActive = image.id === activeId;
    const offset = isActive ? 3 : 2;
    const radius = (image.borderRadius2K ?? collageOptions.imageStyle?.borderRadius2K ?? 24) * layout.scale + offset;

    ctx.save();
    ctx.strokeStyle = isActive ? "rgba(79, 70, 229, 1)" : "rgba(14, 165, 233, 0.9)";
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(rect.x - offset, rect.y - offset, rect.w + offset * 2, rect.h + offset * 2, radius);
    ctx.stroke();
    ctx.restore();
  }
}

function drawDragPreview(options: DrawEditorOverlayOptions) {
  const { ctx, images, drag, layout, collageOptions } = options;
  if (!drag?.imageId || !drag.overCell) return;
  const image = images.find((item) => item.id === drag.imageId);
  if (!image) return;

  const rect = getImageRect({ gridX: drag.overCell.x, gridY: drag.overCell.y, span: image.span }, layout);
  const radius = (image.borderRadius2K ?? collageOptions.imageStyle?.borderRadius2K ?? 24) * layout.scale;

  ctx.save();
  ctx.strokeStyle = "rgba(79, 70, 229, 1)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.fillStyle = "rgba(79, 70, 229, 0.12)";
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawFloatingDraggedImage(options: DrawEditorOverlayOptions) {
  const { ctx, images, drag, layout, collageOptions, imageLoader } = options;
  if (!drag?.imageId) return;
  const image = images.find((item) => item.id === drag.imageId);
  if (!image) return;

  const originalRect = getImageRect(image, layout);
  const rect = {
    x: drag.currentPoint.x - drag.startOffset.x,
    y: drag.currentPoint.y - drag.startOffset.y,
    w: originalRect.w,
    h: originalRect.h,
  };
  const radius = (image.borderRadius2K ?? collageOptions.imageStyle?.borderRadius2K ?? 24) * layout.scale;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
  ctx.shadowColor = "rgba(15, 23, 42, 0.4)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  drawCollageImage(ctx, image, collageOptions, layout, imageLoader, rect, 0.85);

  ctx.save();
  ctx.strokeStyle = "rgba(79, 70, 229, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
  ctx.stroke();
  ctx.restore();
}

export interface DrawHoverToolbarOptions {
  ctx: CanvasRenderingContext2D;
  image: CollageImage;
  layout: CollageLayout;
  canvasWidth: number;
  canvasHeight: number;
  hoveredButtonId: HoverToolbarAction | null;
  showInfo: boolean;
  gridColumns: number;
}

const DIRECTION_BUTTON_RADIUS = 11;
const CORNER_BADGE_RADIUS = 13;
const RESIZE_BUTTON_RADIUS = 6;
const BUTTON_SHADOW = "0 2px 6px rgba(15, 23, 42, 0.18)";
const BUTTON_BORDER = "rgba(148, 163, 184, 0.6)";
const HOVER_BG = "rgba(79, 70, 229, 0.12)";
const HOVER_GLYPH = "#4f46e5";
const NORMAL_GLYPH = "#1e293b";
const DISABLED_GLYPH = "#cbd5e1";
const DELETE_BG = "rgba(239, 68, 68, 0.95)";
const DELETE_HOVER_BG = "rgba(239, 68, 68, 1)";
const REPLACE_BG = "rgba(79, 70, 229, 0.95)";
const REPLACE_HOVER_BG = "rgba(67, 56, 202, 1)";
const INFO_PILL_BG = "rgba(79, 70, 229, 0.92)";

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

export function drawHoverToolbar(options: DrawHoverToolbarOptions): Map<HoverToolbarAction, HoverToolbarButtonRect> {
  const { ctx, image, layout, canvasWidth, hoveredButtonId, showInfo, gridColumns } = options;
  const rect = getImageRect(image, layout);

  const enabled: Record<HoverToolbarAction, boolean> = {
    up: true,
    down: true,
    left: true,
    right: true,
    delete: true,
    replace: true,
    shrink: image.span > 1,
    expand: image.span < gridColumns,
  };

  const buttons = new Map<HoverToolbarAction, HoverToolbarButtonRect>();

  const recordButton = (action: HoverToolbarAction, cx: number, cy: number, radius: number) => {
    if (!enabled[action]) return;
    buttons.set(action, { action, x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 });
  };

  // Compute centers
  const topCx = rect.x + rect.w / 2;
  const bottomCx = topCx;
  const midCy = rect.y + rect.h / 2;

  // Direction buttons: top, left, right are always on the edge. Down sits on the bottom edge.
  const downCy = rect.y + rect.h;

  // Resize buttons: centered inside the image, horizontally and vertically. Two buttons (shrink, expand) side by side, 4px apart.
  const shrinkCx = topCx - DIRECTION_BUTTON_RADIUS - 2;
  const expandCx = topCx + DIRECTION_BUTTON_RADIUS + 2;
  const shrinkCy = midCy;
  const expandCy = midCy;

  // Corner badges: aligned to the image's top-right and bottom-right corners, but offset outward by half a badge so half the badge is inside, half outside
  const deleteCx = rect.x + rect.w;
  const deleteCy = rect.y;
  const replaceCx = rect.x + rect.w;
  const replaceCy = rect.y + rect.h;

  // Direction buttons (top, left, right, down)
  const drawDirection = (action: HoverToolbarAction, cx: number, cy: number) => {
    const r = DIRECTION_BUTTON_RADIUS;
    const isHovered = hoveredButtonId === action && enabled[action];
    ctx.save();
    ctx.shadowColor = BUTTON_SHADOW;
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = isHovered ? HOVER_BG : "rgba(255, 255, 255, 0.98)";
    ctx.strokeStyle = enabled[action] ? BUTTON_BORDER : "rgba(203, 213, 225, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = enabled[action] ? (isHovered ? HOVER_GLYPH : NORMAL_GLYPH) : DISABLED_GLYPH;
    ctx.font = "600 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(TOOLBAR_LABELS[action], cx, cy + 0.5);
    ctx.restore();

    recordButton(action, cx, cy, r);
  };

  drawDirection("up", topCx, rect.y);
  drawDirection("left", rect.x, midCy);
  drawDirection("right", rect.x + rect.w, midCy);
  drawDirection("down", bottomCx, downCy);

  // Resize buttons
  const drawResize = (action: HoverToolbarAction, cx: number, cy: number) => {
    const r = DIRECTION_BUTTON_RADIUS;
    const isHovered = hoveredButtonId === action && enabled[action];
    ctx.save();
    ctx.shadowColor = BUTTON_SHADOW;
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = isHovered ? HOVER_BG : "rgba(255, 255, 255, 0.98)";
    ctx.strokeStyle = enabled[action] ? BUTTON_BORDER : "rgba(203, 213, 225, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - r, cy - r, r * 2, r * 2, RESIZE_BUTTON_RADIUS);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = enabled[action] ? (isHovered ? HOVER_GLYPH : NORMAL_GLYPH) : DISABLED_GLYPH;
    ctx.font = "600 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(TOOLBAR_LABELS[action], cx, cy + 0.5);
    ctx.restore();

    recordButton(action, cx, cy, r);
  };

  drawResize("shrink", shrinkCx, shrinkCy);
  drawResize("expand", expandCx, expandCy);

  // Corner badges (delete + replace)
  const drawCorner = (action: HoverToolbarAction, cx: number, cy: number, baseColor: string, hoverColor: string) => {
    const r = CORNER_BADGE_RADIUS;
    const isHovered = hoveredButtonId === action && enabled[action];
    ctx.save();
    ctx.shadowColor = BUTTON_SHADOW;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = isHovered ? hoverColor : baseColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(TOOLBAR_LABELS[action], cx, cy + 0.5);
    ctx.restore();

    recordButton(action, cx, cy, r);
  };

  drawCorner("delete", deleteCx, deleteCy, DELETE_BG, DELETE_HOVER_BG);
  drawCorner("replace", replaceCx, replaceCy, REPLACE_BG, REPLACE_HOVER_BG);

  // Position info pill (drawn at the inside-bottom-left of the image so it is always
  // visible, and on top of the toolbar so the user can read it even when buttons overlap)
  if (showInfo) {
    const infoText = `(${image.gridX + 1},${image.gridY + 1},${image.span})`;
    ctx.save();
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const textMetrics = ctx.measureText(infoText);
    const pillW = Math.ceil(textMetrics.width) + 16;
    const pillH = 22;
    const pillX = Math.max(rect.x + 4, Math.min(rect.x + rect.w - pillW - 4, rect.x + 8));
    const pillY = rect.y + rect.h - pillH - 4;
    ctx.fillStyle = INFO_PILL_BG;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(infoText, pillX + pillW / 2, pillY + pillH / 2);
    ctx.restore();
  }

  return buttons;
}