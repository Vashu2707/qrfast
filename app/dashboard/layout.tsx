import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";
import { getUnreadNotificationCount } from "@/actions/notifications";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { canAccessDashboard } from "@/lib/roles";
import { getDefaultRouteForRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/login?redirect=/dashboard");
  }

  if (!user) redirect("/login?redirect=/dashboard");
  if (!canAccessDashboard(user.role)) redirect(getDefaultRouteForRole(user.role));

  let unreadCount = 0;
  try {
    unreadCount = await getUnreadNotificationCount();
  } catch {
    // Ignore — non-critical
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar user={user} unreadCount={unreadCount} />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
