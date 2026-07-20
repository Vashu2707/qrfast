"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markNotificationRead, clearAllNotifications } from "@/actions/notifications";
import { formatDate } from "@/lib/format";
import { Bell, CheckCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
};

export function NotificationsPanel({ notifications }: { notifications: Notification[] }) {
  const queryClient = useQueryClient();
  const [clearing, setClearing] = useState(false);

  const handleRead = async (id: string) => {
    try {
      const result = await markNotificationRead(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      toast.error("Failed to mark notification as read.");
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      const result = await clearAllNotifications();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("All notifications cleared.");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      toast.error("Failed to clear notifications.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card className="border-border/60 h-full flex flex-col justify-start">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4" />
            Notifications
          </CardTitle>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs text-muted-foreground" onClick={handleClearAll} disabled={clearing}>
              <CheckCheck className="size-3.5" />
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
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
