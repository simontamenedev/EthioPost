/* ---------- data ---------- */
export const FILE = "commission_2024.xlsx";
const raw: [string, string, string, string, number][] = [
  ["AG-1042", "Abebe Kebede", "Bole", "Addis Ababa", 412],
  ["AG-1057", "Tigist Haile", "Piassa", "Addis Ababa", 388],
  ["AG-2011", "Samuel Tesfaye", "Kezira", "Dire Dawa", 301],
  ["AG-2034", "Hana Girma", "Main", "Mekelle", 256],
  ["AG-3008", "Dawit Alemu", "Mercato", "Bahir Dar", 274],
  ["AG-3021", "Meron Bekele", "Lideta", "Hawassa", 229],
  ["AG-4015", "Yonas Mulugeta", "Arada", "Jimma", 342],
  ["AG-4027", "Selam Wondimu", "Sebeta", "Adama", 198],
];
// commission = transactions × 45 ETB
export const rows = raw.map(([code, name, branch, district, tx]) => ({ code, name, branch, district, tx, amount: tx * 45 }));
export const headers = ["Agent code", "Agent name", "Branch", "District", "Transactions", "Amount (ETB)"];
export const letters = ["A", "B", "C", "D", "E", "F"];
export const fmt = (n: number) => n.toLocaleString("en-US");

export type Stage = 0 | 1 | 2 | 3 | 4; // 0 idle · 1 dragging · 2 reading · 3 importing · 4 done
