import rough from "roughjs/bin/rough";
import type { Options } from "roughjs/bin/core";
import { jsPDF } from "jspdf";
import type { DrawableElement, ExportSettings, Point, SceneState } from "../types/editor";
import { closeLoopPoints, getElementBounds, getSelectionBounds, measureTextLines } from "./geometry";

const dashForStyle = (style: string) => {
  if (style === "dashed") return [10, 6];
  if (style === "dotted") return [2, 5];
  return [];
};

const roughOptions = (element: DrawableElement): Options => ({
  stroke: element.style.strokeColor,
  strokeWidth: element.style.strokeWidth,
  fill: element.style.fillColor === "transparent" ? undefined : element.style.fillColor,
  fillStyle: element.style.fillStyle,
  roughness: element.style.roughness,
  strokeLineDash: dashForStyle(element.style.strokeStyle),
  fillLineDash: dashForStyle(element.style.strokeStyle),
  bowing: 1.25
});

const buildSmoothSvgPath = (points: Point[], closed = false) => {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    const line = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    return closed ? `${line} Z` : line;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    d += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` T ${last.x} ${last.y}`;
  return closed ? `${d} Z` : d;
};

const drawSmoothStroke = (context: CanvasRenderingContext2D, points: Point[], closed = false) => {
  if (points.length === 0) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  if (points.length === 1) {
    context.lineTo(points[0].x + 0.01, points[0].y + 0.01);
  } else if (points.length === 2) {
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

  if (closed) context.closePath();
};

const applyCanvasStyle = (context: CanvasRenderingContext2D, element: DrawableElement) => {
  context.globalAlpha = element.style.opacity / 100;
  context.strokeStyle = element.style.strokeColor;
  context.fillStyle = element.style.fillColor;
  context.lineWidth = element.style.strokeWidth;
  context.setLineDash(dashForStyle(element.style.strokeStyle));
  context.lineCap = "round";
  context.lineJoin = "round";
};

const drawArrowHead = (
  context: CanvasRenderingContext2D,
  tip: Point,
  tail: Point,
  style: "none" | "triangle" | "dot",
  color: string,
  size: number
) => {
  if (style === "none") return;
  context.save();
  context.fillStyle = color;
  context.strokeStyle = color;
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  if (style === "dot") {
    context.beginPath();
    context.arc(tip.x, tip.y, size / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  context.translate(tip.x, tip.y);
  context.rotate(angle);
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(-size * 1.2, size * 0.7);
  context.lineTo(-size * 1.2, -size * 0.7);
  context.closePath();
  context.fill();
  context.restore();
};

export const drawElement = (
  context: CanvasRenderingContext2D,
  element: DrawableElement,
  imageCache: Map<string, HTMLImageElement>
) => {
  if (!element.visible) return;
  applyCanvasStyle(context, element);
  const rc = rough.canvas(context.canvas);

  context.save();
  context.translate(element.x + element.width / 2, element.y + element.height / 2);
  context.rotate(element.rotation);
  context.translate(-(element.x + element.width / 2), -(element.y + element.height / 2));

  if (element.style.renderStyle === "rough" && element.type !== "text" && element.type !== "image" && element.type !== "pencil") {
    switch (element.type) {
      case "rectangle":
        rc.draw(rc.rectangle(element.x, element.y, element.width, element.height, roughOptions(element)));
        break;
      case "ellipse":
        rc.draw(rc.ellipse(element.x + element.width / 2, element.y + element.height / 2, element.width, element.height, roughOptions(element)));
        break;
      case "diamond": {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        rc.draw(rc.polygon([[cx, element.y], [element.x + element.width, cy], [cx, element.y + element.height], [element.x, cy]], roughOptions(element)));
        break;
      }
      case "line":
      case "arrow":
        rc.draw(rc.line(element.points[0].x, element.points[0].y, element.points[1].x, element.points[1].y, roughOptions(element)));
        break;
    }
  } else {
    switch (element.type) {
      case "rectangle": {
        if (element.style.fillColor !== "transparent") {
          context.beginPath();
          context.roundRect(element.x, element.y, element.width, element.height, element.style.roundness);
          context.fill();
        }
        context.beginPath();
        context.roundRect(element.x, element.y, element.width, element.height, element.style.roundness);
        context.stroke();
        break;
      }
      case "ellipse":
        context.beginPath();
        context.ellipse(element.x + element.width / 2, element.y + element.height / 2, Math.abs(element.width) / 2, Math.abs(element.height) / 2, 0, 0, Math.PI * 2);
        if (element.style.fillColor !== "transparent") context.fill();
        context.stroke();
        break;
      case "diamond":
        context.beginPath();
        context.moveTo(element.x + element.width / 2, element.y);
        context.lineTo(element.x + element.width, element.y + element.height / 2);
        context.lineTo(element.x + element.width / 2, element.y + element.height);
        context.lineTo(element.x, element.y + element.height / 2);
        context.closePath();
        if (element.style.fillColor !== "transparent") context.fill();
        context.stroke();
        break;
      case "line":
      case "arrow":
        context.beginPath();
        context.moveTo(element.points[0].x, element.points[0].y);
        context.lineTo(element.points[1].x, element.points[1].y);
        context.stroke();
        break;
      case "pencil":
        if (element.points.length > 1) {
          const closedPoints = closeLoopPoints(element.points, element.style.strokeWidth);
          drawSmoothStroke(context, closedPoints ?? element.points, Boolean(closedPoints));
          if (closedPoints && element.style.fillColor !== "transparent") context.fill();
          context.stroke();
        }
        break;
      case "text": {
        context.fillStyle = element.style.textColor;
        context.font = `${element.style.fontSize}px ${element.style.fontFamily}`;
        context.textBaseline = "top";
        context.textAlign = element.style.textAlign;
        const x = element.style.textAlign === "center" ? element.x + element.width / 2 : element.style.textAlign === "right" ? element.x + element.width : element.x;
        element.text.split("\n").forEach((line, index) => {
          context.fillText(line || " ", x, element.y + index * element.style.fontSize * element.lineHeight);
        });
        break;
      }
      case "image": {
        const image = imageCache.get(element.id);
        if (image) {
          context.drawImage(image, element.x, element.y, element.width, element.height);
        }
        break;
      }
    }
  }

  if (element.type === "arrow") {
    const size = Math.max(8, element.style.strokeWidth * 4);
    drawArrowHead(context, element.points[1], element.points[0], element.style.arrowEnd, element.style.strokeColor, size);
    drawArrowHead(context, element.points[0], element.points[1], element.style.arrowStart, element.style.strokeColor, size);
  }

  context.restore();
  context.globalAlpha = 1;
  context.setLineDash([]);
};

const buildSvgMarkup = (elements: DrawableElement[], scene: SceneState, settings: ExportSettings) => {
  const bounds = getSelectionBounds(elements) ?? { x: 0, y: 0, width: 1280, height: 720 };
  const padding = settings.padding;
  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", `${width}`);
  svg.setAttribute("height", `${height}`);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  if (!settings.transparentBackground) {
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", `${width}`);
    bg.setAttribute("height", `${height}`);
    bg.setAttribute("fill", scene.background);
    svg.appendChild(bg);
  }

  const rc = rough.svg(svg);
  elements.forEach((element) => {
    const translatedX = element.x - bounds.x + padding;
    const translatedY = element.y - bounds.y + padding;
    if (element.type === "text") {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", `${translatedX}`);
      text.setAttribute("y", `${translatedY + element.style.fontSize}`);
      text.setAttribute("fill", element.style.textColor);
      text.setAttribute("font-size", `${element.style.fontSize}`);
      text.setAttribute("font-family", element.style.fontFamily);
      text.textContent = element.text;
      svg.appendChild(text);
      return;
    }

    if (element.type === "image") {
      const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
      image.setAttribute("href", element.src);
      image.setAttribute("x", `${translatedX}`);
      image.setAttribute("y", `${translatedY}`);
      image.setAttribute("width", `${element.width}`);
      image.setAttribute("height", `${element.height}`);
      svg.appendChild(image);
      return;
    }

    let node: SVGGElement | SVGElement | null = null;
    if (element.style.renderStyle === "rough" && element.type !== "pencil") {
      switch (element.type) {
        case "rectangle":
          node = rc.rectangle(translatedX, translatedY, element.width, element.height, roughOptions(element));
          break;
        case "ellipse":
          node = rc.ellipse(translatedX + element.width / 2, translatedY + element.height / 2, element.width, element.height, roughOptions(element));
          break;
        case "diamond": {
          const cx = translatedX + element.width / 2;
          const cy = translatedY + element.height / 2;
          node = rc.polygon([[cx, translatedY], [translatedX + element.width, cy], [cx, translatedY + element.height], [translatedX, cy]], roughOptions(element));
          break;
        }
        case "line":
        case "arrow":
          node = rc.line(element.points[0].x - bounds.x + padding, element.points[0].y - bounds.y + padding, element.points[1].x - bounds.x + padding, element.points[1].y - bounds.y + padding, roughOptions(element));
          break;
      }
    }

    if (!node) {
      if (element.type === "pencil") {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const closedPoints = closeLoopPoints(element.points, element.style.strokeWidth);
        const shiftedPoints = (closedPoints ?? element.points).map((point) => ({ x: point.x - bounds.x + padding, y: point.y - bounds.y + padding }));
        path.setAttribute("d", buildSmoothSvgPath(shiftedPoints, Boolean(closedPoints)));
        path.setAttribute("fill", closedPoints && element.style.fillColor !== "transparent" ? element.style.fillColor : "none");
        path.setAttribute("stroke", element.style.strokeColor);
        path.setAttribute("stroke-width", `${element.style.strokeWidth}`);
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        node = path;
      } else if (element.type === "line" || element.type === "arrow") {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", `${element.points[0].x - bounds.x + padding}`);
        line.setAttribute("y1", `${element.points[0].y - bounds.y + padding}`);
        line.setAttribute("x2", `${element.points[1].x - bounds.x + padding}`);
        line.setAttribute("y2", `${element.points[1].y - bounds.y + padding}`);
        line.setAttribute("stroke", element.style.strokeColor);
        line.setAttribute("stroke-width", `${element.style.strokeWidth}`);
        node = line;
      } else {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", `${translatedX}`);
        rect.setAttribute("y", `${translatedY}`);
        rect.setAttribute("width", `${element.width}`);
        rect.setAttribute("height", `${element.height}`);
        rect.setAttribute("fill", element.style.fillColor);
        rect.setAttribute("stroke", element.style.strokeColor);
        rect.setAttribute("stroke-width", `${element.style.strokeWidth}`);
        node = rect;
      }
    }
    svg.appendChild(node);
  });

  return new XMLSerializer().serializeToString(svg);
};

export const exportScene = async (
  scene: SceneState,
  elements: DrawableElement[],
  settings: ExportSettings,
  canvas: HTMLCanvasElement
) => {
  const exportElements = settings.selectionOnly ? elements : scene.elements;
  if (settings.format === "json") {
    return new Blob([JSON.stringify({ version: 1, scene }, null, 2)], { type: "application/json" });
  }

  if (settings.format === "svg") {
    return new Blob([buildSvgMarkup(exportElements, scene, settings)], { type: "image/svg+xml;charset=utf-8" });
  }

  if (settings.format === "pdf") {
    const svgMarkup = buildSvgMarkup(exportElements, scene, settings);
    const encoded = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgMarkup)))}`;
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    pdf.addImage(encoded, "SVG", 24, 24, 794, 545);
    return pdf.output("blob");
  }

  const offscreen = document.createElement("canvas");
  const bounds = getSelectionBounds(exportElements) ?? { x: 0, y: 0, width: canvas.width, height: canvas.height };
  const padding = settings.padding;
  offscreen.width = Math.max(1, (bounds.width + padding * 2) * settings.scale);
  offscreen.height = Math.max(1, (bounds.height + padding * 2) * settings.scale);
  const ctx = offscreen.getContext("2d");
  if (!ctx) throw new Error("Failed to create export canvas context");
  ctx.scale(settings.scale, settings.scale);
  if (!settings.transparentBackground) {
    ctx.fillStyle = scene.background;
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
  }
  const imageCache = new Map<string, HTMLImageElement>();
  await Promise.all(
    exportElements
      .filter((element) => element.type === "image")
      .map((element) => new Promise<void>((resolve) => {
        const image = new Image();
        image.onload = () => {
          imageCache.set(element.id, image);
          resolve();
        };
        image.onerror = () => resolve();
        image.src = element.src;
      }))
  );

  const shifted: DrawableElement[] = exportElements.map((element) => {
    if (element.type === "line" || element.type === "arrow") {
      return {
        ...element,
        points: [
          { x: element.points[0].x - bounds.x + padding, y: element.points[0].y - bounds.y + padding },
          { x: element.points[1].x - bounds.x + padding, y: element.points[1].y - bounds.y + padding }
        ]
      };
    }
    if (element.type === "pencil") {
      return {
        ...element,
        points: element.points.map((point) => ({ x: point.x - bounds.x + padding, y: point.y - bounds.y + padding }))
      };
    }
    return {
      ...element,
      x: element.x - bounds.x + padding,
      y: element.y - bounds.y + padding
    };
  });

  shifted.forEach((element) => drawElement(ctx, element, imageCache));
  return await new Promise<Blob>((resolve, reject) => {
    offscreen.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to export bitmap"));
          return;
        }
        resolve(blob);
      },
      settings.format === "jpeg" ? "image/jpeg" : "image/png",
      settings.quality
    );
  });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const measureTextElement = (context: CanvasRenderingContext2D, element: DrawableElement) => {
  if (element.type !== "text") return getElementBounds(element);
  const size = measureTextLines(context, element);
  return { x: element.x, y: element.y, width: size.width, height: size.height };
};
