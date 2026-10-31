"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/* ---------- types (defined here; no import from ../types/commission) ---------- */
export type CommissionLevel = "Agent" | "Branch" | "District";

export type CommissionRecord = {
  agentCode: string;
  agent: string;
  branch: string;
  district: string;
  /** reporting month, e.g. "2024-01" */
  month: string;
  transactions: number;
  /** ETB */
  commission: number;
};

/* ---------- initial data (never null / empty on first render) ---------- */
export const COMMISSION_PER_TRANSACTION = 45; // ETB

// [agentCode, agent, branch, district, baseTransactions]
const seed: [string, string, string, string, number][] = [
  ["AG-1042", "Abebe Kebede", "Bole", "Addis Ababa", 412],
  ["AG-1057", "Tigist Haile", "Piassa", "Addis Ababa", 388],
  ["AG-1063", "Kidist Assefa", "Megenagna", "Addis Ababa", 365],
  ["AG-1071", "Biniam Tadesse", "Bole", "Addis Ababa", 331],
  ["AG-2011", "Samuel Tesfaye", "Kezira", "Dire Dawa", 301],
  ["AG-2019", "Rahel Mekonnen", "Sabian", "Dire Dawa", 268],
  ["AG-2034", "Hana Girma", "Main", "Mekelle", 256],
  ["AG-2041", "Gebre Hailu", "Hawelti", "Mekelle", 219],
  ["AG-3008", "Dawit Alemu", "Mercato", "Bahir Dar", 274],
  ["AG-3015", "Selamawit Desta", "Tana", "Bahir Dar", 241],
  ["AG-3021", "Meron Bekele", "Lideta", "Hawassa", 229],
  ["AG-3029", "Yared Negash", "Tabor", "Hawassa", 207],
  ["AG-4015", "Yonas Mulugeta", "Arada", "Jimma", 342],
  ["AG-4022", "Liya Worku", "Merkato", "Jimma", 296],
  ["AG-4027", "Selam Wondimu", "Sebeta", "Adama", 198],
  ["AG-4033", "Natnael Fikru", "Kebele 05", "Adama", 176],
];

const months = ["2024-01", "2024-02", "2024-03"];
const monthFactor = [0.92, 1, 1.08]; // deterministic variation so charts have shape

export const sampleRecords: CommissionRecord[] = seed.flatMap(([agentCode, agent, branch, district, base]) =>
  months.map((month, i) => {
    const transactions = Math.round(base * monthFactor[i]);
    return { agentCode, agent, branch, district, month, transactions, commission: transactions * COMMISSION_PER_TRANSACTION };
  }),
);

/* ---------- context ---------- */
type CommissionDataValue = {
  records: CommissionRecord[];
  setRecords: (records: CommissionRecord[]) => void;
  /** empties the data */
  clearRecords: () => void;
  /** back to the built-in sample data */
  resetRecords: () => void;
  /** false until any saved data has been read from the browser — avoids a flash of sample data */
  isReady: boolean;
};

const STORAGE_KEY = "commission-records:v1";

const CommissionDataContext = createContext<CommissionDataValue | null>(null);

export function CommissionDataProvider({ children }: { children: ReactNode }) {
  const [records, setRecordsState] = useState<CommissionRecord[]>(sampleRecords);
  const [isReady, setIsReady] = useState(false);

  // Restore what this browser session last had (survives refresh and navigation).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecordsState(parsed as CommissionRecord[]);
      }
    } catch {
      /* unreadable or unavailable storage: keep the initial data */
    }
    setIsReady(true);
  }, []);

  const setRecords = useCallback((next: CommissionRecord[]) => {
    setRecordsState(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); // "[]" is saved too, so a cleared state stays cleared
    } catch {
      /* storage full: keep it in memory only */
    }
  }, []);

  const clearRecords = useCallback(() => setRecords([]), [setRecords]);
  const resetRecords = useCallback(() => setRecords(sampleRecords), [setRecords]);

  const value = useMemo(
    () => ({ records, setRecords, clearRecords, resetRecords, isReady }),
    [records, setRecords, clearRecords, resetRecords, isReady],
  );
  return <CommissionDataContext.Provider value={value}>{children}</CommissionDataContext.Provider>;
}

export function useCommissionData(): CommissionDataValue {
  const context = useContext(CommissionDataContext);
  if (!context) throw new Error("useCommissionData must be used within CommissionDataProvider.");
  return context;
}
