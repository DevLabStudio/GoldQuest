
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
import { popularExchanges, popularWallets } from '@/lib/crypto-providers'; // Import crypto providers
import { supportedCurrencies, getCurrencySymbol } from '@/lib/currency';
import type { Account } from '@/services/account-sync';

// Define Zod schema for form validation (adjust accountType enum based on category if needed)
const formSchema = z.object({
  providerName: z.string().min(1, "Provider name is required"), // Renamed from bankName
  accountName: z.string().min(2, "Account name must be at least 2 characters").max(50, "Account name too long"),
  accountType: z.string().min(1, "Account type is required"), // Allow string for flexibility between asset/crypto types initially
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

// Helper to get appropriate provider list based on category
const getProviderList = (category: 'asset' | 'crypto'): string[] => {
    return category === 'asset' ? popularBanks : [...popularExchanges, ...popularWallets].sort();
}

// Helper to get appropriate account types based on category
const getAccountTypes = (category: 'asset' | 'crypto'): { value: string; label: string }[] => {
    if (category === 'asset') {
        return [
            { value: 'checking', label: 'Checking' },
            { value: 'savings', label: 'Savings' },
            { value: 'credit card', label: 'Credit Card' },
            { value: 'investment', label: 'Investment' },
            { value: 'other', label: 'Other' },
        ];
    } else { // category === 'crypto'
        return [
            { value: 'exchange', label: 'Exchange Account' },
            { value: 'wallet', label: 'Self-Custody Wallet' },
            { value: 'staking', label: 'Staking/Yield Account' },
            { value: 'other', label: 'Other Crypto Holding' },
        ];
    }
}


const EditAccountForm: FC<EditAccountFormProps> = ({ account, onAccountUpdated }) => {
  const form = useForm<EditAccountFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      providerName: account.providerName || "", // Use providerName
      accountName: account.name,
      accountType: account.type, // Use existing type string
      currency: account.currency.toUpperCase(),
      balance: account.balance,
    },
  });

  function onSubmit(values: EditAccountFormData) {
    // Prepare data in the expected Account format, keeping the original ID and category
    const updatedAccountData: Account = {
        ...account, // Spread existing account data to preserve ID, category, etc.
        name: values.accountName,
        type: values.accountType,
        balance: values.balance,
        currency: values.currency.toUpperCase(),
        providerName: values.providerName, // Use providerName
        // category remains unchanged from the original 'account' object
    };
    onAccountUpdated(updatedAccountData);
    // Optionally reset form or close dialog here via callback
  }

  const selectedCurrency = form.watch('currency'); // Watch the currency field
  const providerList = getProviderList(account.category); // Get providers based on existing account category
  const accountTypes = getAccountTypes(account.category); // Get account types based on existing category

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="providerName" // Use providerName
          render={({ field }) => (
            <FormItem>
              <FormLabel>{account.category === 'asset' ? 'Bank/Institution' : 'Exchange/Wallet'} Name</FormLabel> {/* Dynamic Label */}
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select a ${account.category === 'asset' ? 'bank/institution' : 'provider'}`} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {providerList.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
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
                <Input placeholder="e.g., My Primary Account" {...field} />
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
                  {accountTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
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

