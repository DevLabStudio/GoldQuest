
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
import { popularExchanges, popularWallets } from '@/lib/crypto-providers'; // Import crypto provider lists
import { supportedCurrencies, getCurrencySymbol } from '@/lib/currency'; // Import currency utils
import type { NewAccountData } from '@/services/account-sync'; // Use NewAccountData

// Define Zod schema for form validation
const formSchema = z.object({
  providerName: z.string().min(1, "Provider name is required"),
  accountName: z.string().min(2, "Account name must be at least 2 characters").max(50, "Account name too long"),
  accountType: z.enum(['exchange', 'wallet', 'staking', 'other'], { // Crypto-specific types
    required_error: "Account type is required",
  }),
  // For crypto, currency might often be a specific crypto asset (BTC, ETH) or a stablecoin (USDT)
  // Keeping it as string for flexibility, but validation might need refinement for crypto symbols.
  currency: z.string().min(3, "Asset/Currency symbol is required").max(10, "Symbol too long"),
  balance: z.coerce.number({ invalid_type_error: "Balance must be a number"}).min(0, "Balance cannot be negative"), // Coerce to number
});

type AddCryptoFormData = z.infer<typeof formSchema>;

interface AddCryptoFormProps {
  onAccountAdded: (account: NewAccountData) => void; // Callback when account is added, use NewAccountData
}

const AddCryptoForm: FC<AddCryptoFormProps> = ({ onAccountAdded }) => {
  const form = useForm<AddCryptoFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      providerName: "",
      accountName: "",
      accountType: undefined, // Default to no selection
      currency: "BTC", // Default to BTC maybe? Or require selection?
      balance: 0,
    },
  });

  function onSubmit(values: AddCryptoFormData) {
    // Prepare data in the expected NewAccountData format, setting category to 'crypto'
    const newAccountData: NewAccountData = {
        name: values.accountName,
        type: values.accountType,
        balance: values.balance,
        currency: values.currency.toUpperCase(), // Ensure currency/asset symbol is uppercase
        providerName: values.providerName,
        category: 'crypto', // Explicitly set category for this form
    };
    onAccountAdded(newAccountData);
    form.reset(); // Reset form after successful submission
  }

  // Combine exchanges and wallets for the provider dropdown
  const cryptoProviders = [...popularExchanges, ...popularWallets].sort();
  const selectedCurrency = form.watch('currency'); // Watch the currency field

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="providerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Exchange/Wallet Provider</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an exchange or wallet" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {cryptoProviders.map((provider) => (
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
              <FormLabel>Account/Wallet Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., My Binance Spot, Ledger Main" {...field} />
              </FormControl>
              <FormDescription>
                Give your account or wallet a nickname.
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
                  <SelectItem value="exchange">Exchange Account</SelectItem>
                  <SelectItem value="wallet">Self-Custody Wallet</SelectItem>
                  <SelectItem value="staking">Staking/Yield Account</SelectItem>
                  <SelectItem value="other">Other Crypto Holding</SelectItem>
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
                  <FormLabel>Primary Asset/Currency</FormLabel>
                  <FormControl>
                     {/* Input for crypto symbol, could be enhanced with a search/select later */}
                    <Input placeholder="e.g., BTC, ETH, USDT" {...field} />
                  </FormControl>
                   <FormDescription>
                       Enter the main crypto symbol (e.g., BTC) or stablecoin (e.g., USDT).
                   </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="balance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Balance ({selectedCurrency.toUpperCase()})</FormLabel>
                  <FormControl>
                    {/* Step might be much smaller for crypto */}
                    <Input type="number" placeholder="0.00000000" step="any" {...field} />
                  </FormControl>
                   <FormDescription>
                       Amount of the asset/currency.
                   </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>

        <Button type="submit" className="w-full">Add Crypto Account</Button>
      </form>
    </Form>
  );
};

export default AddCryptoForm;
