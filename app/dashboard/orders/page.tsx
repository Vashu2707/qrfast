"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrders, updateOrderStatus, updateOrderPaymentStatus } from "@/actions/orders";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, getOrderStatusColor, getOrderStatusLabel } from "@/lib/format";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { toast } from "sonner";
import { Search, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    refetchInterval: 15000,
  });

  const filtered = orders.filter((o) => {
    const matchSearch =
      !search ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.id.includes(search) ||
      o.table.number.includes(search);
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleStatusUpdate = async (id: string, status: OrderStatus) => {
    const result = await updateOrderStatus(id, status);
    if (result.error) toast.error(result.error);
    else {
      toast.success(`Order marked as ${getOrderStatusLabel(status)}`);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  };

  const handlePaymentUpdate = async (id: string, paymentStatus: PaymentStatus) => {
    const result = await updateOrderPaymentStatus(id, paymentStatus);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Payment status updated");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  };

  const statusFlow: OrderStatus[] = [
    OrderStatus.PLACED,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.SERVED,
    OrderStatus.COMPLETED,
  ];

  return (
    <div>
      <StaffHeader title="Orders" subtitle="Manage and track all orders" />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search orders..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.values(OrderStatus).map((s) => (
                <SelectItem key={s} value={s}>{getOrderStatusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="size-4" />
          </Button>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-12">Loading orders...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No orders found</p>
        ) : (
          <div className="grid gap-4">
            {filtered.map((order) => (
              <Card key={order.id} className="border-border/60">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{order.customerName}</span>
                        <Badge variant="outline">Table {order.table.number}</Badge>
                        <Badge className={getOrderStatusColor(order.status)} variant="secondary">
                          {getOrderStatusLabel(order.status)}
                        </Badge>
                        <Badge variant={order.paymentStatus === "SUCCESS" ? "default" : "outline"}>
                          {order.paymentStatus}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{order.customerPhone} · {formatDate(order.createdAt)}</p>
                      <div className="mt-3 space-y-1">
                        {order.orderItems.map((item) => (
                          <p key={item.id} className="text-sm">
                            {item.quantity}x {item.menuItem.name} — {formatCurrency(item.price * item.quantity)}
                          </p>
                        ))}
                      </div>
                      <p className="mt-2 text-lg font-bold">{formatCurrency(order.totalAmount)}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Select
                        value={order.status}
                        onValueChange={(v) => v && handleStatusUpdate(order.id, v as OrderStatus)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusFlow.map((s) => (
                            <SelectItem key={s} value={s}>{getOrderStatusLabel(s)}</SelectItem>
                          ))}
                          <SelectItem value={OrderStatus.CANCELLED}>Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      {order.paymentStatus === PaymentStatus.PENDING && (
                        <Button size="sm" onClick={() => handlePaymentUpdate(order.id, PaymentStatus.SUCCESS)}>
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
