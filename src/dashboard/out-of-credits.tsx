"use client";

import * as React from "react";
import { Button } from "../primitives";
import { cn } from "../lib/utils";

/**
 * Canonical "out of credits" UX, shared across every Tangle product.
 *
 * Backends emit a 402 with `{ error, code: "insufficient_balance", manageUrl,
 * plan?, remainingBalanceUsd? }` when a billable action can't be funded. The
 * frontend catches it, calls {@link parseInsufficientBalance} to extract the
 * shape, and renders {@link OutOfCreditsModal} — a single "add credits /
 * subscribe" CTA that links to the platform billing page (`manageUrl`).
 *
 * This replaces the per-app bespoke handling (silent failures, raw errors,
 * un-clickable text) with one component so the funnel is uniform + testable.
 */

export const INSUFFICIENT_BALANCE_CODE = "insufficient_balance";

export interface InsufficientBalance {
  /** Platform billing URL to add credits / subscribe / connect a card. */
  manageUrl: string;
  /** Current plan, when the backend includes it. */
  plan?: string;
  /** Remaining balance (USD), when included. */
  remainingBalanceUsd?: number;
  /** Backend-supplied human message, when included. */
  message?: string;
}

interface InsufficientBalancePayloadShape {
  code?: unknown;
  error?: unknown;
  message?: unknown;
  manageUrl?: unknown;
  plan?: unknown;
  remainingBalanceUsd?: unknown;
}

/**
 * Detect + parse an insufficient-balance 402 from a parsed JSON body. Returns
 * the typed shape when the body is an insufficient-balance error, else `null`.
 * Falls back to the platform default billing URL when the backend omits
 * `manageUrl` so the CTA is never dead.
 */
export function parseInsufficientBalance(
  payload: unknown,
  opts: { defaultManageUrl?: string } = {},
): InsufficientBalance | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as InsufficientBalancePayloadShape;
  const code = typeof body.code === "string" ? body.code : undefined;
  if (code !== INSUFFICIENT_BALANCE_CODE) return null;
  const manageUrl =
    typeof body.manageUrl === "string" && body.manageUrl.length > 0
      ? body.manageUrl
      : opts.defaultManageUrl;
  if (!manageUrl) return null;
  return {
    manageUrl,
    plan: typeof body.plan === "string" ? body.plan : undefined,
    remainingBalanceUsd:
      typeof body.remainingBalanceUsd === "number"
        ? body.remainingBalanceUsd
        : undefined,
    message:
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : undefined,
  };
}

export interface OutOfCreditsModalProps {
  /** Parsed insufficient-balance details (from {@link parseInsufficientBalance}). */
  balance: InsufficientBalance | null;
  /** Dismiss handler. When omitted the modal cannot be closed (hard paywall). */
  onClose?: () => void;
  /** Override the primary CTA label. Default "Add credits". */
  ctaLabel?: string;
  className?: string;
}

/**
 * Modal shown when a user runs out of credits. Renders nothing when
 * `balance` is null. The primary CTA opens the platform billing page where
 * the user can add credits, subscribe, or connect a card for pay-per-use.
 */
export function OutOfCreditsModal({
  balance,
  onClose,
  ctaLabel = "Add credits",
  className,
}: OutOfCreditsModalProps) {
  if (!balance) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Out of credits"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-xl",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-foreground mb-1">
          You're out of credits
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {balance.message ??
            "Add credits or start a subscription to keep going. Usage is billed to your Tangle account."}
          {typeof balance.remainingBalanceUsd === "number" && (
            <span className="block mt-1">
              Balance: ${balance.remainingBalanceUsd.toFixed(2)}
              {balance.plan ? ` · ${balance.plan} plan` : ""}
            </span>
          )}
        </p>
        <div className="flex gap-2 justify-end">
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Not now
            </Button>
          )}
          <Button asChild>
            <a href={balance.manageUrl} target="_blank" rel="noopener noreferrer">
              {ctaLabel}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
