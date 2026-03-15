import { useMemo } from "react";
import { useEditorStore, selectSelectedElements } from "../store/editorStore";

export const StatusBar = () => {
  const state = useEditorStore();
  const selected = useMemo(() => selectSelectedElements(state), [state.scene.elements, state.selection.selectedIds]);

  return (
    <footer className="mt-3 flex items-center justify-between rounded-3xl px-1 text-xs text-slate-500 dark:text-slate-400">
      <div className="flex items-center gap-3">
        <span>{state.scene.elements.length} objects</span>
        <span>{selected.length} selected</span>
        <span>{state.scene.gridEnabled ? "Grid on" : "Grid off"}</span>
        <span>{state.scene.snapToGrid ? "Snap on" : "Snap off"}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>Autosave enabled</span>
        <span>{Math.round(state.viewport.zoom * 100)}% zoom</span>
      </div>
    </footer>
  );
};
