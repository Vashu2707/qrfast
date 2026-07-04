import { Suspense } from "react";
import { getDashboardStats } from "@/actions/analytics";
import { getOrders } from "@/actions/orders";
import { getNotifications } from "@/actions/notifications";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { DashboardStats } from "@/components/features/dashboard/dashboard-stats";
import { RecentOrdersTable } from "@/components/features/dashboard/recent-orders";
import { NotificationsPanel } from "@/components/features/dashboard/notifications-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesChartWrapper } from "@/components/features/dashboard/sales-chart-wrapper";

async function DashboardStatsSection() {
  const stats = await getDashboardStats();
  return <DashboardStats stats={stats} />;
}

async function ChartSection() {
  const stats = await getDashboardStats();
  return <SalesChartWrapper data={stats.chartData} />;
}

async function NotificationsSection() {
  const notifications = await getNotifications();
  return <NotificationsPanel notifications={notifications.slice(0, 8)} />;
}

async function OrdersSection() {
  const orders = await getOrders();
  return <RecentOrdersTable orders={orders.slice(0, 10)} />;
}

function StatsFallback() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div>
      <StaffHeader title="Dashboard" subtitle="Overview of your restaurant today" />
      <div className="space-y-6 p-6">
        <Suspense fallback={<StatsFallback />}>
          <DashboardStatsSection />
        </Suspense>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Suspense fallback={<Skeleton className="h-[340px] w-full rounded-xl" />}>
              <ChartSection />
            </Suspense>
          </div>
          <Suspense fallback={<Skeleton className="h-[340px] w-full rounded-xl" />}>
            <NotificationsSection />
          </Suspense>
        </div>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <OrdersSection />
        </Suspense>
      </div>
    </div>
  );
}
