
'use client';

import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { useMemo } from 'react'; // Corrected import for useMemo
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Repeat } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format as formatDateFns, parseISO } from 'date-fns';
import type { Account } from '@/services/account-sync';
import { supportedCurrencies, getCurrencySymbol } from '@/lib/currency';
import type { NewSwapData, Swap } from '@/services/swaps';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from 'lucide-react';

// Combine fiat and common crypto for asset selection
const commonCryptoAssets = ["BTC", "ETH", "SOL", "USDT", "USDC", "ADA", "XRP", "DOT", "DOGE"];
const allAssets = [...new Set([...supportedCurrencies, ...commonCryptoAssets])].sort();


const formSchema = z.object({
  date: z.date({ required_error: "Swap date is required" }),
  platformAccountId: z.string().min(1, "Platform/Account is required"),
  fromAsset: z.string().min(1, "Source asset is required").refine(val => allAssets.includes(val.toUpperCase()), "Unsupported source asset"),
  fromAmount: z.coerce.number({ invalid_type_error: "Amount must be a number"}).positive("Source amount must be positive"),
  toAsset: z.string().min(1, "Destination asset is required").refine(val => allAssets.includes(val.toUpperCase()), "Unsupported destination asset"),
  toAmount: z.coerce.number({ invalid_type_error: "Amount must be a number"}).positive("Destination amount must be positive"),
  feeAmount: z.coerce.number({ invalid_type_error: "Fee must be a number"}).min(0, "Fee cannot be negative").optional().nullable(),
  feeCurrency: z.string().min(3, "Fee currency is required if fee amount is entered").optional().nullable().refine(val => val ? allAssets.includes(val.toUpperCase()) : true, "Unsupported fee currency"),
  notes: z.string().max(500, "Notes too long").optional().nullable(),
}).refine(data => data.fromAsset.toUpperCase() !== data.toAsset.toUpperCase(), {
  message: "Source and destination assets must be different.",
  path: ["toAsset"],
}).refine(data => (data.feeAmount && data.feeAmount > 0) ? !!data.feeCurrency : true, {
  message: "Fee currency is required if a fee amount is entered and is greater than zero.",
  path: ["feeCurrency"],
});

export type AddSwapFormData = z.infer<typeof formSchema>;

interface AddSwapFormProps {
  onSubmit: (data: NewSwapData) => Promise<void> | void;
  isLoading: boolean;
  accounts: Account[]; // Accounts in the app, to select the "platform"
  initialData?: Swap;
}

const AddSwapForm: FC<AddSwapFormProps> = ({ onSubmit: passedOnSubmit, isLoading, accounts, initialData }) => {
  const form = useForm<AddSwapFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      ...initialData,
      date: initialData.date ? parseISO(initialData.date) : new Date(),
      feeAmount: initialData.feeAmount === null ? undefined : initialData.feeAmount,
      feeCurrency: initialData.feeCurrency === null ? undefined : initialData.feeCurrency,
      notes: initialData.notes || "",
    } : {
      date: new Date(),
      platformAccountId: undefined,
      fromAsset: undefined,
      fromAmount: undefined,
      toAsset: undefined,
      toAmount: undefined,
      feeAmount: undefined,
      feeCurrency: undefined,
      notes: "",
    },
  });

  const fromAmount = form.watch('fromAmount');
  const toAmount = form.watch('toAmount');
  const fromAssetWatch = form.watch('fromAsset');
  const toAssetWatch = form.watch('toAsset');

  const effectiveRate = useMemo(() => {
    if (fromAmount && toAmount && fromAssetWatch && toAssetWatch && fromAmount > 0 && toAmount > 0) {
      const rate = toAmount / fromAmount;
      return `1 ${fromAssetWatch.toUpperCase()} = ${rate.toFixed(Math.max(2, Math.min(8, (rate < 0.0001 ? 10 : 6))))} ${toAssetWatch.toUpperCase()}`;
    }
    return null;
  }, [fromAmount, toAmount, fromAssetWatch, toAssetWatch]);

  const handleFormSubmit = async (data: AddSwapFormData) => {
    const swapDataToSave: NewSwapData = {
      ...data,
      date: formatDateFns(data.date, 'yyyy-MM-dd'),
      fromAsset: data.fromAsset.toUpperCase(),
      toAsset: data.toAsset.toUpperCase(),
      feeCurrency: data.feeCurrency ? data.feeCurrency.toUpperCase() : null,
      feeAmount: data.feeAmount === undefined || data.feeAmount === null ? null : data.feeAmount,
      notes: data.notes || null,
    };
    await passedOnSubmit(swapDataToSave);
    if (!initialData?.id) {
      form.reset({
        date: new Date(), platformAccountId: undefined, fromAsset: undefined, fromAmount: undefined,
        toAsset: undefined, toAmount: undefined, feeAmount: undefined, feeCurrency: undefined, notes: ""
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
         <Alert variant="default" className="bg-muted/50">
          <Info className="h-4 w-4" />
          <AlertTitle>Important Note on Balances</AlertTitle>
          <AlertDescription className="text-xs">
            Recording a swap here logs the event. To reflect changes in your GoldQuest account balances,
            please also record corresponding transfers between your currency-specific sub-accounts (e.g., "Wise EUR" to "Wise BRL")
            or adjust balances via expense/income entries if you manage platforms as single-currency accounts.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
           <FormField
            control={form.control}
            name="platformAccountId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Platform/Service Account</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select platform (e.g., Wise, Binance)" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.providerName})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>The account in GoldQuest representing the service where the swap occurred.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Swap Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? formatDateFns(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={(date) => date > new Date()} />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="text-center py-2">
            <Repeat className="h-5 w-5 text-muted-foreground inline-block" />
            <p className="text-sm font-medium text-muted-foreground">Swap Details</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <FormField
            control={form.control}
            name="fromAsset"
            render={({ field }) => (
              <FormItem>
                <FormLabel>From Asset</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select source asset" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {allAssets.map((asset) => (
                      <SelectItem key={asset} value={asset}>{asset} ({getCurrencySymbol(asset)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fromAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>From Amount</FormLabel>
                <FormControl><Input type="number" placeholder="100.00" step="any" {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <FormField
            control={form.control}
            name="toAsset"
            render={({ field }) => (
              <FormItem>
                <FormLabel>To Asset</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select destination asset" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {allAssets.map((asset) => (
                      <SelectItem key={asset} value={asset}>{asset} ({getCurrencySymbol(asset)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="toAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>To Amount (Received)</FormLabel>
                <FormControl><Input type="number" placeholder="525.50" step="any" {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
         {effectiveRate && (
          <div className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/30 text-center">
            Effective Rate: {effectiveRate}
          </div>
        )}

        <div className="text-center py-2">
             <p className="text-sm font-medium text-muted-foreground">Fees (Optional)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <FormField
            control={form.control}
            name="feeAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fee Amount</FormLabel>
                <FormControl><Input type="number" placeholder="0.50" step="any" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="feeCurrency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fee Currency</FormLabel>
                <Select onValueChange={v => field.onChange(v === "__NONE__" ? null : v)} value={field.value ?? "__NONE__"}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select fee currency" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="__NONE__">-- None --</SelectItem>
                    {allAssets.map((asset) => (
                      <SelectItem key={asset} value={asset}>{asset} ({getCurrencySymbol(asset)})</SelectItem>
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
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl><Textarea placeholder="Details about the swap, e.g., reason, specific platform details..." {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : e.target.value)}/></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (initialData?.id ? "Saving Swap..." : "Adding Swap...") : (initialData?.id ? "Save Changes" : "Add Swap Record")}
        </Button>
      </form>
    </Form>
  );
};

export default AddSwapForm;

