"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Logo } from "../../app/features/login/components/brand-logo";

/** Small inline spinner (buttons, inline loading). Unchanged. */
export function Spinner({ className, size = 18 }: { className?: string; size?: number }) {
  return <Loader2 size={size} aria-hidden className={cn("animate-spin", className)} />;
}

/** Full-page loader: logo, a slim indeterminate bar and a label. */
export function FullPageSpinner({ label = "Loading…" }: { label?: string }) {
  const reduce = useReducedMotion();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(id);
  }, []);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.15 }} // no flash when loading is near-instant
      className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50 px-6 dark:bg-[#0d1040]"
    >
      <span className="block dark:hidden"><Logo variant="primary" className="h-12" /></span>
      <span className="hidden dark:block"><Logo variant="white" className="h-12" /></span>

      <div className="flex w-full max-w-[220px] flex-col items-center gap-3">
        <div aria-hidden className="relative h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <motion.span
            className="absolute inset-y-0 w-1/3 rounded-full bg-[#f3ad1c]"
            {...(reduce
              ? { style: { left: "33%" } }
              : {
                  initial: { x: "-100%" },
                  animate: { x: "300%" },
                  transition: { duration: 1.2, ease: "easeInOut", repeat: Infinity },
                })}
          />
        </div>

        <p className="text-xs font-medium text-slate-600 dark:text-white/70">{label}</p>

     
      </div>
    </motion.div>
  );
}