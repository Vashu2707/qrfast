import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Matches createOrderSchema's max(99) — the client must cap too, or a merge
 *  like 60+60 produces a cart that only fails at checkout, after the customer
 *  has filled in name/phone. */
export const MAX_CART_QUANTITY = 99;

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
  notes?: string;
  foodType: "VEG" | "NON_VEG" | "VEGAN";
  customizations?: {
    variant?: {
      id: string;
      name: string;
      price: number;
    } | null;
    addons?: Array<{
      id: string;
      name: string;
      price: number;
    }>;
  } | null;
}

interface Coupon {
  code: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
  minOrderAmount: number;
}

interface CartStore {
  items: CartItem[];
  tableId: string;
  tableNumber: string;
  notes: string;
  coupon: Coupon | null;

  setTable: (tableId: string, tableNumber: string) => void;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setNotes: (notes: string) => void;
  applyCoupon: (coupon: Coupon) => void;
  removeCoupon: () => void;
  clearCart: () => void;

  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getGstAmount: (gstPercentage: number) => number;
  getServiceChargeAmount: (serviceChargePercentage: number) => number;
  getTotalAmount: (gstPercentage: number, serviceChargePercentage: number) => number;
}

const generateCompositeId = (
  menuItemId: string,
  customizations?: CartItem["customizations"]
) => {
  const variantPart = customizations?.variant?.id || "novariant";
  const addonsPart = (customizations?.addons || [])
    .map((a) => a.id)
    .sort()
    .join("-") || "noaddons";
  return `${menuItemId}-${variantPart}-${addonsPart}`;
};

const clampQuantity = (quantity: number): number =>
  Math.min(MAX_CART_QUANTITY, Math.max(1, Math.floor(quantity)));

/** Re-adding an identical variant/addon combination should keep the customer's
 *  allergy/prep instructions, not silently drop them just because quantity
 *  is the only field that merges. Deduplicate an identical note so repeated
 *  adds don't grow the same instruction. */
const mergeItemNotes = (existing?: string, incoming?: string): string | undefined => {
  const prev = existing?.trim();
  const next = incoming?.trim();
  if (!prev) return next || undefined;
  if (!next || next === prev) return prev;
  const parts = prev.split(/\s*[;|]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.includes(next)) return prev;
  return `${prev}; ${next}`;
};

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      tableId: "",
      tableNumber: "",
      notes: "",
      coupon: null,

      setTable: (tableId, tableNumber) =>
        set((state) =>
          state.tableId === tableId
            ? { tableId, tableNumber }
            : // Scanned a different table's QR (or returned with a cart
              // from another table) — drop the previous table's items,
              // notes and coupon so they can't be checked out against
              // the new tableId.
              { tableId, tableNumber, items: [], notes: "", coupon: null }
        ),

      addItem: (newItem) => {
        const id = generateCompositeId(newItem.menuItemId, newItem.customizations);
        const items = get().items;
        const existingItemIndex = items.findIndex((item) => item.id === id);

        if (existingItemIndex > -1) {
          const updatedItems = [...items];
          const existing = updatedItems[existingItemIndex];
          updatedItems[existingItemIndex] = {
            ...existing,
            quantity: clampQuantity(existing.quantity + newItem.quantity),
            notes: mergeItemNotes(existing.notes, newItem.notes),
          };
          set({ items: updatedItems });
        } else {
          set({
            items: [
              ...items,
              { ...newItem, quantity: clampQuantity(newItem.quantity), id },
            ],
          });
        }
      },

      removeItem: (id) =>
        set({ items: get().items.filter((item) => item.id !== id) }),

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        // Also guards against a corrupted persisted cart (e.g. from an older
        // release) exceeding the schema's max(99).
        const capped = clampQuantity(quantity);
        set({
          items: get().items.map((item) =>
            item.id === id ? { ...item, quantity: capped } : item
          ),
        });
      },

      setNotes: (notes) => set({ notes }),

      applyCoupon: (coupon) => set({ coupon }),
      removeCoupon: () => set({ coupon: null }),
      clearCart: () => set({ items: [], notes: "", coupon: null }),

      getSubtotal: () => {
        return get().items.reduce((total, item) => {
          const basePrice = item.price;
          const addonsPrice = (item.customizations?.addons || []).reduce(
            (sum, a) => sum + a.price,
            0
          );
          return total + (basePrice + addonsPrice) * item.quantity;
        }, 0);
      },

      getDiscountAmount: () => {
        const coupon = get().coupon;
        if (!coupon) return 0;
        const subtotal = get().getSubtotal();
        if (subtotal < coupon.minOrderAmount) return 0;

        if (coupon.discountType === "PERCENTAGE") {
          return Math.round((subtotal * coupon.discountValue) / 100 * 100) / 100;
        } else {
          return Math.min(coupon.discountValue, subtotal);
        }
      },

      getGstAmount: (gstPercentage) => {
        const taxableAmount = Math.max(0, get().getSubtotal() - get().getDiscountAmount());
        return Math.round((taxableAmount * gstPercentage) / 100 * 100) / 100;
      },

      getServiceChargeAmount: (serviceChargePercentage) => {
        const taxableAmount = Math.max(0, get().getSubtotal() - get().getDiscountAmount());
        return Math.round((taxableAmount * serviceChargePercentage) / 100 * 100) / 100;
      },

      getTotalAmount: (gstPercentage, serviceChargePercentage) => {
        const subtotal = get().getSubtotal();
        const discount = get().getDiscountAmount();
        const taxableAmount = Math.max(0, subtotal - discount);
        const gst = get().getGstAmount(gstPercentage);
        const serviceCharge = get().getServiceChargeAmount(serviceChargePercentage);
        return Math.round((taxableAmount + gst + serviceCharge) * 100) / 100;
      },
    }),
    {
      name: "qr-ordering-cart-store",
    }
  )
);
