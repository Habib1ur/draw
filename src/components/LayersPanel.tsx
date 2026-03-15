import { Eye, EyeOff, Layers3, Lock, LockOpen, MoveDown, MoveUp } from "lucide-react";
import { useMemo } from "react";
import { getElementLabel, useEditorStore } from "../store/editorStore";

export const LayersPanel = () => {
  const state = useEditorStore();
  const items = useMemo(() => [...state.scene.elements].sort((a, b) => b.zIndex - a.zIndex), [state.scene.elements]);

  return (
    <section className="glass-panel scrollbar-thin min-h-0 overflow-y-auto rounded-3xl p-4">
      <div className="mb-3">
        <div className="font-display text-lg font-semibold">Layers</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">Rename, reorder, lock, and hide objects</div>
      </div>
      <div className="space-y-2">
        {items.map((element) => {
          const selected = state.selection.selectedIds.includes(element.id);
          return (
            <div key={element.id} className={`rounded-2xl border px-3 py-2 ${selected ? "border-sky-400 bg-sky-50 dark:bg-sky-950/30" : "border-slate-200 bg-white/60 dark:border-white/10 dark:bg-slate-900/40"}`}>
              <div className="flex items-center gap-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => state.setSelection([element.id])}>
                  <div className="truncate text-sm font-medium">{getElementLabel(element)}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{element.type}</div>
                </button>
                <button onClick={() => state.moveElementByOne(element.id, "up")} aria-label="Move up" className="rounded-xl p-1 hover:bg-slate-900/5 dark:hover:bg-white/5"><MoveUp size={14} /></button>
                <button onClick={() => state.moveElementByOne(element.id, "down")} aria-label="Move down" className="rounded-xl p-1 hover:bg-slate-900/5 dark:hover:bg-white/5"><MoveDown size={14} /></button>
                <button onClick={() => state.toggleElementVisibility(element.id)} aria-label="Toggle visibility" className="rounded-xl p-1 hover:bg-slate-900/5 dark:hover:bg-white/5">{element.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                <button onClick={() => state.toggleElementLock(element.id)} aria-label="Toggle lock" className="rounded-xl p-1 hover:bg-slate-900/5 dark:hover:bg-white/5">{element.locked ? <Lock size={14} /> : <LockOpen size={14} />}</button>
              </div>
              <input
                value={element.metadata?.name ?? ""}
                onChange={(event) => state.renameElement(element.id, event.target.value)}
                placeholder="Custom name"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white/70 px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-950/30"
              />
            </div>
          );
        })}
        {!items.length && (
          <div className="rounded-2xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            <Layers3 className="mx-auto mb-2" size={18} />
            No objects yet
          </div>
        )}
      </div>
    </section>
  );
};
