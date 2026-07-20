"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/actions/analytics";
import { getOrders } from "@/actions/orders";
import { getTables } from "@/actions/tables";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { DashboardStats } from "@/components/features/dashboard/dashboard-stats";
import { RecentOrdersTable } from "@/components/features/dashboard/recent-orders";
import { LiveTables } from "@/components/features/dashboard/live-tables";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesChartWrapper } from "@/components/features/dashboard/sales-chart-wrapper";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
    refetchInterval: 10000,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => getOrders(),
    refetchInterval: 10000,
  });

  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: () => getTables(),
    refetchInterval: 10000,
  });

  return (
    <div>
      <StaffHeader title="Dashboard" subtitle="Overview of your restaurant today" />
      <div className="space-y-6 p-6">
        {statsLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <DashboardStats stats={stats} />
        ) : null}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {statsLoading ? (
              <Skeleton className="h-[340px] w-full rounded-xl" />
            ) : stats ? (
              <SalesChartWrapper data={stats.chartData} />
            ) : null}
          </div>
          {tablesLoading || ordersLoading ? (
            <Skeleton className="h-[340px] w-full rounded-xl" />
          ) : (
            <LiveTables tables={tables} orders={orders} />
          )}
        </div>
        {ordersLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <RecentOrdersTable orders={orders.slice(0, 10)} />
        )}
      </div>
    </div>
  );
}
