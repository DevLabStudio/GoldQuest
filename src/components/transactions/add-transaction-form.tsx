
'use client';

import { FC, useMemo, useEffect, useState } from 'react';
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
import { getCurrencySymbol, supportedCurrencies, convertCurrency, formatCurrency } from '@/lib/currency'; // Ensure this import is correct
import { toast } from "@/hooks/use-toast";
import { getSubscriptions, type Subscription } from '@/services/subscriptions';
import { Skeleton } from '@/components/ui/skeleton';

const transactionTypes = ['expense', 'income', 'transfer'] as const;

const baseSchema = z.object({
  description: z.string().max(100, "Description too long").optional(),
  date: z.date({ required_error: "Transaction date is required" }),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  subscriptionId: z.string().optional().nullable(),
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
  toAccountAmount: z.coerce.number({ invalid_type_error: "Destination amount must be a number" }).positive("Destination amount must be positive").optional(),
  subscriptionId: z.string().optional().nullable().refine(() => false, {
    message: "Transfers cannot be linked to subscriptions.",
  }),
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
    if (data.type === 'transfer' && data.transactionCurrency && data.toAccountCurrency && data.transactionCurrency.toUpperCase() !== data.toAccountCurrency.toUpperCase()) {
        return data.toAccountAmount !== undefined && data.toAccountAmount > 0;
    }
    return true;
}, {
    message: "Destination amount is required and must be positive for cross-currency transfers.",
    path: ['toAccountAmount'],
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
      toAccountAmount: number;
      toAccountCurrency: string;
      date: Date;
      description?: string;
      tags?: string[];
      subscriptionId?: string | null;
    }) => Promise<void> | void;
  isLoading: boolean;
  initialType?: typeof transactionTypes[number] | null;
  initialData?: Partial<AddTransactionFormData & { date: Date | string; id?: string; subscriptionId?: string | null }>;
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
    isLoading: propIsLoading,
    initialType: initialTypeFromParent,
    initialData
}) => {
  const resolvedInitialType = initialTypeFromParent ?? (initialData?.type || 'expense');
  const [calculatedRate, setCalculatedRate] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(propIsLoading);

  useEffect(() => {
    setIsFormLoading(propIsLoading);
  }, [propIsLoading]);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      setIsLoadingSubscriptions(true);
      try {
        const fetchedSubs = await getSubscriptions();
        setSubscriptions(fetchedSubs);
      } catch (error) {
        console.error("Failed to fetch subscriptions:", error);
        toast({ title: "Error", description: "Could not load subscriptions for linking.", variant: "destructive" });
      } finally {
        setIsLoadingSubscriptions(false);
      }
    };
    fetchSubscriptions();
  }, []);


  const form = useForm<AddTransactionFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: (() => {
        if (initialData) {
            const base = {
                ...initialData,
                date: initialData.date ? (typeof initialData.date === 'string' ? parseISO(initialData.date.includes('T') ? initialData.date : initialData.date + 'T00:00:00Z') : initialData.date) : new Date(),
                type: initialData.type || resolvedInitialType,
                tags: initialData.tags || [],
                description: initialData.description || '',
                transactionCurrency: (initialData as Transaction)?.transactionCurrency || 'BRL',
                toAccountCurrency: (initialData as any)?.toAccountCurrency,
                toAccountAmount: (initialData as any)?.toAccountAmount,
                subscriptionId: initialData.subscriptionId === undefined ? null : initialData.subscriptionId,
            };
            if (base.type !== 'transfer' && (initialData as any).accountId) {
                const acc = accounts.find(a => a.id === (initialData as any).accountId);
                base.transactionCurrency = (initialData as Transaction)?.transactionCurrency || acc?.primaryCurrency || 'BRL';
            } else if (base.type === 'transfer') {
                const fromAcc = accounts.find(a => a.id === (initialData as any).fromAccountId);
                const toAcc = accounts.find(a => a.id === (initialData as any).toAccountId);
                base.transactionCurrency = (initialData as Transaction)?.transactionCurrency || fromAcc?.primaryCurrency || 'BRL';
                base.toAccountCurrency = (initialData as any)?.toAccountCurrency || toAcc?.primaryCurrency || 'BRL';
            }
            return base;
        }
        return {
            type: resolvedInitialType, description: "", date: new Date(),
            accountId: accounts[0]?.id,
            fromAccountId: accounts[0]?.id,
            toAccountId: accounts[1]?.id,
            amount: undefined, category: undefined, tags: [],
            subscriptionId: null,
            transactionCurrency: accounts[0]?.primaryCurrency || 'BRL',
            toAccountCurrency: accounts[1]?.primaryCurrency || accounts[0]?.primaryCurrency || 'BRL',
            toAccountAmount: undefined,
        };
    })(),
  });

  const transactionType = form.watch('type');
  const selectedAccountId = form.watch('accountId');
  const selectedFromAccountId = form.watch('fromAccountId');
  const selectedToAccountId = form.watch('toAccountId');
  const sourceAmount = form.watch('amount');
  const destinationAmount = form.watch('toAccountAmount');

  const isEditingExisting = !!(initialData && 'id' in initialData && initialData.id);

  const fromAccountForDisplay = useMemo(() => accounts.find(acc => acc.id === selectedFromAccountId), [accounts, selectedFromAccountId]);
  const toAccountForDisplay = useMemo(() => accounts.find(acc => acc.id === selectedToAccountId), [accounts, selectedToAccountId]);
  const singleAccountForDisplay = useMemo(() => accounts.find(acc => acc.id === selectedAccountId), [accounts, selectedAccountId]);


  const currentTransactionCurrencyForDisplay = useMemo(() => {
      if (transactionType === 'transfer') {
          return fromAccountForDisplay?.primaryCurrency || form.getValues('transactionCurrency') || 'BRL';
      }
      return singleAccountForDisplay?.primaryCurrency || form.getValues('transactionCurrency') || 'BRL';
  }, [transactionType, fromAccountForDisplay, singleAccountForDisplay, form]);

  const currentToAccountCurrencyForDisplay = useMemo(() => {
      if (transactionType === 'transfer') {
          return toAccountForDisplay?.primaryCurrency || form.getValues('toAccountCurrency') || 'BRL';
      }
      return 'BRL';
  }, [transactionType, toAccountForDisplay, form]);


  useEffect(() => {
    const isEditing = !!initialData?.id;

    if (transactionType === 'expense' || transactionType === 'income') {
        const account = accounts.find(acc => acc.id === selectedAccountId);
        if (account && account.primaryCurrency) {
             if (!isEditing || (isEditing && selectedAccountId !== (initialData as any)?.accountId)) {
                form.setValue('transactionCurrency', account.primaryCurrency);
            }
        }
    } else if (transactionType === 'transfer') {
        const fromAccount = accounts.find(acc => acc.id === selectedFromAccountId);
        const toAccount = accounts.find(acc => acc.id === selectedToAccountId);

        if (fromAccount && fromAccount.primaryCurrency) {
            if (!isEditing || (isEditing && selectedFromAccountId !== (initialData as any)?.fromAccountId)) {
                form.setValue('transactionCurrency', fromAccount.primaryCurrency);
            }
        }

        if (toAccount && toAccount.primaryCurrency) {
            if (!isEditing || (isEditing && selectedToAccountId !== (initialData as any)?.toAccountId)) {
                 form.setValue('toAccountCurrency', toAccount.primaryCurrency);
            }
        }
        
        if (fromAccount && fromAccount.primaryCurrency && toAccount && toAccount.primaryCurrency && fromAccount.primaryCurrency.toUpperCase() === toAccount.primaryCurrency.toUpperCase()) {
            const sourceAmt = form.getValues('amount');
            if (sourceAmt && form.getValues('toAccountAmount') !== sourceAmt) {
                 form.setValue('toAccountAmount', sourceAmt, { shouldValidate: true });
            }
        } else if (fromAccount && toAccount && fromAccount.primaryCurrency && toAccount.primaryCurrency && fromAccount.primaryCurrency.toUpperCase() !== toAccount.primaryCurrency.toUpperCase()) {
            if (form.getValues('toAccountAmount') === form.getValues('amount') && !isEditing) {
                 form.setValue('toAccountAmount', undefined, { shouldValidate: true });
            }
        } else {
            form.setValue('toAccountAmount', undefined);
        }
    }
  }, [selectedAccountId, selectedFromAccountId, selectedToAccountId, transactionType, accounts, form, initialData]);


  useEffect(() => {
    if (transactionType === 'transfer' && fromAccountForDisplay && toAccountForDisplay && sourceAmount && destinationAmount && sourceAmount > 0 && destinationAmount > 0) {
      if (fromAccountForDisplay.primaryCurrency !== toAccountForDisplay.primaryCurrency) {
        const rate = destinationAmount / sourceAmount;
        setCalculatedRate(`1 ${fromAccountForDisplay.primaryCurrency} = ${rate.toFixed(4)} ${toAccountForDisplay.primaryCurrency}`);
      } else {
        setCalculatedRate(null);
      }
    } else {
      setCalculatedRate(null);
    }
  }, [fromAccountForDisplay, toAccountForDisplay, sourceAmount, destinationAmount, transactionType]);


  async function onSubmit(values: AddTransactionFormData) {
    const finalTags = values.tags || [];

    if (values.type === 'transfer') {
      if (onTransferAdded) {
        const fromAccount = accounts.find(acc => acc.id === values.fromAccountId);
        const toAccount = accounts.find(acc => acc.id === values.toAccountId);

        if (!fromAccount || !toAccount || !fromAccount.primaryCurrency || !toAccount.primaryCurrency) {
            toast({ title: "Error", description: "Source or destination account (or their primary currencies) not found.", variant: "destructive"});
            return;
        }

        const actualSourceCurrency = fromAccount.primaryCurrency;
        const actualDestinationCurrency = toAccount.primaryCurrency;
        
        let finalToAccountAmount: number;
        if (actualSourceCurrency.toUpperCase() === actualDestinationCurrency.toUpperCase()) {
            finalToAccountAmount = values.amount;
        } else {
            if (!values.toAccountAmount || values.toAccountAmount <= 0) {
                form.setError("toAccountAmount", { type: "manual", message: "Destination amount is required and must be positive for cross-currency transfers." });
                toast({ title: "Error", description: "Destination amount is required for cross-currency transfers.", variant: "destructive" });
                return;
            }
            finalToAccountAmount = values.toAccountAmount;
        }

        await onTransferAdded({
            fromAccountId: values.fromAccountId,
            toAccountId: values.toAccountId,
            amount: values.amount,
            transactionCurrency: actualSourceCurrency,
            toAccountAmount: finalToAccountAmount,
            toAccountCurrency: actualDestinationCurrency,
            date: values.date,
            description: values.description || `Transfer from ${fromAccount.name} to ${toAccount.name}`,
            tags: finalTags,
            subscriptionId: null,
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
      const account = accounts.find(acc => acc.id === values.accountId);
      if (!account || !account.primaryCurrency) {
        toast({ title: "Error", description: "Selected account not found or missing primary currency.", variant: "destructive"});
        return;
      }
      const transactionAmount = values.type === 'expense' ? -Math.abs(values.amount) : Math.abs(values.amount);
      const transactionData: Omit<Transaction, 'id'> | Transaction = {
        ...(initialData && (initialData as Transaction).id && { id: (initialData as Transaction).id }),
        accountId: values.accountId!,
        amount: transactionAmount,
        transactionCurrency: account.primaryCurrency,
        date: formatDateFns(values.date, 'yyyy-MM-dd'),
        description: values.description || values.category || 'Transaction',
        category: values.category!,
        tags: finalTags,
        subscriptionId: values.subscriptionId || null,
      };
      await onTransactionAdded(transactionData);
    }
  }

  const getButtonText = () => {
    const isEditing = !!(initialData && initialData.id);
    if (isFormLoading) return isEditing ? "Saving..." : "Adding...";
    if (isEditing) return "Save Changes";
    const typeLabel = transactionType ? transactionType.charAt(0).toUpperCase() + transactionType.slice(1) : 'Transaction';
    return `Add ${typeLabel}`;
  };

  if (isLoadingSubscriptions && !isEditingExisting) {
      return (
          <div className="space-y-6 py-4">
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
          </div>
      );
  }

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
                    const newType = value as AddTransactionFormData['type'];
                    if (newType === 'transfer') {
                        form.setValue('accountId', undefined);
                        form.setValue('category', undefined);
                        form.setValue('subscriptionId', null);
                        const fromAcc = accounts.find(a => a.id === form.getValues('fromAccountId'));
                        form.setValue('transactionCurrency', fromAcc?.primaryCurrency || 'BRL');
                        const toAcc = accounts.find(a => a.id === form.getValues('toAccountId'));
                        form.setValue('toAccountCurrency', toAcc?.primaryCurrency || 'BRL');
                        if(fromAcc?.primaryCurrency === toAcc?.primaryCurrency) {
                            form.setValue('toAccountAmount', form.getValues('amount'));
                        } else {
                            form.setValue('toAccountAmount', undefined);
                        }
                    } else {
                        form.setValue('fromAccountId', undefined);
                        form.setValue('toAccountId', undefined);
                        form.setValue('toAccountCurrency', undefined);
                        form.setValue('toAccountAmount', undefined);
                        const acc = accounts.find(a => a.id === form.getValues('accountId'));
                        form.setValue('transactionCurrency', acc?.primaryCurrency || 'BRL');
                    }
                  }}
                  defaultValue={field.value}
                  disabled={isEditingExisting}
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
                                    if (acc && acc.primaryCurrency) {
                                        form.setValue('transactionCurrency', acc.primaryCurrency);
                                        const toAcc = accounts.find(a => a.id === form.getValues('toAccountId'));
                                        if (toAcc && toAcc.primaryCurrency && acc.primaryCurrency.toUpperCase() === toAcc.primaryCurrency.toUpperCase()) {
                                             form.setValue('toAccountAmount', form.getValues('amount'));
                                        } else if (toAcc) {
                                            form.setValue('toAccountAmount', undefined);
                                        }
                                    }
                                }}
                                defaultValue={field.value}
                                disabled={isEditingExisting && initialData?.type === 'transfer'}
                            >
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select source account" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {accounts.map((acc) => (
                                <SelectItem key={acc.id} value={acc.id} disabled={acc.id === selectedToAccountId}>
                                    {acc.name} ({getCurrencySymbol(acc.primaryCurrency || 'N/A')})
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
                                     if (acc && acc.primaryCurrency) {
                                        form.setValue('toAccountCurrency', acc.primaryCurrency);
                                        const fromAcc = accounts.find(a => a.id === form.getValues('fromAccountId'));
                                        if (fromAcc && fromAcc.primaryCurrency && acc.primaryCurrency.toUpperCase() === fromAcc.primaryCurrency.toUpperCase()) {
                                            form.setValue('toAccountAmount', form.getValues('amount'));
                                        } else if (fromAcc) {
                                            form.setValue('toAccountAmount', undefined);
                                        }
                                    }
                                }}
                                defaultValue={field.value}
                                disabled={isEditingExisting && initialData?.type === 'transfer'}
                            >
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select destination account" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {accounts.map((acc) => (
                                <SelectItem key={acc.id} value={acc.id} disabled={acc.id === selectedFromAccountId}>
                                    {acc.name} ({getCurrencySymbol(acc.primaryCurrency || 'N/A')})
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
                                    if (acc && acc.primaryCurrency) form.setValue('transactionCurrency', acc.primaryCurrency);
                                }}
                                defaultValue={field.value}
                            >
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {accounts.map((acc) => (
                                <SelectItem key={acc.id} value={acc.id}>
                                    {acc.name} ({getCurrencySymbol(acc.primaryCurrency || 'N/A')})
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
                        <FormLabel>Amount ({getCurrencySymbol(currentTransactionCurrencyForDisplay)})</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="0.00" step="0.01" {...field} value={field.value ?? ''}/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                {transactionType === 'transfer' && fromAccountForDisplay?.primaryCurrency !== toAccountForDisplay?.primaryCurrency && (
                    <FormField
                        control={form.control}
                        name="toAccountAmount"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Amount in Destination Account ({getCurrencySymbol(currentToAccountCurrencyForDisplay)})</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="0.00" step="0.01" {...field} value={field.value ?? ''}/>
                            </FormControl>
                            <FormDescription>Enter the exact amount that arrived in the destination account.</FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                )}
                 {calculatedRate && transactionType === 'transfer' && (
                    <div className="text-sm text-muted-foreground p-2 border rounded-md">
                        Effective Rate: {calculatedRate}
                    </div>
                )}


                {transactionType !== 'transfer' && (
                  <>
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
                    <FormField
                        control={form.control}
                        name="subscriptionId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Link to Subscription (Optional)</FormLabel>
                                <Select
                                    onValueChange={(value) => field.onChange(value === "__NONE__" ? null : value)}
                                    value={field.value || "__NONE__"}
                                    disabled={isLoadingSubscriptions}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={isLoadingSubscriptions ? "Loading subscriptions..." : "Select a subscription"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="__NONE__">None</SelectItem>
                                        {subscriptions.filter(sub => sub.type === transactionType).sort((a,b) => a.name.localeCompare(b.name)).map((sub) => (
                                            <SelectItem key={sub.id} value={sub.id}>
                                                {sub.name} ({formatCurrency(sub.amount, sub.currency, sub.currency, false)})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormDescription>Link this transaction to a recurring subscription.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                  </>
                )}
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
                            Separate tags with commas. Existing tags: {tags.slice(0, 5).map(t => t.name).join(', ')}{tags.length > 5 ? '...' : ''}
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>

        <Button type="submit" className="w-full" disabled={isFormLoading || isLoadingSubscriptions}>
          {getButtonText()}
        </Button>
      </form>
    </Form>
  );
};

export default AddTransactionForm;
