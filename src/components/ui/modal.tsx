"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { focusRing } from "./styles";
import { cn } from "../../lib/utils";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
};

const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" };

export function Modal({ open, onClose, title, description, size = "md", children }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Escape closes, page scroll is locked, focus moves into the dialog and returns on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className={cn(
              // fixed height cap: the panel never exceeds the viewport, the body scrolls
              "relative flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl dark:bg-[#161a5c]",
              widths[size],
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-white/10">
              <div>
                <h2 id={titleId} className="text-lg font-bold tracking-tight text-[#2c317b] dark:text-white">{title}</h2>
                {description && <p className="mt-1 text-sm text-slate-600 dark:text-white/70">{description}</p>}
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={onClose}
                className={cn("rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10", focusRing)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}