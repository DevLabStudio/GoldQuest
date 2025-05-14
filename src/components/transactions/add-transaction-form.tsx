
'use client';

import { FC, useMemo, useEffect } from 'react';
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
import { CalendarIcon } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format as formatDateFns, parseISO } from 'date-fns';
import type { Account } from '@/services/account-sync';
import type { Category } from '@/services/categories';
import type { Tag } from '@/services/tags';
import type { Transaction } from '@/services/transactions';
import { getCurrencySymbol, supportedCurrencies } from '@/lib/currency';
import { toast } from "@/hooks/use-toast";

const transactionTypes = ['expense', 'income', 'transfer'] as const;

const baseSchema = z.object({
  description: z.string().max(100, "Description too long").optional(),
  date: z.date({ required_error: "Transaction date is required" }),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  transactionCurrency: z.string().min(3, "Transaction currency is required").refine(
      (val) => supportedCurrencies.includes(val.toUpperCase()),
      { message: "Unsupported transaction currency" }
  ),
});

const expenseIncomeSchema = baseSchema.extend({
  type: z.enum(['expense', 'income']),
  accountId: z.string().min(1, "Account is required"),
  amount: z.coerce.number({ invalid_type_error: "Amount must be a number" }).positive("Amount must be positive"),
  category: z.string().min(1, "Category is required"),
});

const transferSchema = baseSchema.extend({
  type: z.literal('transfer'),
  fromAccountId: z.string().min(1, "Source account is required"),
  toAccountId: z.string().min(1, "Destination account is required"),
  amount: z.coerce.number({ invalid_type_error: "Amount must be a number" }).positive("Transfer amount must be positive"),
  toAccountCurrency: z.string().min(3, "Destination currency is required for transfers").refine(
      (val) => supportedCurrencies.includes(val.toUpperCase()),
      { message: "Unsupported destination currency" }
  ).optional(),
  exchangeRate: z.coerce.number({ invalid_type_error: "Exchange rate must be a number" }).positive("Exchange rate must be positive").optional(),
});

const formSchema = z.discriminatedUnion('type', [
    expenseIncomeSchema,
    transferSchema
]).refine(data => {
    if (data.type === 'transfer') {
        return data.fromAccountId !== data.toAccountId;
    }
    return true;
}, {
    message: "Source and destination accounts must be different for transfers.",
    path: ['toAccountId'],
}).refine(data => {
    if (data.type === 'transfer' && data.transactionCurrency !== data.toAccountCurrency) {
        return data.exchangeRate !== undefined && data.exchangeRate > 0;
    }
    return true;
}, {
    message: "Exchange rate is required for cross-currency transfers.",
    path: ['exchangeRate'],
});


export type AddTransactionFormData = z.infer<typeof formSchema>;

interface AddTransactionFormProps {
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  onTransactionAdded: (data: Omit<Transaction, 'id'> | Transaction) => Promise<void> | void;
  onTransferAdded?: (data: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      transactionCurrency: string;
      toAccountAmount?: number;
      toAccountCurrency?: string;
      date: Date;
      description?: string;
      tags?: string[];
    }) => Promise<void> | void;
  isLoading: boolean;
  initialType?: typeof transactionTypes[number] | null; // Allow null from parent
  initialData?: Partial<AddTransactionFormData & { date: Date | string; id?: string }>;
}

const parseTagsInput = (input: string | undefined): string[] => {
    if (!input) return [];
    return input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
};

const AddTransactionForm: FC<AddTransactionFormProps> = ({
    accounts,
    categories,
    tags,
    onTransactionAdded,
    onTransferAdded,
    isLoading,
    initialType: initialTypeFromParent, // Renamed to avoid confusion with local default logic
    initialData
}) => {
  const resolvedInitialType = initialTypeFromParent ?? 'expense'; // Handle null or undefined explicitly

  const form = useForm<AddTransactionFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
        ...initialData,
        date: initialData.date ? (typeof initialData.date === 'string' ? parseISO(initialData.date.includes('T') ? initialData.date : initialData.date + 'T00:00:00Z') : initialData.date) : new Date(),
        type: initialData.type || resolvedInitialType, // Use resolvedInitialType
        tags: initialData.tags || [],
        transactionCurrency: (initialData as Transaction)?.transactionCurrency || accounts.find(acc => acc.id === (initialData as any)?.accountId)?.currency || 'BRL',
        description: initialData.description || '',
        toAccountCurrency: (initialData as any)?.toAccountCurrency || (initialData as any)?.transactionCurrency || (accounts.find(acc => acc.id === (initialData as any)?.toAccountId)?.currency),
        exchangeRate: (initialData as any)?.exchangeRate,
    } : {
      type: resolvedInitialType, // Use resolvedInitialType
      description: "",
      date: new Date(),
      accountId: accounts.length > 0 ? accounts[0].id : undefined,
      fromAccountId: accounts.length > 0 ? accounts[0].id : undefined,
      toAccountId: accounts.length > 1 ? accounts[1].id : undefined,
      amount: undefined,
      category: undefined,
      tags: [],
      transactionCurrency: accounts.length > 0 ? accounts[0].currency : 'BRL',
      toAccountCurrency: accounts.length > 1 ? accounts[1].currency : (accounts.length > 0 ? accounts[0].currency : 'BRL'),
      exchangeRate: undefined,
    },
  });

  const transactionType = form.watch('type');
  const selectedAccountId = form.watch('accountId');
  const selectedFromAccountId = form.watch('fromAccountId');
  const selectedToAccountId = form.watch('toAccountId');
  const formTransactionCurrency = form.watch('transactionCurrency');
  const formToAccountCurrency = form.watch('toAccountCurrency');

  const isEditingExisting = !!(initialData && 'id' in initialData && initialData.id);

  const selectedAccountCurrency = useMemo(() => {
      let accIdToUse: string | undefined;
      if (transactionType === 'expense' || transactionType === 'income') {
        accIdToUse = selectedAccountId;
      } else if (transactionType === 'transfer') {
        accIdToUse = selectedFromAccountId;
      }
      return accounts.find(acc => acc.id === accIdToUse)?.currency || formTransactionCurrency || 'BRL';
  }, [selectedAccountId, selectedFromAccountId, accounts, transactionType, formTransactionCurrency]);

  async function onSubmit(values: AddTransactionFormData) {
    const finalTags = values.tags || [];

    if (values.type === 'transfer') {
      if (onTransferAdded) {
        let toAccountAmount = values.amount;
        if (values.transactionCurrency !== values.toAccountCurrency && values.exchangeRate) {
            toAccountAmount = values.amount * values.exchangeRate;
        }

        await onTransferAdded({
            fromAccountId: values.fromAccountId,
            toAccountId: values.toAccountId,
            amount: values.amount,
            transactionCurrency: values.transactionCurrency,
            toAccountAmount: toAccountAmount,
            toAccountCurrency: values.toAccountCurrency || values.transactionCurrency,
            date: values.date,
            description: values.description || `Transfer to ${accounts.find(a=>a.id === values.toAccountId)?.name || 'account'}`,
            tags: finalTags,
        });
      } else {
        console.warn("onTransferAdded callback not provided.");
         toast({
             title: "Transfer Error",
             description: "Transfer functionality is not fully implemented.",
             variant: "destructive",
         });
      }
    } else {
      const transactionAmount = values.type === 'expense' ? -Math.abs(values.amount) : Math.abs(values.amount);
      const transactionData: Omit<Transaction, 'id'> | Transaction = {
        ...(initialData && (initialData as Transaction).id && { id: (initialData as Transaction).id }),
        accountId: values.accountId,
        amount: transactionAmount,
        transactionCurrency: values.transactionCurrency,
        date: formatDateFns(values.date, 'yyyy-MM-dd'),
        description: values.description || values.category || 'Transaction',
        category: values.category!,
        tags: finalTags,
      };
      await onTransactionAdded(transactionData);
    }
  }

  useEffect(() => {
    if (transactionType === 'expense' || transactionType === 'income') {
      const account = accounts.find(acc => acc.id === selectedAccountId);
      if (account && form.getValues('transactionCurrency') !== account.currency) {
        form.setValue('transactionCurrency', account.currency);
      }
    } else if (transactionType === 'transfer') {
        const fromAccount = accounts.find(acc => acc.id === selectedFromAccountId);
        if (fromAccount && form.getValues('transactionCurrency') !== fromAccount.currency) {
            form.setValue('transactionCurrency', fromAccount.currency);
        }
        const toAccount = accounts.find(acc => acc.id === selectedToAccountId);
        if (toAccount && form.getValues('toAccountCurrency') !== toAccount.currency) {
            form.setValue('toAccountCurrency', toAccount.currency);
             if (fromAccount?.currency === toAccount.currency) {
                form.setValue('exchangeRate', 1);
            }
        }
    }
  }, [selectedAccountId, selectedFromAccountId, selectedToAccountId, transactionType, accounts, form]);

  const getButtonText = () => {
    const isEditing = !!initialData?.id;

    if (isLoading) {
        return isEditing ? "Saving..." : "Adding...";
    }

    if (isEditing) {
        return "Save Changes";
    }

    // For new transactions
    let typeLabel = 'Transaction'; // Default fallback
    if (transactionType && typeof transactionType === 'string' && transactionType.length > 0) {
        typeLabel = transactionType.charAt(0).toUpperCase() + transactionType.slice(1);
    }
    return `Add ${typeLabel}`;
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
         <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transaction Type</FormLabel>
              <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    if (value === 'transfer') {
                        form.setValue('accountId', undefined);
                        form.setValue('category', undefined);
                        const fromAcc = accounts.find(a => a.id === form.getValues('fromAccountId'));
                        form.setValue('transactionCurrency', fromAcc?.currency || 'BRL');
                        const toAcc = accounts.find(a => a.id === form.getValues('toAccountId'));
                        form.setValue('toAccountCurrency', toAcc?.currency || 'BRL');
                        if (fromAcc?.currency === toAcc?.currency) {
                            form.setValue('exchangeRate', 1);
                        } else {
                            form.setValue('exchangeRate', undefined); // Clear rate for cross-currency
                        }
                    } else {
                        form.setValue('fromAccountId', undefined);
                        form.setValue('toAccountId', undefined);
                        form.setValue('toAccountCurrency', undefined);
                        form.setValue('exchangeRate', undefined);
                        const acc = accounts.find(a => a.id === form.getValues('accountId'));
                        form.setValue('transactionCurrency', acc?.currency || 'BRL');
                    }
                  }}
                  defaultValue={field.value}
                  disabled={isEditingExisting && initialData?.type === 'transfer'}
              >
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-4">
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                            <Input placeholder="Transaction description" {...field} value={field.value || ''}/>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                {transactionType === 'transfer' ? (
                <>
                    <FormField
                        control={form.control}
                        name="fromAccountId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>From Account</FormLabel>
                            <Select
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    const acc = accounts.find(a => a.id === value);
                                    if (acc) {
                                        form.setValue('transactionCurrency', acc.currency);
                                        if (acc.currency === form.getValues('toAccountCurrency')) {
                                            form.setValue('exchangeRate', 1);
                                        } else if (form.getValues('toAccountCurrency')) {
                                            form.setValue('exchangeRate', undefined); // Clear for cross-currency
                                        }
                                    }
                                }}
                                defaultValue={field.value}
                                disabled={isEditingExisting}
                            >
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
                            <Select
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    const acc = accounts.find(a => a.id === value);
                                     if (acc) {
                                        form.setValue('toAccountCurrency', acc.currency);
                                        if (acc.currency === form.getValues('transactionCurrency')) {
                                            form.setValue('exchangeRate', 1);
                                        } else if (form.getValues('transactionCurrency')) {
                                            form.setValue('exchangeRate', undefined); // Clear for cross-currency
                                        }
                                    }
                                }}
                                defaultValue={field.value}
                                disabled={isEditingExisting}
                            >
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
                </>
                ) : (
                    <FormField
                        control={form.control}
                        name="accountId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Account</FormLabel>
                            <Select
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    const acc = accounts.find(a => a.id === value);
                                    if (acc) form.setValue('transactionCurrency', acc.currency);
                                }}
                                defaultValue={field.value}
                                disabled={isEditingExisting && initialData?.type === 'transfer'}
                            >
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
                )}
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
                                className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                {field.value ? (
                                    formatDateFns(field.value, "PPP")
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
            </div>

            <div className="space-y-4">
                 <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Amount ({getCurrencySymbol(formTransactionCurrency || selectedAccountCurrency)})</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="0.00" step="0.01" {...field} value={field.value || ''}/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="transactionCurrency"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>
                            {transactionType === 'transfer' ? "From Account Currency" : "Transaction Currency"}
                        </FormLabel>
                        <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={ (transactionType !== 'transfer' && !!selectedAccountId) || (transactionType === 'transfer' && !!selectedFromAccountId) }
                        >
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select transaction currency" />
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
                        <FormDescription>
                            {transactionType === 'transfer' ?
                                "Currency of the 'From Account'." :
                                "Determined by selected Account."
                            }
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                {transactionType === 'transfer' && (
                    <>
                        <FormField
                            control={form.control}
                            name="toAccountCurrency"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>To Account Currency</FormLabel>
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                    disabled={!!selectedToAccountId}
                                >
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select destination currency" />
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
                                 <FormDescription>Currency of the 'To Account'.</FormDescription>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        {formTransactionCurrency !== formToAccountCurrency && (
                            <FormField
                                control={form.control}
                                name="exchangeRate"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Exchange Rate (1 {formTransactionCurrency} = ? {formToAccountCurrency})</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 0.92" step="0.000001" {...field} value={field.value || ''}/>
                                    </FormControl>
                                    <FormDescription>Required for cross-currency transfer.</FormDescription>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                    </>
                )}

                {transactionType !== 'transfer' && (
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
                                    .filter(cat => cat.name.toLowerCase() !== 'transfer')
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((cat) => (
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
                )}
                 <FormField
                    control={form.control}
                    name="tags"
                    render={({ field: controllerField }) => (
                        <FormItem>
                        <FormLabel>Tags</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="tag1, tag2, ..."
                                    value={controllerField.value?.join(', ') || ''}
                                    onChange={(e) => controllerField.onChange(parseTagsInput(e.target.value))}
                                />
                            </FormControl>
                        <FormDescription>
                            Separate tags with commas. Existing tags: {tags.slice(0, 5).map(t => t.name).join(', ')}{tags.length > 5 ? '...' : ''}
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {getButtonText()}
        </Button>
      </form>
    </Form>
  );
};

export default AddTransactionForm;
