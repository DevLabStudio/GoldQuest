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
import { allCryptoProviders, type CryptoProviderInfo } from '@/lib/crypto-providers';
import { getCurrencySymbol } from '@/lib/currency';
import type { NewAccountData } from '@/services/account-sync';
import Image from 'next/image';

const allowedFiatCurrencies = ['EUR', 'USD', 'BRL'] as const;

const formSchema = z.object({
  providerName: z.string().min(1, "Provider name is required"),
  accountName: z.string().min(2, "Account name must be at least 2 characters").max(50, "Account name too long"),
  accountType: z.enum(['exchange', 'wallet', 'staking', 'other'], {
    required_error: "Account type is required",
  }),
  currency: z.enum(allowedFiatCurrencies, {
      required_error: "Fiat currency is required",
  }),
  balance: z.coerce.number({ invalid_type_error: "Balance must be a number"}).min(0, "Balance cannot be negative"),
  includeInNetWorth: z.boolean().optional(),
});

type AddCryptoFormData = z.infer<typeof formSchema>;

interface AddCryptoFormProps {
  onAccountAdded: (account: NewAccountData) => void;
}

const AddCryptoForm: FC<AddCryptoFormProps> = ({ onAccountAdded }) => {
  const form = useForm<AddCryptoFormData>({
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

  function onSubmit(values: AddCryptoFormData) {
    const newAccountData: NewAccountData = {
        name: values.accountName,
        type: values.accountType,
        balance: values.balance,
        currency: values.currency.toUpperCase(),
        providerName: values.providerName,
        category: 'crypto',
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
                                className="mr-2 rounded-sm object-contain"
                                data-ai-hint={provider.dataAiHint}
                            />
                            {provider.name}
                        </div>
                        </SelectItem>
                    ))}
                    <SelectItem value="Other">
                        <div className="flex items-center">
                            <span className="w-5 h-5 mr-2 flex items-center justify-center text-muted-foreground">💠</span>
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
            <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Fiat Currency</FormLabel>
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
                        Select the fiat currency for this account.
                    </FormDescription>
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
                <FormLabel>Current Balance ({getCurrencySymbol(selectedCurrency || 'BRL')})</FormLabel>
                <FormControl>
                <Input type="number" placeholder="0.00" step="0.01" {...field} />
                </FormControl>
                <FormDescription>
                    Amount in the selected currency.
                </FormDescription>
                <FormMessage />
            </FormItem>
            )}
        />

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
                  If checked, this crypto account's balance will be part of your total net worth.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">Add Crypto Account</Button>
      </form>
    </Form>
  );
};

export default AddCryptoForm;
