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
import { supportedCurrencies, getCurrencySymbol } from '@/lib/currency'; 
import type { NewAccountData } from '@/services/account-sync'; 
import Image from 'next/image';

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
  balance: z.coerce.number({ invalid_type_error: "Balance must be a number"}).min(0, "Balance cannot be negative for initial setup"),
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
    },
  });

  function onSubmit(values: AddAccountFormData) {
    const newAccountData: NewAccountData = {
        name: values.accountName,
        type: values.accountType,
        balance: values.balance,
        currency: values.currency.toUpperCase(), 
        providerName: values.providerName, 
        category: 'asset', 
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
                        <div className="flex items-center">
                          <Image 
                              src={bank.iconUrl} 
                              alt={`${bank.name} logo placeholder`} 
                              width={20} 
                              height={20} 
                              className="mr-2 rounded-sm" 
                              data-ai-hint={bank.dataAiHint}
                          />
                          {bank.name}
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="Other">
                      <div className="flex items-center">
                          <span className="w-5 h-5 mr-2 flex items-center justify-center text-muted-foreground">🏦</span> 
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
                <FormMessage />
            </FormItem>
            )}
        />
         <FormDescription>
            Enter the current balance in the selected currency.
         </FormDescription>

        <Button type="submit" className="w-full">Add Asset Account</Button> 
      </form>
    </Form>
  );
};

export default AddAccountForm;