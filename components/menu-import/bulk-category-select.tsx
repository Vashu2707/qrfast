"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag } from "lucide-react";

interface BulkCategorySelectProps {
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  onBulkSelect: (categoryId: string) => void;
}

export function BulkCategorySelect({
  categories,
  onBulkSelect,
}: BulkCategorySelectProps) {
  const [value, setValue] = useState<string>("");

  const handleChange = (v: string | null) => {
    if (v) {
      setValue(v);
      onBulkSelect(v);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Tag className="size-3.5 text-gray-400 shrink-0" />
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="h-7 text-xs border-gray-200 rounded-lg w-44 bg-gray-50/50">
          <SelectValue placeholder="Set category for selected">
            {() => {
              if (!value) return "Set category for selected";
              const cat = categories.find((c) => c.id === value);
              return cat?.name ?? value;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
