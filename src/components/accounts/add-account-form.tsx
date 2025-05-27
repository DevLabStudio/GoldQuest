
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
import { Checkbox } from "@/components/ui/checkbox";
import { popularBanks, type BankInfo } from '@/lib/banks';
import { supportedCurrencies, getCurrencySymbol } from '@/lib/currency';
import type { NewAccountData } from '@/services/account-sync';
// Image import removed as we are using iconComponent

// Define Zod schema for form validation
const formSchema = z.object({
  providerName: z.string().min(1, "Provider name is required"),
  accountName: z.string().min(2, "Account name must be at least 2 characters").max(50, "Account name too long"),
  accountType: z.enum(['checking', 'savings', 'credit card', 'investment', 'other'], {
    required_error: "Account type is required",
  }),
  currency: z.string().min(3, "Currency is required").refine(
      (val) => supportedCurrencies.includes(val.toUpperCase()),
      { message: "Unsupported currency" }
  ),
  balance: z.coerce.number({ invalid_type_error: "Balance must be a number"}),
  includeInNetWorth: z.boolean().optional(),
});

type AddAccountFormData = z.infer<typeof formSchema>;

interface AddAccountFormProps {
  onAccountAdded: (account: NewAccountData) => void;
}

const AddAccountForm: FC<AddAccountFormProps> = ({ onAccountAdded }) => {
  const form = useForm<AddAccountFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      providerName: "",
      accountName: "",
      accountType: undefined,
      currency: "BRL",
      balance: 0,
      includeInNetWorth: true,
    },
  });

  function onSubmit(values: AddAccountFormData) {
    const newAccountData: NewAccountData = {
        name: values.accountName,
        type: values.accountType,
        initialBalance: values.balance,
        initialCurrency: values.currency.toUpperCase(),
        providerName: values.providerName,
        category: 'asset',
        includeInNetWorth: values.includeInNetWorth ?? true,
    };
    onAccountAdded(newAccountData);
    form.reset();
  }

  const selectedCurrency = form.watch('currency');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="providerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bank/Institution Name</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a bank or institution" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {popularBanks.map((bank: BankInfo) => (
                      <SelectItem key={bank.name} value={bank.name}>
                        <div className="flex items-center gap-2">
                          {bank.iconComponent}
                          {bank.name}
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="Other">
                      <div className="flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center text-muted-foreground">🏦</span>
                          Other (Specify in Name)
                        </div>
                      </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="accountName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., My Primary Checking" {...field} />
                </FormControl>
                <FormDescription>
                  Give your account a nickname.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="accountType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="credit card">Credit Card</SelectItem>
                    <SelectItem value="investment">Investment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Currency</FormLabel>
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
            name="balance"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Initial Balance ({getCurrencySymbol(selectedCurrency || 'BRL')})</FormLabel>
                <FormControl>
                <Input type="number" placeholder="0.00" step="0.01" {...field} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
         <FormDescription>
            Enter the current balance in the selected currency. This will be the starting balance for this account.
         </FormDescription>

        <FormField
          control={form.control}
          name="includeInNetWorth"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Include in Net Worth Calculations
                </FormLabel>
                <FormDescription>
                  If checked, this account's balance will be part of your total net worth and dashboard summaries.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">Add Asset Account</Button>
      </form>
    </Form>
  );
};

export default AddAccountForm;
