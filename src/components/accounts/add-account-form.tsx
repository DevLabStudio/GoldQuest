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
import { popularBanks, type BankInfo } from '@/lib/banks'; // Import bank list and type
import { supportedCurrencies, getCurrencySymbol } from '@/lib/currency'; // Import currency utils
import type { NewAccountData } from '@/services/account-sync'; // Use NewAccountData
import Image from 'next/image';

// Define Zod schema for form validation
const formSchema = z.object({
  providerName: z.string().min(1, "Provider name is required"), // Renamed from bankName
  accountName: z.string().min(2, "Account name must be at least 2 characters").max(50, "Account name too long"),
  accountType: z.enum(['checking', 'savings', 'credit card', 'investment', 'other'], {
    required_error: "Account type is required",
  }),
  currency: z.string().min(3, "Currency is required").refine(
      (val) => supportedCurrencies.includes(val.toUpperCase()),
      { message: "Unsupported currency" }
  ),
  balance: z.coerce.number({ invalid_type_error: "Balance must be a number"}).min(0, "Balance cannot be negative for initial setup"), // Coerce to number
});

type AddAccountFormData = z.infer<typeof formSchema>;

interface AddAccountFormProps {
  onAccountAdded: (account: NewAccountData) => void; // Callback when account is added, use NewAccountData
}

const AddAccountForm: FC<AddAccountFormProps> = ({ onAccountAdded }) => {
  const form = useForm<AddAccountFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      providerName: "", // Renamed default
      accountName: "",
      accountType: undefined, // Default to no selection
      currency: "BRL", // Default to BRL
      balance: 0,
    },
  });

  function onSubmit(values: AddAccountFormData) {
    // Prepare data in the expected NewAccountData format, setting category to 'asset'
    const newAccountData: NewAccountData = {
        name: values.accountName,
        type: values.accountType,
        balance: values.balance,
        currency: values.currency.toUpperCase(), // Ensure currency is uppercase
        providerName: values.providerName, // Renamed field
        category: 'asset', // Explicitly set category for this form
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
          name="providerName" // Renamed field
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bank/Institution Name</FormLabel> {/* Updated label */}
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a bank or institution" /> {/* Updated placeholder */}
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {popularBanks.map((bank: BankInfo) => (
                    <SelectItem key={bank.name} value={bank.name}>
                      <div className="flex items-center">
                        <Image 
                            src={bank.iconUrl} 
                            alt={`${bank.name} logo`} 
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
                        <span className="w-5 h-5 mr-2 flex items-center justify-center text-muted-foreground">🏦</span> {/* Placeholder for "Other" */}
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
                   {/* Dynamically update label with currency symbol */}
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

        <Button type="submit" className="w-full">Add Asset Account</Button> {/* Updated button text */}
      </form>
    </Form>
  );
};

export default AddAccountForm;
