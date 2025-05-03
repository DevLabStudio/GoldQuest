
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
import { popularBanks } from '@/lib/banks'; // Import bank list
import type { Account } from '@/services/account-sync';

// Define Zod schema for form validation
const formSchema = z.object({
  bankName: z.string().min(1, "Bank name is required"),
  accountName: z.string().min(2, "Account name must be at least 2 characters").max(50, "Account name too long"),
  accountType: z.enum(['checking', 'savings', 'credit card', 'investment', 'other'], {
    required_error: "Account type is required",
  }),
  balance: z.coerce.number({ invalid_type_error: "Balance must be a number"}).min(0, "Balance cannot be negative"), // Coerce to number
});

type AddAccountFormData = z.infer<typeof formSchema>;

interface AddAccountFormProps {
  onAccountAdded: (account: Omit<Account, 'id'>) => void; // Callback when account is added
}

const AddAccountForm: FC<AddAccountFormProps> = ({ onAccountAdded }) => {
  const form = useForm<AddAccountFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bankName: "",
      accountName: "",
      accountType: undefined, // Default to no selection
      balance: 0,
    },
  });

  function onSubmit(values: AddAccountFormData) {
    // Prepare data in the expected Account format (excluding id)
    const newAccountData = {
        name: values.accountName,
        type: values.accountType,
        balance: values.balance,
        bankName: values.bankName, // Add bankName if needed in Account type
    };
    onAccountAdded(newAccountData);
    form.reset(); // Reset form after successful submission
  }

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

        <FormField
          control={form.control}
          name="balance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current Balance (R$)</FormLabel>
              <FormControl>
                 {/* Use step="0.01" for currency */}
                <Input type="number" placeholder="0.00" step="0.01" {...field} />
              </FormControl>
              <FormDescription>
                Enter the current balance of this account.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">Add Account</Button>
      </form>
    </Form>
  );
};

export default AddAccountForm;
