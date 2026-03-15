import type {
  Bounds,
  DrawableElement,
  HandleType,
  Point,
  TextElement,
  ViewportState
} from "../types/editor";

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const screenToWorld = (point: Point, viewport: ViewportState): Point => ({
  x: (point.x - viewport.x) / viewport.zoom,
  y: (point.y - viewport.y) / viewport.zoom
});

export const worldToScreen = (point: Point, viewport: ViewportState): Point => ({
  x: point.x * viewport.zoom + viewport.x,
  y: point.y * viewport.zoom + viewport.y
});

export const normalizeRect = (a: Point, b: Point): Bounds => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y)
});

export const boundsFromPoints = (points: Point[]): Bounds => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
};

export const getElementBounds = (element: DrawableElement): Bounds => {
  if (element.type === "line" || element.type === "arrow") {
    return boundsFromPoints(element.points);
  }

  if (element.type === "pencil") {
    return boundsFromPoints(element.points);
  }

  return {
    x: element.x,
    y: element.y,
    width: Math.max(1, element.width),
    height: Math.max(1, element.height)
  };
};

export const getSelectionBounds = (elements: DrawableElement[]): Bounds | null => {
  if (!elements.length) return null;
  const bounds = elements.map(getElementBounds);
  const minX = Math.min(...bounds.map((bound) => bound.x));
  const minY = Math.min(...bounds.map((bound) => bound.y));
  const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width));
  const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

export const pointInBounds = (point: Point, bounds: Bounds, padding = 0) =>
  point.x >= bounds.x - padding &&
  point.x <= bounds.x + bounds.width + padding &&
  point.y >= bounds.y - padding &&
  point.y <= bounds.y + bounds.height + padding;

export const isClosedLoop = (points: Point[], tolerance = 12) => {
  if (points.length < 3) return false;
  return distance(points[0], points[points.length - 1]) <= tolerance;
};

export const pointInPolygon = (point: Point, polygon: Point[]) => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index];
    const prior = polygon[previous];
    const intersects = ((current.y > point.y) !== (prior.y > point.y)) &&
      point.x < ((prior.x - current.x) * (point.y - current.y)) / Math.max(0.00001, prior.y - current.y) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const distanceToSegment = (point: Point, start: Point, end: Point) => {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  if (lengthSquared === 0) return distance(point, start);
  const t = clamp(
    ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) /
      lengthSquared,
    0,
    1
  );
  const projection = {
    x: start.x + t * (end.x - start.x),
    y: start.y + t * (end.y - start.y)
  };
  return distance(point, projection);
};

export const hitTestElement = (point: Point, element: DrawableElement) => {
  const bounds = getElementBounds(element);
  if (element.type === "line" || element.type === "arrow") {
    return distanceToSegment(point, element.points[0], element.points[1]) <=
      Math.max(8, element.style.strokeWidth * 2)
      ? bounds
      : null;
  }

  if (element.type === "pencil") {
    const tolerance = Math.max(8, element.style.strokeWidth * 2);
    for (let index = 0; index < element.points.length - 1; index += 1) {
      if (distanceToSegment(point, element.points[index], element.points[index + 1]) <= tolerance) {
        return bounds;
      }
    }
    if (isClosedLoop(element.points, tolerance * 1.5) && pointInPolygon(point, element.points)) {
      return bounds;
    }
    return null;
  }

  return pointInBounds(point, bounds, 6) ? bounds : null;
};

export const handlePositions = (bounds: Bounds) => {
  const { x, y, width, height } = bounds;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return {
    nw: { x, y },
    n: { x: centerX, y },
    ne: { x: x + width, y },
    e: { x: x + width, y: centerY },
    se: { x: x + width, y: y + height },
    s: { x: centerX, y: y + height },
    sw: { x, y: y + height },
    w: { x, y: centerY },
    rotate: { x: centerX, y: y - 32 }
  } as Record<HandleType, Point>;
};

export const getHandleAtPoint = (point: Point, bounds: Bounds, zoom = 1, touchMode = false): HandleType | null => {
  const positions = handlePositions(bounds);
  const entries = Object.entries(positions) as Array<[HandleType, Point]>;
  const baseRadius = touchMode ? 22 : 14;
  const scale = 1 / Math.max(0.35, zoom);
  const hit = entries.find(([handle, position]) => {
    const radius = handle === "rotate" ? baseRadius + 6 : baseRadius;
    return distance(point, position) <= radius * scale;
  });
  return hit?.[0] ?? null;
};

export const resizeBounds = (bounds: Bounds, handle: HandleType, delta: Point, keepRatio: boolean) => {
  let { x, y, width, height } = bounds;
  const ratio = width / Math.max(1, height);

  if (handle.includes("n")) {
    y += delta.y;
    height -= delta.y;
  }
  if (handle.includes("s")) {
    height += delta.y;
  }
  if (handle.includes("w")) {
    x += delta.x;
    width -= delta.x;
  }
  if (handle.includes("e")) {
    width += delta.x;
  }

  width = Math.max(4, width);
  height = Math.max(4, height);

  if (keepRatio) {
    if (Math.abs(delta.x) > Math.abs(delta.y)) {
      height = width / Math.max(0.1, ratio);
    } else {
      width = height * ratio;
    }
  }

  return { x, y, width, height };
};

export const rotatePoint = (point: Point, center: Point, angle: number): Point => {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle)
  };
};

export const measureTextLines = (
  context: CanvasRenderingContext2D,
  element: TextElement
) => {
  context.font = `${element.style.fontSize}px ${element.style.fontFamily}`;
  const lines = element.text.split("\n");
  const width = Math.max(...lines.map((line) => context.measureText(line || " ").width), 1);
  const height = lines.length * element.style.fontSize * element.lineHeight;
  return { width, height };
};

export const simplifyPoints = (points: Point[], minDistance = 1.5): Point[] => {
  if (points.length <= 2) return points;
  const simplified: Point[] = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    if (distance(points[index], simplified[simplified.length - 1]) >= minDistance) {
      simplified.push(points[index]);
    }
  }
  if (simplified[simplified.length - 1] !== points[points.length - 1]) {
    simplified.push(points[points.length - 1]);
  }
  return simplified;
};

export const snapPoint = (point: Point, enabled: boolean, gridSize = 16): Point => {
  if (!enabled) return point;
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize
  };
};
