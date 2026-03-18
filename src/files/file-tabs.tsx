/**
 * FileTabs — tab bar for open files in the preview panel.
 */

import { X, FileText, FileCode, FileSpreadsheet } from "lucide-react";
import { cn } from "../lib/utils";

export interface FileTabData {
  id: string;
  name: string;
  path: string;
  dirty?: boolean;
}

export interface FileTabsProps {
  tabs: FileTabData[];
  activeId?: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  className?: string;
}

function getTabIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return FileText;
  if (["csv", "xlsx"].includes(ext)) return FileSpreadsheet;
  return FileCode;
}

export function FileTabs({ tabs, activeId, onSelect, onClose, className }: FileTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className={cn("flex items-center border-b border-[var(--border-subtle)] bg-[var(--bg-dark)] overflow-x-auto", className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const Icon = getTabIcon(tab.name);

        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "group flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-[var(--border-subtle)] shrink-0 transition-colors",
              isActive
                ? "bg-[var(--bg-card)] text-[var(--text-primary)] border-b-2 border-b-[var(--brand-cool)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]",
            )}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[120px]">{tab.name}</span>
            {tab.dirty && <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-cool)]" />}
            <span
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              className="p-0.5 rounded hover:bg-[var(--bg-hover)] opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-2.5 w-2.5" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
