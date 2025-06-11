
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
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image'; // For displaying fetched logo

const allowedFiatCurrencies = ['EUR', 'USD', 'BRL'] as const;

const formSchema = z.object({
  providerName: z.string().min(1, "Provider name is required"),
  accountName: z.string().min(2, "Account name must be at least 2 characters").max(50, "Account name too long"),
  accountType: z.enum(['exchange', 'wallet', 'staking', 'other'], {
    required_error: "Account type is required",
  }),
  currency: z.enum(allowedFiatCurrencies, {
      required_error: "Fiat currency for initial balance is required",
  }),
  balance: z.coerce.number({ invalid_type_error: "Balance must be a number"}),
  includeInNetWorth: z.boolean().optional(),
  providerDisplayIconUrl: z.string().optional(), // Hidden field to store fetched URL
});

type AddCryptoFormData = z.infer<typeof formSchema>;

interface AddCryptoFormProps {
  onAccountAdded: (account: NewAccountData) => void;
}

const AddCryptoForm: FC<AddCryptoFormProps> = ({ onAccountAdded }) => {
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [isFetchingLogo, setIsFetchingLogo] = useState(false);

  const form = useForm<AddCryptoFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      providerName: "",
      accountName: "",
      accountType: undefined,
      currency: "BRL",
      balance: 0,
      includeInNetWorth: true,
      providerDisplayIconUrl: undefined,
    },
  });

  const selectedProviderName = form.watch('providerName');

  useEffect(() => {
    const fetchLogo = async () => {
      if (!selectedProviderName) {
        setLogoPreviewUrl(null);
        form.setValue('providerDisplayIconUrl', undefined);
        return;
      }
      const providerInfo = allCryptoProviders.find(p => p.name === selectedProviderName);
      if (providerInfo && providerInfo.coingeckoExchangeId) {
        setIsFetchingLogo(true);
        setLogoPreviewUrl(null); // Clear previous logo
        form.setValue('providerDisplayIconUrl', undefined);
        try {
          const response = await fetch(`https://api.coingecko.com/api/v3/exchanges/${providerInfo.coingeckoExchangeId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.image) {
              setLogoPreviewUrl(data.image);
              form.setValue('providerDisplayIconUrl', data.image);
            } else {
              setLogoPreviewUrl(null);
            }
          } else {
            console.warn(`Failed to fetch logo for ${selectedProviderName}: ${response.status}`);
            setLogoPreviewUrl(null);
          }
        } catch (error) {
          console.error(`Error fetching logo for ${selectedProviderName}:`, error);
          setLogoPreviewUrl(null);
        } finally {
          setIsFetchingLogo(false);
        }
      } else {
        setLogoPreviewUrl(null);
        form.setValue('providerDisplayIconUrl', undefined);
      }
    };
    fetchLogo();
  }, [selectedProviderName, form]);

  function onSubmit(values: AddCryptoFormData) {
    const newAccountData: NewAccountData = {
        name: values.accountName,
        type: values.accountType,
        initialBalance: values.balance,
        initialCurrency: values.currency.toUpperCase(),
        providerName: values.providerName,
        providerDisplayIconUrl: values.providerDisplayIconUrl,
        category: 'crypto',
        includeInNetWorth: values.includeInNetWorth ?? true,
    };
    onAccountAdded(newAccountData);
    form.reset();
    setLogoPreviewUrl(null);
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
                        <div className="flex items-center gap-2">
                            {provider.iconComponent}
                            {provider.name}
                        </div>
                        </SelectItem>
                    ))}
                    <SelectItem value="Other">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 flex items-center justify-center text-muted-foreground">💠</span>
                            Other (Specify in Name)
                        </div>
                    </SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                {isFetchingLogo && <Skeleton className="h-10 w-10 mt-2 rounded-full" />}
                {logoPreviewUrl && !isFetchingLogo && (
                  <div className="mt-2 flex items-center gap-2">
                    <Image src={logoPreviewUrl} alt={`${selectedProviderName} logo`} width={24} height={24} className="rounded-full" data-ai-hint={`${selectedProviderName} logo`}/>
                    <span className="text-xs text-muted-foreground">Logo Preview</span>
                  </div>
                )}
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
                    <FormLabel>Initial Balance Currency</FormLabel>
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
                        Fiat currency for the initial balance entry.
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
                <FormLabel>Initial Balance ({getCurrencySymbol(selectedCurrency || 'BRL')})</FormLabel>
                <FormControl>
                <Input type="number" placeholder="0.00" step="0.01" {...field} value={field.value ?? ''}/>
                </FormControl>
                <FormDescription>
                    Enter the current fiat value of your crypto holdings for this account.
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
                  If checked, this crypto account's balance (in its fiat equivalent) will be part of your total net worth.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        {/* Hidden field for providerDisplayIconUrl - value set by useEffect */}
        <FormField control={form.control} name="providerDisplayIconUrl" render={({ field }) => <Input type="hidden" {...field} />} />

        <Button type="submit" className="w-full">Add Crypto Account</Button>
      </form>
    </Form>
  );
};

export default AddCryptoForm;
