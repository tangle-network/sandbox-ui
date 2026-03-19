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
          <div
            key={tab.id}
            className={cn(
              "group flex items-center border-r border-[var(--border-subtle)] shrink-0",
              isActive
                ? "bg-[var(--bg-card)] text-[var(--text-primary)] border-b-2 border-b-[var(--brand-cool)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(tab.id)}
              className="flex min-w-0 items-center gap-1.5 px-3 py-1.5 text-xs transition-colors hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-cool)]/60"
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="max-w-[120px] truncate">{tab.name}</span>
              {tab.dirty && <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-cool)]" />}
            </button>
            <button
              type="button"
              aria-label={`Close ${tab.name}`}
              onClick={() => onClose(tab.id)}
              className="mr-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--bg-hover)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60 group-hover:opacity-100"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
