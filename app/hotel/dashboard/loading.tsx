import { ShimmerStatsGrid } from "@/components/ui/shimmer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function HotelDashboardLoading() {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-4 sm:px-6">
        <div>
          <Skeleton className="h-7 w-36" />
          <Skeleton className="mt-1 h-4 w-48" />
        </div>
      </div>
      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        <ShimmerStatsGrid />
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">
              <Skeleton className="h-5 w-40" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
