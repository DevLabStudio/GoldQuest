
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Group } from '@/services/groups';
import type { Category } from '@/services/categories';
import { getCategoryStyle } from '@/services/categories';

interface ManageGroupCategoriesDialogProps {
  group: Group;
  allCategories: Category[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (groupId: string, selectedCategoryIds: string[]) => Promise<void> | void;
  isLoading: boolean;
}

const ManageGroupCategoriesDialog: FC<ManageGroupCategoriesDialogProps> = ({
  group,
  allCategories,
  isOpen,
  onOpenChange,
  onSave,
  isLoading
}) => {
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (group) {
      setSelectedCategoryIds(group.categoryIds || []);
    }
  }, [group]);

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSaveChanges = async () => {
    await onSave(group.id, selectedCategoryIds);
    // Parent will close dialog on successful save
  };

  if (!group) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Categories for "{group.name}"</DialogTitle>
          <DialogDescription>
            Select categories to include in this group.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-72 w-full rounded-md border p-4">
          <div className="space-y-2">
            {allCategories.sort((a,b) => a.name.localeCompare(b.name)).map(category => {
              const { icon: CategoryIcon } = getCategoryStyle(category.name);
              return (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`cat-${category.id}`}
                  checked={selectedCategoryIds.includes(category.id)}
                  onCheckedChange={() => handleCategoryToggle(category.id)}
                />
                <Label
                  htmlFor={`cat-${category.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center"
                >
                  <CategoryIcon /> <span className="ml-1">{category.name}</span>
                </Label>
              </div>
            )}
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSaveChanges} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageGroupCategoriesDialog;
