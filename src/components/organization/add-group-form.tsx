
'use client';

import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";

const formSchema = z.object({
  name: z.string().trim().min(1, "Group name cannot be empty").max(50, "Group name too long"),
});

type AddGroupFormData = z.infer<typeof formSchema>;

interface AddGroupFormProps {
  onGroupAdded: (groupName: string) => Promise<void> | void;
  isLoading: boolean;
}

const AddGroupForm: FC<AddGroupFormProps> = ({ onGroupAdded, isLoading }) => {
  const form = useForm<AddGroupFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  async function onSubmit(values: AddGroupFormData) {
    await onGroupAdded(values.name);
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
              <FormLabel>Group Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Monthly Essentials, Savings Goals" {...field} />
              </FormControl>
              <FormDescription>
                Enter a unique name for the new group.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Adding..." : "Add Group"}
        </Button>
      </form>
    </Form>
  );
};

export default AddGroupForm;
