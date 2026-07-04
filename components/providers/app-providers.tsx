"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: ONE_MINUTE,
            gcTime: FIVE_MINUTES,
            refetchOnWindowFocus: false,
            retry: 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster position="top-center" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
