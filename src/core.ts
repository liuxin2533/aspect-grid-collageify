import {
  canPlace,
  findSlots,
  getDirectionDelta,
  getImageRect,
  getLayout,
  getPlacementSpan,
  hitTest,
  isImageListValid,
  parseRatio,
  toGridPoint,
} from "./layout";
import { ImageLoader } from "./image-loader";
import { drawCollage } from "./render";
import type {
  CollageImage,
  CollageLayout,
  CollageOptions,
  DrawViewport,
  FindSlotsOptions,
  GridPlacement,
  GridPoint,
  ImageInput,
  ImageRect,
  InsertImagesOptions,
  MoveDirection,
  PlacementPreset,
  Unsubscribe,
} from "./types";

const DEFAULT_OPTIONS: Omit<CollageOptions, "containerRatio" | "imageRatio" | "gridColumns" | "padding2K" | "gap2K"> = {
  background: {
    color: "#ffffff",
    transparent: false,
  },
  imageStyle: {
    borderRadius2K: 24,
    shadowBlur2K: 0,
    shadowOffset2K: 0,
    shadowOpacity: 0.2,
  },
  images: [],
  placementPreset: "medium",
};

export class CollageCore {
  private options: CollageOptions;
  private imageLoader = new ImageLoader();
  private changeCallbacks = new Set<(images: CollageImage[], options: CollageOptions) => void>();

  constructor(options: CollageOptions) {
    this.options = this.normalizeOptions(options);
    this.imageLoader.onLoad(() => this.emitChange());
  }

  public getOptions(): CollageOptions {
    return this.options;
  }

  public setOptions(options: CollageOptions) {
    this.options = this.normalizeOptions(options);
    this.emitChange();
  }

  public updateOptions(options: Partial<CollageOptions>) {
    this.options = this.normalizeOptions({
      ...this.options,
      ...options,
      background: {
        ...this.options.background,
        ...options.background,
      },
      imageStyle: {
        ...this.options.imageStyle,
        ...options.imageStyle,
      },
    });
    this.emitChange();
  }

  public getImages(): CollageImage[] {
    return this.options.images || [];
  }

  public setImages(images: CollageImage[]) {
    this.options = { ...this.options, images: this.normalizeImagesForGrid(images, this.options.gridColumns) };
    this.emitChange();
  }

  public onChange(callback: (images: CollageImage[], options: CollageOptions) => void): Unsubscribe {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  public destroy() {
    this.changeCallbacks.clear();
    this.imageLoader.clear();
  }

  public getLayout(width: number, height: number): CollageLayout {
    return getLayout(this.options, width, height);
  }

  public toGridPoint(point: GridPoint, viewport: DrawViewport): GridPoint {
    return toGridPoint(point, this.getLayout(viewport.width, viewport.height));
  }

  public getImageRect(imageOrId: CollageImage | string, layout: CollageLayout): ImageRect | null {
    const image = typeof imageOrId === "string"
      ? this.getImages().find((item) => item.id === imageOrId)
      : imageOrId;
    return image ? getImageRect(image, layout) : null;
  }

  public hitTest(point: GridPoint, viewport: DrawViewport): CollageImage | null {
    return hitTest(this.getImages(), point, this.getLayout(viewport.width, viewport.height));
  }

  public getPlacementSpan(preset: PlacementPreset = this.options.placementPreset || "medium"): number {
    return getPlacementSpan(this.options.gridColumns, preset);
  }

  public findSlots(options: FindSlotsOptions): GridPlacement[] {
    return findSlots(this.getImages(), this.options.gridColumns, options);
  }

  public findFirstSlot(options: FindSlotsOptions): GridPlacement | null {
    return this.findSlots(options)[0] || null;
  }

  public canPlace(placement: GridPlacement, gridRows: number, ignoreIds: string[] = []): boolean {
    return canPlace(this.getImages(), this.options.gridColumns, placement, gridRows, ignoreIds);
  }

  public insertImage(image: CollageImage): CollageImage {
    this.setImages([...this.getImages(), image]);
    return image;
  }

  public insertImageAt(input: ImageInput, placement: GridPlacement): CollageImage {
    const image = this.createImage(input, placement);
    return this.insertImage(image);
  }

  public insertImages(inputs: ImageInput[], options: InsertImagesOptions): CollageImage[] {
    const nextImages = [...this.getImages()];
    const inserted: CollageImage[] = [];
    const span = options.span ?? this.getPlacementSpan(options.placementPreset || this.options.placementPreset || "medium");

    for (const input of inputs) {
      const slot = findSlots(nextImages, this.options.gridColumns, { span, gridRows: options.gridRows })[0] || {
        gridX: 0,
        gridY: options.gridRows,
        span,
      };
      const image = this.createImage(input, slot);
      nextImages.push(image);
      inserted.push(image);
    }

    this.setImages(nextImages);
    return inserted;
  }

  public updateImage(id: string, patch: Partial<CollageImage>): boolean {
    let changed = false;
    const images = this.getImages().map((image) => {
      if (image.id !== id) return image;
      changed = true;
      return { ...image, ...patch };
    });
    if (!changed) return false;
    this.setImages(images);
    return true;
  }

  public removeImage(id: string): boolean {
    return this.removeImages([id]);
  }

  public removeImages(ids: string[]): boolean {
    const set = new Set(ids);
    const images = this.getImages().filter((image) => !set.has(image.id));
    if (images.length === this.getImages().length) return false;
    this.setImages(images);
    return true;
  }

  public replaceImage(id: string, input: ImageInput): boolean {
    const current = this.getImages().find((image) => image.id === id);
    if (!current) return false;
    if (current.src !== input.src) this.imageLoader.delete(current.src);
    return this.updateImage(id, {
      src: input.src,
      name: input.name ?? current.name,
      ...input.style,
    });
  }

  public moveImage(id: string, target: GridPoint, gridRows: number): boolean {
    const image = this.getImages().find((item) => item.id === id);
    if (!image) return false;
    const placement = { gridX: target.x, gridY: target.y, span: image.span };
    if (!this.canPlace(placement, gridRows, [id])) return false;
    return this.updateImage(id, placement);
  }

  public moveImages(ids: string[], delta: GridPoint, gridRows: number): boolean {
    const selectedIds = new Set(ids);
    const images = this.getImages();
    const moved = images.map((image) => selectedIds.has(image.id)
      ? { ...image, gridX: image.gridX + delta.x, gridY: image.gridY + delta.y }
      : image
    );
    if (!isImageListValid(moved, this.options.gridColumns, gridRows)) return false;
    this.setImages(moved);
    return true;
  }

  public moveImagesByDirection(ids: string[], direction: MoveDirection, gridRows: number): boolean {
    return this.moveImages(ids, getDirectionDelta(direction), gridRows);
  }

  public resizeImage(id: string, delta: number, gridRows: number): boolean {
    const image = this.getImages().find((item) => item.id === id);
    if (!image) return false;
    const span = Math.max(1, Math.min(this.options.gridColumns, image.span + delta));
    if (span === image.span) return false;
    if (!this.canPlace({ gridX: image.gridX, gridY: image.gridY, span }, gridRows, [id])) return false;
    return this.updateImage(id, { span });
  }

  public resizeImages(ids: string[], delta: number, gridRows: number): boolean {
    const selectedIds = new Set(ids);
    const images = this.getImages();
    const resized = images.map((image) => selectedIds.has(image.id)
      ? { ...image, span: Math.max(1, Math.min(this.options.gridColumns, image.span + delta)) }
      : image
    );
    const changed = resized.some((image, index) => image.span !== images[index].span);
    if (!changed || !isImageListValid(resized, this.options.gridColumns, gridRows)) return false;
    this.setImages(resized);
    return true;
  }

  public swapImages(sourceId: string, targetId: string): boolean {
    if (sourceId === targetId) return false;
    const source = this.getImages().find((image) => image.id === sourceId);
    const target = this.getImages().find((image) => image.id === targetId);
    if (!source || !target) return false;

    const images = this.getImages().map((image) => {
      if (image.id === sourceId) return { ...image, gridX: target.gridX, gridY: target.gridY, span: target.span };
      if (image.id === targetId) return { ...image, gridX: source.gridX, gridY: source.gridY, span: source.span };
      return image;
    });
    this.setImages(images);
    return true;
  }

  public pushBelow(id: string, rows: number, gridRows: number): boolean {
    const image = this.getImages().find((item) => item.id === id);
    if (!image) return false;
    const boundaryY = image.gridY + image.span;
    const targets = this.getImages().filter((item) => item.id !== id && item.gridY >= boundaryY);
    if (!targets.every((item) => item.gridY + item.span + rows <= gridRows)) return false;
    this.setImages(this.getImages().map((item) => item.id !== id && item.gridY >= boundaryY
      ? { ...item, gridY: item.gridY + rows }
      : item
    ));
    return true;
  }

  public pullBelow(id: string, rows = 1): boolean {
    const image = this.getImages().find((item) => item.id === id);
    if (!image) return false;
    const boundaryY = image.gridY + image.span;
    const pulled = this.getImages().map((item) => item.id !== id && item.gridY >= boundaryY
      ? { ...item, gridY: item.gridY - rows }
      : item
    );
    if (!isImageListValid(pulled, this.options.gridColumns, Number.MAX_SAFE_INTEGER)) return false;
    this.setImages(pulled);
    return true;
  }

  public draw(ctx: CanvasRenderingContext2D, viewport: DrawViewport) {
    drawCollage({
      ctx,
      width: viewport.width,
      height: viewport.height,
      collageOptions: this.options,
      images: this.getImages(),
      layout: this.getLayout(viewport.width, viewport.height),
      imageLoader: this.imageLoader,
    });
  }

  public async renderToCanvas(width = 2048): Promise<HTMLCanvasElement> {
    const height = this.getExportHeight(width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create 2D canvas context");
    await this.imageLoader.preload(this.getImages().map((image) => image.src));
    this.draw(ctx, { width, height });
    return canvas;
  }

  public async exportPNG(width = 2048): Promise<string> {
    const canvas = await this.renderToCanvas(width);
    return canvas.toDataURL("image/png");
  }

  public async exportBlob(width = 2048, type = "image/png", quality?: number): Promise<Blob> {
    const canvas = await this.renderToCanvas(width);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not export canvas blob"));
      }, type, quality);
    });
  }

  public getImageLoader(): ImageLoader {
    return this.imageLoader;
  }

  private getExportHeight(width: number): number {
    const ratio = parseRatio(
      this.options.containerRatio,
      3,
      4,
      this.options.customContainerW,
      this.options.customContainerH
    );
    return Math.round(width / ratio);
  }

  private normalizeOptions(options: CollageOptions): CollageOptions {
    return {
      ...DEFAULT_OPTIONS,
      ...options,
      background: {
        ...DEFAULT_OPTIONS.background,
        ...options.background,
      },
      imageStyle: {
        ...DEFAULT_OPTIONS.imageStyle,
        ...options.imageStyle,
      },
      images: this.normalizeImagesForGrid(options.images || [], options.gridColumns),
      placementPreset: options.placementPreset || DEFAULT_OPTIONS.placementPreset,
    };
  }

  private normalizeImagesForGrid(images: CollageImage[], gridColumns: number): CollageImage[] {
    const safeGridColumns = Math.max(1, Math.floor(gridColumns));
    const placed: CollageImage[] = [];

    for (const image of images) {
      const span = Math.max(1, Math.min(safeGridColumns, image.span));
      const maxGridX = Math.max(0, safeGridColumns - span);
      const preferred = {
        gridX: Math.max(0, Math.min(maxGridX, image.gridX)),
        gridY: Math.max(0, image.gridY),
        span,
      };
      const placement = canPlace(placed, safeGridColumns, preferred, Number.MAX_SAFE_INTEGER)
        ? preferred
        : this.findNearestPlacement(placed, safeGridColumns, preferred);
      placed.push({ ...image, ...placement });
    }

    return placed;
  }

  private findNearestPlacement(
    placed: CollageImage[],
    gridColumns: number,
    preferred: GridPlacement
  ): GridPlacement {
    const maxGridX = Math.max(0, gridColumns - preferred.span);
    const xCandidates = [
      preferred.gridX,
      ...Array.from({ length: maxGridX + 1 }, (_, x) => x).filter((x) => x !== preferred.gridX),
    ];
    const maxBottom = placed.reduce((bottom, image) => Math.max(bottom, image.gridY + image.span), preferred.gridY);
    const maxScanY = maxBottom + placed.length * preferred.span + preferred.span + 1;

    for (let y = preferred.gridY; y <= maxScanY; y++) {
      for (const x of xCandidates) {
        const placement = { gridX: x, gridY: y, span: preferred.span };
        if (canPlace(placed, gridColumns, placement, Number.MAX_SAFE_INTEGER)) {
          return placement;
        }
      }
    }

    return { gridX: 0, gridY: maxBottom, span: preferred.span };
  }

  private createImage(input: ImageInput, placement: GridPlacement): CollageImage {
    return {
      id: input.id || createId("img"),
      src: input.src,
      name: input.name || "Image",
      gridX: placement.gridX,
      gridY: placement.gridY,
      span: placement.span,
      ...input.style,
    };
  }

  private emitChange() {
    const images = this.getImages();
    this.changeCallbacks.forEach((callback) => callback(images, this.options));
  }
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}