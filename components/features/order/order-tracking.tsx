"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCustomerOrder, submitReview } from "@/actions/orders";
import { formatCurrency, formatDate, getOrderStatusColor, getOrderStatusLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { OrderStatus } from "@prisma/client";
import { CheckCircle, Clock, ChefHat, Utensils, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const STATUS_STEPS: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
  OrderStatus.COMPLETED,
];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PLACED: <Clock className="size-5" />,
  CONFIRMED: <CheckCircle className="size-5" />,
  PREPARING: <ChefHat className="size-5" />,
  READY: <Utensils className="size-5" />,
  SERVED: <Utensils className="size-5" />,
  COMPLETED: <CheckCircle className="size-5" />,
};

export function OrderTrackingClient({ orderId }: { orderId: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getCustomerOrder(orderId),
    refetchInterval: 10000,
  });

  useEffect(() => {
    const interval = setInterval(() => refetch(), 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  const handleReview = async () => {
    if (rating === 0) { toast.error("Please select a rating"); return; }
    setReviewLoading(true);
    const result = await submitReview({
      orderId,
      customerName: order!.customerName,
      rating,
      comment: comment || undefined,
    });
    setReviewLoading(false);
    if (result.error) toast.error(result.error);
    else { setReviewSubmitted(true); toast.success("Thank you for your review!"); }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Order not found</p>
        <Link href="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.indexOf(order.status);
  const primaryColor = "#E11D48";

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/60 px-4 py-6 text-center">
        <h1 className="text-xl font-bold">Order Tracking</h1>
        <p className="text-sm text-muted-foreground">Table {order.table.number} · Order Tracking</p>
      </div>

      <div className="mx-auto max-w-lg space-y-6 p-4">
        {/* Status Timeline */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Order Status</CardTitle>
              <Badge className={getOrderStatusColor(order.status)} variant="secondary">
                {getOrderStatusLabel(order.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {STATUS_STEPS.map((step, index) => {
                const isComplete = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                return (
                  <div key={step} className="flex items-center gap-3">
                    <div
                      className={`flex size-10 items-center justify-center rounded-full transition-colors ${
                        isComplete ? "text-white" : "bg-muted text-muted-foreground"
                      }`}
                      style={isComplete ? { backgroundColor: primaryColor } : {}}
                    >
                      {STATUS_ICONS[step]}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${isCurrent ? "text-foreground" : isComplete ? "text-foreground/80" : "text-muted-foreground"}`}>
                        {getOrderStatusLabel(step)}
                      </p>
                      {isCurrent && <p className="text-xs text-muted-foreground animate-pulse">In progress...</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-base">Order Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {order.orderItems.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.menuItem.name}</span>
                <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
              {order.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatCurrency(order.discountAmount)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>{formatCurrency(order.gstAmount)}</span></div>
              {order.serviceChargeAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Service Charge</span><span>{formatCurrency(order.serviceChargeAmount)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Total</span>
                <span style={{ color: primaryColor }}>{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Placed {formatDate(order.createdAt)}</p>
            <Badge variant={order.paymentStatus === "SUCCESS" ? "default" : "outline"}>
              Payment: {order.paymentStatus}
            </Badge>
          </CardContent>
        </Card>

        {/* Review */}
        {order.status === OrderStatus.COMPLETED && !reviewSubmitted && (
          <Card className="border-border/60">
            <CardHeader className="pb-2"><CardTitle className="text-base">Rate Your Experience</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)}>
                    <Star className={`size-8 transition-colors ${star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              <Textarea placeholder="Tell us about your experience..." value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
              <Button onClick={handleReview} disabled={reviewLoading} style={{ backgroundColor: primaryColor }}>
                {reviewLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Submit Review
              </Button>
            </CardContent>
          </Card>
        )}

        {reviewSubmitted && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
            Thank you for your feedback!
          </div>
        )}
      </div>
    </div>
  );
}
