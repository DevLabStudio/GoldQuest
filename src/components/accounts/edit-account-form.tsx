
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
import { popularBanks } from '@/lib/banks';
import { supportedCurrencies, getCurrencySymbol } from '@/lib/currency';
import type { Account } from '@/services/account-sync';

// Define Zod schema for form validation (same as AddAccountForm)
const formSchema = z.object({
  bankName: z.string().min(1, "Bank name is required"),
  accountName: z.string().min(2, "Account name must be at least 2 characters").max(50, "Account name too long"),
  accountType: z.enum(['checking', 'savings', 'credit card', 'investment', 'other'], {
    required_error: "Account type is required",
  }),
  currency: z.string().min(3, "Currency is required").refine(
      (val) => supportedCurrencies.includes(val.toUpperCase()),
      { message: "Unsupported currency" }
  ),
  balance: z.coerce.number({ invalid_type_error: "Balance must be a number"}), // Balance can be negative for updates
});

type EditAccountFormData = z.infer<typeof formSchema>;

interface EditAccountFormProps {
  account: Account; // The account to edit
  onAccountUpdated: (updatedAccount: Account) => void; // Callback when account is updated
}

const EditAccountForm: FC<EditAccountFormProps> = ({ account, onAccountUpdated }) => {
  const form = useForm<EditAccountFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bankName: account.bankName || "",
      accountName: account.name,
      accountType: account.type as EditAccountFormData['accountType'], // Ensure type matches enum
      currency: account.currency.toUpperCase(),
      balance: account.balance,
    },
  });

  function onSubmit(values: EditAccountFormData) {
    // Prepare data in the expected Account format, keeping the original ID
    const updatedAccountData: Account = {
        id: account.id, // Keep the original ID
        name: values.accountName,
        type: values.accountType,
        balance: values.balance,
        currency: values.currency.toUpperCase(),
        bankName: values.bankName,
    };
    onAccountUpdated(updatedAccountData);
    // Optionally reset form or close dialog here via callback
  }

  const selectedCurrency = form.watch('currency'); // Watch the currency field

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="bankName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bank Name</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a bank" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {popularBanks.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                   <SelectItem value="Other">Other (Specify in Name)</SelectItem>
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

         <div className="grid grid-cols-2 gap-4">
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

            <FormField
              control={form.control}
              name="balance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Balance ({getCurrencySymbol(selectedCurrency || 'BRL')})</FormLabel>
                  <FormControl>
                    {/* Use step="0.01" for currency */}
                    <Input type="number" placeholder="0.00" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
         <FormDescription>
            Enter the current balance in the selected currency.
         </FormDescription>

        <Button type="submit" className="w-full">Save Changes</Button>
      </form>
    </Form>
  );
};

export default EditAccountForm;
