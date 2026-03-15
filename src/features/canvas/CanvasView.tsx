import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { Bounds, DrawableElement, ElementStyle, HandleType, Point, TextElement, ToolType } from "../../types/editor";
import { getElementGroupMembers, useEditorStore, selectSelectedElements } from "../../store/editorStore";
import { createElement } from "../../utils/element";
import {
  distance,
  getElementBounds,
  getHandleAtPoint,
  getSelectionBounds,
  handlePositions,
  hitTestElement,
  isClosedLoop,
  measureTextLines,
  pointInPolygon,
  normalizeRect,
  resizeBounds,
  screenToWorld,
  snapPoint,
  simplifyPoints,
  worldToScreen
} from "../../utils/geometry";
import { drawElement } from "../../utils/export";

interface GuideLine {
  orientation: "vertical" | "horizontal";
  value: number;
  from: number;
  to: number;
}

interface InteractionState {
  mode: "idle" | "pan" | "move" | "draw" | "marquee" | "resize" | "rotate";
  pointerId: number | null;
  originScreen: Point;
  originWorld: Point;
  handle: HandleType | null;
  startViewport: { x: number; y: number } | null;
  selectedSnapshot: Map<string, DrawableElement>;
  targetIds: string[];
  draftId: string | null;
  draftPoints: Point[];
  draftStyle: ElementStyle | null;
  marquee: Bounds | null;
  guides: GuideLine[];
}

const initialInteraction = (): InteractionState => ({
  mode: "idle",
  pointerId: null,
  originScreen: { x: 0, y: 0 },
  originWorld: { x: 0, y: 0 },
  handle: null,
  startViewport: null,
  selectedSnapshot: new Map(),
  targetIds: [],
  draftId: null,
  draftPoints: [],
  draftStyle: null,
  marquee: null,
  guides: []
});

const SNAP_THRESHOLD = 8;

const scalePoint = (point: Point, bounds: Bounds, nextBounds: Bounds): Point => {
  const scaleX = bounds.width === 0 ? 1 : nextBounds.width / bounds.width;
  const scaleY = bounds.height === 0 ? 1 : nextBounds.height / bounds.height;
  return {
    x: nextBounds.x + (point.x - bounds.x) * scaleX,
    y: nextBounds.y + (point.y - bounds.y) * scaleY
  };
};

const resizeElement = (original: DrawableElement, nextBounds: Bounds): DrawableElement => {
  if (original.type === "line" || original.type === "arrow") {
    const originalBounds = getElementBounds(original);
    const points = original.points.map((point) => scalePoint(point, originalBounds, nextBounds)) as [Point, Point];
    return {
      ...original,
      x: nextBounds.x,
      y: nextBounds.y,
      width: nextBounds.width,
      height: nextBounds.height,
      points,
      updatedAt: Date.now()
    };
  }

  if (original.type === "pencil") {
    const originalBounds = getElementBounds(original);
    const points = original.points.map((point) => scalePoint(point, originalBounds, nextBounds));
    return {
      ...original,
      x: nextBounds.x,
      y: nextBounds.y,
      width: nextBounds.width,
      height: nextBounds.height,
      points,
      updatedAt: Date.now()
    };
  }

  return {
    ...original,
    x: nextBounds.x,
    y: nextBounds.y,
    width: nextBounds.width,
    height: nextBounds.height,
    updatedAt: Date.now()
  };
};

export const CanvasView = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const interactionRef = useRef<InteractionState>(initialInteraction());
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
  const touchModeRef = useRef<null | { distance: number; center: Point; viewportX: number; viewportY: number; zoom: number }>(null);
  const touchPointsRef = useRef(new Map<number, Point>());
  const draftFrameRef = useRef<number | null>(null);
  const [editingText, setEditingText] = useState<{ id: string | null; value: string; initialValue: string; x: number; y: number; width: number; height: number; worldX: number; worldY: number; style: ElementStyle; lineHeight: number } | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);

  const scene = useEditorStore((state) => state.scene);
  const viewport = useEditorStore((state) => state.viewport);
  const selection = useEditorStore((state) => state.selection);
  const errorMessage = useEditorStore((state) => state.errorMessage);
  const setErrorMessage = useEditorStore((state) => state.setErrorMessage);
  const selectedElements = useMemo(() => scene.elements.filter((element) => selection.selectedIds.includes(element.id)), [scene.elements, selection.selectedIds]);

  const requestDraftRender = () => {
    if (draftFrameRef.current !== null) return;
    draftFrameRef.current = window.requestAnimationFrame(() => {
      draftFrameRef.current = null;
      setDraftVersion((value) => value + 1);
    });
  };

  useEffect(() => () => {
    if (draftFrameRef.current !== null) {
      window.cancelAnimationFrame(draftFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (editingText && textAreaRef.current) {
      textAreaRef.current.focus();
      textAreaRef.current.selectionStart = editingText.value.length;
      textAreaRef.current.selectionEnd = editingText.value.length;
    }
  }, [editingText]);

  useEffect(() => {
    scene.elements
      .filter((element) => element.type === "image")
      .forEach((element) => {
        if (imageCacheRef.current.has(element.id)) return;
        const image = new Image();
        image.onload = () => imageCacheRef.current.set(element.id, image);
        image.src = element.src;
      });
  }, [scene.elements]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const draw = (width: number, height: number) => {
      const context = canvas.getContext("2d");
      if (!context) return;
      context.save();
      context.clearRect(0, 0, width, height);
      context.fillStyle = scene.background;
      context.fillRect(0, 0, width, height);

      if (scene.gridEnabled) drawGrid(context, width, height, viewport.zoom, viewport.x, viewport.y);

      context.translate(viewport.x, viewport.y);
      context.scale(viewport.zoom, viewport.zoom);
      scene.elements.slice().sort((a, b) => a.zIndex - b.zIndex).forEach((element) => drawElement(context, element, imageCacheRef.current));

      const currentInteraction = interactionRef.current;
      if (currentInteraction.mode === "draw" && currentInteraction.draftPoints.length > 1 && currentInteraction.draftStyle) {
        drawElement(context, {
          id: "draft-pencil",
          type: "pencil",
          x: currentInteraction.draftPoints[0].x,
          y: currentInteraction.draftPoints[0].y,
          width: 1,
          height: 1,
          rotation: 0,
          style: currentInteraction.draftStyle,
          locked: false,
          visible: true,
          zIndex: scene.elements.length + 1,
          createdAt: 0,
          updatedAt: 0,
          points: currentInteraction.draftPoints
        }, imageCacheRef.current);
      }

      if (currentInteraction.marquee) {
        context.save();
        context.strokeStyle = "#2563eb";
        context.fillStyle = "rgba(37,99,235,0.08)";
        context.setLineDash([8 / viewport.zoom, 6 / viewport.zoom]);
        context.fillRect(currentInteraction.marquee.x, currentInteraction.marquee.y, currentInteraction.marquee.width, currentInteraction.marquee.height);
        context.strokeRect(currentInteraction.marquee.x, currentInteraction.marquee.y, currentInteraction.marquee.width, currentInteraction.marquee.height);
        context.restore();
      }

      currentInteraction.guides.forEach((guide) => {
        context.save();
        context.strokeStyle = "#0ea5e9";
        context.lineWidth = 1 / viewport.zoom;
        context.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
        context.beginPath();
        if (guide.orientation === "vertical") {
          context.moveTo(guide.value, guide.from);
          context.lineTo(guide.value, guide.to);
        } else {
          context.moveTo(guide.from, guide.value);
          context.lineTo(guide.to, guide.value);
        }
        context.stroke();
        context.restore();
      });

      const bounds = getSelectionBounds(selectedElements.filter((element) => element.visible));
      if (bounds) drawSelectionBounds(context, bounds, viewport.zoom);
      context.restore();
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(rect.width, rect.height);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [scene, viewport, selectedElements, draftVersion]);

  const beginTextEdit = (element: TextElement) => {
    const topLeft = worldToScreen({ x: element.x, y: element.y }, viewport);
    setEditingText({
      id: element.id,
      value: element.text,
      initialValue: element.text,
      x: topLeft.x,
      y: topLeft.y,
      width: Math.max(220, element.width * viewport.zoom),
      height: Math.max(96, element.height * viewport.zoom),
      worldX: element.x,
      worldY: element.y,
      style: structuredClone(element.style),
      lineHeight: element.lineHeight
    });
  };

  const findTopElement = (worldPoint: Point) =>
    scene.elements.slice().sort((a, b) => b.zIndex - a.zIndex).find((element) => element.visible && !element.locked && hitTestElement(worldPoint, element));

  const findFillTarget = (worldPoint: Point) => scene.elements
    .slice()
    .sort((a, b) => b.zIndex - a.zIndex)
    .find((element) => {
      if (!element.visible || element.locked) return false;
      if (["rectangle", "ellipse", "diamond"].includes(element.type)) return Boolean(hitTestElement(worldPoint, element));
      return element.type === "pencil" && isClosedLoop(element.points, Math.max(10, element.style.strokeWidth * 3)) && pointInPolygon(worldPoint, element.points);
    });

  const pointerToPoints = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const screen = { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
    return { screen, world: screenToWorld(screen, viewport) };
  };

  const getOtherBounds = (excludedIds: string[]) => scene.elements.filter((element) => element.visible && !excludedIds.includes(element.id)).map((element) => getElementBounds(element));

  const snapBounds = (candidate: Bounds, others: Bounds[]) => {
    let snapX = 0;
    let snapY = 0;
    let bestX = SNAP_THRESHOLD / viewport.zoom;
    let bestY = SNAP_THRESHOLD / viewport.zoom;
    const guides: GuideLine[] = [];
    const candidateX = [candidate.x, candidate.x + candidate.width / 2, candidate.x + candidate.width];
    const candidateY = [candidate.y, candidate.y + candidate.height / 2, candidate.y + candidate.height];

    others.forEach((bound) => {
      const targetX = [bound.x, bound.x + bound.width / 2, bound.x + bound.width];
      const targetY = [bound.y, bound.y + bound.height / 2, bound.y + bound.height];
      candidateX.forEach((value) => targetX.forEach((target) => {
        const delta = target - value;
        if (Math.abs(delta) < Math.abs(bestX)) {
          bestX = delta;
          snapX = delta;
          guides[0] = { orientation: "vertical", value: target, from: Math.min(bound.y, candidate.y), to: Math.max(bound.y + bound.height, candidate.y + candidate.height) };
        }
      }));
      candidateY.forEach((value) => targetY.forEach((target) => {
        const delta = target - value;
        if (Math.abs(delta) < Math.abs(bestY)) {
          bestY = delta;
          snapY = delta;
          guides[1] = { orientation: "horizontal", value: target, from: Math.min(bound.x, candidate.x), to: Math.max(bound.x + bound.width, candidate.x + candidate.width) };
        }
      }));
    });

    return { bounds: { ...candidate, x: candidate.x + snapX, y: candidate.y + snapY }, guides: guides.filter(Boolean) };
  };

  const updateTouchState = () => {
    const points = Array.from(touchPointsRef.current.values());
    if (points.length !== 2) {
      touchModeRef.current = null;
      return null;
    }
    const [a, b] = points;
    return {
      distance: Math.hypot(b.x - a.x, b.y - a.y),
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const state = useEditorStore.getState();
    const { screen, world } = pointerToPoints(event);
    const snapped = state.activeTool === "pencil" ? world : snapPoint(world, state.scene.snapToGrid);

    if (state.activeTool === "text") {
      event.preventDefault();
      setEditingText({
        id: null,
        value: "",
        initialValue: "",
        x: screen.x,
        y: screen.y,
        width: 240,
        height: 96,
        worldX: snapped.x,
        worldY: snapped.y,
        style: structuredClone(state.activeStyle),
        lineHeight: 1.35
      });
      interactionRef.current = initialInteraction();
      requestAnimationFrame(() => textAreaRef.current?.focus());
      return;
    }

    if (event.pointerType === "touch") {
      touchPointsRef.current.set(event.pointerId, screen);
      const multi = updateTouchState();
      if (multi) {
        touchModeRef.current = {
          distance: multi.distance,
          center: multi.center,
          viewportX: state.viewport.x,
          viewportY: state.viewport.y,
          zoom: state.viewport.zoom
        };
        interactionRef.current = initialInteraction();
        requestDraftRender();
        return;
      }
    }

    const interaction = interactionRef.current;
    interaction.pointerId = event.pointerId;
    interaction.originScreen = screen;
    interaction.originWorld = snapped;
    interaction.guides = [];
    interaction.selectedSnapshot = new Map(selectSelectedElements(state).map((element) => [element.id, structuredClone(element)]));

    const selectionBounds = getSelectionBounds(selectSelectedElements(state));
    const touchMode = event.pointerType === "touch" || (navigator.maxTouchPoints || 0) > 0;
    const handle = selectionBounds ? getHandleAtPoint(snapped, selectionBounds, viewport.zoom, touchMode) : null;
    if (event.button === 1 || state.activeTool === "hand") {
      event.currentTarget.setPointerCapture(event.pointerId);
      interaction.mode = "pan";
      interaction.startViewport = { x: state.viewport.x, y: state.viewport.y };
      return;
    }

    if (state.activeTool === "select") {
      if (handle && selectionBounds && state.selection.selectedIds.length === 1) {
        event.currentTarget.setPointerCapture(event.pointerId);
        state.pushHistory();
        interaction.mode = handle === "rotate" ? "rotate" : "resize";
        interaction.handle = handle;
        interaction.targetIds = [...state.selection.selectedIds];
        return;
      }

      const hit = findTopElement(snapped);
      if (hit) {
        if (event.detail === 2 && hit.type === "text") {
          beginTextEdit(hit);
          return;
        }
        const grouped = getElementGroupMembers(state, hit).map((item) => item.id);
        const targetIds = event.shiftKey ? Array.from(new Set([...state.selection.selectedIds, ...grouped])) : grouped;
        if (!targetIds.every((id) => state.selection.selectedIds.includes(id)) || targetIds.length !== state.selection.selectedIds.length) {
          state.setSelection(targetIds);
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        state.pushHistory();
        interaction.mode = "move";
        interaction.targetIds = targetIds;
        interaction.selectedSnapshot = new Map(state.scene.elements.filter((element) => targetIds.includes(element.id)).map((element) => [element.id, structuredClone(element)]));
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      state.setSelection([]);
      interaction.targetIds = [];
      interaction.mode = "marquee";
      interaction.marquee = { x: snapped.x, y: snapped.y, width: 0, height: 0 };
      requestDraftRender();
      return;
    }

    if (state.activeTool === "fill") {
      const hit = findFillTarget(snapped);
      if (hit && (["rectangle", "ellipse", "diamond"].includes(hit.type) || hit.type === "pencil")) {
        const nextFillColor = state.activeStyle.fillColor === "transparent" || state.activeStyle.fillColor.toLowerCase() === state.scene.background.toLowerCase() ? state.activeStyle.strokeColor : state.activeStyle.fillColor;
        state.pushHistory();
        state.updateElement(hit.id, (element) => ({
          ...element,
          style: {
            ...element.style,
            fillColor: nextFillColor,
            fillStyle: state.activeStyle.fillStyle,
            renderStyle: state.activeStyle.renderStyle,
            roughness: state.activeStyle.roughness
          },
          updatedAt: Date.now()
        }));
        state.setSelection([hit.id]);
      } else {
        state.setErrorMessage("Fill works on closed shapes and closed pencil loops.");
      }
      return;
    }

    if (state.activeTool === "eraser") {
      const hit = findTopElement(snapped);
      if (hit) {
        state.pushHistory();
        state.removeElements(getElementGroupMembers(state, hit).map((element) => element.id));
      }
      return;
    }

    if (state.activeTool === "pencil") {
      event.currentTarget.setPointerCapture(event.pointerId);
      state.pushHistory();
      state.setSelection([]);
      interaction.targetIds = [];
      interaction.mode = "draw";
      interaction.draftId = null;
      interaction.draftPoints = [world];
      interaction.draftStyle = structuredClone(state.activeStyle);
      requestDraftRender();
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    state.pushHistory();
    const toolMap: Record<Exclude<ToolType, "select" | "hand" | "eraser" | "image" | "fill">, DrawableElement["type"]> = {
      rectangle: "rectangle",
      ellipse: "ellipse",
      diamond: "diamond",
      line: "line",
      arrow: "arrow",
      pencil: "pencil",
      text: "text"
    };
    const elementType = toolMap[state.activeTool as keyof typeof toolMap];
    if (!elementType) return;
    const element = createElement(elementType, snapped, state.activeStyle);
    state.addElement(element);
    interaction.targetIds = [element.id];
    interaction.mode = "draw";
    interaction.draftId = element.id;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const state = useEditorStore.getState();
    const { screen, world } = pointerToPoints(event);

    if (event.pointerType === "touch") {
      touchPointsRef.current.set(event.pointerId, screen);
      if (touchModeRef.current) {
        const multi = updateTouchState();
        if (multi) {
          const scale = multi.distance / Math.max(1, touchModeRef.current.distance);
          const nextZoom = Math.min(4, Math.max(0.2, touchModeRef.current.zoom * scale));
          const worldX = (touchModeRef.current.center.x - touchModeRef.current.viewportX) / touchModeRef.current.zoom;
          const worldY = (touchModeRef.current.center.y - touchModeRef.current.viewportY) / touchModeRef.current.zoom;
          state.setViewport({
            zoom: nextZoom,
            x: multi.center.x - worldX * nextZoom,
            y: multi.center.y - worldY * nextZoom
          });
          return;
        }
      }
    }

    const interaction = interactionRef.current;
    if (interaction.pointerId !== event.pointerId) return;

    if (interaction.mode === "draw" && interaction.draftStyle) {
      const lastPoint = interaction.draftPoints[interaction.draftPoints.length - 1];
      if (!lastPoint || distance(lastPoint, world) >= 0.35 / Math.max(0.5, viewport.zoom)) {
        interaction.draftPoints = [...interaction.draftPoints, world];
        interaction.guides = [];
        requestDraftRender();
      }
      return;
    }

    const snapped = snapPoint(world, state.scene.snapToGrid);
    const deltaWorld = { x: snapped.x - interaction.originWorld.x, y: snapped.y - interaction.originWorld.y };

    if (interaction.mode === "pan" && interaction.startViewport) {
      state.setViewport({ x: interaction.startViewport.x + screen.x - interaction.originScreen.x, y: interaction.startViewport.y + screen.y - interaction.originScreen.y });
      return;
    }

    if (interaction.mode === "move") {
      const selectedIds = interaction.targetIds;
      const originalBounds = getSelectionBounds(selectedIds.map((id) => interaction.selectedSnapshot.get(id)).filter(Boolean) as DrawableElement[]);
      const movedBounds = originalBounds ? { ...originalBounds, x: originalBounds.x + deltaWorld.x, y: originalBounds.y + deltaWorld.y } : null;
      const snappedResult = movedBounds ? snapBounds(movedBounds, getOtherBounds(selectedIds)) : null;
      const adjusted = snappedResult ? { x: deltaWorld.x + (snappedResult.bounds.x - movedBounds!.x), y: deltaWorld.y + (snappedResult.bounds.y - movedBounds!.y) } : deltaWorld;
      interaction.guides = snappedResult?.guides ?? [];
      state.updateElements(selectedIds, (element) => {
        const original = interaction.selectedSnapshot.get(element.id) ?? element;
        if (original.type === "line" || original.type === "arrow") return { ...original, x: original.x + adjusted.x, y: original.y + adjusted.y, points: [{ x: original.points[0].x + adjusted.x, y: original.points[0].y + adjusted.y }, { x: original.points[1].x + adjusted.x, y: original.points[1].y + adjusted.y }], updatedAt: Date.now() };
        if (original.type === "pencil") return { ...original, x: original.x + adjusted.x, y: original.y + adjusted.y, points: original.points.map((point) => ({ x: point.x + adjusted.x, y: point.y + adjusted.y })), updatedAt: Date.now() };
        return { ...original, x: original.x + adjusted.x, y: original.y + adjusted.y, updatedAt: Date.now() };
      });
      requestDraftRender();
      return;
    }

    if (interaction.mode === "marquee") {
      interaction.marquee = normalizeRect(interaction.originWorld, snapped);
      const selected = state.scene.elements.filter((element) => element.visible).filter((element) => {
        const bounds = getElementBounds(element);
        const marquee = interaction.marquee;
        return marquee && bounds.x >= marquee.x && bounds.y >= marquee.y && bounds.x + bounds.width <= marquee.x + marquee.width && bounds.y + bounds.height <= marquee.y + marquee.height;
      }).flatMap((element) => getElementGroupMembers(state, element).map((item) => item.id));
      state.setSelection(Array.from(new Set(selected)));
      requestDraftRender();
      return;
    }

    if (interaction.mode === "resize" && interaction.handle && interaction.targetIds.length === 1) {
      const id = interaction.targetIds[0];
      state.updateElement(id, (element) => {
        const original = interaction.selectedSnapshot.get(id) ?? element;
        const nextBounds = resizeBounds(getElementBounds(original), interaction.handle!, deltaWorld, event.shiftKey);
        const snappedResult = snapBounds(nextBounds, getOtherBounds([id]));
        interaction.guides = snappedResult.guides;
        const snappedBounds = snappedResult.bounds;
        return resizeElement(original, snappedBounds);
      });
      requestDraftRender();
      return;
    }

    if (interaction.mode === "rotate" && interaction.targetIds.length === 1) {
      const id = interaction.targetIds[0];
      const original = interaction.selectedSnapshot.get(id);
      if (!original) return;
      const bounds = getElementBounds(original);
      const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      const angle = Math.atan2(snapped.y - center.y, snapped.x - center.x) + Math.PI / 2;
      state.updateElement(id, (element) => ({ ...element, rotation: angle, updatedAt: Date.now() }));
      requestDraftRender();
      return;
    }

    if (interaction.mode === "draw" && interaction.draftId) {
      state.updateElement(interaction.draftId, (element) => {
        if (element.type === "line" || element.type === "arrow") {
          interaction.guides = [];
          return { ...element, width: snapped.x - interaction.originWorld.x, height: snapped.y - interaction.originWorld.y, points: [interaction.originWorld, snapped], updatedAt: Date.now() };
        }
        const rect = normalizeRect(interaction.originWorld, snapped);
        const candidate = { x: event.altKey ? interaction.originWorld.x - rect.width : rect.x, y: event.altKey ? interaction.originWorld.y - rect.height : rect.y, width: event.altKey ? rect.width * 2 : rect.width, height: event.altKey ? rect.height * 2 : rect.height };
        const snappedResult = snapBounds(candidate, getOtherBounds([interaction.draftId ?? ""]));
        interaction.guides = snappedResult.guides;
        const width = event.shiftKey ? Math.max(snappedResult.bounds.width, snappedResult.bounds.height) : snappedResult.bounds.width;
        const height = event.shiftKey ? width : snappedResult.bounds.height;
        return { ...element, x: snappedResult.bounds.x, y: snappedResult.bounds.y, width, height, updatedAt: Date.now() };
      });
      requestDraftRender();
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "touch") {
      touchPointsRef.current.delete(event.pointerId);
      if (touchPointsRef.current.size < 2) touchModeRef.current = null;
    }

    const state = useEditorStore.getState();
    const interaction = interactionRef.current;
    if (interaction.pointerId !== event.pointerId) return;

    if (interaction.mode === "draw" && interaction.draftStyle && interaction.draftPoints.length) {
      const points = simplifyPoints(interaction.draftPoints, 0.75);
      if (points.length > 1) {
        const pencil = createElement("pencil", points[0], interaction.draftStyle);
        if (pencil.type === "pencil") {
          const bounds = getElementBounds({ ...pencil, points });
          pencil.points = points;
          pencil.x = bounds.x;
          pencil.y = bounds.y;
          pencil.width = bounds.width;
          pencil.height = bounds.height;
          pencil.updatedAt = Date.now();
          state.addElement(pencil);
          state.setSelection([pencil.id]);
          state.setTool("select");
        }
      }
    }

    if (interaction.mode === "draw" && interaction.draftId) {
      state.setSelection([interaction.draftId]);
      state.setTool("select");
    }

    interactionRef.current = initialInteraction();
    requestDraftRender();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      const point = { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
      useEditorStore.getState().zoomAt(point, viewport.zoom * (event.deltaY > 0 ? 0.92 : 1.08));
      return;
    }
    event.preventDefault();
    useEditorStore.getState().panViewport({ x: event.shiftKey ? -event.deltaY : -event.deltaX, y: event.shiftKey ? 0 : -event.deltaY });
  };

  const commitText = () => {
    if (!editingText) return;
    const nextValue = editingText.value.trimEnd();
    const state = useEditorStore.getState();
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!nextValue) {
      setEditingText(null);
      state.setTool("select");
      return;
    }

    if (editingText.id) {
      state.pushHistory();
      state.updateElement(editingText.id, (element) => {
        if (element.type !== "text") return element;
        if (!context) return { ...element, text: nextValue, updatedAt: Date.now() };
        const measured = measureTextLines(context, { ...element, text: nextValue });
        return { ...element, text: nextValue, width: Math.max(160, measured.width + 12), height: Math.max(48, measured.height + 12), updatedAt: Date.now() };
      });
      state.setSelection([editingText.id]);
    } else {
      const element = createElement("text", { x: editingText.worldX, y: editingText.worldY }, editingText.style) as TextElement;
      element.text = nextValue;
      element.lineHeight = editingText.lineHeight;
      if (context) {
        const measured = measureTextLines(context, element);
        element.width = Math.max(160, measured.width + 12);
        element.height = Math.max(48, measured.height + 12);
      }
      state.pushHistory();
      state.addElement(element);
      state.setSelection([element.id]);
    }

    setEditingText(null);
    state.setTool("select");
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onWheel={handleWheel} />
      {editingText && (
        <textarea
          ref={textAreaRef}
          autoFocus
          placeholder="Type text"
          value={editingText.value}
          onChange={(event) => {
            const lines = event.target.value.split("\n").length;
            setEditingText((current) => current ? { ...current, value: event.target.value, height: Math.max(96, lines * 32 + 28) } : current);
          }}
          onBlur={commitText}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              if (editingText.id) {
                useEditorStore.getState().updateElement(editingText.id, (element) => element.type === "text" ? { ...element, text: editingText.initialValue } : element);
              }
              setEditingText(null);
              useEditorStore.getState().setTool("select");
              return;
            }
            if ((event.key === "Enter" && !event.shiftKey) || ((event.ctrlKey || event.metaKey) && event.key === "Enter")) {
              event.preventDefault();
              commitText();
            }
          }}
          className="absolute z-20 resize-y rounded-2xl border-2 border-sky-400 bg-white/95 p-3 text-sm shadow-xl outline-none dark:border-sky-500/70 dark:bg-slate-900/95"
          style={{ left: editingText.x, top: editingText.y, width: editingText.width, minHeight: editingText.height }}
        />
      )}
      {errorMessage && <div className="absolute right-4 top-4 rounded-2xl bg-rose-500 px-3 py-2 text-sm text-white shadow-lg" onClick={() => setErrorMessage(null)}>{errorMessage}</div>}
    </div>
  );
};

const drawGrid = (context: CanvasRenderingContext2D, width: number, height: number, zoom: number, offsetX: number, offsetY: number) => {
  const size = Math.max(8, 16 * zoom);
  const styles = getComputedStyle(document.documentElement);
  const minor = styles.getPropertyValue("--grid-minor").trim() || "rgba(148,163,184,0.08)";
  const major = styles.getPropertyValue("--grid-major").trim() || "rgba(148,163,184,0.16)";
  context.save();
  for (let x = ((offsetX % size) + size) % size; x < width; x += size) {
    context.strokeStyle = Math.round((x - offsetX) / size) % 4 === 0 ? major : minor;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = ((offsetY % size) + size) % size; y < height; y += size) {
    context.strokeStyle = Math.round((y - offsetY) / size) % 4 === 0 ? major : minor;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.restore();
};

const drawSelectionBounds = (context: CanvasRenderingContext2D, bounds: Bounds, zoom: number) => {
  const handleSize = (navigator.maxTouchPoints || 0) > 0 ? 16 / zoom : 10 / zoom;
  context.save();
  context.strokeStyle = "#2563eb";
  context.fillStyle = "#ffffff";
  context.lineWidth = 1 / zoom;
  context.setLineDash([8 / zoom, 6 / zoom]);
  context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  context.setLineDash([]);
  const handles = handlePositions(bounds);
  Object.values(handles).forEach((point) => {
    context.beginPath();
    context.rect(point.x - handleSize / 2, point.y - handleSize / 2, handleSize, handleSize);
    context.fill();
    context.stroke();
  });
  context.restore();
};


