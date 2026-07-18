"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrders, updateOrderPaymentStatus, updateOrderStatus } from "@/actions/orders";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { toast } from "sonner";
import { CreditCard, Banknote, RefreshCw, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function CashierPage() {
  const queryClient = useQueryClient();

  const { data: orders = [], refetch, isLoading } = useQuery({
    queryKey: ["cashier-orders"],
    queryFn: () => getOrders(),
    refetchInterval: 10000,
  });

  const pendingPayments = orders.filter((o) => o.paymentStatus === PaymentStatus.PENDING);
  const completedPayments = orders.filter((o) => o.paymentStatus === PaymentStatus.SUCCESS);

  const handleMarkPaid = async (orderId: string) => {
    const result = await updateOrderPaymentStatus(orderId, PaymentStatus.SUCCESS);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Payment marked as received");
      queryClient.invalidateQueries({ queryKey: ["cashier-orders"] });
    }
  };

  const handleComplete = async (orderId: string) => {
    const result = await updateOrderStatus(orderId, OrderStatus.COMPLETED);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Order completed");
      queryClient.invalidateQueries({ queryKey: ["cashier-orders"] });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StaffHeader title="Cashier Desk" subtitle="Manage payments and invoices" />
      <div className="flex items-center gap-3 border-b border-border/60 px-6 py-3">
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 size-4" />Refresh
        </Button>
        <Link href="/dashboard"><Button variant="ghost" size="sm">Admin Dashboard</Button></Link>
      </div>

      <div className="p-6">
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({pendingPayments.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedPayments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : pendingPayments.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">No pending payments</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pendingPayments.map((order) => (
                  <Card key={order.id} className="border-border/60">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">Table {order.table.number}</span>
                        <Badge variant="outline">{order.paymentMethod}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{order.customerName} · {order.customerPhone}</p>
                      <div className="mt-2 space-y-1">
                        {order.orderItems.map((item) => (
                          <p key={item.id} className="text-sm">{item.quantity}x {item.menuItem.name}</p>
                        ))}
                      </div>
                      <p className="mt-3 text-xl font-bold">{formatCurrency(order.totalAmount)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                      <div className="mt-4 flex gap-2">
                        <Button className="flex-1" size="sm" onClick={() => handleMarkPaid(order.id)}>
                          {order.paymentMethod === "RAZORPAY" ? (
                            <CreditCard className="mr-2 size-4" />
                          ) : (
                            <Banknote className="mr-2 size-4" />
                          )}
                          Mark Paid
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleComplete(order.id)}>
                          <CheckCircle className="size-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            {completedPayments.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">No completed payments yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-3 pr-4">Table</th>
                      <th className="pb-3 pr-4">Customer</th>
                      <th className="pb-3 pr-4">Method</th>
                      <th className="pb-3 pr-4">Amount</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedPayments.map((order) => (
                      <tr key={order.id} className="border-b border-border/50">
                        <td className="py-3 pr-4">T-{order.table.number}</td>
                        <td className="py-3 pr-4">{order.customerName}</td>
                        <td className="py-3 pr-4">{order.paymentMethod}</td>
                        <td className="py-3 pr-4 font-medium">{formatCurrency(order.totalAmount)}</td>
                        <td className="py-3 pr-4"><Badge>{order.status}</Badge></td>
                        <td className="py-3 text-muted-foreground">{formatDate(order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
