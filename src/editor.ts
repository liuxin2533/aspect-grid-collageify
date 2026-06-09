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

export interface CanvasCollageEditorOptions {
  multiSelect?: boolean;
  keyboard?: boolean;
  dragMove?: boolean;
  dragSwap?: boolean;
  dragInsert?: boolean;
  quickReplace?: boolean;
  preventDefaultFileDrop?: boolean;
  fileResolver?: (file: File) => Promise<ImageInput | null>;
  overlay?: EditorOverlayOptions;
}

type EditorEventMap = {
  change: (images: CollageImage[]) => void;
  selectionchange: (ids: string[]) => void;
  activechange: (id: string | null) => void;
  cellclick: (placement: GridPlacement) => void;
  replacerequest: (id: string) => void;
  toolbaraction: (action: HoverToolbarAction, imageId: string) => void;
  error: (error: unknown) => void;
};

const DEFAULT_EDITOR_OPTIONS: Required<Omit<CanvasCollageEditorOptions, "fileResolver" | "overlay">> = {
  multiSelect: true,
  keyboard: true,
  dragMove: true,
  dragSwap: true,
  dragInsert: true,
  quickReplace: true,
  preventDefaultFileDrop: true,
};

export class CanvasCollageEditor {
  public readonly core: CollageCore;

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

  constructor(private canvas: HTMLCanvasElement, core: CollageCore, options: CanvasCollageEditorOptions = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create 2D canvas context");

    this.core = core;
    this.ctx = ctx;
    this.options = { ...DEFAULT_EDITOR_OPTIONS, ...options };
    this.disposers.push(this.core.onChange((images) => {
      this.syncSelectionWithImages(images);
      this.render();
      this.emit("change", images);
    }));
    this.bindEvents();
    this.render();
  }

  public static create(canvas: HTMLCanvasElement, options: CollageOptions, editorOptions?: CanvasCollageEditorOptions) {
    return new CanvasCollageEditor(canvas, new CollageCore(options), editorOptions);
  }

  public getCore(): CollageCore {
    return this.core;
  }

  public getSelection(): string[] {
    return [...this.selectedIds];
  }

  public setSelection(ids: string[]) {
    const valid = ids.filter((id) => this.core.getImages().some((image) => image.id === id));
    this.selectedIds = new Set(valid);
    this.activeId = valid[valid.length - 1] || null;
    this.emit("selectionchange", this.getSelection());
    this.emit("activechange", this.activeId);
    this.render();
  }

  public getActiveId(): string | null {
    return this.activeId;
  }

  public setActiveId(id: string | null) {
    if (id && !this.core.getImages().some((image) => image.id === id)) return;
    this.activeId = id;
    this.selectedIds = id ? new Set([id]) : new Set();
    this.emit("activechange", this.activeId);
    this.emit("selectionchange", this.getSelection());
    this.render();
  }

  public clearSelection() {
    if (!this.activeId && this.selectedIds.size === 0) return;
    this.activeId = null;
    this.selectedIds.clear();
    this.emit("activechange", null);
    this.emit("selectionchange", []);
    this.render();
  }

  public setPendingInsertPlacement(placement: GridPlacement | null) {
    this.pendingInsertPlacement = placement;
  }

  public on<K extends keyof EditorEventMap>(event: K, callback: EditorEventMap[K]): Unsubscribe {
    const callbacks = this.eventCallbacks[event] || new Set<(...args: unknown[]) => void>();
    callbacks.add(callback as (...args: unknown[]) => void);
    this.eventCallbacks[event] = callbacks;
    return () => callbacks.delete(callback as (...args: unknown[]) => void);
  }

  public resize() {
    this.render();
  }

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
    drawEditorOverlay({
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
    });
    this.ctx.restore();
  }

  public destroy() {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.objectUrls.clear();
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    if (event.key === "Delete" || event.key === "Backspace") {
      const ids = this.getSelection();
      if (ids.length === 0) return false;
      const changed = this.core.removeImages(ids);
      if (changed) {
        event.preventDefault();
        this.clearSelection();
      }
      return changed;
    }

    const direction = getDirectionFromKey(event.key);
    if (!direction) return false;

    const rows = this.getCurrentGridRows();
    const changed = event.ctrlKey || event.metaKey
      ? this.core.resizeImages(this.getSelection(), direction === "up" ? -1 : direction === "down" ? 1 : 0, rows)
      : this.core.moveImagesByDirection(this.getSelection(), direction, rows);

    if (changed) event.preventDefault();
    return changed;
  }

  public async insertFiles(files: FileList | File[], options?: Partial<InsertImagesOptions>): Promise<CollageImage[]> {
    const pendingPlacement = this.pendingInsertPlacement;
    this.pendingInsertPlacement = null;

    const inputs = await this.resolveFiles(files);
    if (inputs.length === 0) return [];

    if (pendingPlacement) {
      return this.insertResolvedInputsAtPlacement(inputs, pendingPlacement);
    }

    const inserted = this.core.insertImages(inputs, {
      gridRows: options?.gridRows ?? this.getCurrentGridRows(),
      span: options?.span,
      placementPreset: options?.placementPreset,
    });
    if (inserted.length > 0) this.setSelection([inserted[inserted.length - 1].id]);
    return inserted;
  }

  public async insertFilesAt(files: FileList | File[], point: GridPoint): Promise<CollageImage[]> {
    const inputs = await this.resolveFiles(files);
    if (inputs.length === 0) return [];

    const placement = this.getInsertionPlacementAt(point);
    return this.insertResolvedInputsAtPlacement(inputs, placement);
  }

  public async replaceActiveFile(file: File): Promise<boolean> {
    if (!this.activeId) return false;
    return this.replaceFile(this.activeId, file);
  }

  public async replaceFile(id: string, file: File): Promise<boolean> {
    const input = await this.resolveFile(file);
    if (!input) return false;
    return this.core.replaceImage(id, input);
  }

  private bindEvents() {
    const onMouseDown = (event: MouseEvent) => this.handleMouseDown(event);
    const onMouseMove = (event: MouseEvent) => this.handleMouseMove(event);
    const onMouseUp = () => this.handleMouseUp();
    const onDblClick = (event: MouseEvent) => this.handleDoubleClick(event);
    const onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);

    this.canvas.addEventListener("mousedown", onMouseDown);
    this.canvas.addEventListener("mousemove", onMouseMove);
    this.canvas.addEventListener("dblclick", onDblClick);
    window.addEventListener("mouseup", onMouseUp);
    this.disposers.push(() => this.canvas.removeEventListener("mousedown", onMouseDown));
    this.disposers.push(() => this.canvas.removeEventListener("mousemove", onMouseMove));
    this.disposers.push(() => this.canvas.removeEventListener("dblclick", onDblClick));
    this.disposers.push(() => window.removeEventListener("mouseup", onMouseUp));

    if (this.options.keyboard) {
      this.canvas.tabIndex = this.canvas.tabIndex >= 0 ? this.canvas.tabIndex : 0;
      this.canvas.addEventListener("keydown", onKeyDown);
      this.disposers.push(() => this.canvas.removeEventListener("keydown", onKeyDown));
    }

    if (this.options.dragInsert) this.bindFileDropEvents();
  }

  private bindFileDropEvents() {
    const isFileEvent = (event: DragEvent) => !!event.dataTransfer && Array.from(event.dataTransfer.types).includes("Files");
    const onDrag = (event: DragEvent) => {
      if (!isFileEvent(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";

      const slot = this.getHitSlot(this.getMousePoint(event));
      this.hoveredSlot = slot ? { x: slot.gridX, y: slot.gridY } : null;
      this.render();
    };
    const onDrop = (event: DragEvent) => {
      if (!isFileEvent(event) || !event.dataTransfer) return;
      event.preventDefault();
      event.stopPropagation();
      const point = this.getMousePoint(event);
      this.hoveredSlot = null;
      this.insertFilesAt(event.dataTransfer.files, point).catch((error) => this.emit("error", error));
      this.canvas.focus();
    };
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget && this.canvas.contains(event.relatedTarget as Node)) return;
      this.hoveredSlot = null;
      this.render();
    };

    this.canvas.addEventListener("dragenter", onDrag);
    this.canvas.addEventListener("dragover", onDrag);
    this.canvas.addEventListener("dragleave", onDragLeave);
    this.canvas.addEventListener("drop", onDrop);
    this.disposers.push(() => this.canvas.removeEventListener("dragenter", onDrag));
    this.disposers.push(() => this.canvas.removeEventListener("dragover", onDrag));
    this.disposers.push(() => this.canvas.removeEventListener("dragleave", onDragLeave));
    this.disposers.push(() => this.canvas.removeEventListener("drop", onDrop));

    if (this.options.preventDefaultFileDrop) {
      const preventWindowDrop = (event: DragEvent) => {
        if (isFileEvent(event)) event.preventDefault();
      };
      window.addEventListener("dragover", preventWindowDrop);
      window.addEventListener("drop", preventWindowDrop);
      this.disposers.push(() => window.removeEventListener("dragover", preventWindowDrop));
      this.disposers.push(() => window.removeEventListener("drop", preventWindowDrop));
    }
  }

  private handleMouseDown(event: MouseEvent) {
    const point = this.getMousePoint(event);
    const viewport = this.getViewport();
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

    const slot = this.getHitSlot(point);
    this.hoveredSlot = slot ? { x: slot.gridX, y: slot.gridY } : null;
    this.canvas.style.cursor = slot ? "pointer" : this.core.hitTest(point, viewport) ? "move" : "default";
    this.render();
  }

  private handleMouseUp() {
    if (!this.drag?.imageId || !this.drag.overCell) {
      this.drag = null;
      this.render();
      return;
    }

    const source = this.core.getImages().find((image) => image.id === this.drag?.imageId);
    if (source) {
      const target = this.core.getImages().find((image) =>
        image.id !== source.id &&
        this.drag!.overCell!.x >= image.gridX &&
        this.drag!.overCell!.x < image.gridX + image.span &&
        this.drag!.overCell!.y >= image.gridY &&
        this.drag!.overCell!.y < image.gridY + image.span
      );
      if (this.options.dragSwap && target) {
        this.core.swapImages(source.id, target.id);
      } else {
        this.core.moveImage(source.id, this.drag.overCell, this.getCurrentGridRows());
      }
    }

    this.drag = null;
    this.render();
  }

  private handleDoubleClick(event: MouseEvent) {
    if (!this.options.quickReplace) return;
    const hit = this.core.hitTest(this.getMousePoint(event), this.getViewport());
    if (hit) this.emit("replacerequest", hit.id);
  }

  private getInsertionPlacementAt(point: GridPoint): GridPlacement {
    const slot = this.getHitSlot(point);
    if (slot) return slot;

    const viewport = this.getViewport();
    const layout = this.core.getLayout(viewport.width, viewport.height);
    const grid = toGridPoint(point, layout);
    const span = this.getTargetSpan();
    return {
      gridX: Math.max(0, Math.min(this.core.getOptions().gridColumns - span, grid.x)),
      gridY: Math.max(0, Math.min(layout.gridRows - span, grid.y)),
      span,
    };
  }

  private insertResolvedInputsAtPlacement(inputs: ImageInput[], placement: GridPlacement): CollageImage[] {
    const gridRows = this.getCurrentGridRows();
    const first = this.core.canPlace(placement, gridRows)
      ? this.core.insertImageAt(inputs[0], placement)
      : this.core.insertImages([inputs[0]], { gridRows, span: placement.span })[0];
    const rest = inputs.length > 1
      ? this.core.insertImages(inputs.slice(1), { gridRows, span: placement.span })
      : [];
    const inserted = [first, ...rest].filter((image): image is CollageImage => !!image);
    if (inserted.length > 0) this.setSelection([inserted[inserted.length - 1].id]);
    return inserted;
  }

  private getHitSlot(point: GridPoint): GridPlacement | null {
    const viewport = this.getViewport();
    const layout = this.core.getLayout(viewport.width, viewport.height);
    const slots = this.core.findSlots({ span: this.getTargetSpan(), gridRows: layout.gridRows });
    return slots.find((slot) => {
      const rect = getImageRect(slot, layout);
      return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
    }) || null;
  }

  private getTargetSpan(): number {
    const options = this.core.getOptions();
    return getPlacementSpan(options.gridColumns, options.placementPreset || "medium");
  }

  private getCurrentGridRows(): number {
    const viewport = this.getViewport();
    return this.core.getLayout(viewport.width, viewport.height).gridRows;
  }

  private getViewport() {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const rect = this.canvas.getBoundingClientRect();
    return {
      width: rect.width > 0 ? rect.width : this.canvas.width / dpr || 300,
      height: rect.height > 0 ? rect.height : this.canvas.height / dpr || 400,
    };
  }

  private prepareCanvas() {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const { width, height } = this.getViewport();
    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);

    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }

    return { width, height, dpr };
  }

  private getMousePoint(event: MouseEvent | DragEvent): GridPoint {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private async resolveFiles(files: FileList | File[]): Promise<ImageInput[]> {
    const resolved = await Promise.all(Array.from(files).map((file) => this.resolveFile(file)));
    return resolved.filter((input): input is ImageInput => !!input);
  }

  private async resolveFile(file: File): Promise<ImageInput | null> {
    if (!file.type.startsWith("image/")) return null;
    if (this.options.fileResolver) return this.options.fileResolver(file);
    const src = URL.createObjectURL(file);
    this.objectUrls.add(src);
    return { src, name: file.name };
  }

  private syncSelectionWithImages(images: CollageImage[]) {
    const ids = new Set(images.map((image) => image.id));
    const nextSelection = [...this.selectedIds].filter((id) => ids.has(id));
    const nextActive = this.activeId && ids.has(this.activeId) ? this.activeId : nextSelection[nextSelection.length - 1] || null;
    const selectionChanged = nextSelection.length !== this.selectedIds.size;
    const activeChanged = nextActive !== this.activeId;
    this.selectedIds = new Set(nextSelection);
    this.activeId = nextActive;
    if (selectionChanged) this.emit("selectionchange", this.getSelection());
    if (activeChanged) this.emit("activechange", this.activeId);
  }

  private emit<K extends keyof EditorEventMap>(event: K, ...args: Parameters<EditorEventMap[K]>) {
    this.eventCallbacks[event]?.forEach((callback) => {
      callback(...args);
    });
  }
}

function getDirectionFromKey(key: string): MoveDirection | null {
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  if (key === "ArrowLeft") return "left";
  if (key === "ArrowRight") return "right";
  return null;
}