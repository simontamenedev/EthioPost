"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

/* ---------- theme toggle (adds/removes `dark` on <html>) ---------- */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:text-[#2c317b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2c317b] dark:border-white/15 dark:text-white/70 dark:hover:text-[#f3ad1c] dark:focus-visible:outline-[#f3ad1c]"
    >
      <motion.span key={String(dark)} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.25 }}>
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </motion.span>
    </button>
  );
}
