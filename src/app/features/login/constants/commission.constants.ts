export const COMMISSION_RATE = 45;

export const COMMISSION_FILE = "commission_2024.xlsx";

export const AGENT_DATA = [
  ["AG-1042", "Abebe Kebede", "Bole", "Addis Ababa", 412],
  ["AG-1057", "Tigist Haile", "Piassa", "Addis Ababa", 388],
  ["AG-2011", "Samuel Tesfaye", "Kezira", "Dire Dawa", 301],
  ["AG-2034", "Hana Girma", "Main", "Mekelle", 256],
  ["AG-3008", "Dawit Alemu", "Mercato", "Bahir Dar", 274],
  ["AG-3021", "Meron Bekele", "Lideta", "Hawassa", 229],
  ["AG-4015", "Yonas Mulugeta", "Arada", "Jimma", 342],
  ["AG-4027", "Selam Wondimu", "Sebeta", "Adama", 198],
] as const;

export const EXCEL_HEADERS = [
  "Agent code",
  "Agent name",
  "Branch",
  "District",
  "Transactions",
  "Amount (ETB)",
] as const;

export const EXCEL_COLUMN_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;