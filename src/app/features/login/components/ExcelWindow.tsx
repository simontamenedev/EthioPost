"use client";

import { motion } from "framer-motion";
import { AnimatedNumber } from "./animated-number";
import { FILE, fmt, headers, letters, rows, Stage } from "./login-data";

/* ---------- MS Office style sheet (intentionally Excel-green: it mimics the Microsoft app) ---------- */
export function ExcelWindow({ stage, count }: { stage: Stage; count: number }) {
  const loaded = stage >= 3;
  const last = count - 1;
  const sum = rows.slice(0, count).reduce((s, r) => s + r.amount, 0);

  const cell = "overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-[#d4d4d4] px-2 py-[3px] text-[12px] dark:border-[#3b3b3b]";
  const head = "border-b border-r border-[#c6c6c6] bg-[#e6e6e6] text-center text-[11px] font-normal text-[#444] dark:border-[#454545] dark:bg-[#2d2d2d] dark:text-[#b4b4b4]";
  const hot = "bg-[#d3e6dc] font-semibold text-[#217346] dark:bg-[#1e3a2c] dark:text-[#5dc08a]";
  const num = (i: number) => (i >= 4 ? " text-right tabular-nums" : "");

  return (
    <div className="overflow-hidden rounded-lg border border-black/20 bg-white font-[family-name:Segoe_UI,Calibri,system-ui,sans-serif] text-[#201f1e] shadow-2xl shadow-black/40 dark:bg-[#1f1f1f] dark:text-[#e8e8e8]">
      {/* title bar */}
      <div className="flex items-center gap-3 bg-[#217346] px-3 py-1.5 text-white">
        <div className="flex size-5 items-center justify-center rounded-sm bg-white text-[11px] font-bold text-[#217346]">X</div>
        <span className="mx-auto truncate text-xs font-medium">{loaded ? FILE : "Book1"} — Excel</span>
        <div className="flex gap-3 text-xs opacity-80" aria-hidden><span>—</span><span>☐</span><span>✕</span></div>
      </div>
      {/* ribbon tabs */}
      <div className="flex gap-4 border-b border-[#d4d4d4] bg-[#f3f3f3] px-3 pt-1 text-xs text-[#444] dark:border-[#3b3b3b] dark:bg-[#2b2b2b] dark:text-[#c8c8c8]" aria-hidden>
        {["File", "Home", "Insert", "Data", "View"].map((t) => (
          <span key={t} className={t === "Home" ? "border-b-2 border-[#217346] pb-1 font-semibold text-[#217346] dark:text-[#5dc08a]" : "pb-1"}>{t}</span>
        ))}
      </div>
      {/* name box + formula bar */}
      <div className="flex items-center border-b border-[#d4d4d4] bg-white text-xs dark:border-[#3b3b3b] dark:bg-[#1f1f1f]">
        <div className="w-16 border-r border-[#d4d4d4] px-2 py-1 text-center dark:border-[#3b3b3b]">{count > 0 ? `F${count + 1}` : "A1"}</div>
        <span className="px-2 italic text-[#777] dark:text-[#999]">fx</span>
        <motion.span key={count} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-1 tabular-nums">
          {count > 0 ? rows[last].amount : ""}
        </motion.span>
      </div>

      {/* grid */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] table-fixed border-collapse">
          <colgroup>
            <col className="w-8" /><col className="w-[13%]" /><col className="w-[21%]" /><col className="w-[14%]" /><col className="w-[18%]" /><col className="w-[15%]" /><col />
          </colgroup>
          <thead>
            <tr>
              <th className={`${head} h-5`} />
              {letters.map((l, i) => <th key={l} className={`${head} ${loaded && i === 5 ? hot : ""}`}>{l}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-[#f3f3f3] font-semibold dark:bg-[#2a2a2a]">
              <td className={`${head} h-6`}>1</td>
              {headers.map((h, i) => (
                <td key={h} className={cell + num(i)}>
                  <motion.span animate={{ opacity: loaded ? 1 : 0 }} transition={{ duration: 0.3, delay: i * 0.05 }} className="inline-block">{h}</motion.span>
                </td>
              ))}
            </tr>
            {rows.map((r, i) => {
              const on = i < count;
              const vals = [r.code, r.name, r.branch, r.district, fmt(r.tx), fmt(r.amount)];
              return (
                <motion.tr
                  key={r.code}
                  animate={{ backgroundColor: on ? ["rgba(33,115,70,0.32)", "rgba(33,115,70,0)"] : "rgba(33,115,70,0)" }}
                  transition={{ duration: on ? 1 : 0.15 }}
                >
                  <td className={`${head} ${i === last ? hot : ""}`}>{i + 2}</td>
                  {vals.map((v, j) => (
                    <td key={j} className={cell + num(j)}>
                      <motion.span initial={false} animate={{ opacity: on ? 1 : 0, x: on ? 0 : -8 }} transition={{ duration: 0.25, delay: on ? j * 0.03 : 0 }} className="inline-block">{v}</motion.span>
                    </td>
                  ))}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* status bar + sheet tabs */}
      <div className="flex items-center justify-between bg-[#217346] px-3 py-1 text-[11px] text-white">
        <span>{stage === 3 ? "Importing…" : stage === 4 ? "Import complete" : "Ready"}</span>
        <span className="tabular-nums">Count: {count} &nbsp;&nbsp; Sum: <AnimatedNumber value={sum} /></span>
      </div>
      <div className="flex items-end gap-1 border-t border-[#d4d4d4] bg-[#f3f3f3] px-3 pt-1 text-xs dark:border-[#3b3b3b] dark:bg-[#2b2b2b]" aria-hidden>
        <span className="rounded-t border border-b-0 border-[#d4d4d4] bg-white px-3 py-0.5 font-semibold text-[#217346] dark:border-[#3b3b3b] dark:bg-[#1f1f1f] dark:text-[#5dc08a]">Commissions</span>
        <span className="px-3 py-0.5 text-[#777] dark:text-[#999]">Summary</span>
        <span className="px-2 py-0.5 text-[#777]">+</span>
      </div>
    </div>
  );
}
