export type DateRange = { date_from?: string; date_to?: string };
export type PresetKey = "last7" | "last30" | "thisMonth" | "lastMonth" | "all" | "custom";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const PRESETS: { key: Exclude<PresetKey, "custom">; label: string }[] = [
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "all", label: "All time" },
];

export function presetRange(key: Exclude<PresetKey, "custom">, today = new Date()): DateRange {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (key) {
    case "last7":
      return { date_from: iso(new Date(y, m, today.getDate() - 6)), date_to: iso(today) };
    case "last30":
      return { date_from: iso(new Date(y, m, today.getDate() - 29)), date_to: iso(today) };
    case "thisMonth":
      return { date_from: iso(new Date(y, m, 1)), date_to: iso(today) };
    case "lastMonth":
      return { date_from: iso(new Date(y, m - 1, 1)), date_to: iso(new Date(y, m, 0)) };
    case "all":
      return {};
  }
}