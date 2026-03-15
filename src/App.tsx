import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  HelpCircle,
  ImagePlus,
  Moon,
  LocateFixed,
  RefreshCw,
  RotateCcw,
  Save,
  Sun,
  Trash2,
  Undo2,
  Redo2,
  Upload,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { CanvasView } from "./features/canvas/CanvasView";
import { TOOL_DEFINITIONS } from "./constants/tools";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { ExportDialog } from "./components/ExportDialog";
import { ShortcutModal } from "./components/ShortcutModal";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { StatusBar } from "./components/StatusBar";
import { ShapeLibraryPanel } from "./components/ShapeLibraryPanel";
import { useEditorStore, validateProject } from "./store/editorStore";
import { downloadBlob } from "./utils/export";

const App = () => {
  useKeyboardShortcuts();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [topCollapsed, setTopCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const state = useEditorStore();

  useEffect(() => {
    const resolved = state.preferences.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : state.preferences.theme === "dark";
    document.documentElement.classList.toggle("dark", resolved);
  }, [state.preferences.theme]);

  const handleFreshCanvas = () => {
    if (!window.confirm("Clear the current canvas and start a fresh board?")) return;
    state.clearScene();
    state.setTool("select");
  };

  const handleRecenterCanvas = () => {
    state.setViewport({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    });
  };

  const handleImageImport = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      state.setErrorMessage("Unsupported image type.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const image = new Image();
      image.onload = () => {
        state.pushHistory();
        state.addElement({
          id: crypto.randomUUID(),
          type: "image",
          x: -image.width / 2,
          y: -image.height / 2,
          width: image.width,
          height: image.height,
          rotation: 0,
          style: { ...state.activeStyle, renderStyle: "clean" },
          locked: false,
          visible: true,
          zIndex: state.scene.elements.length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          src,
          naturalWidth: image.width,
          naturalHeight: image.height,
          metadata: { name: `Image ${state.scene.elements.length + 1}` }
        });
      };
      image.onerror = () => state.setErrorMessage("Image failed to load.");
      image.src = src;
    };
    reader.onerror = () => state.setErrorMessage("Image import failed.");
    reader.readAsDataURL(file);
  };

  const handleProjectImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const project = validateProject(parsed);
      if (!project) {
        state.setErrorMessage("Invalid project file.");
        return;
      }
      state.pushHistory();
      state.importProject(project);
    } catch {
      state.setErrorMessage("Unable to import project JSON.");
    }
  };

  const desktopGrid = rightCollapsed
    ? "xl:grid-cols-[minmax(0,1fr)]"
    : "xl:grid-cols-[minmax(0,1fr)_380px]";

  return (
    <div className="flex min-h-screen flex-col overflow-hidden p-2 text-slate-900 dark:text-slate-50 sm:p-3">
      <header className="glass-panel mb-3 rounded-3xl px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display text-lg font-bold">Drawboard Pro</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Responsive whiteboard with a top tool dock, collapsible right panel, shape templates, and a rebuilt freehand tool</div>
          </div>
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-px-1 sm:flex-wrap sm:overflow-visible">
            <button className={`snap-start shrink-0 rounded-2xl p-2 transition hover:bg-slate-900/5 dark:hover:bg-white/5 ${topCollapsed ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : ""}`} onClick={() => setTopCollapsed((value) => !value)} aria-label="Toggle top tools" title="Toggle top tools">
              <ChevronDown size={18} className={topCollapsed ? "rotate-180" : ""} />
            </button>
            <button className={`snap-start shrink-0 rounded-2xl p-2 transition hover:bg-slate-900/5 dark:hover:bg-white/5 ${rightCollapsed ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : ""}`} onClick={() => setRightCollapsed((value) => !value)} aria-label="Toggle right panel" title="Toggle right panel">
              {rightCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
            <button className="snap-start shrink-0 rounded-2xl p-2 hover:bg-slate-900/5 dark:hover:bg-white/5" onClick={state.undo} aria-label="Undo"><Undo2 size={18} /></button>
            <button className="snap-start shrink-0 rounded-2xl p-2 hover:bg-slate-900/5 dark:hover:bg-white/5" onClick={state.redo} aria-label="Redo"><Redo2 size={18} /></button>
            <button className="snap-start shrink-0 rounded-2xl p-2 hover:bg-slate-900/5 dark:hover:bg-white/5" onClick={handleFreshCanvas} aria-label="New canvas" title="New canvas"><RefreshCw size={18} /></button>
            <button className="snap-start shrink-0 rounded-2xl p-2 hover:bg-slate-900/5 dark:hover:bg-white/5" onClick={handleRecenterCanvas} aria-label="Recenter canvas" title="Recenter canvas"><LocateFixed size={18} /></button>
            <button className="snap-start shrink-0 rounded-2xl p-2 hover:bg-slate-900/5 dark:hover:bg-white/5" onClick={() => { const blob = new Blob([JSON.stringify(state.exportProject(), null, 2)], { type: "application/json" }); downloadBlob(blob, "drawboard-scene.json"); }} aria-label="Save JSON"><Save size={18} /></button>
            <button className="snap-start shrink-0 rounded-2xl p-2 hover:bg-slate-900/5 dark:hover:bg-white/5" onClick={() => state.setExportDialogOpen(true)} aria-label="Export"><Download size={18} /></button>
            <button className="snap-start shrink-0 rounded-2xl p-2 hover:bg-slate-900/5 dark:hover:bg-white/5" onClick={() => importInputRef.current?.click()} aria-label="Import JSON"><Upload size={18} /></button>
            <button className="snap-start shrink-0 rounded-2xl p-2 hover:bg-slate-900/5 dark:hover:bg-white/5" onClick={() => imageInputRef.current?.click()} aria-label="Import image"><ImagePlus size={18} /></button>
            <button className="snap-start shrink-0 rounded-2xl p-2 hover:bg-slate-900/5 dark:hover:bg-white/5" onClick={() => state.toggleShortcuts(true)} aria-label="Shortcuts"><HelpCircle size={18} /></button>
            <button className="snap-start shrink-0 rounded-2xl p-2 hover:bg-slate-900/5 dark:hover:bg-white/5" onClick={() => state.setTheme(state.preferences.theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">{state.preferences.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </div>
        <div className="px-1 pt-2 text-[10px] text-slate-500 dark:text-slate-400 sm:hidden">Swipe dashboard actions left or right</div>
      </header>

      {!topCollapsed && (
        <div className="glass-panel mb-3 rounded-3xl p-2">
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-px-2 sm:overflow-x-auto xl:overflow-visible xl:flex-wrap">
            <button
              className={`group snap-start shrink-0 min-w-[72px] rounded-2xl px-3 py-3 text-center transition sm:min-w-[76px] xl:min-w-[88px] ${
                state.selection.selectedIds.length
                  ? "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                  : "cursor-not-allowed opacity-40"
              }`}
              onClick={() => {
                if (!state.selection.selectedIds.length) return;
                state.pushHistory();
                state.removeElements(state.selection.selectedIds);
              }}
              title="Delete selected"
              aria-label="Delete selected"
              disabled={!state.selection.selectedIds.length}
            >
              <Trash2 size={18} className="mx-auto" />
              <div className="mt-1 text-[10px] font-medium sm:text-[11px]">Delete</div>
              <div className="text-[9px] text-current/70 sm:text-[10px]">Del</div>
            </button>
            {TOOL_DEFINITIONS.map((tool) => {
              const Icon = tool.icon;
              const active = state.activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  className={`group snap-start shrink-0 min-w-[72px] rounded-2xl px-3 py-3 text-center transition sm:min-w-[76px] xl:min-w-[88px] ${active ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "hover:bg-slate-900/5 dark:hover:bg-white/5"}`}
                  onClick={() => state.setTool(tool.id)}
                  title={`${tool.label} (${tool.shortcut})`}
                >
                  <Icon size={18} className="mx-auto" />
                  <div className="mt-1 text-[10px] font-medium sm:text-[11px]">{tool.label}</div>
                  <div className="text-[9px] text-current/70 sm:text-[10px]">{tool.shortcut}</div>
                </button>
              );
            })}
          </div>
          <div className="px-2 pt-2 text-[10px] text-slate-500 dark:text-slate-400 sm:hidden">Swipe tools left or right</div>
        </div>
      )}

      <div className={`grid min-h-0 flex-1 grid-cols-1 gap-3 ${desktopGrid}`}>
        <main className="order-1 flex min-h-[55vh] min-w-0 flex-col gap-3 xl:min-h-0">
          <section className="relative min-h-[55vh] flex-1 overflow-hidden rounded-[28px] border border-white/40 bg-[var(--bg-canvas)] shadow-panel dark:border-white/10 xl:min-h-0">
            <CanvasView />
            <div className="absolute left-4 top-4 hidden xl:flex flex-col gap-2">
              <button className="rounded-full bg-slate-950/80 px-3 py-2 text-xs text-white shadow-lg dark:bg-slate-100/90 dark:text-slate-900" onClick={() => setTopCollapsed((value) => !value)}>
                {topCollapsed ? "Show tools" : "Hide tools"}
              </button>
            </div>
            <div className="absolute right-4 top-4 hidden xl:flex flex-col gap-2">
              <button className="rounded-full bg-slate-950/80 px-3 py-2 text-xs text-white shadow-lg dark:bg-slate-100/90 dark:text-slate-900" onClick={() => setRightCollapsed((value) => !value)}>
                {rightCollapsed ? "Show right" : "Hide right"}
              </button>
            </div>
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-slate-950/80 px-3 py-2 text-xs text-white shadow-lg dark:bg-slate-100/90 dark:text-slate-900">
              <button onClick={() => state.zoomAt({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, state.viewport.zoom / 1.1)}><ZoomOut size={16} /></button>
              <span>{Math.round(state.viewport.zoom * 100)}%</span>
              <button onClick={() => state.zoomAt({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, state.viewport.zoom * 1.1)}><ZoomIn size={16} /></button>
              <button onClick={() => state.setViewport({ x: window.innerWidth / 2, y: window.innerHeight / 2, zoom: 1 })}><RotateCcw size={16} /></button>
            </div>
          </section>
          {!rightCollapsed && (
            <div className="grid gap-3 xl:hidden">
              <ShapeLibraryPanel />
            </div>
          )}
        </main>

        {!rightCollapsed && (
          <div className="order-2 grid min-h-0 gap-3 xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
            <PropertiesPanel />
            <div className="hidden xl:block"><ShapeLibraryPanel /></div>
          </div>
        )}
      </div>

      <StatusBar />
      <ExportDialog />
      <ShortcutModal />

      <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImageImport(file); event.currentTarget.value = ""; }} />
      <input ref={importInputRef} type="file" className="hidden" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleProjectImport(file); event.currentTarget.value = ""; }} />
    </div>
  );
};

export default App;
