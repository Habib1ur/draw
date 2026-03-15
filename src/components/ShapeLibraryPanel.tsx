import { useMemo } from "react";
import { SquareStack, StickyNote, Workflow, Shapes, Milestone } from "lucide-react";
import { useEditorStore } from "../store/editorStore";
import { createElement, DEFAULT_STYLE } from "../utils/element";
import { createId } from "../utils/id";
import type { DrawableElement, TextElement } from "../types/editor";

interface TemplateDef {
  id: string;
  label: string;
  description: string;
  icon: typeof Shapes;
  build: () => DrawableElement[];
}

const baseText = (x: number, y: number, text: string): TextElement => ({
  ...(createElement("text", { x, y }, { renderStyle: "clean", fillColor: "transparent" }) as TextElement),
  text,
  width: 180,
  height: 60,
  style: { ...DEFAULT_STYLE, renderStyle: "clean", fillColor: "transparent", fontSize: 22, textColor: "#0f172a" }
});

export const ShapeLibraryPanel = () => {
  const { addElements, pushHistory } = useEditorStore();

  const templates = useMemo<TemplateDef[]>(() => [
    {
      id: "sticky-note",
      label: "Sticky Note",
      description: "Note card with warm fill",
      icon: StickyNote,
      build: () => {
        const note = createElement("rectangle", { x: -160, y: -120 }, {
          fillColor: "#fef08a",
          strokeColor: "#ca8a04",
          renderStyle: "clean",
          roundness: 18
        });
        note.width = 220;
        note.height = 180;
        const text = baseText(-132, -92, "Idea\nAdd details here");
        text.groupId = note.groupId = createId();
        return [{ ...note, groupId: text.groupId }, text];
      }
    },
    {
      id: "flow-process",
      label: "Process",
      description: "Flowchart process block",
      icon: Workflow,
      build: () => {
        const groupId = createId();
        const rect = createElement("rectangle", { x: -180, y: -60 }, {
          fillColor: "#e0f2fe",
          strokeColor: "#0284c7",
          renderStyle: "clean",
          roundness: 20
        });
        rect.width = 280;
        rect.height = 120;
        rect.groupId = groupId;
        const text = baseText(-110, -12, "Process step");
        text.groupId = groupId;
        return [rect, text];
      }
    },
    {
      id: "decision",
      label: "Decision",
      description: "Diamond decision node",
      icon: Milestone,
      build: () => {
        const groupId = createId();
        const diamond = createElement("diamond", { x: -110, y: -110 }, {
          fillColor: "#ede9fe",
          strokeColor: "#7c3aed",
          renderStyle: "clean"
        });
        diamond.width = 220;
        diamond.height = 220;
        diamond.groupId = groupId;
        const text = baseText(-62, -16, "Decision?");
        text.groupId = groupId;
        return [diamond, text];
      }
    },
    {
      id: "wireframe-card",
      label: "Wireframe Card",
      description: "Simple UI block",
      icon: SquareStack,
      build: () => {
        const groupId = createId();
        const shell = createElement("rectangle", { x: -220, y: -140 }, {
          fillColor: "#ffffff",
          strokeColor: "#334155",
          renderStyle: "clean",
          roundness: 24
        });
        shell.width = 320;
        shell.height = 220;
        shell.groupId = groupId;
        const header = createElement("rectangle", { x: -220, y: -140 }, {
          fillColor: "#e2e8f0",
          strokeColor: "#334155",
          renderStyle: "clean",
          roundness: 24
        });
        header.width = 320;
        header.height = 54;
        header.groupId = groupId;
        const body = baseText(-178, -62, "Card title\nSupport copy and annotation");
        body.groupId = groupId;
        return [shell, header, body];
      }
    }
  ], []);

  return (
    <section className="glass-panel rounded-3xl p-4">
      <div className="mb-3">
        <div className="font-display text-lg font-semibold">Shape Library</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">Quick insert reusable blocks and templates</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {templates.map((template) => {
          const Icon = template.icon;
          return (
            <button
              key={template.id}
              className="rounded-3xl border border-slate-200 bg-white/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-lg dark:border-white/10 dark:bg-slate-900/40"
              onClick={() => {
                pushHistory();
                addElements(template.build());
              }}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-2 dark:bg-slate-800"><Icon size={18} /></div>
                <div className="font-medium">{template.label}</div>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{template.description}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
