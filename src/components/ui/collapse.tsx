import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** Smooth height animation without measuring: grid rows go 0fr → 1fr. */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      aria-hidden={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-in-out motion-reduce:transition-none",
        open ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}