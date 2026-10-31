"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, ArrowDownToLine, FileSpreadsheet, LoaderCircle, Upload, X } from "lucide-react";
import { ColumnMapping, ParsedSheet } from "../types/commission";
import { useCommissionData } from "./commission-data";
import { createCommissionRecords, exportCommissionWorkbook, guessColumnMapping, readExcelFile } from "../lib/commission-excel";


type MappingField = keyof ColumnMapping;

const FIELD_LABELS: Record<MappingField, string> = {
  agent: "Agent",
  branch: "Branch",
  district: "District",
  date: "Date (optional)",
  amount: "Amount (optional if commission is provided)",
  commission: "Commission (or provide Amount + Rate)",
  rate: "Rate (used only when no commission value is provided)",
};

const REQUIRED_FIELDS: MappingField[] = ["agent", "branch", "district"];
const SELECT_FIELDS: MappingField[] = ["agent", "branch", "district", "date", "amount", "commission", "rate"];

export function ExcelImportButton({ compact = false }: { compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { records, setRecords } = useCommissionData();
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const parsed = await readExcelFile(file);
      setFileName(file.name);
      setSheet(parsed);
      setMapping(guessColumnMapping(parsed.headers));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Excel file could not be read.");
    } finally {
      setBusy(false);
    }
  }

  function updateMapping(field: MappingField, value: string) {
    setMapping((current) => current ? { ...current, [field]: value === "" ? null : Number(value) } : current);
  }

  function importRows() {
    if (!sheet || !mapping) return;
    setError("");
    setBusy(true);
    try {
      const imported = createCommissionRecords(sheet, mapping, fileName);
      setRecords(imported);
      setSheet(null);
      setMapping(null);
      setFileName("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The spreadsheet could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  async function exportReport() {
    setError("");
    setBusy(true);
    try {
      await exportCommissionWorkbook(records);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The report could not be exported.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60 ${compact ? "h-10 px-3 text-xs" : ""}`}>
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
          Import Excel
        </button>
        {records.length > 0 && (
          <button type="button" disabled={busy} onClick={exportReport} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 ${compact ? "h-10 px-3 text-xs" : ""}`}>
            <ArrowDownToLine size={16} /> Export Excel
          </button>
        )}
      </div>

      {error && <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-rose-700"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</p>}

      {sheet && mapping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <section aria-labelledby="import-title" aria-modal="true" role="dialog" className="my-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><FileSpreadsheet size={20} /></span>
                <h2 id="import-title" className="mt-3 text-xl font-bold text-slate-950">Review Excel columns</h2>
                <p className="mt-1 text-sm text-slate-500">{fileName} · worksheet: {sheet.worksheetName} · {sheet.rows.length.toLocaleString()} rows</p>
              </div>
              <button type="button" aria-label="Close import dialog" onClick={() => { setSheet(null); setError(""); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={18} /></button>
            </div>

            <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              Confirm the columns below. The commission column is used as-is when present; otherwise, commission is calculated as amount × rate. Rates over 1 are treated as percentages (for example, 5 means 5%).
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {SELECT_FIELDS.map((field) => (
                <label key={field} className="text-sm font-medium text-slate-700">
                  {FIELD_LABELS[field]}{REQUIRED_FIELDS.includes(field) && <span className="text-rose-600"> *</span>}
                  <select value={mapping[field] ?? ""} onChange={(event) => updateMapping(field, event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10">
                    <option value="">Not selected</option>
                    {sheet.headers.map((header, index) => <option key={`${index}-${header}`} value={index}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button type="button" onClick={() => { setSheet(null); setError(""); }} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={busy} onClick={importRows} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                Import {sheet.rows.length.toLocaleString()} rows
              </button>
            </div>
            {error && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-rose-700"><AlertCircle size={16} />{error}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
