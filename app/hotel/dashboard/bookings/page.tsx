"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createHotelBooking,
  getHotelBookings,
  updateHotelBooking,
  updateHotelBookingStatus,
  assignHotelRoom,
  updateHotelBookingPayment,
} from "@/actions/hotel/bookings";
import { getHotelRooms, getHotelRoomTypes } from "@/actions/hotel/rooms";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatCurrency,
  formatDateOnly,
  getBookingStatusColor,
  getBookingStatusLabel,
} from "@/lib/format";
import { todayInTz } from "@/lib/hotel";
import { getHotelSettings } from "@/actions/hotel/settings";
import { toast } from "sonner";
import { Search, RefreshCw, Plus, Pencil, KeyRound } from "lucide-react";

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
] as const;

interface BookingRow {
  id: string;
  referenceCode: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string;
  guestCount: number;
  roomTypeId: string;
  roomId: string | null;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  totalAmount: number;
  specialRequests: string | null;
  notes: string | null;
  roomType: { id: string; name: string; basePrice: number };
  room: { id: string; number: string } | null;
}

interface EditForm {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCount: string;
  checkInDate: string;
  checkOutDate: string;
  specialRequests: string;
  notes: string;
}

const emptyForm = (today: string) => ({
  roomTypeId: "",
  guestName: "",
  guestEmail: "",
  guestPhone: "",
  guestCount: "1",
  checkInDate: today,
  checkOutDate: "",
  specialRequests: "",
});

/** Format a date-only value (Date or ISO string) as YYYY-MM-DD without TZ shifts. */
const toDateInput = (v: Date | string) => {
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export default function HotelBookingsPage() {
  const queryClient = useQueryClient();

  // Shares the cache key with the settings page. "Today" must be the
  // hotel's calendar day, not the browser's (see todayInTz).
  const { data: settings } = useQuery({
    queryKey: ["hotel-settings"],
    queryFn: () => getHotelSettings(),
  });
  const today = todayInTz(settings?.timezone);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(today));

  const [editBooking, setEditBooking] = useState<BookingRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const [assignBooking, setAssignBooking] = useState<BookingRow | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState("");

  const [payBooking, setPayBooking] = useState<BookingRow | null>(null);
  const [payStatus, setPayStatus] = useState("PAID");
  const [payMethod, setPayMethod] = useState("CASH");

  const { data: bookings = [], isLoading, refetch } = useQuery({
    queryKey: ["hotel-bookings"],
    queryFn: async (): Promise<BookingRow[]> =>
      (await getHotelBookings()) as unknown as BookingRow[],
    refetchInterval: 10000,
  });

  const { data: roomTypes = [] } = useQuery({
    queryKey: ["hotel-room-types"],
    queryFn: () => getHotelRoomTypes(),
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["hotel-rooms"],
    queryFn: () => getHotelRooms(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["hotel-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["hotel-stats"] });
    queryClient.invalidateQueries({ queryKey: ["hotel-rooms"] });
  };

  const filtered = bookings.filter((b: BookingRow) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      b.referenceCode.toLowerCase().includes(q) ||
      b.guestName.toLowerCase().includes(q) ||
      b.guestPhone.includes(q);
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const nights = (inD: Date | string, outD: Date | string) =>
    inD && outD ? Math.max(0, Math.round((+new Date(outD) - +new Date(inD)) / 86_400_000)) : 0;

  const handleCreate = async () => {
    const result = await createHotelBooking({
      roomTypeId: form.roomTypeId,
      guestName: form.guestName,
      guestEmail: form.guestEmail,
      guestPhone: form.guestPhone,
      guestCount: Number(form.guestCount) || 1,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      specialRequests: form.specialRequests,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Booking created — ${result.referenceCode}`);
    setForm(emptyForm(today));
    setNewOpen(false);
    invalidate();
  };

  const handleStatus = async (booking: BookingRow, status: string) => {
    const result = await updateHotelBookingStatus({ id: booking.id, status });
    if (result.error) toast.error(result.error);
    else {
      toast.success(`Booking marked as ${getBookingStatusLabel(status)}`);
      invalidate();
    }
  };

  const openEdit = (booking: BookingRow) => {
    setEditBooking(booking);
    setEditForm({
      guestName: booking.guestName,
      guestEmail: booking.guestEmail || "",
      guestPhone: booking.guestPhone,
      guestCount: String(booking.guestCount),
      checkInDate: toDateInput(booking.checkInDate),
      checkOutDate: toDateInput(booking.checkOutDate),
      specialRequests: booking.specialRequests || "",
      notes: booking.notes || "",
    });
  };

  const handleEdit = async () => {
    if (!editBooking || !editForm) return;
    const result = await updateHotelBooking(editBooking.id, {
      ...editForm,
      guestCount: Number(editForm.guestCount) || 1,
    });
    if (result.error) toast.error(result.error);
    else {
      toast.success("Booking updated");
      setEditBooking(null);
      invalidate();
    }
  };

  const handleAssign = async () => {
    if (!assignBooking || !selectedRoomId) return;
    const result = await assignHotelRoom({
      bookingId: assignBooking.id,
      roomId: selectedRoomId,
    });
    if (result.error) toast.error(result.error);
    else {
      toast.success("Room assigned");
      setAssignBooking(null);
      setSelectedRoomId("");
      invalidate();
    }
  };

  const handlePayment = async () => {
    if (!payBooking) return;
    const result = await updateHotelBookingPayment({
      id: payBooking.id,
      paymentStatus: payStatus,
      paymentMethod: payStatus === "PENDING" ? "" : payMethod,
    });
    if (result.error) toast.error(result.error);
    else {
      toast.success("Payment status updated");
      setPayBooking(null);
      invalidate();
    }
  };

  const assignableRooms = rooms.filter(
    (r) => assignBooking && r.roomTypeId === assignBooking.roomTypeId
  );

  return (
    <div>
      <StaffHeader title="Bookings" subtitle="Manage reservations, check-ins and payments" />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reference, guest or phone..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Select
              value={statusFilter}
              onValueChange={(v) => v && setStatusFilter(v)}
              items={[
                { value: "all", label: "All Status" },
                ...STATUSES.map((s) => ({
                  value: s,
                  label: getBookingStatusLabel(s),
                })),
              ]}
            >
              <SelectTrigger className="w-full min-w-0 sm:w-[170px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {getBookingStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="size-11 shrink-0" onClick={() => refetch()}>
              <RefreshCw className="size-4" />
            </Button>
            <Button className="shrink-0" onClick={() => setNewOpen(true)}>
              <Plus className="mr-2 size-4" />
              New Booking
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="py-12 text-center text-muted-foreground">Loading bookings...</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">No bookings found</p>
        ) : (
          <div className="grid gap-4">
            {filtered.map((booking: BookingRow) => (
              <Card key={booking.id} className="border-border/60">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold">{booking.guestName}</span>
                        <Badge variant="outline">{booking.referenceCode}</Badge>
                        <Badge
                          variant="secondary"
                          className={getBookingStatusColor(booking.status)}
                        >
                          {getBookingStatusLabel(booking.status)}
                        </Badge>
                        <Badge variant={booking.paymentStatus === "PAID" ? "default" : "outline"}>
                          {booking.paymentStatus}
                          {booking.paymentMethod ? ` · ${booking.paymentMethod}` : ""}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {booking.guestPhone}
                        {booking.guestEmail ? ` · ${booking.guestEmail}` : ""}
                        {" · "}
                        {booking.guestCount} guest(s)
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {booking.roomType.name}
                        {booking.room ? ` · Room ${booking.room.number}` : " · Room not assigned"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateOnly(booking.checkInDate)} &rarr; {formatDateOnly(booking.checkOutDate)}
                        {" · "}
                        {nights(booking.checkInDate, booking.checkOutDate)} night(s)
                      </p>
                      <p className="mt-2 text-lg font-bold tabular-nums">
                        {formatCurrency(booking.totalAmount)}
                      </p>
                      {booking.specialRequests && (
                        <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                          {booking.specialRequests}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {booking.status === "PENDING" && (
                        <Button size="sm" onClick={() => handleStatus(booking, "CONFIRMED")}>
                          Confirm
                        </Button>
                      )}
                      {booking.status === "CONFIRMED" && (
                        <Button
                          size="sm"
                          onClick={() => handleStatus(booking, "CHECKED_IN")}
                          disabled={!booking.roomId}
                          title={!booking.roomId ? "Assign a room first" : undefined}
                        >
                          Check In
                        </Button>
                      )}
                      {booking.status === "CHECKED_IN" && (
                        <Button size="sm" onClick={() => handleStatus(booking, "CHECKED_OUT")}>
                          Check Out
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAssignBooking(booking);
                          setSelectedRoomId(booking.roomId || "");
                        }}
                      >
                        <KeyRound className="mr-1 size-3" />
                        {booking.room ? "Change Room" : "Assign Room"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setPayBooking(booking);
                        // Sync the dialog to THIS booking — otherwise the
                        // stale PAID/CASH default (or last-used values) is
                        // written back by a single "Update Payment" click,
                        // silently corrupting payment stats on a PENDING row.
                        setPayStatus(booking.paymentStatus || "PENDING");
                        setPayMethod(booking.paymentMethod || "CASH");
                      }}>
                        Payment
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(booking)}>
                        <Pencil className="mr-1 size-3" />
                        Edit
                      </Button>
                      {["PENDING", "CONFIRMED"].includes(booking.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleStatus(booking, "CANCELLED")}
                        >
                          Cancel
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

      {/* New booking dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Booking</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Room Type</Label>
              <Select
                value={form.roomTypeId}
                onValueChange={(v) => v && setForm({ ...form, roomTypeId: v })}
                items={roomTypes.map((t) => ({
                  value: t.id,
                  label: `${t.name} — ${formatCurrency(t.basePrice)}/night`,
                }))}
              >
                <SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
                <SelectContent>
                  {roomTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} — {formatCurrency(t.basePrice)}/night
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Guest Name</Label>
                <Input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input type="email" value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Guests</Label>
                <Input type="number" min={1} value={form.guestCount} onChange={(e) => setForm({ ...form, guestCount: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Check-in</Label>
                <Input type="date" min={today} value={form.checkInDate} onChange={(e) => setForm({ ...form, checkInDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Check-out</Label>
                <Input type="date" min={form.checkInDate} value={form.checkOutDate} onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Special Requests</Label>
              <Input value={form.specialRequests} onChange={(e) => setForm({ ...form, specialRequests: e.target.value })} />
            </div>
            <Button
              onClick={handleCreate}
              disabled={!form.roomTypeId || !form.guestName || !form.guestPhone || !form.checkOutDate}
            >
              Create Booking
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editBooking} onOpenChange={(open) => !open && setEditBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Booking {editBooking?.referenceCode}</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Guest Name</Label>
                  <Input value={editForm.guestName} onChange={(e) => setEditForm({ ...editForm, guestName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={editForm.guestPhone} onChange={(e) => setEditForm({ ...editForm, guestPhone: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={editForm.guestEmail} onChange={(e) => setEditForm({ ...editForm, guestEmail: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Guests</Label>
                  <Input type="number" min={1} value={editForm.guestCount} onChange={(e) => setEditForm({ ...editForm, guestCount: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Check-in</Label>
                  <Input type="date" value={editForm.checkInDate} onChange={(e) => setEditForm({ ...editForm, checkInDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Check-out</Label>
                  <Input type="date" value={editForm.checkOutDate} onChange={(e) => setEditForm({ ...editForm, checkOutDate: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Special Requests</Label>
                <Input value={editForm.specialRequests} onChange={(e) => setEditForm({ ...editForm, specialRequests: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Internal Notes</Label>
                <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>
              <Button onClick={handleEdit}>Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign room dialog */}
      <Dialog open={!!assignBooking} onOpenChange={(open) => !open && setAssignBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign Room — {assignBooking?.referenceCode}
              {assignBooking ? ` (${assignBooking.roomType.name})` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Room</Label>
              <Select
                value={selectedRoomId}
                onValueChange={(v) => v && setSelectedRoomId(v)}
                items={assignableRooms.map((r) => ({
                  value: r.id,
                  label: `Room ${r.number}${r.floor ? ` · Floor ${r.floor}` : ""} — ${r.status}`,
                }))}
              >
                <SelectTrigger><SelectValue placeholder="Select a room" /></SelectTrigger>
                <SelectContent>
                  {assignableRooms.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No rooms of this type
                    </SelectItem>
                  ) : (
                    assignableRooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        Room {r.number}
                        {r.floor ? ` · Floor ${r.floor}` : ""} — {r.status}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAssign} disabled={!selectedRoomId || selectedRoomId === "none"}>
              Assign Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={!!payBooking} onOpenChange={(open) => !open && setPayBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment — {payBooking?.referenceCode}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Total:{" "}
              <span className="font-semibold text-foreground">
                {payBooking ? formatCurrency(payBooking.totalAmount) : ""}
              </span>
            </p>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={payStatus}
                onValueChange={(v) => v && setPayStatus(v)}
                items={[
                  { value: "PENDING", label: "Pending" },
                  { value: "PAID", label: "Paid" },
                  { value: "REFUNDED", label: "Refunded" },
                ]}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payStatus !== "PENDING" && (
              <div className="space-y-2">
                <Label>Method</Label>
                <Select
                  value={payMethod}
                  onValueChange={(v) => v && setPayMethod(v)}
                  items={[
                    { value: "CASH", label: "Cash" },
                    { value: "UPI", label: "UPI" },
                    { value: "CARD", label: "Card" },
                    { value: "ONLINE", label: "Online" },
                  ]}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="ONLINE">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handlePayment}>Update Payment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
