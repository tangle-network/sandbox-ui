import { Button, Badge } from "@tangle-network/ui/primitives";
import { Trophy } from "lucide-react";
import { cn } from "../lib/utils";
import { AssetEditor } from "./asset-editor";
import type { AssetVariant } from "./types";

export interface VariantCompareProps {
  variants: AssetVariant[];
  onPromote?: (variantId: string) => void;
  onSave?: (variant: AssetVariant) => void;
  className?: string;
}

export function VariantCompare({ variants, onPromote, onSave, className }: VariantCompareProps) {
  const cols = Math.min(variants.length, 3);
  if (variants.length === 0) {
    return (
      <div className={cn("py-12 text-center text-sm text-muted-foreground", className)}>
        No variants to compare.
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="text-xs text-muted-foreground">
        Comparing {variants.length} variant{variants.length !== 1 ? "s" : ""}.
        {onPromote && " Promote one to mark it approved and archive the rest."}
      </div>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {variants.slice(0, 3).map((variant) => (
          <div key={variant.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium">{variant.label}</span>
                {variant.approvedAt && <Badge variant="default" className="text-[10px] h-4 px-1.5">Approved</Badge>}
                {variant.rejectedAt && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Rejected</Badge>}
              </div>
              {onPromote && !variant.approvedAt && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPromote(variant.id)}
                  className="h-6 gap-1 text-[11px] px-2"
                >
                  <Trophy size={11} />
                  Pick this
                </Button>
              )}
            </div>
            <AssetEditor
              spec={variant.spec}
              onSave={(spec) => onSave?.({ ...variant, spec })}
              className="min-h-[300px]"
            />
            {variant.editLog.length > 0 && (
              <div className="text-[10px] text-muted-foreground space-y-0.5">
                <span className="font-medium">Edit history</span>
                {variant.editLog.slice(-3).map((ev, i) => (
                  <div key={i}>
                    {ev.action}{ev.editedFields?.length ? ` (${ev.editedFields.join(", ")})` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
