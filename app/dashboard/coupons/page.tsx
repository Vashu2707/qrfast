"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCoupons, createCoupon, deleteCoupon, toggleCouponStatus } from "@/actions/coupons";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const emptyCoupon = { code: "", discountType: "PERCENTAGE", discountValue: "", minOrderAmount: "0", expiryDate: "", usageLimit: "" };

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyCoupon);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: coupons = [] } = useQuery({ queryKey: ["coupons"], queryFn: getCoupons });

  const handleCreate = async () => {
    const result = await createCoupon({
      ...form,
      discountValue: parseFloat(form.discountValue),
      minOrderAmount: parseFloat(form.minOrderAmount),
      usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
    });
    if (result.error) toast.error(result.error);
    else {
      toast.success("Coupon created");
      setForm(emptyCoupon);
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
    }
  };

  return (
    <div>
      <StaffHeader title="Coupons" subtitle="Manage discount codes" />
      <div className="space-y-6 p-6">
        <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 size-4" />Create Coupon</Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Coupon</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE20" /></div>
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={form.discountType} onValueChange={(v) => v && setForm({ ...form, discountType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    <SelectItem value="FLAT">Flat Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Value</Label><Input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} /></div>
                <div className="space-y-2"><Label>Min Order (₹)</Label><Input type="number" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Expiry Date</Label><Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></div>
                <div className="space-y-2"><Label>Usage Limit</Label><Input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} placeholder="Unlimited" /></div>
              </div>
              <Button onClick={handleCreate} disabled={!form.code || !form.discountValue || !form.expiryDate}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => (
            <Card key={coupon.id} className={`border-border/60 ${!coupon.isActive ? "opacity-60" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <Badge variant="default" className="text-base font-mono">{coupon.code}</Badge>
                  <Button variant="ghost" size="icon" onClick={async () => { if (confirm("Delete?")) { await deleteCoupon(coupon.id); queryClient.invalidateQueries({ queryKey: ["coupons"] }); } }}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <p className="mt-2 text-sm">
                  {coupon.discountType === "PERCENTAGE" ? `${coupon.discountValue}% off` : `₹${coupon.discountValue} off`}
                  {coupon.minOrderAmount > 0 && ` · Min ₹${coupon.minOrderAmount}`}
                </p>
                <p className="text-xs text-muted-foreground">Expires: {formatDate(coupon.expiryDate)}</p>
                <p className="text-xs text-muted-foreground">Used: {coupon.usageCount}{coupon.usageLimit ? `/${coupon.usageLimit}` : ""}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Switch checked={coupon.isActive} onCheckedChange={async () => { await toggleCouponStatus(coupon.id); queryClient.invalidateQueries({ queryKey: ["coupons"] }); }} />
                  <span className="text-xs">{coupon.isActive ? "Active" : "Inactive"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
