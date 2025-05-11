
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
import { allCryptoProviders, type CryptoProviderInfo } from '@/lib/crypto-providers'; // Import crypto provider lists and type
import { getCurrencySymbol } from '@/lib/currency'; // Import currency utils
import type { NewAccountData } from '@/services/account-sync'; // Use NewAccountData
import Image from 'next/image';

// Define allowed fiat currencies
const allowedFiatCurrencies = ['EUR', 'USD', 'BRL'] as const;

// Define Zod schema for form validation
const formSchema = z.object({
  providerName: z.string().min(1, "Provider name is required"),
  accountName: z.string().min(2, "Account name must be at least 2 characters").max(50, "Account name too long"),
  accountType: z.enum(['exchange', 'wallet', 'staking', 'other'], { // Crypto-specific types
    required_error: "Account type is required",
  }),
  // Restrict currency to specific fiat options
  currency: z.enum(allowedFiatCurrencies, {
      required_error: "Fiat currency is required",
  }),
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
      currency: "BRL", // Default to BRL
      balance: 0,
    },
  });

  function onSubmit(values: AddCryptoFormData) {
    // Prepare data in the expected NewAccountData format, setting category to 'crypto'
    const newAccountData: NewAccountData = {
        name: values.accountName,
        type: values.accountType,
        balance: values.balance,
        currency: values.currency.toUpperCase(), // Ensure currency symbol is uppercase
        providerName: values.providerName,
        category: 'crypto', // Explicitly set category for this form
    };
    onAccountAdded(newAccountData);
    form.reset(); // Reset form after successful submission
  }

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
                  {allCryptoProviders.map((provider: CryptoProviderInfo) => (
                    <SelectItem key={provider.name} value={provider.name}>
                       <div className="flex items-center">
                        <Image 
                            src={provider.iconUrl} 
                            alt={`${provider.name} logo`} 
                            width={20} 
                            height={20} 
                            className="mr-2 rounded-sm"
                            data-ai-hint={provider.dataAiHint} 
                        />
                        {provider.name}
                      </div>
                    </SelectItem>
                  ))}
                   <SelectItem value="Other">
                     <div className="flex items-center">
                        <span className="w-5 h-5 mr-2 flex items-center justify-center text-muted-foreground">💠</span> {/* Placeholder for "Other" */}
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
                  <FormLabel>Fiat Currency</FormLabel> {/* Changed Label */}
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allowedFiatCurrencies.map((curr) => (
                        <SelectItem key={curr} value={curr}>
                          {curr} ({getCurrencySymbol(curr)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                   <FormDescription>
                       Select the fiat currency for this account. {/* Changed Description */}
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
                  {/* Dynamically update label with selected currency symbol */}
                  <FormLabel>Current Balance ({getCurrencySymbol(selectedCurrency || 'BRL')})</FormLabel>
                  <FormControl>
                    {/* Use step="0.01" for currency */}
                    <Input type="number" placeholder="0.00" step="0.01" {...field} />
                  </FormControl>
                   <FormDescription>
                       Amount in the selected currency.
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
```