
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
  icon: z.string().max(5, "Icon should be short (e.g., emoji or 1-2 chars).").optional(),
});

type EditCategoryFormData = z.infer<typeof formSchema>;

interface EditCategoryFormProps {
  category: Category;
  onCategoryUpdated: (categoryId: string, newName: string, newIcon?: string) => Promise<void> | void;
  isLoading: boolean;
}

const EditCategoryForm: FC<EditCategoryFormProps> = ({ category, onCategoryUpdated, isLoading }) => {
  const form = useForm<EditCategoryFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category.name,
      icon: category.icon || "",
    },
  });

  async function onSubmit(values: EditCategoryFormData) {
    await onCategoryUpdated(category.id, values.name, values.icon);
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

        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Icon (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 🛒 or Home" {...field} />
              </FormControl>
              <FormDescription>
                Enter a short icon or emoji (e.g., 💰, 🚗). Leave blank to use default.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
           {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
};

export default EditCategoryForm;
