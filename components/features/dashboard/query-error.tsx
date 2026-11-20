"use client";

import { AlertCircle } from "lucide-react";

/** Visible failure state for staff dashboard queries (no silent empty data). */
export function QueryError({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
    >
      <AlertCircle className="size-4 shrink-0" />
      {message}
    </div>
  );
}
