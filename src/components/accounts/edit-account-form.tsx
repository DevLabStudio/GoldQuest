
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
import { popularBanks, type BankInfo } from '@/lib/banks';
import { allCryptoProviders, type CryptoProviderInfo } from '@/lib/crypto-providers'; 
import { supportedCurrencies, getCurrencySymbol } from '@/lib/currency';
import type { Account } from '@/services/account-sync';
import Image from 'next/image';

const allowedFiatCurrenciesForCrypto = ['EUR', 'USD', 'BRL'] as const;

const formSchema = z.object({
  providerName: z.string().min(1, "Provider name is required"), 
  accountName: z.string().min(2, "Account name must be at least 2 characters").max(50, "Account name too long"),
  accountType: z.string().min(1, "Account type is required"), 
  currency: z.string().min(3, "Currency is required"), // Validated dynamically below
  balance: z.coerce.number({ invalid_type_error: "Balance must be a number"}), 
});

type EditAccountFormData = z.infer<typeof formSchema>;

interface EditAccountFormProps {
  account: Account; 
  onAccountUpdated: (updatedAccount: Account) => void; 
}

const getProviderList = (category: 'asset' | 'crypto'): Array<BankInfo | CryptoProviderInfo> => {
    if (category === 'asset') {
        return popularBanks;
    } else {
        return allCryptoProviders;
    }
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
  const form = useForm<EditAccountFormData>({
    resolver: zodResolver(formSchema.refine(data => {
        if (account.category === 'crypto') {
            return allowedFiatCurrenciesForCrypto.includes(data.currency.toUpperCase() as any);
        }
        return supportedCurrencies.includes(data.currency.toUpperCase());
    }, {
        message: account.category === 'crypto' ? `Currency for crypto accounts must be one of: ${allowedFiatCurrenciesForCrypto.join(', ')}` : "Unsupported currency",
        path: ['currency'],
    })),
    defaultValues: {
      providerName: account.providerName || "", 
      accountName: account.name,
      accountType: account.type, 
      currency: account.currency.toUpperCase(),
      balance: account.balance,
    },
  });

  function onSubmit(values: EditAccountFormData) {
    const updatedAccountData: Account = {
        ...account, 
        name: values.accountName,
        type: values.accountType,
        balance: values.balance,
        currency: values.currency.toUpperCase(),
        providerName: values.providerName, 
    };
    onAccountUpdated(updatedAccountData);
  }

  const selectedCurrency = form.watch('currency'); 
  const providerList = getProviderList(account.category); 
  const accountTypes = getAccountTypes(account.category); 
  const currencyOptions = account.category === 'crypto' ? allowedFiatCurrenciesForCrypto : supportedCurrencies;


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      <div className="flex items-center">
                        <Image 
                            src={provider.iconUrl} 
                            alt={`${provider.name} logo placeholder`}
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
                        <span className="w-5 h-5 mr-2 flex items-center justify-center text-muted-foreground">
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
                      {currencyOptions.map((curr) => (
                        <SelectItem key={curr} value={curr}>
                          {curr} ({getCurrencySymbol(curr)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                   <FormDescription>
                      {account.category === 'crypto' ? 'Fiat currency for this crypto account.' : 'Account currency.'}
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
                  <FormLabel>Current Balance ({getCurrencySymbol(selectedCurrency || 'BRL')})</FormLabel>
                  <FormControl>
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
