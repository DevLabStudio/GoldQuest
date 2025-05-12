'use client';

import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format as formatDateFns, parseISO } from 'date-fns';
import { supportedCurrencies, getCurrencySymbol } from '@/lib/currency';
import type { Category } from '@/services/categories';
import type { Account } from '@/services/account-sync';
import type { Group } from '@/services/groups'; // Import Group type
import type { SubscriptionFrequency } from '@/services/subscriptions';

const subscriptionFrequencies: SubscriptionFrequency[] = ['daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'semi-annually', 'annually'];

const formSchema = z.object({
  name: z.string().min(2, "Subscription name must be at least 2 characters").max(100, "Name too long"),
  amount: z.coerce.number({ invalid_type_error: "Amount must be a number"}).positive("Amount must be positive"),
  currency: z.string().min(3).refine(val => supportedCurrencies.includes(val.toUpperCase()), { message: "Unsupported currency" }),
  type: z.enum(['income', 'expense'], { required_error: "Subscription type is required" }),
  category: z.string().min(1, "Category is required"),
  accountId: z.string().optional(),
  groupId: z.string().optional(), // Added groupId
  startDate: z.date({ required_error: "Start date is required" }),
  frequency: z.enum(subscriptionFrequencies, { required_error: "Frequency is required" }),
  nextPaymentDate: z.date({ required_error: "Next payment date is required" }),
  notes: z.string().max(200, "Notes too long").optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().max(200, "Description too long").optional(), // Added description field
});

export type AddSubscriptionFormData = z.infer<typeof formSchema>;

interface AddSubscriptionFormProps {
  onSubmit: (data: AddSubscriptionFormData) => Promise<void> | void;
  isLoading: boolean;
  categories: Category[];
  accounts: Account[];
  groups: Group[]; // Added groups prop
  initialData?: Partial<AddSubscriptionFormData & { id?: string; startDate: Date; nextPaymentDate: Date; }>;
}

const parseTagsInput = (input: string | undefined): string[] => {
    if (!input) return [];
    return input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
};


const AddSubscriptionForm: FC<AddSubscriptionFormProps> = ({
    onSubmit: passedOnSubmit,
    isLoading,
    categories,
    accounts,
    groups, // Destructure groups
    initialData
}) => {
  const form = useForm<AddSubscriptionFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
        name: initialData.name || "",
        type: initialData.type || 'expense',
        amount: initialData.amount || undefined,
        currency: initialData.currency || 'BRL',
        category: initialData.category || undefined,
        accountId: initialData.accountId || undefined,
        groupId: initialData.groupId || undefined,
        startDate: initialData.startDate ? (typeof initialData.startDate === 'string' ? parseISO(initialData.startDate) : initialData.startDate) : new Date(),
        nextPaymentDate: initialData.nextPaymentDate ? (typeof initialData.nextPaymentDate === 'string' ? parseISO(initialData.nextPaymentDate) : initialData.nextPaymentDate) : new Date(),
        frequency: initialData.frequency || 'monthly',
        notes: initialData.notes || "",
        description: initialData.description || "",
        tags: initialData.tags || [],
    } : {
      name: "",
      type: 'expense',
      amount: undefined,
      currency: "BRL",
      category: undefined,
      accountId: undefined,
      groupId: undefined,
      startDate: new Date(),
      frequency: 'monthly',
      nextPaymentDate: new Date(),
      notes: "",
      description: "",
      tags: [],
    },
  });

  const selectedCurrency = form.watch('currency');

  const handleFormSubmit = async (data: AddSubscriptionFormData) => {
    const submissionData = {
      ...data,
      accountId: data.accountId === "__NONE_ACCOUNT__" ? undefined : data.accountId,
      groupId: data.groupId === "__NONE_GROUP__" ? undefined : data.groupId, 
    };
    await passedOnSubmit(submissionData);
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Subscription Name</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., Netflix, Gym Membership" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        
        <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                    <Input placeholder="Subscription description" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Amount ({getCurrencySymbol(selectedCurrency)})</FormLabel>
                    <FormControl>
                    <Input type="number" placeholder="0.00" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {supportedCurrencies.map((curr) => (
                        <SelectItem key={curr} value={curr}>
                            {curr} ({getCurrencySymbol(curr)})
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Associated Account (Optional)</FormLabel>
                    <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                    >
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select an account" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="__NONE_ACCOUNT__">None</SelectItem>
                        {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                            {acc.name} ({getCurrencySymbol(acc.currency)})
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
         <FormField
            control={form.control}
            name="groupId"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Associated Group (Optional)</FormLabel>
                <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                >
                <FormControl>
                    <SelectTrigger>
                    <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                </FormControl>
                <SelectContent>
                    <SelectItem value="__NONE_GROUP__">None</SelectItem>
                    {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                        {group.name}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
            )}
        />


        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                            {field.value ? formatDateFns(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {subscriptionFrequencies.map((freq) => (
                            <SelectItem key={freq} value={freq}>
                            {freq.charAt(0).toUpperCase() + freq.slice(1)}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="nextPaymentDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Next Payment Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                            {field.value ? formatDateFns(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormControl>
                    <Input placeholder="Any additional notes" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />

        <FormField
            control={form.control}
            name="tags"
            render={({ field: controllerField }) => (
                <FormItem>
                <FormLabel>Tags (Optional)</FormLabel>
                    <FormControl>
                        <Input
                            placeholder="tag1, tag2, ..."
                            value={controllerField.value?.join(', ') || ''}
                            onChange={(e) => controllerField.onChange(parseTagsInput(e.target.value))}
                        />
                    </FormControl>
                <FormDescription>
                    Separate tags with commas.
                </FormDescription>
                <FormMessage />
                </FormItem>
            )}
        />


        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (initialData?.id ? "Saving..." : "Adding...") : (initialData?.id ? "Save Changes" : "Add Subscription")}
        </Button>
      </form>
    </Form>
  );
};

export default AddSubscriptionForm;
