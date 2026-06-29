"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { markNotificationRead } from "@/actions/notifications";
import { formatDate } from "@/lib/format";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
};

export function NotificationsPanel({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();

  const handleRead = async (id: string) => {
    await markNotificationRead(id);
    router.refresh();
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4" />
          Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No notifications</p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.isRead && handleRead(n.id)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                n.isRead ? "border-border/40 opacity-60" : "border-border bg-muted/30 hover:bg-muted/50"
              }`}
            >
              <p className="text-sm font-medium">{n.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(n.createdAt)}</p>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
