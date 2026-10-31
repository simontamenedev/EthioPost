"use client";

import Link from "next/link";
import { LayoutGroup, motion, type Variants } from "framer-motion";
import { CircleHelp, LogOut } from "lucide-react";
import { navSections, type NavKey } from "./dashboard-nav";
import { Logo } from "../app/features/login/components/brand-logo";

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.1 } } };
const row: Variants = { hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } } };

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3ad1c]";

type Props = {
  active?: NavKey;
  /** unique per instance (desktop / drawer) so the active pill animates independently */
  groupId: string;
  onNavigate?: () => void;
};

/* Post Finance Blue surface, white logo, gold = active state. */
export function SidebarContent({ active, groupId, onNavigate }: Props) {
  return (
    <div className="flex h-full flex-col bg-[#2c317b] text-white dark:bg-[#161a5c]">
      <Link href="/" onClick={onNavigate} aria-label="Post Finance home" className={`flex h-[76px] shrink-0 items-center border-b border-white/10 px-6 ${focus}`}>
        <Logo variant="white" priority className="h-11" />
      </Link>

      <LayoutGroup id={groupId}>
        <motion.nav aria-label="Main navigation" variants={list} initial="hidden" animate="show" className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          {navSections.map((section) => (
            <div key={section.title}>
              <motion.p variants={row} className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">
                {section.title}
              </motion.p>
              <ul className="mt-2 space-y-1">
                {section.items.map(({ label, href, key, icon: Icon }) => {
                  const isActive = active === key;
                  return (
                    <motion.li key={key} variants={row}>
                      <Link
                        href={href}
                        onClick={onNavigate}
                        aria-current={isActive ? "page" : undefined}
                        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${focus} ${
                          isActive ? "text-white" : "text-white/75 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {isActive && (
                          <motion.span layoutId="nav-active" transition={{ type: "spring", stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-xl bg-white/10">
                            <span className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-[#f3ad1c]" />
                          </motion.span>
                        )}
                        <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} className={`relative transition-transform duration-200 group-hover:translate-x-0.5 ${isActive ? "text-[#f3ad1c]" : ""}`} />
                        <span className="relative">{label}</span>
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          ))}
        </motion.nav>
      </LayoutGroup>

      <div className="shrink-0 p-4">
        <Link href="/login" onClick={onNavigate} className={`group mt-4 flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/10 ${focus}`}>
          <span className="flex size-9 items-center justify-center rounded-full bg-[#f3ad1c] text-xs font-bold text-[#2c317b]">AA</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">Admin Account</span>
            <span className="block truncate text-[11px] text-white/70">Administrator</span>
          </span>
          <LogOut size={16} className="text-white/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white" />
        </Link>
      </div>
    </div>
  );
}
