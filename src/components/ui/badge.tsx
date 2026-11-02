import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import type { Status, UserRole } from "../../lib/api/types";

type Tone = "green" | "slate" | "blue" | "gold";

const tones: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30",
  slate: "",
  blue: "bg-[#2c317b]/10 text-[#2c317b] ring-[#2c317b]/20 dark:bg-white/10 dark:text-white dark:ring-white/20",
  gold: "bg-[#f3ad1c]/15 text-[#8a5d00] ring-[#f3ad1c]/40 dark:bg-[#f3ad1c]/15 dark:text-[#f3ad1c] dark:ring-[#f3ad1c]/40",
};

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset", tones[tone])}>
      {children}
    </span>
  );
}

export const StatusBadge = ({ status }: { status: Status }) => (
  <Badge tone={status === "active" ? "green" : "slate"}>{status}</Badge>
);

export const RoleBadge = ({ role }: { role: UserRole }) => (
  <Badge tone={role === "admin" ? "gold" : "blue"}>{role}</Badge>
);
