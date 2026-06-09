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
      return drawHoverToolbar({
        ctx: options.ctx,
        image: hoveredImage,
        layout: options.layout,
        canvasHeight: options.height,
        hoveredButtonId: options.hoveredButtonId,
        position: overlay.toolbarPosition,
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