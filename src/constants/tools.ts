import {
  ArrowRight,
  Circle,
  Diamond,
  Eraser,
  Hand,
  Minus,
  MousePointer2,
  PaintBucket,
  Pencil,
  Square,
  Type
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ToolType } from "../types/editor";

export interface ToolDefinition {
  id: ToolType;
  label: string;
  shortcut: string;
  icon: LucideIcon;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  { id: "pencil", label: "Pencil", shortcut: "P", icon: Pencil },
  { id: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
  { id: "fill", label: "Fill", shortcut: "F", icon: PaintBucket },
  { id: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
  { id: "hand", label: "Hand", shortcut: "H", icon: Hand },
  { id: "rectangle", label: "Rectangle", shortcut: "R", icon: Square },
  { id: "ellipse", label: "Ellipse", shortcut: "O", icon: Circle },
  { id: "diamond", label: "Diamond", shortcut: "D", icon: Diamond },
  { id: "line", label: "Line", shortcut: "L", icon: Minus },
  { id: "arrow", label: "Arrow", shortcut: "A", icon: ArrowRight },
  { id: "text", label: "Text", shortcut: "T", icon: Type },
];
