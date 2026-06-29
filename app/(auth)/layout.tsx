import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          QRFast
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4 pb-12">
        {children}
      </main>
    </div>
  );
}
