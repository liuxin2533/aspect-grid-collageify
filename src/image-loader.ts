export class ImageLoader {
  private cache = new Map<string, HTMLImageElement>();
  private loading = new Set<string>();
  private loadCallbacks = new Set<() => void>();

  public onLoad(callback: () => void) {
    this.loadCallbacks.add(callback);
    return () => this.loadCallbacks.delete(callback);
  }

  public get(src: string): HTMLImageElement | null {
    if (this.cache.has(src)) {
      return this.cache.get(src)!;
    }

    if (this.loading.has(src)) {
      return null;
    }

    this.loading.add(src);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      this.cache.set(src, image);
      this.loading.delete(src);
      this.emitLoad();
    };
    image.onerror = () => {
      this.loading.delete(src);
      this.emitLoad();
    };
    image.src = src;
    return null;
  }

  public async preload(srcList: string[]): Promise<void> {
    await Promise.all(srcList.map((src) => this.load(src)));
  }

  public delete(src: string) {
    this.cache.delete(src);
    this.loading.delete(src);
  }

  public clear() {
    this.cache.clear();
    this.loading.clear();
    this.loadCallbacks.clear();
  }

  private load(src: string): Promise<void> {
    if (this.cache.has(src)) return Promise.resolve();

    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        this.cache.set(src, image);
        resolve();
      };
      image.onerror = () => resolve();
      image.src = src;
    });
  }

  private emitLoad() {
    this.loadCallbacks.forEach((callback) => callback());
  }
}