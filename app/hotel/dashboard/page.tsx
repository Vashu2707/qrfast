"use client";

import { useQuery } from "@tanstack/react-query";
import { getHotelDashboardStats } from "@/actions/hotel/stats";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCurrency,
  formatDateOnly,
  getBookingStatusColor,
  getBookingStatusLabel,
} from "@/lib/format";
import {
  CalendarCheck,
  LogOut,
  BedDouble,
  Percent,
  Clock,
  Banknote,
} from "lucide-react";

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className={`size-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function HotelDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["hotel-stats"],
    queryFn: () => getHotelDashboardStats(),
    refetchInterval: 10000,
  });

  return (
    <div>
      <StaffHeader title="Dashboard" subtitle="Overview of your hotel today" />
      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        {isLoading || !stats ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              icon={CalendarCheck}
              label="Arrivals"
              value={stats.arrivalsToday}
              color="text-indigo-600"
            />
            <StatCard
              icon={LogOut}
              label="Departures"
              value={stats.departuresToday}
              color="text-amber-600"
            />
            <StatCard
              icon={BedDouble}
              label="In-House"
              value={stats.inHouse}
              color="text-emerald-600"
            />
            <StatCard
              icon={Percent}
              label="Occupancy"
              value={`${stats.occupancyRate}%`}
              color="text-sky-600"
            />
            <StatCard
              icon={Clock}
              label="Upcoming"
              value={stats.pendingBookings}
              color="text-violet-600"
            />
            <StatCard
              icon={Banknote}
              label="Month Revenue"
              value={formatCurrency(stats.monthRevenue)}
              color="text-rose-600"
            />
          </div>
        )}

        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Arrivals — Next 7 Days</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {!stats
                ? null
                : Object.entries(stats.statusCounts)
                    .filter(([, count]) => count > 0)
                    .map(([status, count]) => (
                      <Badge
                        key={status}
                        variant="secondary"
                        className={getBookingStatusColor(status)}
                      >
                        {getBookingStatusLabel(status)}: {count}
                      </Badge>
                    ))}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 rounded-xl" />
            ) : !stats || stats.upcomingBookings.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No upcoming arrivals in the next 7 days.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Reference</th>
                      <th className="pb-2 pr-4 font-medium">Guest</th>
                      <th className="pb-2 pr-4 font-medium">Room</th>
                      <th className="pb-2 pr-4 font-medium">Check-in</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.upcomingBookings.map((b) => (
                      <tr key={b.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-4 font-medium">{b.referenceCode}</td>
                        <td className="py-2.5 pr-4">{b.guestName}</td>
                        <td className="py-2.5 pr-4">
                          {b.roomNumber
                            ? `Room ${b.roomNumber}`
                            : b.roomTypeName}
                        </td>
                        <td className="py-2.5 pr-4">{formatDateOnly(b.checkInDate)}</td>
                        <td className="py-2.5 pr-4">
                          <Badge
                            variant="secondary"
                            className={getBookingStatusColor(b.status)}
                          >
                            {getBookingStatusLabel(b.status)}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatCurrency(b.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
