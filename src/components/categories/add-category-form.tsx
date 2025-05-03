
'use client';

import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import type { Category } from '@/services/categories.tsx'; // Import Category type if needed later (updated extension)

const formSchema = z.object({
  name: z.string().trim().min(1, "Category name cannot be empty").max(50, "Category name too long"),
  // Future fields: icon, color
});

type AddCategoryFormData = z.infer<typeof formSchema>;

interface AddCategoryFormProps {
  onCategoryAdded: (categoryName: string) => Promise<void> | void; // Async or sync callback
  isLoading: boolean;
}

const AddCategoryForm: FC<AddCategoryFormProps> = ({ onCategoryAdded, isLoading }) => {
  const form = useForm<AddCategoryFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  async function onSubmit(values: AddCategoryFormData) {
    await onCategoryAdded(values.name);
    form.reset(); // Reset form after successful submission (handled in parent)
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
                Enter a unique name for the new category.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Add fields for icon/color selection here later */}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Adding..." : "Add Category"}
        </Button>
      </form>
    </Form>
  );
};

export default AddCategoryForm;
