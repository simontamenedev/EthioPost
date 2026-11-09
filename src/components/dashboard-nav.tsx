import {
  Building2,
  FileSpreadsheet,
  Folder,
  LayoutDashboard,
  MapPinned,
  Percent,
  ReceiptText,
  UserCog,
  UserPlus,
  Users,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

export type NavKey =
  | "overview" | "transactions" | "registrations" | "upgrades" | "imports" | "reports"
  | "districts" | "branches" | "agents" | "commission-rates" | "users" | "roles";

export type NavItem = {
  label: string;
  href: string;
  key: NavKey;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Extra classes for icons that carry their own colour (e.g. the yellow Files folder). */
  iconClassName?: string;
};
export type NavSection = { title: string; items: NavItem[] };

/** Yellow filled folder used for "Files". Accepts the same props as any Lucide icon. */
const FolderIcon = (({ size = 18, className, ...props }: LucideProps) => (
  <Folder
    size={size}
    strokeWidth={1.4}
    className={`shrink-0 fill-[#f3ad1c] text-[#f3ad1c] ${className ?? ""}`}
    {...props}
  />
)) as LucideIcon;

/* Edit hrefs here to match your routes. */
export const navSections: NavSection[] = [
  {
    title: "Workspace",
    items: [{ label: "Overview", href: "/", key: "overview", icon: LayoutDashboard }],
  },
  {
    title: "Agent performance",
    items: [
      { label: "Transactions", href: "/transactions", key: "transactions", icon: ReceiptText },
      { label: "Registrations", href: "/registrations", key: "registrations", icon: UserPlus },
      { label: "Upgrades", href: "/upgrades", key: "upgrades", icon: FileSpreadsheet },
      { label: "Files", href: "/imports", key: "imports", icon: FolderIcon, adminOnly: true },
    ],
  },
  {
    title: "Master data",
    items: [
      { label: "Districts", href: "/districts", key: "districts", icon: MapPinned },
      { label: "Branches", href: "/branches", key: "branches", icon: Building2 },
      { label: "Agents", href: "/agents", key: "agents", icon: Users },
      { label: "Commission rates", href: "/commission-rates", key: "commission-rates", icon: Percent },
    ],
  },
  {
    title: "User management",
    items: [
      { label: "Users", href: "/users", key: "users", icon: UserCog },
      // { label: "Roles & permissions", href: "/roles", key: "roles", icon: ShieldCheck },
    ],
  },
];

/** Used when the `active` prop is not passed (e.g. shell placed in a layout). */
export function resolveActive(pathname: string): NavKey | undefined {
  const all = navSections.flatMap((s) => s.items);
  return all.find((i) => (i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(i.href + "/")))?.key;
}