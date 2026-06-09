export type RatioOption = "1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "custom" | string;

export type PlacementPreset = "small" | "medium" | "large";

export type MoveDirection = "up" | "down" | "left" | "right";

export type HoverToolbarAction =
  | "up" | "down" | "left" | "right"
  | "shrink" | "expand"
  | "delete" | "replace";

export interface GridPoint {
  x: number;
  y: number;
}

export interface GridPlacement {
  gridX: number;
  gridY: number;
  span: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ImageStyleOptions {
  borderRadius2K?: number;
  shadowBlur2K?: number;
  shadowOffset2K?: number;
  shadowOpacity?: number;
}

export interface CollageImage extends GridPlacement, ImageStyleOptions {
  id: string;
  src: string;
  name: string;
}

export interface ImageInput {
  id?: string;
  src: string;
  name?: string;
  style?: ImageStyleOptions;
}

export interface CollageOptions {
  containerRatio: RatioOption;
  customContainerW?: number;
  customContainerH?: number;
  imageRatio: RatioOption;
  customImageW?: number;
  customImageH?: number;
  gridColumns: number;
  padding2K: number;
  gap2K: number;
  background?: {
    color?: string;
    transparent?: boolean;
  };
  imageStyle?: ImageStyleOptions;
  images?: CollageImage[];
  placementPreset?: PlacementPreset;
}

export interface NormalizedCollageOptions extends Required<Omit<CollageOptions, "customContainerW" | "customContainerH" | "customImageW" | "customImageH">> {
  customContainerW?: number;
  customContainerH?: number;
  customImageW?: number;
  customImageH?: number;
}

export interface CollageLayout {
  scale: number;
  padding: number;
  gap: number;
  cellW: number;
  cellH: number;
  gridRows: number;
  offsetX: number;
  offsetY: number;
  gridW: number;
  gridH: number;
  containerRatioVal: number;
  imageRatioVal: number;
}

export interface ImageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FindSlotsOptions {
  span: number;
  gridRows: number;
}

export interface InsertImagesOptions {
  span?: number;
  placementPreset?: PlacementPreset;
  gridRows: number;
}

export interface DrawViewport {
  width: number;
  height: number;
}

export type Unsubscribe = () => void;