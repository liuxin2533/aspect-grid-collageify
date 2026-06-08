import type {
  CollageImage,
  CollageLayout,
  CollageOptions,
  FindSlotsOptions,
  GridPlacement,
  GridPoint,
  ImageRect,
  MoveDirection,
  PlacementPreset,
} from "./types";

export function parseRatio(
  ratio: string,
  fallbackW: number,
  fallbackH: number,
  customW?: number,
  customH?: number
): number {
  if (ratio === "custom") {
    return (customW || fallbackW) / (customH || fallbackH);
  }

  const [w, h] = ratio.split(":").map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) {
    return fallbackW / fallbackH;
  }

  return w / h;
}

export function getLayout(options: CollageOptions, width: number, height: number): CollageLayout {
  const containerRatioVal = parseRatio(
    options.containerRatio,
    3,
    4,
    options.customContainerW,
    options.customContainerH
  );
  const imageRatioVal = parseRatio(
    options.imageRatio,
    16,
    9,
    options.customImageW,
    options.customImageH
  );

  const scale = width / 2048;
  const padding = options.padding2K * scale;
  const gap = options.gap2K * scale;
  const gridColumns = options.gridColumns;

  const contentW = Math.max(50, width - padding * 2);
  const contentH = Math.max(50, height - padding * 2);
  const cellW = (contentW - (gridColumns - 1) * gap) / gridColumns;
  const cellH = (cellW + gap) / imageRatioVal - gap;
  const gridRows = Math.floor((contentH + gap) / (cellH + gap));
  const gridW = gridColumns * cellW + (gridColumns - 1) * gap;
  const gridH = gridRows * cellH + (gridRows - 1) * gap;
  const offsetX = padding + (contentW - gridW) / 2;
  const offsetY = padding + (contentH - gridH) / 2;

  return {
    scale,
    padding,
    gap,
    cellW,
    cellH,
    gridRows,
    offsetX,
    offsetY,
    gridW,
    gridH,
    containerRatioVal,
    imageRatioVal,
  };
}

export function getImageRect(image: GridPlacement, layout: CollageLayout): ImageRect {
  const w = image.span * layout.cellW + (image.span - 1) * layout.gap;
  const h = image.span * layout.cellH + (image.span - 1) * layout.gap;
  const x = layout.offsetX + image.gridX * (layout.cellW + layout.gap);
  const y = layout.offsetY + image.gridY * (layout.cellH + layout.gap);
  return { x, y, w, h };
}

export function toGridPoint(point: GridPoint, layout: CollageLayout): GridPoint {
  return {
    x: Math.round((point.x - layout.offsetX) / (layout.cellW + layout.gap)),
    y: Math.round((point.y - layout.offsetY) / (layout.cellH + layout.gap)),
  };
}

export function hitTest(images: CollageImage[], point: GridPoint, layout: CollageLayout): CollageImage | null {
  for (let i = images.length - 1; i >= 0; i--) {
    const image = images[i];
    const rect = getImageRect(image, layout);
    if (point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h) {
      return image;
    }
  }
  return null;
}

export function getPlacementSpan(gridColumns: number, preset: PlacementPreset = "medium"): number {
  switch (gridColumns) {
    case 4:
    case 6:
      return { small: 1, medium: 2, large: 3 }[preset];
    case 8:
      return { small: 2, medium: 3, large: 4 }[preset];
    case 12:
      return { small: 3, medium: 4, large: 6 }[preset];
    default: {
      const s = Math.max(1, Math.floor(gridColumns / 4));
      const m = Math.min(gridColumns, Math.max(s + 1, Math.floor(gridColumns / 3)));
      const l = Math.min(gridColumns, Math.max(m + 1, Math.floor(gridColumns / 2)));
      return { small: s, medium: m, large: l }[preset];
    }
  }
}

export function canPlace(
  images: CollageImage[],
  gridColumns: number,
  placement: GridPlacement,
  gridRows: number,
  ignoreIds: string[] = []
): boolean {
  const ignored = new Set(ignoreIds);
  const { gridX, gridY, span } = placement;
  if (gridX < 0 || gridY < 0 || gridX + span > gridColumns || gridY + span > gridRows) {
    return false;
  }

  for (const image of images) {
    if (ignored.has(image.id)) continue;
    const overlap = !(
      gridX + span <= image.gridX ||
      image.gridX + image.span <= gridX ||
      gridY + span <= image.gridY ||
      image.gridY + image.span <= gridY
    );
    if (overlap) return false;
  }

  return true;
}

export function isImageListValid(images: CollageImage[], gridColumns: number, gridRows: number): boolean {
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    if (
      image.gridX < 0 ||
      image.gridY < 0 ||
      image.gridX + image.span > gridColumns ||
      image.gridY + image.span > gridRows
    ) {
      return false;
    }

    for (let j = i + 1; j < images.length; j++) {
      const other = images[j];
      const overlap = !(
        image.gridX + image.span <= other.gridX ||
        other.gridX + other.span <= image.gridX ||
        image.gridY + image.span <= other.gridY ||
        other.gridY + other.span <= image.gridY
      );
      if (overlap) return false;
    }
  }

  return true;
}

export function findSlots(
  images: CollageImage[],
  gridColumns: number,
  options: FindSlotsOptions
): GridPlacement[] {
  const { span, gridRows } = options;
  const occupied = Array.from({ length: gridColumns }, () => Array(gridRows).fill(false));

  for (const image of images) {
    for (let dx = 0; dx < image.span; dx++) {
      for (let dy = 0; dy < image.span; dy++) {
        const cx = image.gridX + dx;
        const ry = image.gridY + dy;
        if (cx < gridColumns && ry < gridRows) {
          occupied[cx][ry] = true;
        }
      }
    }
  }

  const result: GridPlacement[] = [];
  const tempOccupied = occupied.map((row) => [...row]);

  for (let y = 0; y <= gridRows - span; y++) {
    for (let x = 0; x <= gridColumns - span; x++) {
      let free = true;
      for (let dx = 0; dx < span; dx++) {
        for (let dy = 0; dy < span; dy++) {
          if (tempOccupied[x + dx][y + dy]) {
            free = false;
            break;
          }
        }
        if (!free) break;
      }

      if (free) {
        result.push({ gridX: x, gridY: y, span });
        for (let dx = 0; dx < span; dx++) {
          for (let dy = 0; dy < span; dy++) {
            tempOccupied[x + dx][y + dy] = true;
          }
        }
      }
    }
  }

  return result;
}

export function getDirectionDelta(direction: MoveDirection): GridPoint {
  return {
    x: direction === "left" ? -1 : direction === "right" ? 1 : 0,
    y: direction === "up" ? -1 : direction === "down" ? 1 : 0,
  };
}