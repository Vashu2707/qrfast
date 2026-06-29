import { getDashboardStats } from "@/actions/analytics";
import { getNotifications } from "@/actions/notifications";
import { getOrders } from "@/actions/orders";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { DashboardStats } from "@/components/features/dashboard/dashboard-stats";
import { SalesChart } from "@/components/features/dashboard/sales-chart";
import { RecentOrdersTable } from "@/components/features/dashboard/recent-orders";
import { NotificationsPanel } from "@/components/features/dashboard/notifications-panel";

export default async function DashboardPage() {
  const [stats, orders, notifications] = await Promise.all([
    getDashboardStats(),
    getOrders(),
    getNotifications(),
  ]);

  return (
    <div>
      <StaffHeader title="Dashboard" subtitle="Overview of your restaurant today" />
      <div className="space-y-6 p-6">
        <DashboardStats stats={stats} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SalesChart data={stats.chartData} />
          </div>
          <NotificationsPanel notifications={notifications.slice(0, 8)} />
        </div>
        <RecentOrdersTable orders={orders.slice(0, 10)} />
      </div>
    </div>
  );
}
