import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#F8FAFC] overflow-hidden flex flex-col justify-between">
      {/* Subtle Dot Grid Background (approx. 2-3% opacity slate dots) */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(148,163,184,0.08)_1.5px,transparent_1.5px)] [background-size:24px_24px] pointer-events-none" />

      <header className="flex items-center justify-between px-8 py-6 z-10">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="size-8 rounded-lg bg-gradient-to-br from-orange-600 to-amber-500 flex items-center justify-center text-white font-extrabold text-lg shadow-sm group-hover:opacity-90 transition-opacity">
            Q
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            QRFast
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12 md:py-20 z-10">
        {children}
      </main>
    </div>
  );
}
