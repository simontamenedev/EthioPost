"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { Check, FileSpreadsheet, Upload } from "lucide-react";
import { FILE, rows, type Stage } from "./login-data";
import { ExcelWindow } from "./ExcelWindow";

/* ---------- import flow: file → drag → drop → rows fill the sheet ---------- */
const fileV: Variants = {
  idle: {
    x: 0, y: 0, rotate: 0, scale: 1, opacity: 1,
    transition: { x: { duration: 0 }, y: { duration: 0 }, rotate: { duration: 0 }, scale: { duration: 0.3 }, opacity: { duration: 0.5 } },
  },
  drag: (p: { x: number; y: number }) => ({
    x: [0, p.x * 0.6, p.x], y: [0, -22, p.y], rotate: [0, -6, -2], scale: [1, 1.08, 1.04], opacity: 1,
    transition: { duration: 1.4, ease: "easeInOut", times: [0, 0.55, 1] },
  }),
  drop: (p: { x: number; y: number }) => ({ x: p.x, y: p.y, rotate: 0, scale: 0.35, opacity: 0, transition: { duration: 0.3 } }),
};

function Bar({ pct, duration = 0.3 }: { pct: number; duration?: number }) {
  return (
    <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-white/15">
      <motion.div className="h-full rounded-full bg-[#f3ad1c]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration, ease: "easeOut" }} />
    </div>
  );
}

export function ImportDemo() {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>(0);
  const [count, setCount] = useState(0);
  const [over, setOver] = useState(false);
  const [d, setD] = useState({ x: 0, y: 0 });
  const fileRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce) {
      setStage(4);
      setCount(rows.length);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const STEP = 260;
    const run = () => {
      setStage(0); setCount(0); setOver(false);
      at(500, () => {
        const f = fileRef.current?.getBoundingClientRect();
        const t = dropRef.current?.getBoundingClientRect();
        if (f && t) setD({ x: t.left + t.width / 2 - (f.left + f.width / 2), y: t.top + t.height / 2 - (f.top + f.height / 2) });
      });
      at(1000, () => setStage(1));
      at(2000, () => setOver(true)); // file hovers over the drop zone
      at(2700, () => { setStage(2); setOver(false); });
      at(4100, () => setStage(3));
      rows.forEach((_, i) => at(4300 + i * STEP, () => setCount(i + 1)));
      const end = 4300 + rows.length * STEP + 400;
      at(end, () => setStage(4));
      at(end + 4200, run);
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  const variant = stage === 0 ? "idle" : stage === 1 ? "drag" : "drop";
  const zone =
    stage >= 2
      ? "border-solid border-[#f3ad1c]/50 bg-[#f3ad1c]/10"
      : over
        ? "border-dashed border-[#f3ad1c] bg-[#f3ad1c]/20"
        : "border-dashed border-white/25 bg-white/5";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5">
        {/* the Excel file on "desktop" (kept in Excel green — it depicts the Microsoft app, not our brand) */}
        <div ref={fileRef} className="relative w-[148px] shrink-0">
          <motion.div variants={fileV} custom={d} animate={variant} className="relative z-20 rounded-lg bg-white p-2 text-[#201f1e] shadow-xl shadow-black/40">
            <div className="overflow-hidden rounded border border-[#d4d4d4]">
              <div className="flex h-4 items-center gap-1 bg-[#217346] px-1.5 text-[8px] font-bold text-white">X <span className="font-normal opacity-80">Excel</span></div>
              <div className="grid grid-cols-4 bg-white">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span key={i} className={`h-[9px] border-b border-r border-[#e1e1e1] ${i < 4 ? "bg-[#e8f2ec]" : ""}`} />
                ))}
              </div>
            </div>
            <p className="mt-1.5 truncate text-[10px] font-semibold">{FILE}</p>
            <p className="text-[9px] text-[#777]">{rows.length} rows · 6 columns</p>
            <motion.svg
              width="20" height="20" viewBox="0 0 20 20" className="absolute -bottom-3 -right-2 drop-shadow"
              animate={{ opacity: stage <= 1 ? 1 : 0, scale: stage === 1 ? [1, 0.8, 1] : 1 }}
              transition={{ duration: 0.3 }}
            >
              <path d="M3 2l13 7-6 1.8L7.5 17z" fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
            </motion.svg>
          </motion.div>
        </div>

        {/* drop zone */}
        <motion.div
          ref={dropRef}
          animate={{ scale: over ? 1.03 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className={`flex h-[112px] flex-1 items-center justify-center rounded-xl border-2 px-4 text-center transition-colors duration-300 ${zone}`}
        >
          <AnimatePresence mode="wait">
            {stage <= 1 && (
              <motion.div key={over ? "over" : "idle"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col items-center">
                <motion.span animate={over ? { y: [0, -4, 0] } : { y: 0 }} transition={{ repeat: over ? Infinity : 0, duration: 0.8 }} className="mb-1.5 flex size-9 items-center justify-center rounded-full bg-white/10 text-[#f3ad1c]">
                  <Upload size={17} />
                </motion.span>
                <p className="text-sm font-semibold">{over ? "Release to import" : "Drag and drop your Excel file"}</p>
                <p className="mt-0.5 text-[11px] text-white/70">{over ? FILE : "or browse · .xlsx, .xls, .csv"}</p>
              </motion.div>
            )}
            {stage === 2 && (
              <motion.div key="read" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                <FileSpreadsheet size={22} className="text-[#f3ad1c]" />
                <p className="mt-1 text-sm font-semibold">{FILE}</p>
                <p className="text-[11px] text-white/70">Reading headers and rows…</p>
                <Bar pct={100} duration={1.3} />
              </motion.div>
            )}
            {stage === 3 && (
              <motion.div key="import" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                <p className="text-sm font-semibold">Importing agents…</p>
                <p className="text-[11px] tabular-nums text-white/70">{count} of {rows.length} rows</p>
                <Bar pct={(count / rows.length) * 100} />
              </motion.div>
            )}
            {stage === 4 && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="mb-1.5 flex size-9 items-center justify-center rounded-full bg-[#f3ad1c] text-[#2c317b]">
                  <Check size={18} strokeWidth={3} />
                </motion.span>
                <p className="text-sm font-semibold">{rows.length} agents imported</p>
                <p className="text-[11px] text-white/70">No errors found</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <ExcelWindow stage={stage} count={count} />
    </div>
  );
}
