import { Group, Layers, Lock, MoveVertical, Palette, SquareDashedMousePointer, Trash2, Type, Ungroup } from "lucide-react";
import { useMemo } from "react";
import { useEditorStore, selectSelectedElements } from "../store/editorStore";

const strokeSwatches = ["#0f172a", "#ef4444", "#f97316", "#eab308", "#16a34a", "#0284c7", "#7c3aed", "#db2777"];
const fillSwatches = ["#ffffff", "#fef2f2", "#fff7ed", "#fefce8", "#ecfccb", "#e0f2fe", "#ede9fe", "transparent"];
const fontFamilies = [
  "Manrope, sans-serif",
  "Georgia, serif",
  "'Trebuchet MS', sans-serif",
  "'Courier New', monospace"
];

export const PropertiesPanel = () => {
  const state = useEditorStore();
  const selectedElements = useMemo(() => selectSelectedElements(state), [state.scene.elements, state.selection.selectedIds]);
  const sample = selectedElements[0];
  const style = sample?.style ?? state.activeStyle;
  const textSample = selectedElements.find((element) => element.type === "text");

  const applyStyle = (partial: Partial<typeof style>) => {
    if (selectedElements.length) {
      state.applyStyleToSelection(partial);
      return;
    }
    state.updateActiveStyle(partial);
  };

  const isGrouped = selectedElements.some((element) => element.groupId);

  return (
    <aside className="glass-panel scrollbar-thin min-h-0 overflow-y-auto rounded-3xl p-4">
      <div className="mb-4">
        <div className="font-display text-lg font-semibold">Inspector</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {selectedElements.length ? `${selectedElements.length} selected` : "Choose a tool or select an object"}
        </div>
      </div>

      <div className="space-y-5 text-sm">
        <section>
          <div className="mb-2 font-medium">Preset</div>
          <select className="w-full rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40" value={state.preferences.stylePreset} onChange={(event) => state.setStylePreset(event.target.value as typeof state.preferences.stylePreset)}>
            <option value="clean">Clean</option>
            <option value="sketch">Sketch</option>
            <option value="presentation">Presentation</option>
            <option value="marker">Bold marker</option>
            <option value="wireframe">Wireframe</option>
          </select>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2 font-medium"><Palette size={14} /> Stroke</div>
          <div className="flex flex-wrap gap-2">
            {strokeSwatches.map((color) => (
              <button key={color} className="h-7 w-7 rounded-full border border-slate-300" style={{ backgroundColor: color }} onClick={() => applyStyle({ strokeColor: color, textColor: color })} />
            ))}
            <input type="color" value={style.strokeColor} onChange={(event) => applyStyle({ strokeColor: event.target.value, textColor: event.target.value })} className="h-7 w-10 rounded-lg border border-slate-300 bg-transparent p-0" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900/40">Width
              <input type="range" min="1" max="10" value={style.strokeWidth} onChange={(event) => applyStyle({ strokeWidth: Number(event.target.value) })} className="mt-2 w-full" />
            </label>
            <label className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900/40">Opacity
              <input type="range" min="10" max="100" value={style.opacity} onChange={(event) => applyStyle({ opacity: Number(event.target.value) })} className="mt-2 w-full" />
            </label>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/40" value={style.strokeStyle} onChange={(event) => applyStyle({ strokeStyle: event.target.value as typeof style.strokeStyle })}>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
            <select className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/40" value={style.renderStyle} onChange={(event) => applyStyle({ renderStyle: event.target.value as typeof style.renderStyle, roughness: event.target.value === "clean" ? 0 : Math.max(style.roughness, 1.2), fillStyle: event.target.value === "clean" ? "solid" : style.fillStyle })}>
              <option value="clean">Clean</option>
              <option value="rough">Rough</option>
            </select>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2 font-medium"><SquareDashedMousePointer size={14} /> Fill</div>
          <div className="flex flex-wrap gap-2">
            {fillSwatches.map((color) => (
              <button key={color} className="h-7 w-7 rounded-full border border-slate-300" style={{ background: color === "transparent" ? "linear-gradient(135deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)" : color }} onClick={() => applyStyle({ fillColor: color })} />
            ))}
            <input type="color" value={style.fillColor === "transparent" ? "#ffffff" : style.fillColor} onChange={(event) => applyStyle({ fillColor: event.target.value })} className="h-7 w-10 rounded-lg border border-slate-300 bg-transparent p-0" />
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2 font-medium"><Type size={14} /> Text</div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="10" max="128" value={style.fontSize} onChange={(event) => applyStyle({ fontSize: Number(event.target.value) })} className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40" />
            <select className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40" value={style.textAlign} onChange={(event) => applyStyle({ textAlign: event.target.value as CanvasTextAlign })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40" value={style.fontFamily} onChange={(event) => applyStyle({ fontFamily: event.target.value })}>
              {fontFamilies.map((font) => <option key={font} value={font}>{font.split(",")[0].replace(/'/g, "")}</option>)}
            </select>
            <label className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900/40">
              Line height {(textSample?.lineHeight ?? 1.35).toFixed(2)}
              <input
                type="range"
                min="1"
                max="2"
                step="0.05"
                value={textSample?.lineHeight ?? 1.35}
                onChange={(event) => state.updateElements(state.selection.selectedIds, (element) => element.type === "text" ? { ...element, lineHeight: Number(event.target.value), updatedAt: Date.now() } : element)}
                className="mt-2 w-full"
              />
            </label>
          </div>
          <div className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
            Text tool: press <kbd>Enter</kbd> to save, <kbd>Shift + Enter</kbd> for a new line, and double-click existing text to edit it.
          </div>
        </section>

        <section>
          <div className="mb-2 font-medium">Canvas</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900/40"><span>Grid</span><input type="checkbox" checked={state.scene.gridEnabled} onChange={(event) => state.setGridEnabled(event.target.checked)} /></label>
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900/40"><span>Snap</span><input type="checkbox" checked={state.scene.snapToGrid} onChange={(event) => state.setSnapToGrid(event.target.checked)} /></label>
          </div>
          <input type="color" className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white/70 p-2 dark:border-white/10 dark:bg-slate-900/40" value={state.scene.background} onChange={(event) => state.setBackground(event.target.value)} />
        </section>

        {selectedElements.length > 0 && (
          <section>
            <div className="mb-2 font-medium">Arrange</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button className="rounded-2xl border border-slate-200 px-3 py-2 dark:border-white/10" onClick={() => state.reorderSelection("front")}><Layers className="mr-2 inline" size={14} />Front</button>
              <button className="rounded-2xl border border-slate-200 px-3 py-2 dark:border-white/10" onClick={() => state.reorderSelection("back")}><MoveVertical className="mr-2 inline" size={14} />Back</button>
              <button className="rounded-2xl border border-slate-200 px-3 py-2 dark:border-white/10" onClick={() => state.groupSelection()}><Group className="mr-2 inline" size={14} />Group</button>
              <button className="rounded-2xl border border-slate-200 px-3 py-2 dark:border-white/10" onClick={() => state.ungroupSelection()} disabled={!isGrouped}><Ungroup className="mr-2 inline" size={14} />Ungroup</button>
              <button className="rounded-2xl border border-slate-200 px-3 py-2 dark:border-white/10" onClick={() => state.duplicateSelection()}>Duplicate</button>
              <button className="rounded-2xl border border-slate-200 px-3 py-2 dark:border-white/10" onClick={() => state.removeElements(state.selection.selectedIds)}><Trash2 className="mr-2 inline" size={14} />Delete</button>
            </div>
            <button className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs dark:border-white/10" onClick={() => state.updateElements(state.selection.selectedIds, (element) => ({ ...element, locked: !element.locked }))}><Lock className="mr-2 inline" size={14} />Toggle lock</button>
          </section>
        )}
      </div>
    </aside>
  );
};
