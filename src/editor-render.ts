import { getImageRect } from "./layout";
import { drawCollageImage } from "./render";
import type { ImageLoader } from "./image-loader";
import type { CollageImage, CollageLayout, CollageOptions, GridPlacement, GridPoint } from "./types";

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
}

export function drawEditorOverlay(options: DrawEditorOverlayOptions) {
  const overlay = {
    showBoundary: true,
    showGridlines: true,
    showSlots: true,
    slotText: "点击上传或拖入",
    ...options.overlay,
  };

  if (overlay.showBoundary) drawBoundary(options.ctx, options.width, options.height, options.layout);
  if (overlay.showGridlines) drawGridlines(options.ctx, options.collageOptions.gridColumns, options.layout);
  if (overlay.showSlots) drawSlots(options, overlay.slotText);
  drawSelection(options);
  drawDragPreview(options);
  drawFloatingDraggedImage(options);
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