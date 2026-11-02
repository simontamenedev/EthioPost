import {
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  MapPinned,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavKey = "overview" | "reports" | "districts" | "branches" | "agents" | "users" | "roles";

export type NavItem = { label: string; href: string; key: NavKey; icon: LucideIcon };
export type NavSection = { title: string; items: NavItem[] };

/* Edit hrefs here to match your routes. */
export const navSections: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { label: "Overview", href: "/", key: "overview", icon: LayoutDashboard },
    ],
  },
  {
    title: "Master data",
    items: [
      { label: "Districts", href: "/districts", key: "districts", icon: MapPinned },
      { label: "Branches", href: "/branches", key: "branches", icon: Building2 },
      { label: "Agents", href: "/agents", key: "agents", icon: Users },
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
