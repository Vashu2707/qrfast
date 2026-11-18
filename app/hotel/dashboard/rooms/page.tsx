"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createHotelRoom,
  deleteHotelRoom,
  getHotelRooms,
  getHotelRoomTypes,
  updateHotelRoom,
  updateHotelRoomStatus,
  createHotelRoomType,
  deleteHotelRoomType,
  updateHotelRoomType,
} from "@/actions/hotel/rooms";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { formatCurrency, getRoomStatusColor, getRoomStatusLabel } from "@/lib/format";
import type { HotelRoomInput, HotelRoomTypeInput } from "@/schemas/hotel";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, BedDouble, LayoutGrid } from "lucide-react";

type RoomRow = Awaited<ReturnType<typeof getHotelRooms>>[number];
type RoomTypeRow = Awaited<ReturnType<typeof getHotelRoomTypes>>[number];

const ROOM_STATUSES = ["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE"] as const;

const emptyRoom = { number: "", floor: "", roomTypeId: "", status: "AVAILABLE" };
const emptyType = {
  name: "",
  description: "",
  basePrice: "",
  maxGuests: "2",
  amenities: "",
  sortOrder: "0",
};

export default function HotelRoomsPage() {
  const queryClient = useQueryClient();

  const [roomDialog, setRoomDialog] = useState(false);
  const [roomForm, setRoomForm] = useState(emptyRoom);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);

  const [typeDialog, setTypeDialog] = useState(false);
  const [typeForm, setTypeForm] = useState(emptyType);
  const [editTypeId, setEditTypeId] = useState<string | null>(null);

  const { data: rooms = [] } = useQuery({
    queryKey: ["hotel-rooms"],
    queryFn: () => getHotelRooms(),
    refetchInterval: 15000,
  });

  const { data: roomTypes = [] } = useQuery({
    queryKey: ["hotel-room-types"],
    queryFn: () => getHotelRoomTypes(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["hotel-rooms"] });
    queryClient.invalidateQueries({ queryKey: ["hotel-room-types"] });
    queryClient.invalidateQueries({ queryKey: ["hotel-stats"] });
  };

  // ─── Rooms ────────────────────────────────────────────────────────────────

  const handleRoomSubmit = async () => {
    const payload: HotelRoomInput = {
      number: roomForm.number,
      floor: roomForm.floor,
      roomTypeId: roomForm.roomTypeId,
      status: roomForm.status as HotelRoomInput["status"],
    };
    const result = editRoomId
      ? await updateHotelRoom(editRoomId, payload)
      : await createHotelRoom(payload);
    if (result.error) toast.error(result.error);
    else {
      toast.success(editRoomId ? "Room updated" : "Room created");
      setRoomDialog(false);
      setRoomForm(emptyRoom);
      setEditRoomId(null);
      invalidate();
    }
  };

  const handleRoomDelete = async (id: string) => {
    if (!confirm("Delete this room?")) return;
    const result = await deleteHotelRoom(id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Room deleted");
      invalidate();
    }
  };

  const handleRoomStatus = async (id: string, status: string) => {
    const result = await updateHotelRoomStatus({ id, status });
    if (result.error) toast.error(result.error);
    else invalidate();
  };

  const openRoomEdit = (room: RoomRow) => {
    setEditRoomId(room.id);
    setRoomForm({
      number: room.number,
      floor: room.floor || "",
      roomTypeId: room.roomTypeId,
      status: room.status,
    });
    setRoomDialog(true);
  };

  // ─── Room types ───────────────────────────────────────────────────────────

  const handleTypeSubmit = async () => {
    const payload: HotelRoomTypeInput = {
      name: typeForm.name,
      description: typeForm.description,
      basePrice: Number(typeForm.basePrice) || 0,
      maxGuests: Number(typeForm.maxGuests) || 2,
      amenities: typeForm.amenities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      images: [],
      sortOrder: Number(typeForm.sortOrder) || 0,
    };
    const result = editTypeId
      ? await updateHotelRoomType(editTypeId, payload)
      : await createHotelRoomType(payload);
    if (result.error) toast.error(result.error);
    else {
      toast.success(editTypeId ? "Room type updated" : "Room type created");
      setTypeDialog(false);
      setTypeForm(emptyType);
      setEditTypeId(null);
      invalidate();
    }
  };

  const handleTypeDelete = async (id: string) => {
    if (!confirm("Delete this room type?")) return;
    const result = await deleteHotelRoomType(id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Room type deleted");
      invalidate();
    }
  };

  const openTypeEdit = (type: RoomTypeRow) => {
    setEditTypeId(type.id);
    setTypeForm({
      name: type.name,
      description: type.description || "",
      basePrice: String(type.basePrice ?? ""),
      maxGuests: String(type.maxGuests ?? 2),
      amenities: (type.amenities || []).join(", "),
      sortOrder: String(type.sortOrder ?? 0),
    });
    setTypeDialog(true);
  };

  return (
    <div>
      <StaffHeader title="Rooms" subtitle="Manage rooms and room types" />
      <div className="p-4 sm:p-6">
        <Tabs defaultValue="rooms">
          <TabsList className="mb-4">
            <TabsTrigger value="rooms">
              <LayoutGrid className="mr-1.5 size-4" />
              Rooms ({rooms.length})
            </TabsTrigger>
            <TabsTrigger value="types">
              <BedDouble className="mr-1.5 size-4" />
              Room Types ({roomTypes.length})
            </TabsTrigger>
          </TabsList>

          {/* Rooms tab */}
          <TabsContent value="rooms" className="space-y-4">
            <Button
              onClick={() => {
                setEditRoomId(null);
                setRoomForm(emptyRoom);
                setRoomDialog(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Add Room
            </Button>

            {rooms.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">
                No rooms yet. Create a room type first, then add rooms.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rooms.map((room) => (
                  <Card key={room.id} className="border-border/60">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Room {room.number}</h3>
                        <Badge
                          variant="secondary"
                          className={getRoomStatusColor(room.status)}
                        >
                          {getRoomStatusLabel(room.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {room.roomType?.name}
                        {room.floor ? ` · Floor ${room.floor}` : ""}
                      </p>
                      <Select
                        value={room.status}
                        onValueChange={(v) => v && handleRoomStatus(room.id, v)}
                        items={ROOM_STATUSES.map((s) => ({
                          value: s,
                          label: getRoomStatusLabel(s),
                        }))}
                      >
                        <SelectTrigger className="my-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROOM_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {getRoomStatusLabel(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openRoomEdit(room)}
                        >
                          <Pencil className="mr-1 size-3" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRoomDelete(room.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Room types tab */}
          <TabsContent value="types" className="space-y-4">
            <Button
              onClick={() => {
                setEditTypeId(null);
                setTypeForm(emptyType);
                setTypeDialog(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Add Room Type
            </Button>

            {roomTypes.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">
                No room types yet. Create one to start taking bookings.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {roomTypes.map((type) => (
                  <Card key={type.id} className="border-border/60">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">{type.name}</h3>
                        <Badge variant="secondary">
                          {type._count?.rooms ?? 0} room(s)
                        </Badge>
                      </div>
                      <p className="mt-1 text-xl font-semibold">
                        {formatCurrency(type.basePrice)}
                        <span className="text-sm font-normal text-muted-foreground">
                          /night
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Up to {type.maxGuests} guest(s)
                      </p>
                      {type.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {type.description}
                        </p>
                      )}
                      {type.amenities?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {type.amenities.map((a: string) => (
                            <Badge key={a} variant="outline" className="text-xs">
                              {a}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openTypeEdit(type)}
                        >
                          <Pencil className="mr-1 size-3" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTypeDelete(type.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Room dialog */}
      <Dialog
        open={roomDialog}
        onOpenChange={(open) => {
          setRoomDialog(open);
          if (!open) setEditRoomId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRoomId ? "Edit Room" : "Create Room"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input
                  placeholder="e.g. 101"
                  value={roomForm.number}
                  onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Floor</Label>
                <Input
                  placeholder="e.g. 1"
                  value={roomForm.floor}
                  onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Room Type</Label>
              <Select
                value={roomForm.roomTypeId}
                onValueChange={(v) => v && setRoomForm({ ...roomForm, roomTypeId: v })}
                items={roomTypes.map((t) => ({ value: t.id, label: t.name }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={roomForm.status}
                onValueChange={(v) => v && setRoomForm({ ...roomForm, status: v })}
                items={ROOM_STATUSES.map((s) => ({
                  value: s,
                  label: getRoomStatusLabel(s),
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {getRoomStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleRoomSubmit}
              disabled={!roomForm.number || !roomForm.roomTypeId}
            >
              {editRoomId ? "Save Changes" : "Create Room"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Room type dialog */}
      <Dialog
        open={typeDialog}
        onOpenChange={(open) => {
          setTypeDialog(open);
          if (!open) setEditTypeId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTypeId ? "Edit Room Type" : "Create Room Type"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Deluxe"
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={typeForm.description}
                onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Price / Night</Label>
                <Input
                  type="number"
                  min={0}
                  value={typeForm.basePrice}
                  onChange={(e) => setTypeForm({ ...typeForm, basePrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Guests</Label>
                <Input
                  type="number"
                  min={1}
                  value={typeForm.maxGuests}
                  onChange={(e) => setTypeForm({ ...typeForm, maxGuests: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  min={0}
                  value={typeForm.sortOrder}
                  onChange={(e) => setTypeForm({ ...typeForm, sortOrder: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Amenities (comma separated)</Label>
              <Input
                placeholder="Wi-Fi, AC, Breakfast"
                value={typeForm.amenities}
                onChange={(e) => setTypeForm({ ...typeForm, amenities: e.target.value })}
              />
            </div>
            <Button onClick={handleTypeSubmit} disabled={!typeForm.name || !typeForm.basePrice}>
              {editTypeId ? "Save Changes" : "Create Room Type"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
