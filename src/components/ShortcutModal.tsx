import { TOOL_DEFINITIONS } from "../constants/tools";
import { useEditorStore } from "../store/editorStore";

const extraShortcuts = [
  ["Delete", "Delete selection"],
  ["Ctrl/Cmd + Z", "Undo"],
  ["Ctrl/Cmd + Shift + Z", "Redo"],
  ["Ctrl/Cmd + C", "Copy"],
  ["Ctrl/Cmd + V", "Paste"],
  ["Ctrl/Cmd + D", "Duplicate"],
  ["Ctrl/Cmd + A", "Select all"],
  ["Ctrl/Cmd + S", "Export JSON"],
  ["Ctrl/Cmd + 0", "Reset zoom"],
  ["?", "Show shortcuts"],
  ["Arrow keys", "Nudge selection"],
  ["Shift + Arrow", "Large nudge"],
  ["Space + drag", "Temporary pan"]
];

export const ShortcutModal = () => {
  const { preferences, toggleShortcuts } = useEditorStore();
  if (!preferences.showShortcuts) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4" onClick={() => toggleShortcuts(false)}>
      <div className="glass-panel w-full max-w-2xl rounded-3xl p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 font-display text-lg font-semibold">Keyboard shortcuts</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {TOOL_DEFINITIONS.map((tool) => (
            <div key={tool.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/40">
              <span>{tool.label}</span>
              <kbd>{tool.shortcut}</kbd>
            </div>
          ))}
          {extraShortcuts.map(([shortcut, description]) => (
            <div key={shortcut} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/40">
              <span>{description}</span>
              <kbd>{shortcut}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
