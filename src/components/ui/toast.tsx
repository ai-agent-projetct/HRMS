"use client";

import { create } from "zustand";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "info" | "warning" | "danger";

interface Toast {
  id: number;
  title: string;
  detail?: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  push: (title: string, detail?: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let nextToastId = 1;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (title, detail, tone = "success") => {
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts, { id, title, detail, tone }] }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      4500
    );
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
};

const TONES: Record<ToastTone, string> = {
  success: "border-success/40 text-success",
  info: "border-info/40 text-info",
  warning: "border-warning/40 text-warning",
  danger: "border-danger/40 text-danger",
};

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-card p-3 shadow-card-hover animate-fade-in-up",
              TONES[t.tone]
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">{t.title}</p>
              {t.detail && (
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {t.detail}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
