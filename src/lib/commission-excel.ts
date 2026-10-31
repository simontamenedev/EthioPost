import ExcelJS from "exceljs";
import type {
  CellPrimitive,
  ColumnMapping,
  CommissionLevel,
  CommissionRecord,
  CommissionSummary,
  ParsedSheet,
} from "@/types/commission";

const HEADER_ALIASES: Record<keyof ColumnMapping, string[]> = {
  agent: ["agent", "agent name", "sales agent", "employee", "employee name", "staff name", "collector", "user name", "merchant agent"],
  branch: ["branch", "branch name", "branch code", "office", "outlet"],
  district: ["district", "district name", "zone", "territory"],
  date: ["date", "transaction date", "payment date", "business date"],
  amount: ["amount", "transaction amount", "eligible amount", "sales amount", "base amount", "transaction value"],
  commission: ["commission", "commission amount", "commission earned", "commission value", "agent commission", "total commission", "fee"],
  rate: ["commission rate", "commission %", "commission percentage", "rate percent", "rate %"],
};

function cellValue(value: unknown): CellPrimitive {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value) return cellValue(value.result);
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => "text" in item ? String(item.text) : "").join("");
    }
  }
  return String(value);
}

export async function readExcelFile(file: File): Promise<ParsedSheet> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Please choose an .xlsx Excel file.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("The Excel file must be smaller than 20 MB.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("This workbook does not contain a worksheet.");

  let headerRow = 0;
  worksheet.eachRow((row, rowNumber) => {
    let hasValue = false;
    row.eachCell((cell) => {
      if (cellValue(cell.value)?.toString().trim()) hasValue = true;
    });
    if (headerRow === 0 && hasValue) {
      headerRow = rowNumber;
    }
  });
  if (!headerRow) throw new Error("The first worksheet is empty.");

  const headers: string[] = [];
  const firstRow = worksheet.getRow(headerRow);
  for (let column = 1; column <= firstRow.cellCount; column += 1) {
    headers.push(cellValue(firstRow.getCell(column).value)?.toString().trim() || `Column ${column}`);
  }

  const rows: CellPrimitive[][] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const values = headers.map((_, index) => cellValue(row.getCell(index + 1).value));
    if (values.some((value) => value !== null && String(value).trim() !== "")) rows.push(values);
  });
  if (!rows.length) throw new Error("No data rows were found below the header row.");

  return { headers, rows, worksheetName: worksheet.name };
}

export function guessColumnMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim());
  const result = {} as ColumnMapping;
  for (const field of Object.keys(HEADER_ALIASES) as (keyof ColumnMapping)[]) {
    result[field] = normalized.findIndex((header) => HEADER_ALIASES[field].includes(header));
    if (result[field] === -1) result[field] = null;
  }
  return result;
}

function parseNumber(value: CellPrimitive): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let normalized = value.trim().replace(/[^\d,().-]/g, "");
  if (!normalized) return null;
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma > dot) normalized = normalized.replace(/\./g, "").replace(",", ".");
  else normalized = normalized.replace(/,/g, "");
  if (normalized.startsWith("(") && normalized.endsWith(")")) {
    normalized = `-${normalized.slice(1, -1)}`;
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function getText(row: CellPrimitive[], index: number | null): string {
  if (index === null) return "";
  const value = row[index];
  return value === null || value === undefined ? "" : String(value).trim();
}

export function createCommissionRecords(
  sheet: ParsedSheet,
  mapping: ColumnMapping,
  fileName: string,
): CommissionRecord[] {
  if (mapping.agent === null || mapping.branch === null || mapping.district === null) {
    throw new Error("Select the Agent, Branch, and District columns to create the requested summaries.");
  }
  if (mapping.commission === null && (mapping.amount === null || mapping.rate === null)) {
    throw new Error("Select a Commission column, or select both Amount and Commission rate columns.");
  }

  return sheet.rows.map((row, index) => {
    const amount = mapping.amount === null ? null : parseNumber(row[mapping.amount]);
    let commission: number | null = mapping.commission === null ? null : parseNumber(row[mapping.commission]);
    if (commission === null && mapping.amount !== null && mapping.rate !== null) {
      const rateText = getText(row, mapping.rate);
      const rate = parseNumber(row[mapping.rate]);
      if (amount !== null && rate !== null) {
        const fraction = rateText.includes("%") || rate > 1 ? rate / 100 : rate;
        commission = amount * fraction;
      }
    }
    if (commission === null) {
      throw new Error(`Could not read a commission value on Excel row ${index + 2}. Check the commission, amount, and rate columns.`);
    }

    const source: Record<string, CellPrimitive> = {};
    sheet.headers.forEach((header, column) => { source[header] = row[column] ?? null; });

    return {
      id: `${fileName}-${index}`,
      agent: getText(row, mapping.agent) || "Unassigned agent",
      branch: getText(row, mapping.branch) || "Unassigned branch",
      district: getText(row, mapping.district) || "Unassigned district",
      date: getText(row, mapping.date),
      amount,
      commission,
      source,
    };
  });
}

export function summarizeCommissions(
  records: CommissionRecord[],
  level: CommissionLevel,
): CommissionSummary[] {
  const field = level.toLowerCase() as "agent" | "branch" | "district";
  const grouped = new Map<string, CommissionSummary>();
  for (const record of records) {
    const name = record[field] || `Unassigned ${field}`;
    const current = grouped.get(name) ?? { name, records: 0, amount: 0, commission: 0 };
    current.records += 1;
    current.amount += record.amount ?? 0;
    current.commission += record.commission;
    grouped.set(name, current);
  }
  return [...grouped.values()].sort((first, second) => second.commission - first.commission);
}

export async function exportCommissionWorkbook(records: CommissionRecord[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EthioPost Commission Dashboard";
  const details = workbook.addWorksheet("Commission details");
  details.columns = [
    { header: "Agent", key: "agent", width: 24 },
    { header: "Branch", key: "branch", width: 22 },
    { header: "District", key: "district", width: 22 },
    { header: "Date", key: "date", width: 16 },
    { header: "Amount", key: "amount", width: 16 },
    { header: "Commission", key: "commission", width: 18 },
  ];
  records.forEach((record) => details.addRow(record));
  details.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  details.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };

  for (const level of ["Agent", "Branch", "District"] as const) {
    const sheet = workbook.addWorksheet(`By ${level}`);
    sheet.columns = [
      { header: level, key: "name", width: 30 },
      { header: "Records", key: "records", width: 14 },
      { header: "Total amount", key: "amount", width: 20 },
      { header: "Total commission", key: "commission", width: 22 },
    ];
    summarizeCommissions(records, level).forEach((summary) => sheet.addRow(summary));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ethiopost-commission-report.xlsx";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
