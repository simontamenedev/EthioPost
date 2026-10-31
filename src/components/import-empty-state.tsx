"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { FileSpreadsheet } from "lucide-react";
import { ExcelImportButton } from "./excel-import";

/* First-run state. Official motif sits behind at low opacity (light: black, dark: white). */
export function ImportEmptyState() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-dashed border-[#2c317b]/30 bg-white px-6 py-16 text-center dark:border-white/20 dark:bg-[#161a5c]"
    >
      <Image src="/brand/pattern-black.svg" alt="" aria-hidden width={1386} height={466} unoptimized draggable={false} className="pointer-events-none absolute inset-0 size-full object-cover opacity-[0.04] dark:hidden" />
      <Image src="/brand/pattern-white.svg" alt="" aria-hidden width={1386} height={466} unoptimized draggable={false} className="pointer-events-none absolute inset-0 hidden size-full object-cover opacity-[0.06] dark:block" />

      <div className="relative">
        <motion.span
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#2c317b] text-[#f3ad1c] shadow-lg shadow-[#2c317b]/25"
        >
          <FileSpreadsheet size={28} />
        </motion.span>
        <h2 className="mt-5 text-xl font-bold text-[#2c317b] dark:text-white">Start with your Excel commission report</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-white/75">
          Import an .xlsx workbook. Map its agent, branch, district, and commission columns, then review the calculated summaries. Your workbook stays in this browser session.
        </p>
        <div className="mt-6 flex justify-center"><ExcelImportButton compact /></div>
      </div>
    </motion.section>
  );
}
