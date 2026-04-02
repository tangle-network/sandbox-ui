/**
 * AuditResults — structured pass/fail display for form audits.
 */

import { useState } from "react";
import { CheckCircle, XCircle, ChevronRight, Shield } from "lucide-react";
import { cn } from "../lib/utils";

export interface AuditCheck {
  label: string;
  expected: string | number;
  actual?: string | number | null;
  passed: boolean;
  tolerance?: number;
  fieldPath?: string;
}

export interface FormAudit {
  formId: string;
  formName?: string;
  found: boolean;
  checks: AuditCheck[];
  passed: number;
  failed: number;
}

export interface AuditResultsProps {
  forms: FormAudit[];
  crossFormChecks?: AuditCheck[];
  overallScore?: number;
  className?: string;
}

export function AuditResults({ forms, crossFormChecks = [], overallScore, className }: AuditResultsProps) {
  const totalPassed = forms.reduce((s, f) => s + f.passed, 0);
  const totalChecks = forms.reduce((s, f) => s + f.passed + f.failed, 0);

  return (
    <div className={cn("space-y-3 p-3", className)}>
      {/* Summary */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] bg-background border border-border">
        <Shield className={cn("h-5 w-5", totalChecks === totalPassed ? "text-[var(--code-success)]" : "text-[var(--code-number)]")} />
        <div>
          <div className="text-sm font-semibold text-foreground">
            {totalPassed}/{totalChecks} checks passed
          </div>
          {overallScore !== undefined && (
            <div className="text-xs text-muted-foreground">Score: {overallScore}/100</div>
          )}
        </div>
      </div>

      {/* Per-form results */}
      {forms.map((form) => (
        <FormAuditCard key={form.formId} form={form} />
      ))}

      {/* Cross-form checks */}
      {crossFormChecks.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Cross-Form Checks
          </div>
          {crossFormChecks.map((check, i) => (
            <CheckRow key={i} check={check} />
          ))}
        </div>
      )}
    </div>
  );
}

function FormAuditCard({ form }: { form: FormAudit }) {
  const [expanded, setExpanded] = useState(form.failed > 0);
  const allPassed = form.failed === 0 && form.found;

  return (
    <div className="rounded-[var(--radius-md)] border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-accent transition-colors"
      >
        {allPassed ? (
          <CheckCircle className="h-4 w-4 text-[var(--code-success)] shrink-0" />
        ) : !form.found ? (
          <XCircle className="h-4 w-4 text-[var(--code-error)] shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-[var(--code-number)] shrink-0" />
        )}
        <span className="text-sm font-medium text-foreground flex-1">
          {form.formName || form.formId}
        </span>
        <span className={cn("text-xs tabular-nums", allPassed ? "text-[var(--code-success)]" : "text-muted-foreground")}>
          {form.passed}/{form.passed + form.failed}
        </span>
        <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", expanded && "rotate-90")} />
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-1.5 space-y-0.5">
          {form.checks.map((check, i) => (
            <CheckRow key={i} check={check} />
          ))}
        </div>
      )}
    </div>
  );
}

function CheckRow({ check }: { check: AuditCheck }) {
  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      {check.passed ? (
        <CheckCircle className="h-3 w-3 text-[var(--code-success)] shrink-0" />
      ) : (
        <XCircle className="h-3 w-3 text-[var(--code-error)] shrink-0" />
      )}
      <span className="text-foreground flex-1 truncate">{check.label}</span>
      <span className="text-muted-foreground tabular-nums shrink-0">
        {check.passed ? String(check.actual ?? check.expected) : `${check.actual ?? "missing"} ≠ ${check.expected}`}
      </span>
    </div>
  );
}
