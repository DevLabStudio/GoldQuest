
'use client';

import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";

const formSchema = z.object({
  name: z.string().trim().min(1, "Tag name cannot be empty").max(30, "Tag name too long"),
});

type AddTagFormData = z.infer<typeof formSchema>;

interface AddTagFormProps {
  onTagAdded: (tagName: string) => Promise<void> | void; // Async or sync callback
  isLoading: boolean;
}

const AddTagForm: FC<AddTagFormProps> = ({ onTagAdded, isLoading }) => {
  const form = useForm<AddTagFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  async function onSubmit(values: AddTagFormData) {
    await onTagAdded(values.name);
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
              <FormLabel>Tag Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Travel, Q1-Budget" {...field} />
              </FormControl>
              <FormDescription>
                Enter a unique name for the new tag.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Adding..." : "Add Tag"}
        </Button>
      </form>
    </Form>
  );
};

export default AddTagForm;
