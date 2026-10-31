"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { BarChart3, Check, Download, FileSpreadsheet, LayoutDashboard, Upload } from "lucide-react";

/* ---------- demo data (same agents as the import demo) ---------- */
const raw: [string, string, number][] = [
  ["Addis Ababa", "Abebe Kebede", 412], ["Addis Ababa", "Tigist Haile", 388], ["Dire Dawa", "Samuel Tesfaye", 301],
  ["Mekelle", "Hana Girma", 256], ["Bahir Dar", "Dawit Alemu", 274], ["Hawassa", "Meron Bekele", 229],
  ["Jimma", "Yonas Mulugeta", 342], ["Adama", "Selam Wondimu", 198],
];
const fmt = (n: number) => n.toLocaleString("en-US");
const byDistrict = Object.values(
  raw.reduce<Record<string, { name: string; agents: number; tx: number; amount: number }>>((m, [d, , tx]) => {
    const g = (m[d] ??= { name: d, agents: 0, tx: 0, amount: 0 });
    g.agents++; g.tx += tx; g.amount += tx * 45;
    return m;
  }, {})
).sort((a, b) => b.amount - a.amount);
const totalTx = byDistrict.reduce((s, g) => s + g.tx, 0);
const totalAmt = totalTx * 45;
const months = [38, 44, 41, 52, 58, 55, 63, 70, 66, 74, 81, 88];

function Num({ value, delay = 0, duration = 1.1 }: { value: number; delay?: number; duration?: number }) {
  const v = useMotionValue(0);
  const text = useTransform(v, (n) => fmt(Math.round(n)));
  useEffect(() => {
    const c = animate(v, value, { duration, delay, ease: "easeOut" });
    return () => c.stop();
  }, [value, delay, duration, v]);
  return <motion.span>{text}</motion.span>;
}

const win = "overflow-hidden rounded-lg bg-white text-slate-900 shadow-2xl shadow-black/40 dark:bg-slate-900 dark:text-slate-100";

/* ---------- 2. dashboard fills in ---------- */
function DashboardDemo() {
  const kpis = [
    { label: "Commission (ETB)", value: totalAmt },
    { label: "Transactions", value: totalTx },
    { label: "Active agents", value: raw.length },
  ];
  const maxD = byDistrict[0].amount;
  return (
    <div className={win}>
      <div className="flex items-center gap-2 bg-[#217346] px-3 py-1.5 text-white">
        <LayoutDashboard size={14} />
        <span className="text-xs font-medium">Dashboard · 2024</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] opacity-90">
          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} className="size-1.5 rounded-full bg-emerald-300" /> Live
        </span>
      </div>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-3 gap-2.5">
          {kpis.map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.15, duration: 0.4 }}
              className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{k.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums tracking-tight"><Num value={k.value} delay={0.3 + i * 0.15} /></p>
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-[1.25fr_1fr] gap-2.5">
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="mb-2 text-xs font-semibold">Commission by district</p>
            <ul className="space-y-1.5">
              {byDistrict.map((g, i) => (
                <li key={g.name} className="grid grid-cols-[68px_1fr_44px] items-center gap-2 text-[11px]">
                  <span className="truncate text-slate-600 dark:text-slate-300">{g.name}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <motion.div className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400" initial={{ width: 0 }} animate={{ width: `${(g.amount / maxD) * 100}%` }} transition={{ duration: 0.8, delay: 0.8 + i * 0.1, ease: "easeOut" }} />
                  </div>
                  <span className="text-right tabular-nums text-slate-500 dark:text-slate-400">{(g.amount / 1000).toFixed(1)}k</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="mb-2 text-xs font-semibold">Monthly commission</p>
            <div className="flex flex-1 items-end gap-1">
              {months.map((h, i) => (
                <motion.div key={i} className="flex-1 rounded-t bg-emerald-600/80 dark:bg-emerald-400/80" initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.6, delay: 1 + i * 0.07, ease: "easeOut" }} />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-slate-400"><span>Jan</span><span>Dec</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 3. report is generated and displayed ---------- */
type RStage = 0 | 1 | 2 | 3; // 0 idle · 1 generating · 2 table filling · 3 ready
const steps = ["Reading agent rows", "Grouping by district", "Calculating totals"];

function ReportDemo() {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<RStage>(0);
  const [done, setDone] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (reduce) { setStage(3); setDone(3); setCount(byDistrict.length); return; }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const run = () => {
      setStage(0); setDone(0); setCount(0);
      at(1500, () => setStage(1));
      steps.forEach((_, i) => at(2000 + i * 700, () => setDone(i + 1)));
      at(4300, () => setStage(2));
      byDistrict.forEach((_, i) => at(4400 + i * 230, () => setCount(i + 1)));
      at(4400 + byDistrict.length * 230 + 300, () => setStage(3));
      at(9300, run);
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  const sum = byDistrict.slice(0, count).reduce((s, g) => s + g.amount, 0);
  const cell = "border-b border-r border-[#d4d4d4] px-2 py-[3px] text-[11.5px] dark:border-[#3b3b3b]";

  return (
    <div className={win}>
      <div className="flex items-center gap-2 bg-[#217346] px-3 py-1.5 text-white">
        <BarChart3 size={14} /><span className="text-xs font-medium">Reports</span>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-3 dark:border-slate-700">
        <div className="flex gap-1.5 text-xs">
          {["By agent", "By branch", "By district"].map((t) => (
            <span key={t} className={`rounded-md px-2.5 py-1 ${t === "By district" ? "bg-emerald-700 font-semibold text-white" : "text-slate-500 dark:text-slate-400"}`}>{t}</span>
          ))}
        </div>
        <div className="relative">
          <motion.div animate={{ scale: stage === 1 ? 0.95 : 1 }} className={`flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-white ${stage === 0 ? "bg-emerald-700" : "bg-emerald-800"}`}>
            {stage === 1 ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="size-3 rounded-full border-2 border-white/30 border-t-white" /> : stage >= 2 ? <Check size={13} strokeWidth={3} /> : <FileSpreadsheet size={13} />}
            {stage === 0 ? "Generate report" : stage === 1 ? "Generating…" : "Report ready"}
          </motion.div>
          <motion.svg width="18" height="18" viewBox="0 0 20 20" className="absolute right-5 top-4 drop-shadow"
            initial={{ x: 90, y: 80, opacity: 0 }} animate={stage === 0 ? { x: 0, y: 0, opacity: 1 } : { x: 0, y: 0, opacity: 0 }} transition={{ duration: 0.9, delay: stage === 0 ? 0.4 : 0, ease: "easeInOut" }}>
            <path d="M3 2l13 7-6 1.8L7.5 17z" fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
          </motion.svg>
        </div>
      </div>

      <div className="relative min-h-[300px] p-3">
        <AnimatePresence mode="wait">
          {stage <= 1 && (
            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-[276px] flex-col items-center justify-center">
              {stage === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Pick a grouping, then generate your report.</p>
              ) : (
                <ul className="w-56 space-y-2.5 text-sm">
                  {steps.map((s, i) => (
                    <li key={s} className="flex items-center gap-2.5">
                      <span className={`flex size-5 items-center justify-center rounded-full ${i < done ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>
                        {i < done ? <Check size={12} strokeWidth={3} /> : i === done ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="size-3 rounded-full border-2 border-emerald-600/30 border-t-emerald-600" /> : null}
                      </span>
                      <span className={i <= done ? "" : "text-slate-400"}>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
          {stage >= 2 && (
            <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden rounded border border-[#d4d4d4] text-[#201f1e] dark:border-[#3b3b3b] dark:text-[#e8e8e8]">
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr className="bg-[#f3f3f3] font-semibold dark:bg-[#2a2a2a]">
                    {["District", "Agents", "Transactions", "Amount (ETB)"].map((h, i) => <td key={h} className={`${cell} ${i ? "text-right" : ""}`}>{h}</td>)}
                  </tr>
                </thead>
                <tbody>
                  {byDistrict.map((g, i) => {
                    const on = i < count;
                    return (
                      <motion.tr key={g.name} animate={{ backgroundColor: on ? ["rgba(33,115,70,0.32)", "rgba(33,115,70,0)"] : "rgba(33,115,70,0)" }} transition={{ duration: on ? 1 : 0.1 }}>
                        {[g.name, g.agents, fmt(g.tx), fmt(g.amount)].map((v, j) => (
                          <td key={j} className={`${cell} ${j ? "text-right tabular-nums" : ""}`}>
                            <motion.span className="inline-block" initial={false} animate={{ opacity: on ? 1 : 0, x: on ? 0 : -8 }} transition={{ duration: 0.25 }}>{v}</motion.span>
                          </td>
                        ))}
                      </motion.tr>
                    );
                  })}
                  <tr className="bg-[#e8f2ec] font-semibold dark:bg-[#1e3a2c]">
                    <td className={cell}>Total</td><td className={`${cell} text-right`} /><td className={`${cell} text-right`} />
                    <td className={`${cell} text-right tabular-nums`}><Num value={sum} duration={0.3} /></td>
                  </tr>
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {stage === 3 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
              <FileSpreadsheet size={14} /> <span className="font-semibold">commission_by_district.xlsx</span> is ready
              <span className="ml-auto flex items-center gap-1 font-semibold"><Download size={13} /> Download</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------- showcase: Import → Dashboard → Report, auto-advancing ---------- */
const tabs = [
  { label: "Import", Icon: Upload, ms: 10500 },
  { label: "Dashboard", Icon: LayoutDashboard, ms: 7500 },
  { label: "Reports", Icon: BarChart3, ms: 9800 },
];

export function Showcase({ importDemo }: { importDemo: ReactNode }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % tabs.length), tabs[step].ms);
    return () => clearTimeout(t);
  }, [step, reduce]);

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {tabs.map(({ label, Icon, ms }, i) => (
          <button key={label} type="button" onClick={() => setStep(i)} aria-pressed={step === i}
            className={`group relative flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${step === i ? "bg-white/15 text-white" : "bg-white/5 text-emerald-100/60 hover:text-white"}`}>
            <Icon size={14} /> {label}
            {step === i && !reduce && (
              <motion.span key={`p-${step}`} className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-emerald-300" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: ms / 1000, ease: "linear" }} />
            )}
          </button>
        ))}
      </div>
      <div className="min-h-[455px]">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            {step === 0 ? importDemo : step === 1 ? <DashboardDemo /> : <ReportDemo />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}