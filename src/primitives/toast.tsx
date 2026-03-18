"use client";

import { cva } from "class-variance-authority";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";

const toastVariants = cva(
  "pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground",
        success: "border-green-500/20 bg-green-500/10 text-green-400",
        error: "border-red-500/20 bg-red-500/10 text-red-400",
        warning: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
        info: "border-blue-500/20 bg-blue-500/10 text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  default: Info,
};

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning" | "info";
  duration?: number;
}

interface ToastProps extends Toast {
  onDismiss: (id: string) => void;
}

function ToastComponent({
  id,
  title,
  description,
  variant = "default",
  onDismiss,
}: ToastProps) {
  const Icon = icons[variant];

  return (
    <div
      className={cn(toastVariants({ variant }))}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-medium text-sm">{title}</p>
          {description && (
            <p className="mt-1 text-sm opacity-80">{description}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      className="fixed right-4 bottom-4 z-50 flex max-w-md flex-col gap-2"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastComponent key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// Toast Context and Hook
type ToastInput = Omit<Toast, "id">;

interface ToastContextValue {
  toasts: Toast[];
  toast: (input: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = Math.random().toString(36).slice(2);
      const newToast: Toast = { id, ...input };
      setToasts((prev) => [...prev, newToast]);

      // Auto-dismiss after duration
      const duration = input.duration ?? 5000;
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const success = React.useCallback(
    (title: string, description?: string) => {
      toast({ title, description, variant: "success" });
    },
    [toast],
  );

  const error = React.useCallback(
    (title: string, description?: string) => {
      toast({ title, description, variant: "error" });
    },
    [toast],
  );

  const warning = React.useCallback(
    (title: string, description?: string) => {
      toast({ title, description, variant: "warning" });
    },
    [toast],
  );

  const info = React.useCallback(
    (title: string, description?: string) => {
      toast({ title, description, variant: "info" });
    },
    [toast],
  );

  const value = React.useMemo(
    () => ({ toasts, toast, success, error, warning, info, dismiss }),
    [toasts, toast, success, error, warning, info, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
