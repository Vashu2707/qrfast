"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/hooks/use-cart";
import { createOrder } from "@/actions/orders";
import { validateCoupon } from "@/actions/coupons";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentMethod } from "@prisma/client";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Trash2, Loader2, CreditCard, Banknote } from "lucide-react";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface Props {
  slug: string;
  tableParam: string;
  gstPercentage: number;
  serviceChargePercentage: number;
  primaryColor: string;
  restaurantName: string;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CartClient({
  slug, tableParam, gstPercentage, serviceChargePercentage, primaryColor, restaurantName,
}: Props) {
  const router = useRouter();
  const {
    items, tableId, tableNumber, restaurantId, notes, coupon,
    updateQuantity, removeItem, setNotes, applyCoupon, removeCoupon, clearCart,
    getSubtotal, getDiscountAmount, getGstAmount, getServiceChargeAmount, getTotalAmount,
  } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [loading, setLoading] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);

  useEffect(() => {
    if (items.length === 0 && !loading) {
      // Allow empty cart view briefly
    }
  }, [items, loading]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    const result = await validateCoupon(restaurantId, couponCode, getSubtotal());
    setCouponLoading(false);
    if (!result.isValid) {
      toast.error(result.message || "Invalid coupon");
      return;
    }
    applyCoupon(result.coupon!);
    toast.success(`Coupon ${result.coupon!.code} applied!`);
  };

  const handleCheckout = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Please enter your name and phone number");
      return;
    }
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setLoading(true);
    const result = await createOrder({
      tableId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      paymentMethod,
      couponCode: coupon?.code || couponCode || undefined,
      notes: notes || undefined,
      items: items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes,
        customizations: item.customizations,
      })),
    });
    setLoading(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }

    if (!("success" in result) || !result.success) return;

    if (paymentMethod === PaymentMethod.RAZORPAY && result.razorpayOrder) {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Failed to load payment gateway");
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: result.razorpayOrder.amount,
        currency: result.razorpayOrder.currency,
        name: restaurantName,
        description: `Order at Table ${tableNumber}`,
        order_id: result.razorpayOrder.id,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          clearCart();
          toast.success("Payment successful!");
          router.push(`/order/${result.orderId}`);
        },
        prefill: { name: customerName, contact: customerPhone },
        theme: { color: primaryColor },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      clearCart();
      toast.success("Order placed! Pay at the counter.");
      router.push(`/order/${result.orderId}`);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Your cart is empty</p>
        <Link href={`/menu/${slug}/${tableParam}`}>
          <Button>
            <ArrowLeft className="mr-2 size-4" />Back to Menu
          </Button>
        </Link>
      </div>
    );
  }

  const subtotal = getSubtotal();
  const discount = getDiscountAmount();
  const gst = getGstAmount(gstPercentage);
  const serviceCharge = getServiceChargeAmount(serviceChargePercentage);
  const total = getTotalAmount(gstPercentage, serviceChargePercentage);

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/60 bg-background/95 px-4 py-4 backdrop-blur-md">
        <Link href={`/menu/${slug}/${tableParam}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button>
        </Link>
        <h1 className="text-lg font-semibold">Checkout · Table {tableNumber}</h1>
      </div>

      <div className="mx-auto max-w-lg space-y-4 p-4">
        {/* Cart Items */}
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-base">Your Order</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                {item.image && (
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg">
                    <Image src={item.image} alt={item.name} fill className="object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                  {item.customizations?.variant && (
                    <p className="text-xs text-muted-foreground">{item.customizations.variant.name}</p>
                  )}
                  {item.customizations?.addons && item.customizations.addons.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      + {item.customizations.addons.map((a) => a.name).join(", ")}
                    </p>
                  )}
                  <p className="text-sm font-semibold" style={{ color: primaryColor }}>
                    {formatCurrency((item.price + (item.customizations?.addons?.reduce((s, a) => s + a.price, 0) || 0)) * item.quantity)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="size-7" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="size-7" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => removeItem(item.id)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Coupon */}
        <Card className="border-border/60">
          <CardContent className="pt-4">
            {coupon ? (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-600">Coupon {coupon.code} applied</span>
                <Button variant="ghost" size="sm" onClick={removeCoupon}>Remove</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} />
                <Button variant="outline" onClick={handleApplyCoupon} disabled={couponLoading}>Apply</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-base">Your Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2"><Label>Name</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="John Doe" /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+91 9876543210" type="tel" /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special requests..." rows={2} /></div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-base">Payment</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod(PaymentMethod.RAZORPAY)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${paymentMethod === PaymentMethod.RAZORPAY ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <CreditCard className="size-6" />
              <span className="text-sm font-medium">Pay Online</span>
            </button>
            <button
              onClick={() => setPaymentMethod(PaymentMethod.CASH)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${paymentMethod === PaymentMethod.CASH ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <Banknote className="size-6" />
              <span className="text-sm font-medium">Pay at Counter</span>
            </button>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="border-border/60">
          <CardContent className="space-y-2 pt-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">GST ({gstPercentage}%)</span><span>{formatCurrency(gst)}</span></div>
            {serviceCharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Service Charge</span><span>{formatCurrency(serviceCharge)}</span></div>}
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>Grand Total</span>
              <span style={{ color: primaryColor }}>{formatCurrency(total)}</span>
            </div>
          </CardContent>
        </Card>

        <Button
          className="h-12 w-full text-base"
          style={{ backgroundColor: primaryColor }}
          onClick={handleCheckout}
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {paymentMethod === PaymentMethod.RAZORPAY ? "Pay & Place Order" : "Place Order"}
        </Button>
      </div>
    </div>
  );
}
