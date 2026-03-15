import type { DrawableElement, ImageElement, Point } from "../types/editor";
import { closeLoopPoints, getSelectionBounds } from "./geometry";
import { createId } from "./id";

const FILL_PADDING = 48;
const MAX_FILL_DIMENSION = 4096;
const BOUNDARY_ALPHA_THRESHOLD = 12;
const FILL_BLEED_PIXELS = 2;

const strokeShape = (context: CanvasRenderingContext2D, element: DrawableElement) => {
  context.save();
  context.translate(element.x + element.width / 2, element.y + element.height / 2);
  context.rotate(element.rotation);
  context.translate(-(element.x + element.width / 2), -(element.y + element.height / 2));
  context.beginPath();

  switch (element.type) {
    case "rectangle":
      context.roundRect(element.x, element.y, element.width, element.height, Math.max(0, element.style.roundness));
      context.stroke();
      break;
    case "ellipse":
      context.ellipse(
        element.x + element.width / 2,
        element.y + element.height / 2,
        Math.abs(element.width) / 2,
        Math.abs(element.height) / 2,
        0,
        0,
        Math.PI * 2
      );
      context.stroke();
      break;
    case "diamond":
      context.moveTo(element.x + element.width / 2, element.y);
      context.lineTo(element.x + element.width, element.y + element.height / 2);
      context.lineTo(element.x + element.width / 2, element.y + element.height);
      context.lineTo(element.x, element.y + element.height / 2);
      context.closePath();
      context.stroke();
      break;
    case "line":
    case "arrow":
      context.moveTo(element.points[0].x, element.points[0].y);
      context.lineTo(element.points[1].x, element.points[1].y);
      context.stroke();
      break;
    case "pencil": {
      if (element.points.length < 2) break;
      const points = closeLoopPoints(element.points, element.style.strokeWidth) ?? element.points;
      context.moveTo(points[0].x, points[0].y);
      if (points.length === 2) {
        context.lineTo(points[1].x, points[1].y);
      } else {
        for (let index = 1; index < points.length - 1; index += 1) {
          const current = points[index];
          const next = points[index + 1];
          context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
        }
        const last = points[points.length - 1];
        context.quadraticCurveTo(last.x, last.y, last.x, last.y);
      }
      if (points !== element.points) context.closePath();
      context.stroke();
      break;
    }
    default:
      break;
  }

  context.restore();
};

const getRenderableBounds = (elements: DrawableElement[]) => {
  const bounds = getSelectionBounds(elements) ?? { x: 0, y: 0, width: 1, height: 1 };
  return {
    x: bounds.x - FILL_PADDING,
    y: bounds.y - FILL_PADDING,
    width: bounds.width + FILL_PADDING * 2,
    height: bounds.height + FILL_PADDING * 2
  };
};

const makeCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export const createRegionFillElement = (
  elements: DrawableElement[],
  clickPoint: Point,
  color: string
): ImageElement | null => {
  const boundaryElements = elements.filter((element) =>
    element.visible &&
    !element.locked &&
    element.type !== "text" &&
    element.type !== "image"
  );

  if (!boundaryElements.length) return null;

  const bounds = getRenderableBounds(boundaryElements);
  const scale = Math.min(
    1,
    MAX_FILL_DIMENSION / Math.max(1, bounds.width),
    MAX_FILL_DIMENSION / Math.max(1, bounds.height)
  );
  const width = Math.max(1, Math.ceil(bounds.width * scale));
  const height = Math.max(1, Math.ceil(bounds.height * scale));
  const sampleX = Math.round((clickPoint.x - bounds.x) * scale);
  const sampleY = Math.round((clickPoint.y - bounds.y) * scale);

  if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) return null;

  const boundaryCanvas = makeCanvas(width, height);
  const boundaryContext = boundaryCanvas.getContext("2d");
  if (!boundaryContext) return null;

  boundaryContext.clearRect(0, 0, width, height);
  boundaryContext.scale(scale, scale);
  boundaryContext.translate(-bounds.x, -bounds.y);
  boundaryContext.strokeStyle = "#000000";
  boundaryContext.fillStyle = "transparent";
  boundaryContext.lineCap = "round";
  boundaryContext.lineJoin = "round";

  boundaryElements.forEach((element) => {
    boundaryContext.lineWidth = Math.max(2, element.style.strokeWidth + 2);
    boundaryContext.setLineDash([]);
    strokeShape(boundaryContext, element);
  });

  const imageData = boundaryContext.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const startIndex = (sampleY * width + sampleX) * 4;
  if (pixels[startIndex + 3] >= BOUNDARY_ALPHA_THRESHOLD) return null;

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height * 2);
  let queueStart = 0;
  let queueEnd = 0;

  queue[queueEnd++] = sampleX;
  queue[queueEnd++] = sampleY;
  visited[sampleY * width + sampleX] = 1;

  const filled = new Uint8Array(width * height);
  let minX = sampleX;
  let minY = sampleY;
  let maxX = sampleX;
  let maxY = sampleY;
  let fillCount = 0;

  while (queueStart < queueEnd) {
    const x = queue[queueStart++];
    const y = queue[queueStart++];
    const offset = y * width + x;
    const alpha = pixels[offset * 4 + 3];

    if (alpha >= BOUNDARY_ALPHA_THRESHOLD) continue;

    filled[offset] = 1;
    fillCount += 1;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1]
    ];

    for (const [nextX, nextY] of neighbors) {
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
      const nextOffset = nextY * width + nextX;
      if (visited[nextOffset]) continue;
      visited[nextOffset] = 1;
      queue[queueEnd++] = nextX;
      queue[queueEnd++] = nextY;
    }
  }

  if (!fillCount) return null;
  if (minX === 0 || minY === 0 || maxX === width - 1 || maxY === height - 1) return null;

  const cropWidth = maxX - minX + 1 + FILL_BLEED_PIXELS * 2;
  const cropHeight = maxY - minY + 1 + FILL_BLEED_PIXELS * 2;
  const fillCanvas = makeCanvas(cropWidth, cropHeight);
  const fillContext = fillCanvas.getContext("2d");
  if (!fillContext) return null;

  fillContext.clearRect(0, 0, cropWidth, cropHeight);
  fillContext.fillStyle = color;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!filled[y * width + x]) continue;
      const drawX = x - minX;
      const drawY = y - minY;
      fillContext.fillRect(
        drawX,
        drawY,
        1 + FILL_BLEED_PIXELS * 2,
        1 + FILL_BLEED_PIXELS * 2
      );
    }
  }

  return {
    id: createId(),
    type: "image",
    x: bounds.x + (minX - FILL_BLEED_PIXELS) / scale,
    y: bounds.y + (minY - FILL_BLEED_PIXELS) / scale,
    width: cropWidth / scale,
    height: cropHeight / scale,
    rotation: 0,
    style: {
      strokeColor: "transparent",
      fillColor: "transparent",
      textColor: "#000000",
      strokeWidth: 0,
      strokeStyle: "solid",
      fillStyle: "solid",
      opacity: 100,
      roughness: 0,
      renderStyle: "clean",
      fontFamily: "Manrope, sans-serif",
      fontSize: 24,
      textAlign: "left",
      roundness: 0,
      arrowStart: "none",
      arrowEnd: "none"
    },
    locked: false,
    visible: true,
    zIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    src: fillCanvas.toDataURL("image/png"),
    naturalWidth: cropWidth,
    naturalHeight: cropHeight,
    metadata: {
      name: "Region fill",
      generated: true
    }
  };
};
