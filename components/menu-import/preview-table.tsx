"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MenuImportItem } from "@/types/menu-import";
import type { FoodType } from "@prisma/client";

interface PreviewTableProps {
  items: MenuImportItem[];
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleItem: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<MenuImportItem>) => void;
}

export function PreviewTable({
  items,
  categories,
  allSelected,
  onToggleAll,
  onToggleItem,
  onUpdateItem,
}: PreviewTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
            <th className="px-3 py-2.5 text-left font-bold text-gray-600 dark:text-gray-400 w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Select all"
              />
            </th>
            <th className="px-3 py-2.5 text-left font-bold text-gray-600 dark:text-gray-400">Name</th>
            <th className="px-3 py-2.5 text-left font-bold text-gray-600 dark:text-gray-400">Description</th>
            <th className="px-3 py-2.5 text-right font-bold text-gray-600 dark:text-gray-400 w-20">Price</th>
            <th className="px-3 py-2.5 text-center font-bold text-gray-600 dark:text-gray-400 w-24">Food Type</th>
            <th className="px-3 py-2.5 text-center font-bold text-gray-600 dark:text-gray-400 w-16">Spicy</th>
            <th className="px-3 py-2.5 text-left font-bold text-gray-600 dark:text-gray-400">Ingredients</th>
            <th className="px-3 py-2.5 text-left font-bold text-gray-600 dark:text-gray-400">Allergens</th>
            <th className="px-3 py-2.5 text-left font-bold text-gray-600 dark:text-gray-400 w-36">Category</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-900">
          {items.map((item) => (
            <tr
              key={item.id}
              className={cn(
                "bg-white dark:bg-gray-950 transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-900/50",
                !item.selected && "opacity-50"
              )}
            >
              <td className="px-3 py-2">
                <Checkbox
                  checked={item.selected}
                  onCheckedChange={() => onToggleItem(item.id)}
                  aria-label={`Select ${item.name}`}
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  value={item.name}
                  onChange={(e) => onUpdateItem(item.id, { name: e.target.value })}
                  className="h-7 text-xs border-0 bg-transparent p-0 font-bold focus-visible:ring-0 focus-visible:border-gray-300 shadow-none"
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  value={item.description}
                  onChange={(e) => onUpdateItem(item.id, { description: e.target.value })}
                  className="h-7 text-xs border-0 bg-transparent p-0 text-gray-500 focus-visible:ring-0 focus-visible:border-gray-300 shadow-none"
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={item.price}
                  onChange={(e) =>
                    onUpdateItem(item.id, { price: parseFloat(e.target.value) || 0 })
                  }
                  className="h-7 text-xs border-0 bg-transparent p-0 text-right font-bold focus-visible:ring-0 focus-visible:border-gray-300 shadow-none"
                />
              </td>
              <td className="px-3 py-2 text-center">
                <FoodTypeSelect
                  value={item.foodType}
                  onChange={(foodType) => onUpdateItem(item.id, { foodType })}
                />
              </td>
              <td className="px-3 py-2 text-center">
                <SpicyBadge level={item.spicyLevel} />
              </td>
              <td className="px-3 py-2">
                <Input
                  value={item.ingredients.join(", ")}
                  onChange={(e) =>
                    onUpdateItem(item.id, {
                      ingredients: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="e.g. Tomato, Cheese"
                  className="h-7 text-xs border-0 bg-transparent p-0 text-gray-500 focus-visible:ring-0 focus-visible:border-gray-300 shadow-none"
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  value={item.allergens.join(", ")}
                  onChange={(e) =>
                    onUpdateItem(item.id, {
                      allergens: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="e.g. Dairy, Gluten"
                  className="h-7 text-xs border-0 bg-transparent p-0 text-gray-500 focus-visible:ring-0 focus-visible:border-gray-300 shadow-none"
                />
              </td>
              <td className="px-3 py-2">
                <select
                  value={item.categoryId}
                  onChange={(e) => onUpdateItem(item.id, { categoryId: e.target.value })}
                  className={cn(
                    "h-7 w-full rounded-md border bg-transparent px-2 text-xs outline-none cursor-pointer",
                    item.categoryId
                      ? "border-gray-200 dark:border-gray-800"
                      : "border-dashed border-red-300 text-gray-400"
                  )}
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FoodTypeSelect({
  value,
  onChange,
}: {
  value: FoodType;
  onChange: (v: FoodType) => void;
}) {
  const options: { value: FoodType; label: string; dot: string }[] = [
    { value: "VEG", label: "V", dot: "bg-green-600" },
    { value: "NON_VEG", label: "NV", dot: "bg-red-600" },
    { value: "VEGAN", label: "VG", dot: "bg-emerald-500" },
  ];

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-800 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors",
            value === opt.value
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "text-gray-400 hover:text-gray-600"
          )}
          title={opt.value.replace("_", " ")}
        >
          <span className={cn("inline-block size-1.5 rounded-full mr-0.5", opt.dot)} />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SpicyBadge({ level }: { level: number }) {
  if (level === 0) {
    return <span className="text-[10px] text-gray-400 font-bold">0</span>;
  }
  return (
    <Badge
      className={cn(
        "text-[9px] font-bold px-1.5 py-0 border-0 scale-90",
        level === 1 && "bg-yellow-50 text-yellow-700",
        level === 2 && "bg-orange-50 text-orange-700",
        level === 3 && "bg-red-50 text-red-700"
      )}
    >
      {"🌶️".repeat(level)}
    </Badge>
  );
}
