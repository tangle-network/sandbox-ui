"use client";

export interface Backend {
  type: string;
  label: string;
  description?: string;
}

export interface BackendSelectorProps {
  backends: Backend[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label?: string;
  hint?: string;
  multiSelect?: boolean;
  className?: string;
}

export function BackendSelector({
  backends,
  selected,
  onChange,
  label = "Models",
  hint,
  multiSelect = true,
  className,
}: BackendSelectorProps) {
  const toggle = (type: string) => {
    if (multiSelect) {
      onChange(
        selected.includes(type)
          ? selected.filter((b) => b !== type)
          : [...selected, type],
      );
    } else {
      onChange([type]);
    }
  };

  return (
    <div className={className}>
      <label className="mb-2 block font-medium text-sm">
        {label}
        {multiSelect && (
          <span className="ml-2 font-normal text-muted-foreground">
            (select multiple to compare)
          </span>
        )}
      </label>
      <div className="flex flex-wrap gap-2">
        {backends.map((backend) => {
          const isSelected = selected.includes(backend.type);
          return (
            <button
              key={backend.type}
              type="button"
              onClick={() => toggle(backend.type)}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                isSelected
                  ? "border-blue-500 bg-blue-500/10 text-blue-400"
                  : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50"
              }`}
              title={backend.description}
            >
              {backend.label}
            </button>
          );
        })}
      </div>
      {multiSelect && selected.length > 1 && (
        <p className="mt-2 text-muted-foreground text-xs">
          {hint ||
            `Will run on ${selected.length} variants in parallel for comparison`}
        </p>
      )}
    </div>
  );
}
