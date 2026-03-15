import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  DrawableElement,
  EditorPreferences,
  EditorSnapshot,
  ExportSettings,
  HistoryState,
  Point,
  ProjectSchema,
  SceneState,
  SelectionState,
  ThemeMode,
  ToolType,
  EraserMode,
  ViewportState
} from "../types/editor";
import { DEFAULT_STYLE, cloneElement, stylePresets } from "../utils/element";
import { createId } from "../utils/id";

const SCHEMA_VERSION = 1;

export interface EditorState {
  scene: SceneState;
  viewport: ViewportState;
  selection: SelectionState;
  activeTool: ToolType;
  preferences: EditorPreferences;
  history: HistoryState;
  clipboard: DrawableElement[];
  exportSettings: ExportSettings;
  activeStyle: typeof DEFAULT_STYLE;
  isExportDialogOpen: boolean;
  errorMessage: string | null;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  setTool: (tool: ToolType) => void;
  setTheme: (theme: ThemeMode) => void;
  setEraserMode: (mode: EraserMode) => void;
  setEraserSize: (size: number) => void;
  toggleShortcuts: (open?: boolean) => void;
  setSelection: (selectedIds: string[]) => void;
  addElement: (element: DrawableElement, select?: boolean) => void;
  addElements: (elements: DrawableElement[], select?: boolean) => void;
  updateElement: (id: string, updater: (element: DrawableElement) => DrawableElement) => void;
  updateElements: (ids: string[], updater: (element: DrawableElement) => DrawableElement) => void;
  removeElements: (ids: string[]) => void;
  setElements: (elements: DrawableElement[]) => void;
  reorderSelection: (mode: "front" | "back" | "forward" | "backward") => void;
  moveElementByOne: (id: string, direction: "up" | "down") => void;
  renameElement: (id: string, name: string) => void;
  toggleElementVisibility: (id: string) => void;
  toggleElementLock: (id: string) => void;
  duplicateSelection: () => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  setViewport: (viewport: Partial<ViewportState>) => void;
  panViewport: (delta: Point) => void;
  zoomAt: (screenPoint: Point, nextZoom: number) => void;
  setBackground: (color: string) => void;
  setGridEnabled: (enabled: boolean) => void;
  setSnapToGrid: (enabled: boolean) => void;
  updateActiveStyle: (partial: Partial<typeof DEFAULT_STYLE>) => void;
  applyStyleToSelection: (partial: Partial<typeof DEFAULT_STYLE>) => void;
  setStylePreset: (preset: EditorPreferences["stylePreset"]) => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  clearScene: () => void;
  setExportDialogOpen: (open: boolean) => void;
  setExportSettings: (partial: Partial<ExportSettings>) => void;
  importProject: (project: ProjectSchema) => void;
  exportProject: () => ProjectSchema;
  setErrorMessage: (message: string | null) => void;
}

const snapshotFromState = (state: Pick<EditorState, "scene" | "selection" | "viewport">): EditorSnapshot => ({
  scene: structuredClone(state.scene),
  selection: structuredClone(state.selection),
  viewport: structuredClone(state.viewport)
});

const defaultScene: SceneState = {
  elements: [],
  background: "#ffffff",
  gridEnabled: true,
  snapToGrid: true
};

const defaultPreferences: EditorPreferences = {
  theme: "system",
  showShortcuts: false,
  stylePreset: "clean",
  lastUsedTool: "select",
  eraserMode: "partial",
  eraserSize: 20
};

const defaultExportSettings: ExportSettings = {
  filename: "drawboard-scene",
  format: "png",
  scale: 2,
  quality: 0.92,
  padding: 32,
  transparentBackground: false,
  selectionOnly: false
};

const initialViewport = (): ViewportState => ({
  x: typeof window === "undefined" ? 0 : window.innerWidth / 2,
  y: typeof window === "undefined" ? 0 : window.innerHeight / 2,
  zoom: 1
});

const normalizeZ = (elements: DrawableElement[]) =>
  elements.map((element, index) => ({ ...element, zIndex: index }));

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      scene: defaultScene,
      viewport: initialViewport(),
      selection: { selectedIds: [] },
      activeTool: "select",
      preferences: defaultPreferences,
      history: { past: [], future: [] },
      clipboard: [],
      exportSettings: defaultExportSettings,
      activeStyle: { ...DEFAULT_STYLE, ...stylePresets.clean },
      isExportDialogOpen: false,
      errorMessage: null,
      pushHistory: () => {
        const { history } = get();
        set((state) => ({
          history: {
            past: [...history.past.slice(-79), snapshotFromState(state)],
            future: []
          }
        }));
      },
      undo: () => {
        const { history } = get();
        const previous = history.past[history.past.length - 1];
        if (!previous) return;
        set((state) => ({
          scene: previous.scene,
          selection: previous.selection,
          viewport: previous.viewport,
          history: {
            past: state.history.past.slice(0, -1),
            future: [snapshotFromState(state), ...state.history.future]
          }
        }));
      },
      redo: () => {
        const { history } = get();
        const next = history.future[0];
        if (!next) return;
        set((state) => ({
          scene: next.scene,
          selection: next.selection,
          viewport: next.viewport,
          history: {
            past: [...state.history.past, snapshotFromState(state)],
            future: state.history.future.slice(1)
          }
        }));
      },
      setTool: (tool) => set((state) => ({ activeTool: tool, preferences: { ...state.preferences, lastUsedTool: tool } })),
      setTheme: (theme) => set((state) => ({ preferences: { ...state.preferences, theme } })),
      setEraserMode: (eraserMode) => set((state) => ({ preferences: { ...state.preferences, eraserMode } })),
      setEraserSize: (eraserSize) => set((state) => ({ preferences: { ...state.preferences, eraserSize } })),
      toggleShortcuts: (open) => set((state) => ({ preferences: { ...state.preferences, showShortcuts: open ?? !state.preferences.showShortcuts } })),
      setSelection: (selectedIds) => set({ selection: { selectedIds } }),
      addElement: (element, select = true) =>
        set((state) => {
          const elements = normalizeZ([...state.scene.elements, element]);
          return { scene: { ...state.scene, elements }, selection: select ? { selectedIds: [element.id] } : state.selection };
        }),
      addElements: (elementsToAdd, select = true) =>
        set((state) => {
          const elements = normalizeZ([...state.scene.elements, ...elementsToAdd]);
          return { scene: { ...state.scene, elements }, selection: select ? { selectedIds: elementsToAdd.map((element) => element.id) } : state.selection };
        }),
      updateElement: (id, updater) =>
        set((state) => ({ scene: { ...state.scene, elements: state.scene.elements.map((element) => (element.id === id ? updater(structuredClone(element)) : element)) } })),
      updateElements: (ids, updater) =>
        set((state) => ({ scene: { ...state.scene, elements: state.scene.elements.map((element) => (ids.includes(element.id) ? updater(structuredClone(element)) : element)) } })),
      removeElements: (ids) =>
        set((state) => ({
          scene: { ...state.scene, elements: normalizeZ(state.scene.elements.filter((element) => !ids.includes(element.id))) },
          selection: { selectedIds: state.selection.selectedIds.filter((id) => !ids.includes(id)) }
        })),
      setElements: (elements) => set((state) => ({ scene: { ...state.scene, elements: normalizeZ(elements) } })),
      reorderSelection: (mode) =>
        set((state) => {
          const selected = new Set(state.selection.selectedIds);
          const sorted = [...state.scene.elements];
          const selectedItems = sorted.filter((element) => selected.has(element.id));
          const unselectedItems = sorted.filter((element) => !selected.has(element.id));
          let next = sorted;
          if (mode === "front") next = [...unselectedItems, ...selectedItems];
          if (mode === "back") next = [...selectedItems, ...unselectedItems];
          if (mode === "forward" || mode === "backward") {
            next = [...sorted];
            const direction = mode === "forward" ? 1 : -1;
            for (let index = direction > 0 ? next.length - 1 : 0; direction > 0 ? index >= 0 : index < next.length; index += direction > 0 ? -1 : 1) {
              if (!selected.has(next[index].id)) continue;
              const target = index + direction;
              if (target < 0 || target >= next.length || selected.has(next[target].id)) continue;
              [next[index], next[target]] = [next[target], next[index]];
            }
          }
          return { scene: { ...state.scene, elements: normalizeZ(next) } };
        }),
      moveElementByOne: (id, direction) =>
        set((state) => {
          const next = [...state.scene.elements];
          const index = next.findIndex((element) => element.id === id);
          const target = direction === "up" ? index + 1 : index - 1;
          if (index < 0 || target < 0 || target >= next.length) return state;
          [next[index], next[target]] = [next[target], next[index]];
          return { scene: { ...state.scene, elements: normalizeZ(next) } };
        }),
      renameElement: (id, name) =>
        set((state) => ({
          scene: {
            ...state.scene,
            elements: state.scene.elements.map((element) =>
              element.id === id ? { ...element, metadata: { ...element.metadata, name }, updatedAt: Date.now() } : element
            )
          }
        })),
      toggleElementVisibility: (id) =>
        set((state) => ({
          scene: {
            ...state.scene,
            elements: state.scene.elements.map((element) =>
              element.id === id ? { ...element, visible: !element.visible, updatedAt: Date.now() } : element
            )
          }
        })),
      toggleElementLock: (id) =>
        set((state) => ({
          scene: {
            ...state.scene,
            elements: state.scene.elements.map((element) =>
              element.id === id ? { ...element, locked: !element.locked, updatedAt: Date.now() } : element
            )
          }
        })),
      duplicateSelection: () =>
        set((state) => {
          const duplicates = state.scene.elements.filter((element) => state.selection.selectedIds.includes(element.id)).map((element, index) => cloneElement(element, 24 + index * 8));
          return { scene: { ...state.scene, elements: normalizeZ([...state.scene.elements, ...duplicates]) }, selection: { selectedIds: duplicates.map((element) => element.id) } };
        }),
      groupSelection: () =>
        set((state) => {
          if (state.selection.selectedIds.length < 2) return state;
          const groupId = createId();
          return { scene: { ...state.scene, elements: state.scene.elements.map((element) => (state.selection.selectedIds.includes(element.id) ? { ...element, groupId, updatedAt: Date.now() } : element)) } };
        }),
      ungroupSelection: () =>
        set((state) => ({ scene: { ...state.scene, elements: state.scene.elements.map((element) => (state.selection.selectedIds.includes(element.id) ? { ...element, groupId: undefined, updatedAt: Date.now() } : element)) } })),
      setViewport: (viewport) => set((state) => ({ viewport: { ...state.viewport, ...viewport } })),
      panViewport: (delta) => set((state) => ({ viewport: { ...state.viewport, x: state.viewport.x + delta.x, y: state.viewport.y + delta.y } })),
      zoomAt: (screenPoint, nextZoom) =>
        set((state) => {
          const clampedZoom = Math.min(4, Math.max(0.1, nextZoom));
          const worldX = (screenPoint.x - state.viewport.x) / state.viewport.zoom;
          const worldY = (screenPoint.y - state.viewport.y) / state.viewport.zoom;
          return { viewport: { x: screenPoint.x - worldX * clampedZoom, y: screenPoint.y - worldY * clampedZoom, zoom: clampedZoom } };
        }),
      setBackground: (background) => set((state) => ({ scene: { ...state.scene, background } })),
      setGridEnabled: (enabled) => set((state) => ({ scene: { ...state.scene, gridEnabled: enabled } })),
      setSnapToGrid: (enabled) => set((state) => ({ scene: { ...state.scene, snapToGrid: enabled } })),
      updateActiveStyle: (partial) => set((state) => ({ activeStyle: { ...state.activeStyle, ...partial } })),
      applyStyleToSelection: (partial) =>
        set((state) => ({
          scene: { ...state.scene, elements: state.scene.elements.map((element) => (state.selection.selectedIds.includes(element.id) ? { ...element, style: { ...element.style, ...partial }, updatedAt: Date.now() } : element)) },
          activeStyle: { ...state.activeStyle, ...partial }
        })),
      setStylePreset: (preset) => set((state) => ({ preferences: { ...state.preferences, stylePreset: preset }, activeStyle: { ...state.activeStyle, ...stylePresets[preset] } })),
      copySelection: () => set((state) => ({ clipboard: state.scene.elements.filter((element) => state.selection.selectedIds.includes(element.id)) })),
      pasteClipboard: () =>
        set((state) => {
          const pasted = state.clipboard.map((element, index) => cloneElement(element, 32 + index * 8));
          return { scene: { ...state.scene, elements: normalizeZ([...state.scene.elements, ...pasted]) }, selection: { selectedIds: pasted.map((element) => element.id) } };
        }),
      clearScene: () => set({ scene: defaultScene, selection: { selectedIds: [] }, viewport: initialViewport(), history: { past: [], future: [] } }),
      setExportDialogOpen: (open) => set({ isExportDialogOpen: open }),
      setExportSettings: (partial) => set((state) => ({ exportSettings: { ...state.exportSettings, ...partial } })),
      importProject: (project) => set({ scene: project.scene, viewport: project.viewport, preferences: project.preferences, selection: { selectedIds: [] }, history: { past: [], future: [] }, activeStyle: { ...DEFAULT_STYLE, ...stylePresets[project.preferences.stylePreset] } }),
      exportProject: () => {
        const state = get();
        return { version: SCHEMA_VERSION, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), scene: state.scene, viewport: state.viewport, preferences: state.preferences };
      },
      setErrorMessage: (message) => set({ errorMessage: message })
    }),
    {
      name: "drawboard-pro-state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ scene: state.scene, viewport: state.viewport, preferences: state.preferences, activeStyle: state.activeStyle, exportSettings: state.exportSettings })
    }
  )
);

export const selectSelectedElements = (state: EditorState) => state.scene.elements.filter((element) => state.selection.selectedIds.includes(element.id));

export const getElementGroupMembers = (state: EditorState, element: DrawableElement) =>
  element.groupId ? state.scene.elements.filter((item) => item.groupId === element.groupId) : [element];

export const getElementLabel = (element: DrawableElement) => element.metadata?.name || `${element.type} ${element.id.slice(0, 4)}`;

export const validateProject = (input: unknown): ProjectSchema | null => {
  if (!input || typeof input !== "object") return null;
  const candidate = input as ProjectSchema;
  if (candidate.version !== SCHEMA_VERSION) return null;
  if (!candidate.scene || !Array.isArray(candidate.scene.elements)) return null;
  return candidate;
};
