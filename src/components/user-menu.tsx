"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LogOut, UserCog } from "lucide-react";
import { useAuthStore } from "../lib/auth/auth-store";
import { useLogout } from "../app/features/auth/hooks";

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "U";

const itemCls =
  "group flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-white dark:hover:bg-white/10";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  const name = user?.name ?? "Account";
  const role = user?.role ?? "";
  const initials = initialsOf(name);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2c317b] dark:hover:bg-white/10 dark:focus-visible:outline-[#f3ad1c]"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-[#f3ad1c] text-[11px] font-bold text-[#2c317b]">{initials}</span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[120px] truncate text-xs font-semibold text-slate-900 dark:text-white">{name}</span>
          <span className="block text-[10px] capitalize text-slate-600 dark:text-white/70">{role}</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="hidden text-slate-500 dark:text-white/70 sm:block">
          <ChevronDown size={15} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 z-40 mt-2 w-56 origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/15 dark:bg-[#161a5c]"
          >
            <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <p className="truncate text-sm font-semibold text-[#2c317b] dark:text-white">{name}</p>
              <p className="truncate text-xs text-slate-600 dark:text-white/70">{user?.email}</p>
              <p className="mt-0.5 text-[11px] capitalize text-slate-500 dark:text-white/60">{role}</p>
            </div>

            <Link href="/account" role="menuitem" onClick={() => setOpen(false)} className={itemCls}>
              <UserCog size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" /> Account
            </Link>

            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); logout(); }}
              className={`${itemCls} border-t border-slate-100 dark:border-white/10`}
            >
              <LogOut size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}