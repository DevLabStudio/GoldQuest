
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
import { popularBanks, type BankInfo } from '@/lib/banks';
// Image import removed as we are using iconComponent
import { Textarea } from '@/components/ui/textarea';
import type { NewCreditCardData, CreditCard } from '@/services/credit-cards';

const formSchema = z.object({
  name: z.string().min(2, "Card name must be at least 2 characters").max(100, "Name too long"),
  bankName: z.string().min(1, "Bank name is required"),
  limit: z.coerce.number({ invalid_type_error: "Limit must be a number" }).positive("Credit limit must be positive"),
  currency: z.string().min(3).refine(val => supportedCurrencies.includes(val.toUpperCase()), { message: "Unsupported currency" }),
  currentBalance: z.coerce.number({ invalid_type_error: "Balance must be a number" }), // Can be negative
  paymentDueDate: z.date().optional(),
  statementClosingDay: z.coerce.number().int().min(1).max(31).optional(),
  interestRate: z.coerce.number({ invalid_type_error: "Rate must be a number" }).min(0).max(100).optional(),
  notes: z.string().max(500, "Notes too long").optional(),
});

export type AddCreditCardFormData = z.infer<typeof formSchema>;

interface AddCreditCardFormProps {
  onSubmit: (data: NewCreditCardData) => Promise<void> | void;
  isLoading: boolean;
  initialData?: CreditCard;
}

const AddCreditCardForm: FC<AddCreditCardFormProps> = ({ onSubmit: passedOnSubmit, isLoading, initialData }) => {
  const form = useForm<AddCreditCardFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
        name: initialData.name,
        bankName: initialData.bankName,
        limit: initialData.limit,
        currency: initialData.currency,
        currentBalance: initialData.currentBalance,
        paymentDueDate: initialData.paymentDueDate ? parseISO(initialData.paymentDueDate) : undefined,
        statementClosingDay: initialData.statementClosingDay,
        interestRate: initialData.interestRate,
        notes: initialData.notes || "",
    } : {
      name: "",
      bankName: "",
      limit: undefined,
      currency: "BRL",
      currentBalance: 0,
      paymentDueDate: undefined,
      statementClosingDay: undefined,
      interestRate: undefined,
      notes: "",
    },
  });

  const selectedCurrency = form.watch('currency');

  const handleFormSubmit = async (data: AddCreditCardFormData) => {
    const cardDataToSave: NewCreditCardData = {
        ...data,
        paymentDueDate: data.paymentDueDate ? formatDateFns(data.paymentDueDate, 'yyyy-MM-dd') : undefined,
    };
    await passedOnSubmit(cardDataToSave);
    if (!initialData?.id) { 
      form.reset();
    }
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
                    <FormLabel>Card Name/Nickname</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., My Visa, Nubank Rewards" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="bankName"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Bank/Issuer</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select a bank" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {popularBanks.map((bank: BankInfo) => (
                        <SelectItem key={bank.name} value={bank.name}>
                            <div className="flex items-center gap-2"> {/* Added gap-2 for spacing */}
                              {bank.iconComponent}
                              {bank.name}
                            </div>
                        </SelectItem>
                        ))}
                        <SelectItem value="Other">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 flex items-center justify-center text-muted-foreground">🏦</span>
                                Other
                            </div>
                        </SelectItem>
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
                name="limit"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Credit Limit ({getCurrencySymbol(selectedCurrency)})</FormLabel>
                    <FormControl>
                    <Input type="number" placeholder="5000.00" step="0.01" {...field} value={field.value ?? ''}/>
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
        
        <FormField
            control={form.control}
            name="currentBalance"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Current Balance ({getCurrencySymbol(selectedCurrency)})</FormLabel>
                <FormControl>
                <Input type="number" placeholder="-500.00" step="0.01" {...field} value={field.value ?? ''}/>
                </FormControl>
                <FormDescription>Enter current outstanding balance. Usually negative or zero.</FormDescription>
                <FormMessage />
            </FormItem>
            )}
        />

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="paymentDueDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Next Payment Due Date (Optional)</FormLabel>
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
                name="statementClosingDay"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Statement Closing Day (1-31, Optional)</FormLabel>
                    <FormControl>
                    <Input type="number" placeholder="e.g., 25" min="1" max="31" step="1" {...field} value={field.value ?? ''}/>
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
        
        <FormField
            control={form.control}
            name="interestRate"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Annual Interest Rate (APR %, Optional)</FormLabel>
                <FormControl>
                <Input type="number" placeholder="19.99" step="0.01" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />

        <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormControl>
                    <Textarea placeholder="Any additional notes about the credit card..." {...field} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (initialData?.id ? "Saving..." : "Adding...") : (initialData?.id ? "Save Changes" : "Add Credit Card")}
        </Button>
      </form>
    </Form>
  );
};

export default AddCreditCardForm;

