
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
import type { NewLoanData, LoanType } from '@/services/loans';
import { loanTypeLabels } from '@/services/loans';
import { Textarea } from '@/components/ui/textarea';

const loanTypes = Object.keys(loanTypeLabels) as LoanType[];

const formSchema = z.object({
  name: z.string().min(2, "Loan name must be at least 2 characters").max(100, "Name too long"),
  lender: z.string().min(1, "Lender name is required").max(100, "Lender name too long"),
  originalAmount: z.coerce.number({ invalid_type_error: "Amount must be a number"}).positive("Original amount must be positive"),
  currency: z.string().min(3).refine(val => supportedCurrencies.includes(val.toUpperCase()), { message: "Unsupported currency" }),
  interestRate: z.coerce.number({ invalid_type_error: "Rate must be a number"}).min(0, "Interest rate cannot be negative").max(100, "Interest rate seems too high"),
  termMonths: z.coerce.number().int().positive("Term must be a positive number of months"),
  startDate: z.date({ required_error: "Start date is required" }),
  monthlyPayment: z.coerce.number({ invalid_type_error: "Payment must be a number"}).positive("Monthly payment must be positive"),
  loanType: z.enum(loanTypes, { required_error: "Loan type is required" }),
  notes: z.string().max(500, "Notes too long").optional(),
});

export type AddLoanFormData = z.infer<typeof formSchema>;

interface AddLoanFormProps {
  onSubmit: (data: NewLoanData) => Promise<void> | void;
  isLoading: boolean;
  initialData?: Partial<AddLoanFormData & { id?: string; startDate: Date; loanType: LoanType; }>;
}

const AddLoanForm: FC<AddLoanFormProps> = ({ onSubmit: passedOnSubmit, isLoading, initialData }) => {
  const form = useForm<AddLoanFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
        ...initialData,
        startDate: initialData.startDate ? (typeof initialData.startDate === 'string' ? parseISO(initialData.startDate) : initialData.startDate) : new Date(),
        loanType: initialData.loanType || 'other',
        notes: initialData.notes || "",
        originalAmount: initialData.originalAmount ?? undefined,
        interestRate: initialData.interestRate ?? undefined,
        termMonths: initialData.termMonths ?? undefined,
        monthlyPayment: initialData.monthlyPayment ?? undefined,
    } : {
      name: "",
      lender: "",
      originalAmount: undefined,
      currency: "USD",
      interestRate: undefined,
      termMonths: undefined,
      startDate: new Date(),
      monthlyPayment: undefined,
      loanType: 'other',
      notes: "",
    },
  });

  const selectedCurrency = form.watch('currency');

  const handleFormSubmit = async (data: AddLoanFormData) => {
    const loanDataToSave: NewLoanData = {
        ...data,
        startDate: formatDateFns(data.startDate, 'yyyy-MM-dd'),
    };
    await passedOnSubmit(loanDataToSave);
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
                    <FormLabel>Loan Name</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Car Loan, Mortgage" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="lender"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Lender</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Main Street Bank" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <FormField
            control={form.control}
            name="loanType"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Loan Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                    <SelectTrigger>
                    <SelectValue placeholder="Select loan type" />
                    </SelectTrigger>
                </FormControl>
                <SelectContent>
                    {loanTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                        {loanTypeLabels[type]}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
            )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="originalAmount"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Original Amount ({getCurrencySymbol(selectedCurrency)})</FormLabel>
                    <FormControl>
                    <Input type="number" placeholder="10000.00" step="0.01" {...field} value={field.value ?? ''}/>
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
                name="interestRate"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Annual Interest Rate (%)</FormLabel>
                    <FormControl>
                    <Input type="number" placeholder="5.0" step="0.01" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="termMonths"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Loan Term (Months)</FormLabel>
                    <FormControl>
                    <Input type="number" placeholder="60" step="1" {...field} value={field.value ?? ''}/>
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                name="monthlyPayment"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Monthly Payment ({getCurrencySymbol(selectedCurrency)})</FormLabel>
                    <FormControl>
                    <Input type="number" placeholder="250.00" step="0.01" {...field} value={field.value ?? ''}/>
                    </FormControl>
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
                    <Textarea placeholder="Any additional notes about the loan..." {...field} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (initialData?.id ? "Saving..." : "Adding...") : (initialData?.id ? "Save Changes" : "Add Loan")}
        </Button>
      </form>
    </Form>
  );
};

export default AddLoanForm;
