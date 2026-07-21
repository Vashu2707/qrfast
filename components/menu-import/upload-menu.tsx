"use client";

import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, ImageIcon, Loader2 } from "lucide-react";

interface UploadMenuProps {
  onFileSelect: (file: File) => void;
  scanning: boolean;
}

export function UploadMenu({ onFileSelect, scanning }: UploadMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onFileSelect]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-8 transition-colors hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer"
      onClick={() => !scanning && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleChange}
        className="hidden"
      />

      {scanning ? (
        <Loader2 className="size-10 text-blue-500 animate-spin" />
      ) : (
        <div className="size-14 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
          <Upload className="size-6 text-blue-500" />
        </div>
      )}

      <div className="text-center space-y-1">
        <p className="text-sm font-bold text-gray-900 dark:text-white">
          {scanning ? "Scanning menu..." : "Upload Menu Image"}
        </p>
        <p className="text-xs text-gray-500">
          {scanning
            ? "AI is extracting menu items from your image"
            : "Drag & drop or click to select. PNG, JPG up to 10MB."}
        </p>
      </div>

      {!scanning && (
        <Button
          variant="outline"
          size="sm"
          className="text-xs font-bold"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          <ImageIcon className="mr-1.5 size-3.5" />
          Choose Image
        </Button>
      )}
    </div>
  );
}
