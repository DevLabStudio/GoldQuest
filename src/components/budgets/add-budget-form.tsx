
'use client';

import type { FC } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format as formatDateFns, parseISO, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { supportedCurrencies, getCurrencySymbol } from '@/lib/currency';
import type { Category } from '@/services/categories';
import type { Group } from '@/services/groups';
import type { BudgetPeriod, NewBudgetData, Budget } from '@/services/budgets';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import React, { useMemo, useEffect } from 'react';


const budgetPeriods: BudgetPeriod[] = ['monthly', 'quarterly', 'annually', 'custom'];

const formSchema = z.object({
  name: z.string().min(2, "Budget name must be at least 2 characters").max(100, "Name too long"),
  amount: z.coerce.number({ invalid_type_error: "Amount must be a number" }).positive("Amount must be positive"),
  currency: z.string().min(3).refine(val => supportedCurrencies.includes(val.toUpperCase()), { message: "Unsupported currency" }),
  period: z.enum(budgetPeriods, { required_error: "Budget period is required" }),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date().optional(),
  appliesTo: z.enum(['categories', 'groups'], { required_error: "Budget must apply to categories or groups" }),
  selectedIds: z.array(z.string()).min(1, "Please select at least one category or group"),
  notes: z.string().max(500, "Notes too long").optional(),
}).refine(data => {
  if (data.period === 'custom' && !data.endDate) {
    return false;
  }
  if (data.period === 'custom' && data.endDate && data.startDate > data.endDate) {
    return false;
  }
  return true;
}, {
  message: "End date is required for custom period and must be after start date.",
  path: ['endDate'],
});

export type AddBudgetFormData = z.infer<typeof formSchema>;

interface AddBudgetFormProps {
  onSubmit: (data: NewBudgetData) => Promise<void> | void;
  isLoading: boolean;
  categories: Category[];
  groups: Group[];
  initialData?: Budget;
}

const AddBudgetForm: FC<AddBudgetFormProps> = ({ onSubmit: passedOnSubmit, isLoading, categories, groups, initialData }) => {
  const form = useForm<AddBudgetFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      ...initialData,
      startDate: initialData.startDate ? parseISO(initialData.startDate) : startOfMonth(new Date()),
      endDate: initialData.endDate ? parseISO(initialData.endDate) : undefined,
      selectedIds: initialData.selectedIds || [],
      notes: initialData.notes || "",
    } : {
      name: "",
      amount: undefined,
      currency: "BRL",
      period: 'monthly',
      startDate: startOfMonth(new Date()),
      endDate: undefined,
      appliesTo: 'categories',
      selectedIds: [],
      notes: "",
    },
  });

  const selectedCurrency = form.watch('currency');
  const selectedPeriod = form.watch('period');
  const appliesTo = form.watch('appliesTo');

  const itemsToSelectFrom = useMemo(() => {
    return appliesTo === 'categories' ? categories : groups;
  }, [appliesTo, categories, groups]);

  const handleFormSubmit = async (data: AddBudgetFormData) => {
    const budgetDataToSave: NewBudgetData = {
      ...data,
      startDate: formatDateFns(data.startDate, 'yyyy-MM-dd'),
      endDate: data.period === 'custom' && data.endDate ? formatDateFns(data.endDate, 'yyyy-MM-dd') : null,
    };
    await passedOnSubmit(budgetDataToSave);
    if (!initialData?.id) {
      form.reset({
        name: "", amount: undefined, currency: "BRL", period: 'monthly',
        startDate: startOfMonth(new Date()), endDate: undefined,
        appliesTo: 'categories', selectedIds: [], notes: ""
      });
    }
  };

  useEffect(() => {
    // Reset selectedIds when appliesTo changes
    form.setValue('selectedIds', []);
  }, [appliesTo, form]);
  
  useEffect(() => {
    if (selectedPeriod !== 'custom') {
      form.setValue('endDate', undefined);
      form.clearErrors('endDate'); // Clear any previous errors for endDate
    }
  }, [selectedPeriod, form]);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Budget Name</FormLabel>
                <FormControl><Input placeholder="e.g., Monthly Groceries, Vacation Fund" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount ({getCurrencySymbol(selectedCurrency)})</FormLabel>
                <FormControl><Input type="number" placeholder="500.00" step="0.01" {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {supportedCurrencies.map((curr) => (
                      <SelectItem key={curr} value={curr}>{curr} ({getCurrencySymbol(curr)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="period"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {budgetPeriods.map((p) => (
                      <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Start Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
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
          {selectedPeriod === 'custom' && (
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>End Date (Custom Period)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? formatDateFns(field.value, "PPP") : <span>Pick end date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => form.getValues("startDate") && date < form.getValues("startDate") } initialFocus/>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
                control={form.control}
                name="appliesTo"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Applies To</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Track by..." /></SelectTrigger></FormControl>
                    <SelectContent>
                        <SelectItem value="categories">Categories</SelectItem>
                        <SelectItem value="groups">Groups</SelectItem>
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="selectedIds"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Select {appliesTo === 'categories' ? 'Categories' : 'Groups'}</FormLabel>
                         <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn("w-full justify-between", !field.value?.length && "text-muted-foreground")}
                                >
                                    {field.value?.length
                                    ? `${field.value.length} selected`
                                    : `Select ${appliesTo}...`}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[300px] p-0">
                                <Command>
                                <CommandInput placeholder={`Search ${appliesTo}...`} />
                                <CommandList>
                                    <CommandEmpty>No {appliesTo} found.</CommandEmpty>
                                    <CommandGroup>
                                    <ScrollArea className="h-48">
                                    {itemsToSelectFrom.map((item) => (
                                        <CommandItem
                                        key={item.id}
                                        value={item.name}
                                        onSelect={() => {
                                            const currentSelection = field.value || [];
                                            const isSelected = currentSelection.includes(item.id);
                                            if (isSelected) {
                                            field.onChange(currentSelection.filter(id => id !== item.id));
                                            } else {
                                            field.onChange([...currentSelection, item.id]);
                                            }
                                        }}
                                        >
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            (field.value || []).includes(item.id) ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {item.name}
                                        </CommandItem>
                                    ))}
                                    </ScrollArea>
                                    </CommandGroup>
                                </CommandList>
                                </Command>
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
              <FormControl><Textarea placeholder="Any additional notes about this budget..." {...field} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (initialData?.id ? "Saving..." : "Adding...") : (initialData?.id ? "Save Changes" : "Add Budget")}
        </Button>
      </form>
    </Form>
  );
};

export default AddBudgetForm;
