"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrders, updateOrderStatus } from "@/actions/orders";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, getOrderStatusLabel } from "@/lib/format";
import { OrderStatus } from "@prisma/client";
import { toast } from "sonner";
import { ChefHat, Clock, CheckCircle, RefreshCw, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const KITCHEN_STATUSES = [
  OrderStatus.PLACED,
  OrderStatus.PREPARING,
  OrderStatus.PREPARED,
  OrderStatus.READY,
];

const NOTIFICATION_TONE = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OSdTgwOUKzn8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yk2CBtpvfDknU4MDlCs5/C2YxwGOJHX8sx5LAUkd8fw3ZBAC";

export default function KitchenPage() {
  const queryClient = useQueryClient();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevOrderCount = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const unlockedRef = useRef(false);

  const { data: orders = [], refetch, isLoading } = useQuery({
    queryKey: ["kitchen-orders"],
    queryFn: () => getOrders(),
    refetchInterval: 8000,
  });

  const kitchenOrders = orders.filter((o) =>
    KITCHEN_STATUSES.includes(o.status as typeof KITCHEN_STATUSES[number])
  );

  const unlockAudio = useCallback(async () => {
    if (unlockedRef.current) return;
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      const res = await fetch(NOTIFICATION_TONE);
      const arrayBuf = await res.arrayBuffer();
      audioBufferRef.current = await ctx.decodeAudioData(arrayBuf);
      unlockedRef.current = true;
    } catch {
      // fallback: will try plain Audio below
    }
  }, []);

  const playNotification = useCallback(() => {
    const ctx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    if (ctx && buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } else {
      try {
        const audio = new Audio(NOTIFICATION_TONE);
        audio.play().catch(() => {});
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (soundEnabled && kitchenOrders.length > prevOrderCount.current && prevOrderCount.current > 0) {
      playNotification();
    }
    prevOrderCount.current = kitchenOrders.length;
  }, [kitchenOrders.length, soundEnabled, playNotification]);

  const handleStatusUpdate = async (id: string, status: OrderStatus) => {
    const result = await updateOrderStatus(id, status);
    if (result.error) toast.error(result.error);
    else {
      toast.success(`Order → ${getOrderStatusLabel(status)}`);
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
    }
  };

  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const flow: Partial<Record<OrderStatus, OrderStatus>> = {
      [OrderStatus.PLACED]: OrderStatus.PREPARING,
      [OrderStatus.PREPARING]: OrderStatus.PREPARED,
      [OrderStatus.PREPARED]: OrderStatus.READY,
    };
    return flow[current] || null;
  };

  const columns = [
    { status: OrderStatus.PLACED, label: "New Orders", color: "border-blue-500" },
    { status: OrderStatus.PREPARING, label: "Preparing", color: "border-amber-500" },
    { status: OrderStatus.PREPARED, label: "Prepared", color: "border-violet-500" },
    { status: OrderStatus.READY, label: "Ready", color: "border-emerald-500" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <StaffHeader title="Kitchen Display" subtitle="Live order board" />
      <div className="flex items-center gap-3 border-b border-border/60 px-6 py-3">
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 size-4" />Refresh
        </Button>
        <Button
          variant={soundEnabled ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (!soundEnabled) unlockAudio();
            setSoundEnabled(!soundEnabled);
          }}
        >
          <Volume2 className="mr-2 size-4" />Sound {soundEnabled ? "On" : "Off"}
        </Button>
        <Button variant={soundEnabled ? "default" : "outline"} size="sm" onClick={() => setSoundEnabled(!soundEnabled)}>
          <Volume2 className="mr-2 size-4" />Sound {soundEnabled ? "On" : "Off"}
        </Button>
        <Link href="/dashboard"><Button variant="ghost" size="sm">Admin Dashboard</Button></Link>
        <Badge variant="secondary" className="ml-auto">{kitchenOrders.length} active orders</Badge>
      </div>

      {isLoading ? (
        <p className="py-20 text-center text-muted-foreground">Loading orders...</p>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-4">
          {columns.map(({ status, label, color }) => {
            const columnOrders = kitchenOrders.filter((o) => o.status === status);
            return (
              <div key={status} className={`rounded-xl border-t-4 ${color} bg-card/50 p-3`}>
                <h2 className="mb-3 flex items-center gap-2 font-semibold">
                  <ChefHat className="size-4" />
                  {label}
                  <Badge variant="secondary">{columnOrders.length}</Badge>
                </h2>
                <div className="space-y-3">
                  {columnOrders.map((order) => {
                    const nextStatus = getNextStatus(order.status as OrderStatus);
                    const elapsed = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
                    return (
                      <Card key={order.id} className="border-border/60">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">Table {order.table.number}</span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="size-3" />{elapsed}m ago
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{order.customerName}</p>
                          <div className="mt-2 space-y-1">
                            {order.orderItems.map((item) => (
                              <p key={item.id} className="text-sm font-medium">
                                {item.quantity}x {item.menuItem.name}
                                {item.notes && <span className="block text-xs text-amber-600">Note: {item.notes}</span>}
                              </p>
                            ))}
                          </div>
                          <p className="mt-2 text-sm font-bold">{formatCurrency(order.totalAmount)}</p>
                          {nextStatus && (
                            <Button
                              className="mt-3 w-full"
                              size="sm"
                              onClick={() => handleStatusUpdate(order.id, nextStatus)}
                            >
                              <CheckCircle className="mr-2 size-4" />
                              Mark {getOrderStatusLabel(nextStatus)}
                            </Button>
                          )}
                          {order.status === OrderStatus.READY && (
                            <Button
                              className="mt-3 w-full"
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusUpdate(order.id, OrderStatus.SERVED)}
                            >
                              <CheckCircle className="mr-2 size-4" />
                              Mark Served
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {columnOrders.length === 0 && (
                    <p className="py-8 text-center text-xs text-muted-foreground">No orders</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
