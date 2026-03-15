import type {
  DrawableElement,
  ElementStyle,
  ElementType,
  ImageElement,
  Point,
  TextElement
} from "../types/editor";
import { createId } from "./id";

export const DEFAULT_STYLE: ElementStyle = {
  strokeColor: "#0f172a",
  fillColor: "#ffffff",
  textColor: "#0f172a",
  strokeWidth: 2,
  strokeStyle: "solid",
  fillStyle: "solid",
  opacity: 100,
  roughness: 0,
  renderStyle: "clean",
  fontFamily: "Manrope, sans-serif",
  fontSize: 24,
  textAlign: "left",
  roundness: 12,
  arrowStart: "none",
  arrowEnd: "triangle"
};

export const stylePresets: Record<string, Partial<ElementStyle>> = {
  sketch: {
    renderStyle: "rough",
    roughness: 1.5,
    fillStyle: "hachure",
    fillColor: "transparent",
    fontFamily: "Virgil, Manrope, sans-serif"
  },
  clean: {
    renderStyle: "clean",
    roughness: 0,
    fillStyle: "solid",
    fillColor: "#ffffff",
    fontFamily: "Manrope, sans-serif"
  },
  presentation: {
    renderStyle: "clean",
    strokeWidth: 3,
    fillStyle: "solid",
    fillColor: "#f8fafc"
  },
  marker: {
    renderStyle: "clean",
    roughness: 0,
    strokeWidth: 4,
    opacity: 92,
    fillColor: "#fff7ed"
  },
  wireframe: {
    renderStyle: "clean",
    fillColor: "transparent",
    strokeColor: "#475569",
    strokeWidth: 1
  }
};

export const createElement = (
  type: ElementType,
  position: Point,
  style?: Partial<ElementStyle>
): DrawableElement => {
  const base = {
    id: createId(),
    type,
    x: position.x,
    y: position.y,
    width: 0,
    height: 0,
    rotation: 0,
    style: { ...DEFAULT_STYLE, ...style },
    locked: false,
    visible: true,
    zIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  switch (type) {
    case "line":
      return { ...base, type, points: [position, position] };
    case "arrow":
      return { ...base, type, points: [position, position] };
    case "pencil":
      return { ...base, type, points: [position] };
    case "text":
      return { ...base, type, text: "", lineHeight: 1.35, width: 180, height: 32 } as TextElement;
    case "image":
      return {
        ...base,
        type,
        src: "",
        naturalWidth: 0,
        naturalHeight: 0
      } as ImageElement;
    default:
      return base as DrawableElement;
  }
};

export const cloneElement = (element: DrawableElement, offset = 24): DrawableElement => {
  const now = Date.now();
  const shiftedPoints = "points" in element
    ? element.points.map((point) => ({ x: point.x + offset, y: point.y + offset }))
    : undefined;

  return {
    ...element,
    id: createId(),
    x: element.x + offset,
    y: element.y + offset,
    points: shiftedPoints,
    createdAt: now,
    updatedAt: now
  } as DrawableElement;
};
