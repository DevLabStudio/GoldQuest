'use client';

import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import type { Category } from '@/services/categories';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Picker, { type EmojiClickData, Theme as EmojiTheme, SuggestionMode } from 'emoji-picker-react';
import { Smile } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

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
  const { theme } = useAuthContext(); // Get theme from AuthContext
  const form = useForm<EditCategoryFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category?.name || "",
      icon: category?.icon || "",
    },
  });

  async function onSubmit(values: EditCategoryFormData) {
    if (!category) return;
    await onCategoryUpdated(category.id, values.name, values.icon);
  }

  const onEmojiClick = (emojiData: EmojiClickData, event: MouseEvent) => {
    form.setValue('icon', emojiData.emoji);
  };

  const emojiPickerTheme = theme === 'dark' ? EmojiTheme.DARK : EmojiTheme.LIGHT;

  if (!category) {
      return <p className="text-destructive">Error: Category data is not available.</p>;
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
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Selected Emoji"
                  value={field.value || ""}
                  readOnly
                  className="flex-grow"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" type="button">
                      <Smile className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-0">
                     <Picker
                        onEmojiClick={onEmojiClick}
                        theme={emojiPickerTheme}
                        autoFocusSearch={false}
                        lazyLoadEmojis={true}
                        suggestedEmojisMode={SuggestionMode.RECENT}
                        searchPlaceHolder="Search emoji"
                        previewConfig={{showPreview: false}}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <FormDescription>
                Click the smiley face to select an emoji. Leave blank to use default Lucide icon.
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
