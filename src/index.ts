export interface PlacedImage {
  id: string;
  src: string;
  name: string;
  gridX: number;
  gridY: number;
  span: number;
  borderRadius2K?: number;
  shadowBlur2K?: number;
  shadowOffset2K?: number;
  shadowOpacity?: number;
}

export interface CollageConfig {
  containerRatio: string;
  customContainerW?: number;
  customContainerH?: number;
  imageRatio: string;
  customImageW?: number;
  customImageH?: number;
  gridColumns: number;
  padding2K: number;
  gap2K: number;
  containerBgColor?: string;
  useTransparentBg?: boolean;
  images: PlacedImage[];
  showGridlines?: boolean;
  placementSize?: "small" | "medium" | "large";
  imageBorderRadius2K?: number;
  imageShadowBlur2K?: number;
  imageShadowOffset2K?: number;
  imageShadowOpacity?: number;
}

export class AspectGridCollageify {
  private config: CollageConfig;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  // Cache for loaded images
  private imageCache = new Map<string, HTMLImageElement>();
  private loadingImages = new Set<string>();

  // Interactive states
  private activeImageId: string | null = null;
  private draggedImageId: string | null = null;
  private dragStartOffset = { x: 0, y: 0 };
  private dragCurrentPos = { x: 0, y: 0 };
  private draggedOverCell: { x: number; y: number } | null = null;
  private hoveredPlaceholder: { gridX: number; gridY: number } | null = null;
  private isDragging = false;

  // Callback events
  private changeCallbacks: Array<(images: PlacedImage[]) => void> = [];
  private activeCallbacks: Array<(id: string | null) => void> = [];
  private clickCallbacks: Array<(x: number, y: number) => void> = [];

  constructor(config: CollageConfig, canvasElement?: HTMLCanvasElement) {
    this.config = {
      showGridlines: true,
      placementSize: "medium",
      containerBgColor: "#ffffff",
      useTransparentBg: false,
      imageBorderRadius2K: 24,
      imageShadowBlur2K: 0,
      imageShadowOffset2K: 0,
      imageShadowOpacity: 0.2,
      ...config,
    };

    if (canvasElement) {
      this.canvas = canvasElement;
      this.ctx = canvasElement.getContext("2d");
      this.initEvents();
    }
  }

  // --- API Configuration Get/Set ---

  public getConfig(): CollageConfig {
    return this.config;
  }

  public updateConfig(newConfig: Partial<CollageConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.render();
  }

  public getImages(): PlacedImage[] {
    return this.config.images;
  }

  public setImages(images: PlacedImage[]) {
    this.config.images = images;
    this.triggerChange();
    this.render();
  }

  public getActiveImageId(): string | null {
    return this.activeImageId;
  }

  public setActiveImageId(id: string | null) {
    this.activeImageId = id;
    this.triggerActiveChange();
    this.render();
  }

  // --- Event Callbacks registration ---

  public onImagesChanged(callback: (images: PlacedImage[]) => void) {
    this.changeCallbacks.push(callback);
  }

  public onActiveImageChanged(callback: (id: string | null) => void) {
    this.activeCallbacks.push(callback);
  }

  public onCellClicked(callback: (x: number, y: number) => void) {
    this.clickCallbacks.push(callback);
  }

  private triggerChange() {
    this.changeCallbacks.forEach((cb) => cb(this.config.images));
  }

  private triggerActiveChange() {
    this.activeCallbacks.forEach((cb) => cb(this.activeImageId));
  }

  private triggerCellClick(x: number, y: number) {
    this.clickCallbacks.forEach((cb) => cb(x, y));
  }

  // --- Image Cache helpers ---

  private getOrLoadImage(src: string): HTMLImageElement | null {
    if (this.imageCache.has(src)) {
      return this.imageCache.get(src)!;
    }

    if (this.loadingImages.has(src)) {
      return null;
    }

    this.loadingImages.add(src);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      this.imageCache.set(src, img);
      this.loadingImages.delete(src);
      this.render();
    };
    img.onerror = () => {
      this.loadingImages.delete(src);
      console.error("Failed to load image:", src);
    };
    img.src = src;
    return null;
  }

  private async preloadAllImages(): Promise<void> {
    const promises = this.config.images.map((imgData) => {
      if (this.imageCache.has(imgData.src)) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          this.imageCache.set(imgData.src, img);
          resolve();
        };
        img.onerror = () => {
          console.error("Preload failed:", imgData.src);
          resolve(); // Resolve anyway to not block entire sequence
        };
        img.src = imgData.src;
      });
    });
    await Promise.all(promises);
  }

  // --- Grid placement collision validation ---

  public canPlaceImage(imgId: string | null, x: number, y: number, spanSize: number, gridRows: number): boolean {
    if (x + spanSize > this.config.gridColumns || y + spanSize > gridRows || x < 0 || y < 0) return false;

    for (const img of this.config.images) {
      if (imgId && img.id === imgId) continue;
      const overlap = !(
        x + spanSize <= img.gridX ||
        img.gridX + img.span <= x ||
        y + spanSize <= img.gridY ||
        img.gridY + img.span <= y
      );
      if (overlap) return false;
    }

    return true;
  }

  // --- Placed Images Editing Actions ---

  public addImage(img: PlacedImage) {
    this.config.images = [...this.config.images, img];
    this.activeImageId = img.id;
    this.triggerChange();
    this.triggerActiveChange();
    this.render();
  }

  public removeImage(imgId: string) {
    this.config.images = this.config.images.filter((img) => img.id !== imgId);
    if (this.activeImageId === imgId) {
      this.activeImageId = null;
      this.triggerActiveChange();
    }
    this.triggerChange();
    this.render();
  }

  public updateImage(imgId: string, updates: Partial<PlacedImage>) {
    this.config.images = this.config.images.map((img) =>
      img.id === imgId ? { ...img, ...updates } : img
    );
    this.triggerChange();
    this.render();
  }

  public modifyImageSpan(imgId: string, delta: number, gridRows: number): boolean {
    const img = this.config.images.find((i) => i.id === imgId);
    if (!img) return false;

    const newSpan = Math.max(1, Math.min(this.config.gridColumns, img.span + delta));
    if (newSpan === img.span) return false;

    if (this.canPlaceImage(imgId, img.gridX, img.gridY, newSpan, gridRows)) {
      this.config.images = this.config.images.map((i) =>
        i.id === imgId ? { ...i, span: newSpan } : i
      );
      this.triggerChange();
      this.render();
      return true;
    }
    return false;
  }

  public stepImagePosition(imgId: string, dir: "up" | "down" | "left" | "right", gridRows: number): boolean {
    const img = this.config.images.find((i) => i.id === imgId);
    if (!img) return false;

    let targetX = img.gridX;
    let targetY = img.gridY;

    if (dir === "up") targetY = Math.max(0, targetY - 1);
    if (dir === "down") targetY = Math.min(gridRows - img.span, targetY + 1);
    if (dir === "left") targetX = Math.max(0, targetX - 1);
    if (dir === "right") targetX = Math.min(this.config.gridColumns - img.span, targetX + 1);

    if (targetX === img.gridX && targetY === img.gridY) return false;

    if (this.canPlaceImage(imgId, targetX, targetY, img.span, gridRows)) {
      this.config.images = this.config.images.map((i) =>
        i.id === imgId ? { ...i, gridX: targetX, gridY: targetY } : i
      );
      this.triggerChange();
      this.render();
      return true;
    }
    return false;
  }

  public pushDownBelow(imgId: string, gridRows: number): boolean {
    const activeImg = this.config.images.find((i) => i.id === imgId);
    if (!activeImg) return false;

    const boundaryY = activeImg.gridY + activeImg.span;
    const targets = this.config.images.filter((img) => img.id !== imgId && img.gridY >= boundaryY);

    const canShiftAll = targets.every((img) => img.gridY + img.span + 1 <= gridRows);
    if (!canShiftAll) return false;

    this.config.images = this.config.images.map((img) => {
      if (img.id !== imgId && img.gridY >= boundaryY) {
        return { ...img, gridY: img.gridY + 1 };
      }
      return img;
    });
    this.triggerChange();
    this.render();
    return true;
  }

  public pullUpBelow(imgId: string): boolean {
    const activeImg = this.config.images.find((i) => i.id === imgId);
    if (!activeImg) return false;

    const boundaryY = activeImg.gridY + activeImg.span;

    const tempImages = this.config.images.map((img) => {
      if (img.id !== imgId && img.gridY >= boundaryY) {
        return { ...img, gridY: img.gridY - 1 };
      }
      return img;
    });

    let isValid = true;
    for (let i = 0; i < tempImages.length; i++) {
      const img = tempImages[i];
      if (img.gridY < 0) {
        isValid = false;
        break;
      }
      for (let j = i + 1; j < tempImages.length; j++) {
        const other = tempImages[j];
        const overlap = !(
          img.gridX + img.span <= other.gridX ||
          other.gridX + other.span <= img.gridX ||
          img.gridY + img.span <= other.gridY ||
          other.gridY + other.span <= img.gridY
        );
        if (overlap) {
          isValid = false;
          break;
        }
      }
      if (!isValid) break;
    }

    if (!isValid) return false;

    this.config.images = tempImages;
    this.triggerChange();
    this.render();
    return true;
  }

  // --- Layout Calculations (Geometric Math) ---

  public calculateLayout(width: number, height: number) {
    const containerRatioVal = (() => {
      if (this.config.containerRatio === "custom") {
        return (this.config.customContainerW || 3) / (this.config.customContainerH || 4);
      }
      const parts = this.config.containerRatio.split(":");
      return Number(parts[0]) / Number(parts[1]);
    })();

    const imageRatioVal = (() => {
      if (this.config.imageRatio === "custom") {
        return (this.config.customImageW || 16) / (this.config.customImageH || 9);
      }
      const parts = this.config.imageRatio.split(":");
      return Number(parts[0]) / Number(parts[1]);
    })();

    const scale = width / 2048;
    const padding = this.config.padding2K * scale;
    const gap = this.config.gap2K * scale;

    const contentW = Math.max(50, width - padding * 2);
    const contentH = Math.max(50, height - padding * 2);

    const cellW = (contentW - (this.config.gridColumns - 1) * gap) / this.config.gridColumns;
    const cellH = (cellW + gap) / imageRatioVal - gap;

    const gridRows = Math.floor((contentH + gap) / (cellH + gap));

    const gridW = this.config.gridColumns * cellW + (this.config.gridColumns - 1) * gap;
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

  // --- Visual mode mouse interaction listeners ---

  private initEvents() {
    if (!this.canvas) return;

    // Get scaled mouse position inside canvas (in logical CSS pixels)
    const getMouseCoords = (e: MouseEvent) => {
      const rect = this.canvas!.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    this.canvas.addEventListener("mousedown", (e) => {
      const mouse = getMouseCoords(e);
      const rect = this.canvas!.getBoundingClientRect();
      const layout = this.calculateLayout(rect.width || this.canvas!.width, rect.height || this.canvas!.height);

      // A. Check hit placed image
      const hitImg = this.hitTest(mouse.x, mouse.y, layout);
      if (hitImg) {
        this.activeImageId = hitImg.id;
        this.draggedImageId = hitImg.id;
        this.isDragging = true;

        const imgRect = this.getImageRect(hitImg, layout);
        this.dragStartOffset = {
          x: mouse.x - imgRect.x,
          y: mouse.y - imgRect.y,
        };
        this.dragCurrentPos = { x: mouse.x, y: mouse.y };

        this.triggerActiveChange();
        this.render();
        return;
      }

      // B. Check hit placeholders
      const targetSpan = this.getCurrentTargetSpan();
      const placeholders = this.getPlaceholders(targetSpan, layout.gridRows);
      const hitPlaceholder = placeholders.find((slot) => {
        const slotX = layout.offsetX + slot.gridX * (layout.cellW + layout.gap);
        const slotY = layout.offsetY + slot.gridY * (layout.cellH + layout.gap);
        const slotW = slot.span * layout.cellW + (slot.span - 1) * layout.gap;
        const slotH = slot.span * layout.cellH + (slot.span - 1) * layout.gap;

        return (
          mouse.x >= slotX &&
          mouse.x <= slotX + slotW &&
          mouse.y >= slotY &&
          mouse.y <= slotY + slotH
        );
      });

      if (hitPlaceholder) {
        this.triggerCellClick(hitPlaceholder.gridX, hitPlaceholder.gridY);
        return;
      }

      // Clicked blank area -> deselect
      if (this.activeImageId) {
        this.activeImageId = null;
        this.triggerActiveChange();
        this.render();
      }
    });

    this.canvas.addEventListener("mousemove", (e) => {
      const mouse = getMouseCoords(e);
      const rect = this.canvas!.getBoundingClientRect();
      const layout = this.calculateLayout(rect.width || this.canvas!.width, rect.height || this.canvas!.height);

      if (this.isDragging && this.draggedImageId) {
        this.dragCurrentPos = { x: mouse.x, y: mouse.y };

        // Calculate snapped grid coords from drag pos
        const snapX = mouse.x - this.dragStartOffset.x;
        const snapY = mouse.y - this.dragStartOffset.y;

        const col = Math.round((snapX - layout.offsetX) / (layout.cellW + layout.gap));
        const row = Math.round((snapY - layout.offsetY) / (layout.cellH + layout.gap));

        const draggedImg = this.config.images.find((img) => img.id === this.draggedImageId);
        if (draggedImg) {
          const targetX = Math.max(0, Math.min(this.config.gridColumns - draggedImg.span, col));
          const targetY = Math.max(0, Math.min(layout.gridRows - draggedImg.span, row));

          if (!this.draggedOverCell || this.draggedOverCell.x !== targetX || this.draggedOverCell.y !== targetY) {
            this.draggedOverCell = { x: targetX, y: targetY };
          }
        }
        this.render();
      } else {
        // Track hover on placeholders for highlights
        const targetSpan = this.getCurrentTargetSpan();
        const placeholders = this.getPlaceholders(targetSpan, layout.gridRows);
        const hitPlaceholder = placeholders.find((slot) => {
          const slotX = layout.offsetX + slot.gridX * (layout.cellW + layout.gap);
          const slotY = layout.offsetY + slot.gridY * (layout.cellH + layout.gap);
          const slotW = slot.span * layout.cellW + (slot.span - 1) * layout.gap;
          const slotH = slot.span * layout.cellH + (slot.span - 1) * layout.gap;

          return (
            mouse.x >= slotX &&
            mouse.x <= slotX + slotW &&
            mouse.y >= slotY &&
            mouse.y <= slotY + slotH
          );
        });

        if (hitPlaceholder) {
          if (!this.hoveredPlaceholder || this.hoveredPlaceholder.gridX !== hitPlaceholder.gridX || this.hoveredPlaceholder.gridY !== hitPlaceholder.gridY) {
            this.hoveredPlaceholder = { gridX: hitPlaceholder.gridX, gridY: hitPlaceholder.gridY };
            this.canvas!.style.cursor = "pointer";
            this.render();
          }
        } else {
          if (this.hoveredPlaceholder) {
            this.hoveredPlaceholder = null;
            this.canvas!.style.cursor = "default";
            this.render();
          }

          // Hover cursor check for placed images
          const hitImg = this.hitTest(mouse.x, mouse.y, layout);
          this.canvas!.style.cursor = hitImg ? "move" : "default";
        }
      }
    });

    window.addEventListener("mouseup", () => {
      if (this.isDragging && this.draggedImageId && this.draggedOverCell) {
        const sourceImg = this.config.images.find((img) => img.id === this.draggedImageId);
        if (sourceImg) {
          const rect = this.canvas!.getBoundingClientRect();
          const layout = this.calculateLayout(rect.width || this.canvas!.width, rect.height || this.canvas!.height);
          const targetX = this.draggedOverCell.x;
          const targetY = this.draggedOverCell.y;

          if (this.canPlaceImage(this.draggedImageId, targetX, targetY, sourceImg.span, layout.gridRows)) {
            // Drop successfully
            this.config.images = this.config.images.map((img) =>
              img.id === this.draggedImageId ? { ...img, gridX: targetX, gridY: targetY } : img
            );
            this.triggerChange();
          } else {
            // Swap positions if exact same span size
            const targetImg = this.config.images.find((img) => img.gridX === targetX && img.gridY === targetY);
            if (
              targetImg &&
              targetImg.span === sourceImg.span &&
              this.canPlaceImage(this.draggedImageId, targetImg.gridX, targetImg.gridY, sourceImg.span, layout.gridRows)
            ) {
              this.config.images = this.config.images.map((img) => {
                if (img.id === sourceImg.id) return { ...img, gridX: targetImg.gridX, gridY: targetImg.gridY };
                if (img.id === targetImg.id) return { ...img, gridX: sourceImg.gridX, gridY: sourceImg.gridY };
                return img;
              });
              this.triggerChange();
            }
          }
        }
      }

      this.isDragging = false;
      this.draggedImageId = null;
      this.draggedOverCell = null;
      this.render();
    });
  }

  private hitTest(x: number, y: number, layout: ReturnType<typeof this.calculateLayout>): PlacedImage | null {
    // Traverse backwards to select the top-most rendered image first
    for (let i = this.config.images.length - 1; i >= 0; i--) {
      const img = this.config.images[i];
      const rect = this.getImageRect(img, layout);
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
        return img;
      }
    }
    return null;
  }

  private getImageRect(img: PlacedImage, layout: ReturnType<typeof this.calculateLayout>) {
    const w = img.span * layout.cellW + (img.span - 1) * layout.gap;
    const h = img.span * layout.cellH + (img.span - 1) * layout.gap;
    const x = layout.offsetX + img.gridX * (layout.cellW + layout.gap);
    const y = layout.offsetY + img.gridY * (layout.cellH + layout.gap);
    return { x, y, w, h };
  }

  private getCurrentTargetSpan(): number {
    const size = this.config.placementSize || "medium";
    const gridColumns = this.config.gridColumns;

    switch (gridColumns) {
      case 4:
        return { small: 1, medium: 2, large: 3 }[size];
      case 6:
        return { small: 1, medium: 2, large: 3 }[size];
      case 8:
        return { small: 2, medium: 3, large: 4 }[size];
      case 12:
        return { small: 3, medium: 4, large: 6 }[size];
      default:
        const s = Math.max(1, Math.floor(gridColumns / 4));
        const m = Math.min(gridColumns, Math.max(s + 1, Math.floor(gridColumns / 3)));
        const l = Math.min(gridColumns, Math.max(m + 1, Math.floor(gridColumns / 2)));
        return { small: s, medium: m, large: l }[size];
    }
  }

  public getPlaceholders(targetSpan: number, gridRows: number): Array<{ gridX: number; gridY: number; span: number }> {
    const gridColumns = this.config.gridColumns;
    const occupied = Array.from({ length: gridColumns }, () => Array(gridRows).fill(false));

    for (const img of this.config.images) {
      for (let dx = 0; dx < img.span; dx++) {
        for (let dy = 0; dy < img.span; dy++) {
          const cx = img.gridX + dx;
          const ry = img.gridY + dy;
          if (cx < gridColumns && ry < gridRows) {
            occupied[cx][ry] = true;
          }
        }
      }
    }

    const result: Array<{ gridX: number; gridY: number; span: number }> = [];
    const tempOccupied = occupied.map((row) => [...row]);

    for (let r = 0; r <= gridRows - targetSpan; r++) {
      for (let c = 0; c <= gridColumns - targetSpan; c++) {
        let isFree = true;
        for (let dx = 0; dx < targetSpan; dx++) {
          for (let dy = 0; dy < targetSpan; dy++) {
            if (tempOccupied[c + dx][r + dy]) {
              isFree = false;
              break;
            }
          }
          if (!isFree) break;
        }

        if (isFree) {
          result.push({ gridX: c, gridY: r, span: targetSpan });
          for (let dx = 0; dx < targetSpan; dx++) {
            for (let dy = 0; dy < targetSpan; dy++) {
              tempOccupied[c + dx][r + dy] = true;
            }
          }
        }
      }
    }
    return result;
  }

  // --- Rendering Pipeline ---

  public render(drawUI: boolean = true) {
    if (!this.canvas || !this.ctx) return;

    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : (this.canvas.width / dpr || 300);
    const h = rect.height > 0 ? rect.height : (this.canvas.height / dpr || 400);

    const targetWidth = Math.round(w * dpr);
    const targetHeight = Math.round(h * dpr);

    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
    }

    this.ctx.save();
    this.ctx.clearRect(0, 0, targetWidth, targetHeight);
    this.ctx.scale(dpr, dpr);
    this.draw(this.ctx, w, h, drawUI);
    this.ctx.restore();
  }

  /**
   * The master draw function: compiles background, images, and overlays.
   * Can be shared between interactive Canvas on the page and high-res offscreen Canvas.
   */
  public draw(ctx: CanvasRenderingContext2D, width: number, height: number, drawUI: boolean) {
    const layout = this.calculateLayout(width, height);

    // 1. Draw Background
    if (!this.config.useTransparentBg) {
      ctx.fillStyle = this.config.containerBgColor || "#ffffff";
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    // Track dragged item to render it floating on top later
    let draggedImgData: PlacedImage | null = null;
    let draggedImgRect: { x: number; y: number; w: number; h: number } | null = null;

    // 2. Draw Placed Images
    for (const img of this.config.images) {
      const rect = this.getImageRect(img, layout);
      const isDraggedSelf = this.isDragging && this.draggedImageId === img.id;
      const borderRadius = (img.borderRadius2K ?? this.config.imageBorderRadius2K ?? 24) * layout.scale;

      if (isDraggedSelf && drawUI) {
        draggedImgData = img;
        draggedImgRect = rect;

        // Draw a light dashed placeholder at the original position
        ctx.save();
        ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.fillStyle = "rgba(241, 245, 249, 0.05)";
        ctx.beginPath();
        ctx.roundRect(rect.x, rect.y, rect.w, rect.h, borderRadius);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        continue;
      }

      ctx.save();
      
      const shadowBlur = (img.shadowBlur2K ?? this.config.imageShadowBlur2K ?? 0) * layout.scale;
      const shadowOffset = (img.shadowOffset2K ?? this.config.imageShadowOffset2K ?? 0) * layout.scale;
      const shadowOpacity = img.shadowOpacity ?? this.config.imageShadowOpacity ?? 0.2;

      // Draw shadow first on a solid backing path (filled with white or container bg color)
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

      // Clip and draw image inside
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, borderRadius);
      ctx.clip();

      const imgElement = this.getOrLoadImage(img.src);
      if (imgElement) {
        // Handle equivalent object-fit: cover drawing
        drawImageCover(ctx, imgElement, rect.x, rect.y, rect.w, rect.h);
      } else {
        // Draw loading state placeholder
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = "#94a3b8";
        ctx.font = `bold 12px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("加载中...", rect.x + rect.w / 2, rect.y + rect.h / 2);
      }
      ctx.restore();

      // Draw border
      ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
      ctx.lineWidth = Math.max(1, 1 * layout.scale);
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, borderRadius);
      ctx.stroke();

      ctx.restore();
    }

    // 3. UI Overlays (Only drawn in interactive editor mode)
    if (drawUI) {
      // A. Outer dashed boundary
      ctx.strokeStyle = "rgba(79, 70, 229, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.roundRect(layout.padding, layout.padding, width - layout.padding * 2, height - layout.padding * 2, 12);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // B. Helper gridlines
      if (this.config.showGridlines) {
        ctx.strokeStyle = "rgba(203, 213, 225, 0.35)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        // Vertical lines
        for (let i = 1; i < this.config.gridColumns; i++) {
          const lineX = layout.offsetX + i * layout.cellW + (i - 1) * layout.gap + layout.gap / 2;
          ctx.beginPath();
          ctx.moveTo(lineX, layout.padding);
          ctx.lineTo(lineX, layout.padding + layout.gridH);
          ctx.stroke();
        }

        // Horizontal lines
        for (let i = 1; i < layout.gridRows; i++) {
          const lineY = layout.offsetY + i * layout.cellH + (i - 1) * layout.gap + layout.gap / 2;
          ctx.beginPath();
          ctx.moveTo(layout.padding, lineY);
          ctx.lineTo(layout.padding + layout.gridW, lineY);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // C. Disjoint empty slot placeholders
      const targetSpan = this.getCurrentTargetSpan();
      const placeholders = this.getPlaceholders(targetSpan, layout.gridRows);

      for (const slot of placeholders) {
        const slotX = layout.offsetX + slot.gridX * (layout.cellW + layout.gap);
        const slotY = layout.offsetY + slot.gridY * (layout.cellH + layout.gap);
        const slotW = slot.span * layout.cellW + (slot.span - 1) * layout.gap;
        const slotH = slot.span * layout.cellH + (slot.span - 1) * layout.gap;

        const isHovered =
          this.hoveredPlaceholder &&
          this.hoveredPlaceholder.gridX === slot.gridX &&
          this.hoveredPlaceholder.gridY === slot.gridY;

        ctx.save();
        ctx.strokeStyle = isHovered ? "rgba(79, 70, 229, 0.5)" : "rgba(79, 70, 229, 0.2)";
        ctx.lineWidth = isHovered ? 2 : 1.5;
        ctx.setLineDash([5, 5]);
        ctx.fillStyle = isHovered ? "rgba(79, 70, 229, 0.05)" : "transparent";

        const slotRadius = Math.max(6, (this.config.imageBorderRadius2K ?? 24) * layout.scale);
        ctx.beginPath();
        ctx.roundRect(slotX, slotY, slotW, slotH, slotRadius);
        ctx.fill();
        ctx.stroke();

        // Plus icon & text
        const color = isHovered ? "rgba(79, 70, 229, 0.8)" : "rgba(148, 163, 184, 0.5)";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);

        const showText = slotW >= 90 && slotH >= 65;
        const centerCX = slotX + slotW / 2;
        const centerCY = showText ? (slotY + slotH / 2 - 10) : (slotY + slotH / 2);
        const plusSize = 7;

        // Draw plus sign
        ctx.beginPath();
        ctx.moveTo(centerCX - plusSize, centerCY);
        ctx.lineTo(centerCX + plusSize, centerCY);
        ctx.moveTo(centerCX, centerCY - plusSize);
        ctx.lineTo(centerCX, centerCY + plusSize);
        ctx.stroke();

        if (showText) {
          // Draw text
          ctx.fillStyle = isHovered ? "rgba(79, 70, 229, 1)" : "rgba(148, 163, 184, 0.7)";
          ctx.font = `500 12px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText("点击上传或拖入", slotX + slotW / 2, centerCY + plusSize + 6);

          // Coordinates tag
          ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
          ctx.font = `10px monospace`;
          ctx.fillText(`(${slot.gridX + 1}, ${slot.gridY + 1})`, slotX + slotW / 2, centerCY + plusSize + 22);
        }

        ctx.restore();
      }

      // D. Selection Ring highlight
      if (this.activeImageId) {
        const activeImg = this.config.images.find((img) => img.id === this.activeImageId);
        if (activeImg) {
          const rect = this.getImageRect(activeImg, layout);
          ctx.save();
          ctx.strokeStyle = "rgba(79, 70, 229, 1)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          // Draw with outer offset
          const offset = 3;
          const activeBorderRadius = (activeImg.borderRadius2K ?? this.config.imageBorderRadius2K ?? 24) * layout.scale;
          const ringRadius = activeBorderRadius + offset;
          ctx.roundRect(
            rect.x - offset,
            rect.y - offset,
            rect.w + offset * 2,
            rect.h + offset * 2,
            ringRadius
          );
          ctx.stroke();
          ctx.restore();
        }
      }

      // E. Snap Drop preview overlay
      if (this.isDragging && this.draggedOverCell && this.draggedImageId) {
        const draggedImg = this.config.images.find((img) => img.id === this.draggedImageId);
        if (draggedImg) {
          const previewX = layout.offsetX + this.draggedOverCell.x * (layout.cellW + layout.gap);
          const previewY = layout.offsetY + this.draggedOverCell.y * (layout.cellH + layout.gap);
          const previewW = draggedImg.span * layout.cellW + (draggedImg.span - 1) * layout.gap;
          const previewH = draggedImg.span * layout.cellH + (draggedImg.span - 1) * layout.gap;

          ctx.save();
          ctx.strokeStyle = "rgba(79, 70, 229, 1)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.fillStyle = "rgba(79, 70, 229, 0.12)";

          const previewRadius = (draggedImg.borderRadius2K ?? this.config.imageBorderRadius2K ?? 24) * layout.scale;
          ctx.beginPath();
          ctx.roundRect(previewX, previewY, previewW, previewH, previewRadius);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // F. Floating Dragged Image Card (Floats on top of all gridlines/items)
      if (this.isDragging && draggedImgData && draggedImgRect) {
        const floatX = this.dragCurrentPos.x - this.dragStartOffset.x;
        const floatY = this.dragCurrentPos.y - this.dragStartOffset.y;
        const floatW = draggedImgRect.w;
        const floatH = draggedImgRect.h;

        const borderRadius = (draggedImgData.borderRadius2K ?? this.config.imageBorderRadius2K ?? 24) * layout.scale;

        ctx.save();
        // A. Draw solid shadow backing first
        ctx.beginPath();
        ctx.roundRect(floatX, floatY, floatW, floatH, borderRadius);
        ctx.shadowColor = "rgba(15, 23, 42, 0.4)";
        ctx.shadowBlur = 16;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();

        ctx.save();
        // B. Clip and draw image inside
        ctx.globalAlpha = 0.85; // slight transparency to see layout guides underneath
        ctx.beginPath();
        ctx.roundRect(floatX, floatY, floatW, floatH, borderRadius);
        ctx.clip();

        const imgElement = this.getOrLoadImage(draggedImgData.src);
        if (imgElement) {
          drawImageCover(ctx, imgElement, floatX, floatY, floatW, floatH);
        } else {
          ctx.fillStyle = "#e2e8f0";
          ctx.fillRect(floatX, floatY, floatW, floatH);
        }
        ctx.restore();

        // High-contrast blue border for active floating outline
        ctx.save();
        ctx.strokeStyle = "rgba(79, 70, 229, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(floatX, floatY, floatW, floatH, borderRadius);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // --- Headless Offscreen Export PNG ---

  public async exportPNG(targetWidth: number = 2048): Promise<string> {
    const containerRatioVal = (() => {
      if (this.config.containerRatio === "custom") {
        return (this.config.customContainerW || 3) / (this.config.customContainerH || 4);
      }
      const parts = this.config.containerRatio.split(":");
      return Number(parts[0]) / Number(parts[1]);
    })();

    const exportHeight = Math.round(targetWidth / containerRatioVal);

    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = targetWidth;
    offscreenCanvas.height = exportHeight;

    const offscreenCtx = offscreenCanvas.getContext("2d");
    if (!offscreenCtx) throw new Error("Could not create 2D offscreen canvas context");

    // Preload all assets first to guarantee synchronous draw completion
    await this.preloadAllImages();

    // Render cleanly without any auxiliary gridlines or active boundaries
    this.draw(offscreenCtx, targetWidth, exportHeight, false);

    return offscreenCanvas.toDataURL("image/png");
  }
}

/**
 * Cover crop algorithm helper for Canvas 2D
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height;

  if (imgRatio > targetRatio) {
    // Image is wider than cell -> Crop left and right sides
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    // Image is taller than cell -> Crop top and bottom sides
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
