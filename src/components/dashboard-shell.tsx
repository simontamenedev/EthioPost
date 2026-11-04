"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Bell, Menu, Search, X } from "lucide-react";
import { resolveActive, type NavKey } from "./dashboard-nav";
import { SidebarContent } from "./sidebar-content";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "../app/features/login/components/theme-toggle";
import { Logo } from "../app/features/login/components/brand-logo";

type DashboardShellProps = {
  /** optional — when omitted the active link is derived from the URL */
  active?: NavKey;
  children: ReactNode;
};

const iconBtn =
  "rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2c317b] dark:text-white/75 dark:hover:bg-white/10 dark:focus-visible:outline-[#f3ad1c]";

export default function DashboardShell({ active, children }: DashboardShellProps) {
  const pathname = usePathname();
  const current = active ?? resolveActive(pathname);
  const [open, setOpen] = useState(false);

  // mobile drawer: Escape closes, page scroll locked while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <MotionConfig reducedMotion="user">
      {/* flex row: the sidebar column stretches to the full page height, so it never clips */}
      <div className="flex min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#0d1040] dark:text-white">
        {/* desktop sidebar (normal flow, not fixed) */}
        <aside className="hidden w-[264px] shrink-0 lg:flex">
          <SidebarContent active={current} groupId="desktop" />
        </aside>

        {/* mobile drawer */}
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
              <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
              <motion.aside
                className="absolute inset-y-0 left-0 w-[280px] max-w-[85%] overflow-y-auto shadow-2xl"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
              >
                <SidebarContent active={current} groupId="drawer" onNavigate={() => setOpen(false)} />
                <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#f3ad1c]">
                  <X size={18} />
                </button>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-5 backdrop-blur transition-colors dark:border-white/10 dark:bg-[#0d1040]/90 sm:px-8 lg:px-10">
            <div className="flex items-center gap-2 lg:hidden">
              <button type="button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)} className={iconBtn}>
                <Menu size={20} />
              </button>
              <Link href="/" aria-label="Post Finance home" className="inline-flex">
                <span className="block dark:hidden"><Logo variant="primary" className="h-8" /></span>
                <span className="hidden dark:block"><Logo variant="white" className="h-8" /></span>
              </Link>
            </div>

            <div className="hidden max-w-md flex-1 items-center gap-2.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 transition focus-within:border-[#2c317b] focus-within:ring-4 focus-within:ring-[#2c317b]/15 dark:border-white/20 dark:bg-white/5 dark:focus-within:border-[#f3ad1c] dark:focus-within:ring-[#f3ad1c]/20 md:flex lg:max-w-[390px]">
              <Search size={17} className="shrink-0 text-slate-500 dark:text-white/60" />
              <input aria-label="Search commission reports" placeholder="Commission reports by agent..." className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-white/50" />
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <motion.button type="button" aria-label="Notifications" whileTap={{ scale: 0.92 }} whileHover="ring" className={iconBtn}>
                <motion.span variants={{ ring: { rotate: [0, -14, 12, -8, 0], transition: { duration: 0.5 } } }} className="block">
                  <Bell size={19} />
                </motion.span>
              </motion.button>
              <span className="hidden h-7 w-px bg-slate-200 dark:bg-white/15 sm:block" />
              <UserMenu />
            </div>
          </header>

          <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, ease: "easeOut" }}>
            {children}
          </motion.main>
        </div>
      </div>
    </MotionConfig>
  );
}