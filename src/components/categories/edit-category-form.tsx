
'use client';

import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import type { Category } from '@/services/categories';

const formSchema = z.object({
  name: z.string().trim().min(1, "Category name cannot be empty").max(50, "Category name too long"),
  // Future fields: icon, color
});

type EditCategoryFormData = z.infer<typeof formSchema>;

interface EditCategoryFormProps {
  category: Category; // The category being edited
  onCategoryUpdated: (categoryId: string, newName: string) => Promise<void> | void; // Async or sync
  isLoading: boolean;
}

const EditCategoryForm: FC<EditCategoryFormProps> = ({ category, onCategoryUpdated, isLoading }) => {
  const form = useForm<EditCategoryFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category.name,
    },
  });

  async function onSubmit(values: EditCategoryFormData) {
    await onCategoryUpdated(category.id, values.name);
    // Don't reset here, parent closes dialog
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Entertainment, Health" {...field} />
              </FormControl>
              <FormDescription>
                Enter the new name for the category.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Add fields for icon/color selection here later */}

        <Button type="submit" className="w-full" disabled={isLoading}>
           {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
};

export default EditCategoryForm;
