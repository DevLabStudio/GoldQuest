
'use client';

import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { popularBanks, type BankInfo } from '@/lib/banks';
import { allCryptoProviders, type CryptoProviderInfo } from '@/lib/crypto-providers';
import { supportedCurrencies, getCurrencySymbol } from '@/lib/currency';
import type { Account } from '@/services/account-sync';
// Image import removed

const allowedFiatCurrenciesForCrypto = ['EUR', 'USD', 'BRL'] as const;

const formSchema = z.object({
  providerName: z.string().min(1, "Provider name is required"),
  accountName: z.string().min(2, "Account name must be at least 2 characters").max(50, "Account name too long"),
  accountType: z.string().min(1, "Account type is required"),
  primaryCurrency: z.string().min(3, "Primary currency is required"),
  primaryBalance: z.coerce.number({ invalid_type_error: "Balance must be a number"}),
  includeInNetWorth: z.boolean().optional(),
});

type EditAccountFormData = z.infer<typeof formSchema>;

interface EditAccountFormProps {
  account: Account;
  onAccountUpdated: (updatedAccount: Account) => void;
}

const getProviderList = (category: 'asset' | 'crypto'): Array<BankInfo | CryptoProviderInfo> => {
    return category === 'asset' ? popularBanks : allCryptoProviders;
}

const getAccountTypes = (category: 'asset' | 'crypto'): { value: string; label: string }[] => {
    if (category === 'asset') {
        return [
            { value: 'checking', label: 'Checking' },
            { value: 'savings', label: 'Savings' },
            { value: 'credit card', label: 'Credit Card' },
            { value: 'investment', label: 'Investment' },
            { value: 'other', label: 'Other' },
        ];
    } else {
        return [
            { value: 'exchange', label: 'Exchange Account' },
            { value: 'wallet', label: 'Self-Custody Wallet' },
            { value: 'staking', label: 'Staking/Yield Account' },
            { value: 'other Crypto Holding', label: 'Other Crypto Holding' },
        ];
    }
}

const EditAccountForm: FC<EditAccountFormProps> = ({ account, onAccountUpdated }) => {
  const currentPrimaryBalanceEntry = account.balances.find(b => b.currency === account.primaryCurrency) || account.balances[0] || { currency: 'USD', amount: 0 };

  const form = useForm<EditAccountFormData>({
    resolver: zodResolver(formSchema.refine(data => {
        if (account.category === 'crypto') {
            return allowedFiatCurrenciesForCrypto.includes(data.primaryCurrency.toUpperCase() as any);
        }
        return supportedCurrencies.includes(data.primaryCurrency.toUpperCase());
    }, {
        message: account.category === 'crypto' ? `Currency for crypto accounts must be one of: ${allowedFiatCurrenciesForCrypto.join(', ')}` : "Unsupported currency",
        path: ['primaryCurrency'],
    })),
    defaultValues: {
      providerName: account.providerName || "",
      accountName: account.name,
      accountType: account.type,
      primaryCurrency: account.primaryCurrency || currentPrimaryBalanceEntry.currency,
      primaryBalance: currentPrimaryBalanceEntry.amount,
      includeInNetWorth: account.includeInNetWorth ?? true,
    },
  });

  function onSubmit(values: EditAccountFormData) {
    const primaryBalanceIndex = account.balances.findIndex(b => b.currency === values.primaryCurrency.toUpperCase());
    let updatedBalances = [...account.balances];

    if (primaryBalanceIndex !== -1) {
        updatedBalances[primaryBalanceIndex] = { ...updatedBalances[primaryBalanceIndex], amount: values.primaryBalance, currency: values.primaryCurrency.toUpperCase() };
    } else {
        // This case should ideally not happen if primaryCurrency is chosen from existing ones.
        // If it's a new primary currency, we'd need to add it.
        // For now, we assume primaryCurrency selected is one that already has a balance entry or is the only one.
        // If the currency was changed to a *new* one not in the balances array:
        const newPrimaryCurrency = values.primaryCurrency.toUpperCase();
        if (!updatedBalances.some(b => b.currency === newPrimaryCurrency)) {
            updatedBalances = [{ currency: newPrimaryCurrency, amount: values.primaryBalance }];
        } else {
             const existingIdx = updatedBalances.findIndex(b => b.currency === newPrimaryCurrency);
             updatedBalances[existingIdx] = { ...updatedBalances[existingIdx], amount: values.primaryBalance };
        }
    }
    
    // Ensure no duplicate currencies in balances if primaryCurrency changed.
    // This logic might need more refinement if we allow adding/removing multiple balances in this form.
    // For now, this simplified update focuses on the *primary* balance.
    const uniqueBalances = updatedBalances.reduce((acc, current) => {
        const x = acc.find(item => item.currency === current.currency);
        if (!x) {
            return acc.concat([current]);
        } else {
            // If primaryCurrency matches, ensure this one is kept/updated
            if(current.currency === values.primaryCurrency.toUpperCase()) {
                const filtered = acc.filter(item => item.currency !== current.currency);
                return filtered.concat([current]);
            }
            return acc;
        }
    }, [] as Array<{ currency: string; amount: number }>);


    const updatedAccountData: Account = {
        ...account,
        name: values.accountName,
        type: values.accountType,
        providerName: values.providerName,
        balances: uniqueBalances,
        primaryCurrency: values.primaryCurrency.toUpperCase(),
        includeInNetWorth: values.includeInNetWorth ?? true,
    };
    onAccountUpdated(updatedAccountData);
  }

  const selectedPrimaryCurrency = form.watch('primaryCurrency');
  const providerList = getProviderList(account.category);
  const accountTypes = getAccountTypes(account.category);
  const currencyOptions = account.category === 'crypto' ? allowedFiatCurrenciesForCrypto : (account.balances.length > 0 ? account.balances.map(b => b.currency) : [account.primaryCurrency || 'USD']);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="providerName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>{account.category === 'asset' ? 'Bank/Institution' : 'Exchange/Wallet'} Name</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder={`Select a ${account.category === 'asset' ? 'bank/institution' : 'provider'}`} />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    {providerList.map((provider) => (
                        <SelectItem key={provider.name} value={provider.name}>
                        <div className="flex items-center gap-2">
                            {provider.iconComponent}
                            {provider.name}
                        </div>
                        </SelectItem>
                    ))}
                    <SelectItem value="Other">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 flex items-center justify-center text-muted-foreground">
                                {account.category === 'asset' ? '🏦' : '💠'}
                            </span>
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
                    <Input placeholder="e.g., My Primary Account" {...field} />
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
            <FormField
                control={form.control}
                name="primaryCurrency"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Primary Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select primary currency" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {currencyOptions.map((curr) => (
                        <SelectItem key={curr} value={curr}>
                            {curr} ({getCurrencySymbol(curr)})
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormDescription>
                        The main currency for this account's display and primary balance.
                    </FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <FormField
            control={form.control}
            name="primaryBalance"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Primary Balance ({getCurrencySymbol(selectedPrimaryCurrency || 'USD')})</FormLabel>
                <FormControl>
                <Input type="number" placeholder="0.00" step="0.01" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
         <FormDescription>
            Enter the current balance for the selected primary currency.
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
                  If checked, this account's balances will be part of your total net worth and dashboard summaries.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">Save Changes</Button>
      </form>
    </Form>
  );
};

export default EditAccountForm;
