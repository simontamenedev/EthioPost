import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export function Spinner({ className, size = 18 }: { className?: string; size?: number }) {
  return <Loader2 size={size} aria-hidden className={cn("animate-spin", className)} />;
}

export function FullPageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#0d1040]">
      <Spinner size={28} className="text-[#2c317b] dark:text-[#f3ad1c]" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
