
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
import { CalendarIcon, ArrowRightLeft } from 'lucide-react'; // Add transfer icon
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import type { Account } from '@/services/account-sync';
import type { Category } from '@/services/categories.tsx';
import type { Transaction } from '@/services/transactions.tsx';
import { getCurrencySymbol } from '@/lib/currency';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea

// Define allowed transaction types
const transactionTypes = ['expense', 'income', 'transfer'] as const;

// Base schema for common fields
const baseSchema = z.object({
  description: z.string().max(100, "Description too long").optional(),
  date: z.date({ required_error: "Transaction date is required" }),
  category: z.string().optional(), // Optional for transfers
});

// Schemas for each transaction type
const expenseIncomeSchema = baseSchema.extend({
  type: z.enum(['expense', 'income']),
  accountId: z.string().min(1, "Account is required"),
  amount: z.coerce.number({ invalid_type_error: "Amount must be a number" }).positive("Amount must be positive"), // Use positive, sign determined by type
  category: z.string().min(1, "Category is required"), // Required for expense/income
});

const transferSchema = baseSchema.extend({
  type: z.literal('transfer'),
  fromAccountId: z.string().min(1, "Source account is required"),
  toAccountId: z.string().min(1, "Destination account is required"),
  amount: z.coerce.number({ invalid_type_error: "Amount must be a number" }).positive("Transfer amount must be positive"),
  category: z.string().optional(), // Category is explicitly optional for transfers
});

// Discriminated union schema
const formSchema = z.discriminatedUnion('type', [
    expenseIncomeSchema,
    transferSchema
]).refine(data => {
    // Additional validation for transfer: accounts must be different
    if (data.type === 'transfer') {
        return data.fromAccountId !== data.toAccountId;
    }
    return true;
}, {
    message: "Source and destination accounts must be different for transfers.",
    path: ['toAccountId'], // Attach error to the destination field
});


type AddTransactionFormData = z.infer<typeof formSchema>;

interface AddTransactionFormProps {
  accounts: Account[];
  categories: Category[];
  // Callback receives data in the format needed by addTransaction or a specific transfer function
  onTransactionAdded: (data: Omit<Transaction, 'id'>) => Promise<void> | void;
  onTransferAdded?: (data: { fromAccountId: string; toAccountId: string; amount: number; date: Date; description?: string }) => Promise<void> | void;
  isLoading: boolean;
  initialType?: typeof transactionTypes[number]; // Optional initial type
}

const AddTransactionForm: FC<AddTransactionFormProps> = ({
    accounts,
    categories,
    onTransactionAdded,
    onTransferAdded,
    isLoading,
    initialType = 'expense' // Default to expense
}) => {
  const form = useForm<AddTransactionFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: initialType,
      description: "",
      date: new Date(), // Default to today
      // Default other fields based on initialType or leave undefined
      accountId: accounts.length > 0 ? accounts[0].id : undefined,
      fromAccountId: accounts.length > 0 ? accounts[0].id : undefined,
      toAccountId: accounts.length > 1 ? accounts[1].id : undefined,
      amount: undefined, // No default amount
      category: undefined,
    },
  });

  const transactionType = form.watch('type');
  const selectedAccountId = form.watch('accountId'); // For expense/income
  const selectedFromAccountId = form.watch('fromAccountId'); // For transfer
  const selectedToAccountId = form.watch('toAccountId'); // For transfer

  // Get currency for the selected account (expense/income)
  const selectedAccountCurrency = useMemo(() => {
      if (transactionType === 'expense' || transactionType === 'income') {
        return accounts.find(acc => acc.id === selectedAccountId)?.currency || 'BRL';
      }
      return 'BRL'; // Default for transfer or if not found
  }, [selectedAccountId, accounts, transactionType]);

  // Get currency for the "from" account (transfer)
    const fromAccountCurrency = useMemo(() => {
        if (transactionType === 'transfer') {
            return accounts.find(acc => acc.id === selectedFromAccountId)?.currency || 'BRL';
        }
        return 'BRL';
    }, [selectedFromAccountId, accounts, transactionType]);


  async function onSubmit(values: AddTransactionFormData) {
    if (values.type === 'transfer') {
      // Handle transfer
      if (onTransferAdded) {
        await onTransferAdded({
            fromAccountId: values.fromAccountId,
            toAccountId: values.toAccountId,
            amount: values.amount, // Already positive
            date: values.date,
            description: values.description || `Transfer to ${accounts.find(a=>a.id === values.toAccountId)?.name || 'account'}`,
        });
         console.log("Transfer data:", values);
         // TODO: Implement transfer logic (add two transactions)
      } else {
        console.warn("onTransferAdded callback not provided.");
      }
    } else {
      // Handle expense or income
      const transactionAmount = values.type === 'expense' ? -Math.abs(values.amount) : Math.abs(values.amount);
      const transactionData: Omit<Transaction, 'id'> = {
        accountId: values.accountId,
        amount: transactionAmount,
        date: format(values.date, 'yyyy-MM-dd'), // Format date to string
        description: values.description || values.category, // Use category if description empty
        category: values.category,
      };
      await onTransactionAdded(transactionData);
       console.log("Expense/Income data:", transactionData);
    }
    form.reset(); // Reset form after successful submission
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
         {/* Transaction Type Selector */}
         <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transaction Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select transaction type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Conditional Fields based on Type */}
        {transactionType === 'transfer' ? (
          <>
            {/* Transfer Specific Fields */}
            <div className="grid grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="fromAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Account</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id} disabled={acc.id === selectedToAccountId}>
                            {acc.name} ({getCurrencySymbol(acc.currency)})
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
                name="toAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Account</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id} disabled={acc.id === selectedFromAccountId}>
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
             {/* Amount Field for Transfer */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    {/* Label indicates currency of the 'From' account */}
                    <FormLabel>Amount ({getCurrencySymbol(fromAccountCurrency)})</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </>
        ) : (
           <>
             {/* Expense/Income Specific Fields */}
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
              {/* Amount Field for Expense/Income */}
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Amount ({getCurrencySymbol(selectedAccountCurrency)})</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="0.00" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
               {/* Category Field (Required for Expense/Income) */}
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
                        {categories
                            .sort((a, b) => a.name.localeCompare(b.name)) // Sort categories alphabetically
                            .map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
                                {cat.name}
                            </SelectItem>
                        ))}
                        {/* Option to add a new category could go here */}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
           </>
        )}

         {/* Common Fields: Date and Description */}
          <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Add a note or description..."
                  className="resize-none" // Optional: prevent resizing
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />


        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Adding..." : `Add ${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}`}
        </Button>
      </form>
    </Form>
  );
};

export default AddTransactionForm;
