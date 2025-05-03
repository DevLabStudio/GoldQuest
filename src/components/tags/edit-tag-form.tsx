
'use client';

import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import type { Tag } from '@/services/tags.tsx';

const formSchema = z.object({
  name: z.string().trim().min(1, "Tag name cannot be empty").max(30, "Tag name too long"),
});

type EditTagFormData = z.infer<typeof formSchema>;

interface EditTagFormProps {
  tag: Tag; // The tag being edited
  onTagUpdated: (tagId: string, newName: string) => Promise<void> | void; // Async or sync
  isLoading: boolean;
}

const EditTagForm: FC<EditTagFormProps> = ({ tag, onTagUpdated, isLoading }) => {
  const form = useForm<EditTagFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: tag.name,
    },
  });

  async function onSubmit(values: EditTagFormData) {
    await onTagUpdated(tag.id, values.name);
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
              <FormLabel>Tag Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Travel, Q1-Budget" {...field} />
              </FormControl>
              <FormDescription>
                Enter the new name for the tag.
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

export default EditTagForm;
