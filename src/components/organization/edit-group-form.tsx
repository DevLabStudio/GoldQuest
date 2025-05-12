'use client';

import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import type { Group } from '@/services/groups';

const formSchema = z.object({
  name: z.string().trim().min(1, "Group name cannot be empty").max(50, "Group name too long"),
});

type EditGroupFormData = z.infer<typeof formSchema>;

interface EditGroupFormProps {
  group: Group;
  onGroupUpdated: (groupId: string, newName: string) => Promise<void> | void;
  isLoading: boolean;
}

const EditGroupForm: FC<EditGroupFormProps> = ({ group, onGroupUpdated, isLoading }) => {
  const form = useForm<EditGroupFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: group?.name || "",
    },
  });

  async function onSubmit(values: EditGroupFormData) {
    if (!group) return;
    await onGroupUpdated(group.id, values.name);
  }
  
  if (!group) {
      return <p className="text-destructive">Error: Group data is not available.</p>;
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
                Enter the new name for the group.
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

export default EditGroupForm;
