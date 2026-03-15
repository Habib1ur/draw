import { useEffect } from "react";
import { TOOL_DEFINITIONS } from "../constants/tools";
import { useEditorStore } from "../store/editorStore";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
};

export const useKeyboardShortcuts = () => {
  const state = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) && event.key !== "Escape") return;
      const meta = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (!meta) {
        const tool = TOOL_DEFINITIONS.find((item) => item.shortcut.toLowerCase() === key);
        if (tool) {
          event.preventDefault();
          state.setTool(tool.id);
          return;
        }
      }

      if ((event.key === "Delete" || event.key === "Backspace") && state.selection.selectedIds.length) {
        event.preventDefault();
        state.pushHistory();
        state.removeElements(state.selection.selectedIds);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        state.setSelection([]);
        if (state.preferences.showShortcuts) state.toggleShortcuts(false);
        if (state.activeTool !== "select") state.setTool("select");
        return;
      }

      if (meta && key === "z" && !event.shiftKey) {
        event.preventDefault();
        state.undo();
        return;
      }

      if (meta && ((key === "z" && event.shiftKey) || key === "y")) {
        event.preventDefault();
        state.redo();
        return;
      }

      if (meta && key === "c") {
        event.preventDefault();
        state.copySelection();
        return;
      }

      if (meta && key === "v") {
        event.preventDefault();
        state.pushHistory();
        state.pasteClipboard();
        return;
      }

      if (meta && key === "d") {
        event.preventDefault();
        state.pushHistory();
        state.duplicateSelection();
        return;
      }

      if (meta && key === "a") {
        event.preventDefault();
        state.setSelection(state.scene.elements.map((element) => element.id));
        return;
      }

      if (meta && key === "g" && !event.shiftKey) {
        event.preventDefault();
        state.pushHistory();
        state.groupSelection();
        return;
      }

      if (meta && key === "g" && event.shiftKey) {
        event.preventDefault();
        state.pushHistory();
        state.ungroupSelection();
        return;
      }

      if (meta && key === "s") {
        event.preventDefault();
        const blob = new Blob([JSON.stringify(state.exportProject(), null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "drawboard-scene.json";
        anchor.click();
        URL.revokeObjectURL(url);
        return;
      }

      if (meta && key === "+") {
        event.preventDefault();
        state.zoomAt({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, state.viewport.zoom * 1.1);
        return;
      }

      if (meta && key === "-") {
        event.preventDefault();
        state.zoomAt({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, state.viewport.zoom / 1.1);
        return;
      }

      if (meta && key === "0") {
        event.preventDefault();
        state.setViewport({ x: window.innerWidth / 2, y: window.innerHeight / 2, zoom: 1 });
        return;
      }

      if (event.key === "?" || (event.shiftKey && key === "/")) {
        event.preventDefault();
        state.toggleShortcuts(true);
        return;
      }

      if (state.selection.selectedIds.length && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const delta = {
          ArrowUp: { x: 0, y: -step },
          ArrowDown: { x: 0, y: step },
          ArrowLeft: { x: -step, y: 0 },
          ArrowRight: { x: step, y: 0 }
        }[event.key];
        if (!delta) return;
        state.pushHistory();
        state.updateElements(state.selection.selectedIds, (element) => {
          if (element.type === "line" || element.type === "arrow") {
            return {
              ...element,
              x: element.x + delta.x,
              y: element.y + delta.y,
              points: [
                { x: element.points[0].x + delta.x, y: element.points[0].y + delta.y },
                { x: element.points[1].x + delta.x, y: element.points[1].y + delta.y }
              ],
              updatedAt: Date.now()
            };
          }
          if (element.type === "pencil") {
            return {
              ...element,
              x: element.x + delta.x,
              y: element.y + delta.y,
              points: element.points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })),
              updatedAt: Date.now()
            };
          }
          return { ...element, x: element.x + delta.x, y: element.y + delta.y, updatedAt: Date.now() };
        });
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state]);
};
