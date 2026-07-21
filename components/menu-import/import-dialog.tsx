"use client";

import { useCallback, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCategories } from "@/actions/categories";
import { useMenuImport } from "@/hooks/use-menu-import";
import { UploadMenu } from "./upload-menu";
import { PreviewTable } from "./preview-table";
import { BulkCategorySelect } from "./bulk-category-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const queryClient = useQueryClient();
  const [hasOpened, setHasOpened] = useState(false);

  const {
    step,
    previewUrl,
    items,
    scanning,
    saving,
    error,
    importedCount,
    selectedCount,
    allSelected,
    handleFileSelect,
    updateItem,
    toggleItem,
    toggleAll,
    setBulkCategory,
    handleImport,
    reset,
  } = useMenuImport();

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
    enabled: open,
  });

  const handleClose = useCallback(
    (o: boolean) => {
      if (!o) {
        if (step === "done") {
          queryClient.invalidateQueries({ queryKey: ["menuItems"] });
          queryClient.invalidateQueries({ queryKey: ["categories"] });
        }
        setTimeout(() => reset(), 200);
      }
      onOpenChange(o);
    },
    [onOpenChange, reset, step, queryClient]
  );

  const handleImportClick = useCallback(async () => {
    await handleImport();
  }, [handleImport]);

  useEffect(() => {
    if (step === "done" && importedCount > 0) {
      toast.success(`Successfully imported ${importedCount} menu items.`);
    }
  }, [step, importedCount]);

  const hasMissingCategories =
    step === "preview" &&
    items.some((i) => i.selected && !i.categoryId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <DialogTitle className="flex items-center gap-2 font-extrabold">
            <Sparkles className="size-5 text-blue-500" />
            AI Menu Import
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {/* Upload Step */}
          {step === "upload" && (
            <>
              <UploadMenu onFileSelect={handleFileSelect} scanning={scanning} />
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3">
                  <AlertCircle className="size-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-700 dark:text-red-400 font-medium">{error}</p>
                </div>
              )}
            </>
          )}

          {/* Preview Step */}
          {step === "preview" && (
            <>
              {scanning && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      Scanning menu...
                    </p>
                    <p className="text-xs text-gray-500">
                      AI is extracting items from your image
                    </p>
                  </div>
                </div>
              )}

              {!scanning && items.length > 0 && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          reset();
                        }}
                        className="text-xs font-bold"
                      >
                        <ArrowLeft className="mr-1 size-3.5" />
                        New Image
                      </Button>
                      <p className="text-xs text-gray-500">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {items.length}
                        </span>{" "}
                        items found
                        {selectedCount < items.length && (
                          <>
                            ,{" "}
                            <span className="font-bold text-blue-600">
                              {selectedCount}
                            </span>{" "}
                            selected
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <BulkCategorySelect
                        categories={categories}
                        onBulkSelect={setBulkCategory}
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3">
                      <AlertCircle className="size-4 text-red-500 shrink-0" />
                      <p className="text-xs text-red-700 dark:text-red-400 font-medium">{error}</p>
                    </div>
                  )}

                  <PreviewTable
                    items={items}
                    categories={categories}
                    allSelected={allSelected}
                    onToggleAll={toggleAll}
                    onToggleItem={toggleItem}
                    onUpdateItem={updateItem}
                  />
                </>
              )}

              {!scanning && items.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="size-10 text-gray-300 mb-3" />
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    No items found
                  </p>
                  <p className="text-xs text-gray-500 max-w-xs mt-1">
                    The AI could not detect any menu items. Please try a clearer photo.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 text-xs font-bold"
                    onClick={reset}
                  >
                    <RotateCcw className="mr-1 size-3.5" />
                    Try Again
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Done Step */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-16 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="size-8 text-green-600" />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                Import Complete
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Successfully imported{" "}
                <span className="font-bold text-green-600">{importedCount}</span>{" "}
                menu items.
              </p>
              <div className="flex gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    reset();
                  }}
                  className="text-xs font-bold"
                >
                  <Sparkles className="mr-1 size-3.5" />
                  Import More
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleClose(false)}
                  className="text-xs font-bold"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step === "preview" && !scanning && items.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {hasMissingCategories && (
                <span className="text-amber-600 font-medium">
                  Assign categories to all selected items before importing.
                </span>
              )}
            </p>
            <Button
              onClick={handleImportClick}
              disabled={saving || selectedCount === 0 || hasMissingCategories}
              className="text-xs font-bold"
              size="sm"
            >
              {saving ? (
                <>
                  <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                  Importing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 size-3.5" />
                  Import Selected Items
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
