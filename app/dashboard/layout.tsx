import { redirect } from "next/navigation";
import { getCurrentUserFast } from "@/actions/auth";
import { getUnreadNotificationCount } from "@/actions/notifications";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { canAccessDashboard } from "@/lib/roles";
import { getDefaultRouteForRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, unreadCount] = await Promise.all([
    getCurrentUserFast().catch(() => null),
    getUnreadNotificationCount().catch(() => 0),
  ]);

  if (!user) redirect("/login?redirect=/dashboard");
  if (!canAccessDashboard(user.role)) redirect(getDefaultRouteForRole(user.role));

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar user={user} unreadCount={unreadCount} />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
