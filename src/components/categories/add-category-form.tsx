'use client';

import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";

const formSchema = z.object({
  name: z.string().trim().min(1, "Category name cannot be empty").max(50, "Category name too long"),
  icon: z.string().max(5, "Icon should be short (e.g., emoji or 1-2 chars).").optional(),
});

type AddCategoryFormData = z.infer<typeof formSchema>;

interface AddCategoryFormProps {
  onCategoryAdded: (categoryName: string, icon?: string) => Promise<void> | void;
  isLoading: boolean;
}

const AddCategoryForm: FC<AddCategoryFormProps> = ({ onCategoryAdded, isLoading }) => {
  const form = useForm<AddCategoryFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      icon: "",
    },
  });

  async function onSubmit(values: AddCategoryFormData) {
    await onCategoryAdded(values.name, values.icon);
    form.reset();
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

        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Icon (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 🛒, 🏠, 💡 (Type or paste an emoji)" {...field} />
              </FormControl>
              <FormDescription>
                Enter a single emoji character (e.g., 💰, 🚗).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Adding..." : "Add Category"}
        </Button>
      </form>
    </Form>
  );
};

export default AddCategoryForm;
