import { useEditorStore } from "../store/editorStore";
import { downloadBlob, exportScene } from "../utils/export";
import { selectSelectedElements } from "../store/editorStore";

export const ExportDialog = () => {
  const state = useEditorStore();
  if (!state.isExportDialogOpen) return null;

  const handleExport = async () => {
    try {
      const canvas = document.querySelector("canvas");
      if (!(canvas instanceof HTMLCanvasElement)) return;
      const selected = selectSelectedElements(useEditorStore.getState());
      const blob = await exportScene(state.scene, state.exportSettings.selectionOnly ? selected : state.scene.elements, state.exportSettings, canvas);
      const extension = state.exportSettings.format === "jpeg" ? "jpg" : state.exportSettings.format;
      downloadBlob(blob, `${state.exportSettings.filename}.${extension}`);
      state.setExportDialogOpen(false);
    } catch {
      state.setErrorMessage("Export failed.");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="glass-panel w-full max-w-md rounded-3xl p-5">
        <div className="mb-4 font-display text-lg font-semibold">Export scene</div>
        <div className="space-y-3 text-sm">
          <input className="w-full rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40" value={state.exportSettings.filename} onChange={(event) => state.setExportSettings({ filename: event.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40" value={state.exportSettings.format} onChange={(event) => state.setExportSettings({ format: event.target.value as typeof state.exportSettings.format })}>
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="svg">SVG</option>
              <option value="pdf">PDF</option>
              <option value="json">JSON</option>
            </select>
            <select className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40" value={state.exportSettings.scale} onChange={(event) => state.setExportSettings({ scale: Number(event.target.value) as 1 | 2 | 3 })}>
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="3">3x</option>
            </select>
          </div>
          <label className="block rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900/40">
            JPEG quality {state.exportSettings.quality.toFixed(2)}
            <input type="range" min="0.4" max="1" step="0.02" className="mt-2 w-full" value={state.exportSettings.quality} onChange={(event) => state.setExportSettings({ quality: Number(event.target.value) })} />
          </label>
          <label className="block rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900/40">
            Padding {state.exportSettings.padding}px
            <input type="range" min="0" max="96" step="4" className="mt-2 w-full" value={state.exportSettings.padding} onChange={(event) => state.setExportSettings({ padding: Number(event.target.value) })} />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900/40">
            <span>Transparent background</span>
            <input type="checkbox" checked={state.exportSettings.transparentBackground} onChange={(event) => state.setExportSettings({ transparentBackground: event.target.checked })} />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900/40">
            <span>Selection only</span>
            <input type="checkbox" checked={state.exportSettings.selectionOnly} onChange={(event) => state.setExportSettings({ selectionOnly: event.target.checked })} />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-2xl border border-slate-200 px-4 py-2 dark:border-white/10" onClick={() => state.setExportDialogOpen(false)}>Cancel</button>
          <button className="rounded-2xl bg-slate-900 px-4 py-2 text-white dark:bg-white dark:text-slate-900" onClick={() => void handleExport()}>Export</button>
        </div>
      </div>
    </div>
  );
};
