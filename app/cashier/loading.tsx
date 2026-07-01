import { Skeleton } from "@/components/ui/skeleton";

export default function CashierLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between border-b border-border/60 bg-card/30 px-6 py-4 backdrop-blur-sm">
        <div>
          <Skeleton className="h-7 w-36" />
          <Skeleton className="mt-1 h-4 w-48" />
        </div>
      </div>
      <div className="flex items-center gap-3 border-b border-border/60 px-6 py-3">
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="p-6">
        <div className="flex gap-2 border-b border-border pb-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 p-5">
              <Skeleton className="mb-2 h-5 w-20" />
              <Skeleton className="mb-2 h-4 w-36" />
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
