import { getImageRect } from "./layout";
import type { CollageImage, CollageLayout, CollageOptions } from "./types";
import type { ImageLoader } from "./image-loader";

export interface DrawCollageOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  collageOptions: CollageOptions;
  images: CollageImage[];
  layout: CollageLayout;
  imageLoader: ImageLoader;
  skipImageIds?: Set<string>;
}

export function drawCollage(options: DrawCollageOptions) {
  const { ctx, width, height, collageOptions, images, layout, imageLoader, skipImageIds } = options;

  if (!collageOptions.background?.transparent) {
    ctx.fillStyle = collageOptions.background?.color || "#ffffff";
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  for (const image of images) {
    if (skipImageIds?.has(image.id)) continue;
    drawCollageImage(ctx, image, collageOptions, layout, imageLoader);
  }
}

export function drawCollageImage(
  ctx: CanvasRenderingContext2D,
  image: CollageImage,
  options: CollageOptions,
  layout: CollageLayout,
  imageLoader: ImageLoader,
  overrideRect?: { x: number; y: number; w: number; h: number },
  alpha = 1
) {
  const rect = overrideRect || getImageRect(image, layout);
  const borderRadius = (image.borderRadius2K ?? options.imageStyle?.borderRadius2K ?? 24) * layout.scale;
  const shadowBlur = (image.shadowBlur2K ?? options.imageStyle?.shadowBlur2K ?? 0) * layout.scale;
  const shadowOffset = (image.shadowOffset2K ?? options.imageStyle?.shadowOffset2K ?? 0) * layout.scale;
  const shadowOpacity = image.shadowOpacity ?? options.imageStyle?.shadowOpacity ?? 0.2;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (shadowBlur > 0 || shadowOffset > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(15, 23, 42, ${shadowOpacity})`;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = shadowOffset;
    ctx.shadowOffsetY = shadowOffset;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, borderRadius);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, borderRadius);
  ctx.clip();

  const element = imageLoader.get(image.src);
  if (element) {
    drawImageCover(ctx, element, rect.x, rect.y, rect.w, rect.h);
  } else {
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("加载中...", rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
  ctx.lineWidth = Math.max(1, layout.scale);
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, borderRadius);
  ctx.stroke();

  ctx.restore();
}

export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imageRatio = image.width / image.height;
  const targetRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (imageRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / targetRatio;
    sy = (image.height - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}