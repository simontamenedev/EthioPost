import type { ReactNode } from "react";
import { AuthGuard } from "../../components/auth/auth-guard";
import DashboardShell from "../../components/dashboard-shell";


export default function ManagementLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
