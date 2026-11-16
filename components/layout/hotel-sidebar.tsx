"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  DoorOpen,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { hotelSignOut } from "@/actions/hotel/auth";
import { HotelRole } from "@prisma/client";
import { toast } from "sonner";

const hotelLinks = [
  { href: "/hotel/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/hotel/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/hotel/dashboard/rooms", label: "Rooms", icon: DoorOpen },
];

interface HotelSidebarProps {
  user: {
    name: string | null;
    email: string;
    role: HotelRole;
  };
}

export function HotelSidebar({ user }: HotelSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const result = await hotelSignOut();
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Signed out");
    router.push("/hotel/login");
    router.refresh();
  };

  return (
    <aside className="flex h-screen w-58 flex-col border-r border-border bg-card">
      <div className="border-b border-border/60 p-5">
        <Link href="/hotel/dashboard" className="text-lg font-semibold tracking-tight">
          QRFast Hotel
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {hotelLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === href || (href !== "/hotel/dashboard" && pathname.startsWith(href))
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-border/60 p-4 space-y-3">
        <Link
          href="/hotel/dashboard/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            pathname.startsWith("/hotel/dashboard/settings")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Settings className="size-4" />
          Settings
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {user.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.role}</p>
          </div>
          <ThemeToggle />
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
          <LogOut className="mr-2 size-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
