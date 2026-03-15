export type ToolType =
  | "select"
  | "hand"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "pencil"
  | "text"
  | "fill"
  | "eraser"
  | "image";

export type ElementType =
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "pencil"
  | "text"
  | "image";

export type StrokeStyle = "solid" | "dashed" | "dotted";
export type FillStyle = "solid" | "hachure" | "cross-hatch";
export type RenderStyle = "rough" | "clean";
export type ThemeMode = "light" | "dark" | "system";
export type ArrowheadStyle = "none" | "triangle" | "dot";
export type EraserMode = "partial" | "full";
export type HandleType =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw"
  | "rotate";

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElementStyle {
  strokeColor: string;
  fillColor: string;
  textColor: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  fillStyle: FillStyle;
  opacity: number;
  roughness: number;
  renderStyle: RenderStyle;
  fontFamily: string;
  fontSize: number;
  textAlign: CanvasTextAlign;
  roundness: number;
  arrowStart: ArrowheadStyle;
  arrowEnd: ArrowheadStyle;
}

export interface ElementMetadata {
  name?: string;
  [key: string]: unknown;
}

export interface DrawableElementBase {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  style: ElementStyle;
  locked: boolean;
  visible: boolean;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
  groupId?: string;
  metadata?: ElementMetadata;
}

export interface RectangleElement extends DrawableElementBase {
  type: "rectangle";
}

export interface EllipseElement extends DrawableElementBase {
  type: "ellipse";
}

export interface DiamondElement extends DrawableElementBase {
  type: "diamond";
}

export interface LineElement extends DrawableElementBase {
  type: "line";
  points: [Point, Point];
}

export interface ArrowElement extends DrawableElementBase {
  type: "arrow";
  points: [Point, Point];
}

export interface PencilElement extends DrawableElementBase {
  type: "pencil";
  points: Point[];
}

export interface TextElement extends DrawableElementBase {
  type: "text";
  text: string;
  lineHeight: number;
}

export interface ImageElement extends DrawableElementBase {
  type: "image";
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

export type DrawableElement =
  | RectangleElement
  | EllipseElement
  | DiamondElement
  | LineElement
  | ArrowElement
  | PencilElement
  | TextElement
  | ImageElement;

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface SceneState {
  elements: DrawableElement[];
  background: string;
  gridEnabled: boolean;
  snapToGrid: boolean;
}

export interface SelectionState {
  selectedIds: string[];
}

export interface ExportSettings {
  filename: string;
  format: "png" | "jpeg" | "svg" | "pdf" | "json";
  scale: 1 | 2 | 3;
  quality: number;
  padding: number;
  transparentBackground: boolean;
  selectionOnly: boolean;
}

export interface EditorPreferences {
  theme: ThemeMode;
  showShortcuts: boolean;
  stylePreset: "sketch" | "clean" | "presentation" | "marker" | "wireframe";
  lastUsedTool: ToolType;
  eraserMode: EraserMode;
  eraserSize: number;
}

export interface HistoryState {
  past: EditorSnapshot[];
  future: EditorSnapshot[];
}

export interface EditorSnapshot {
  scene: SceneState;
  selection: SelectionState;
  viewport: ViewportState;
}

export interface ProjectSchema {
  version: 1;
  createdAt: string;
  updatedAt: string;
  scene: SceneState;
  viewport: ViewportState;
  preferences: EditorPreferences;
}
