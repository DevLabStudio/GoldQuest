
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthContext } from '@/contexts/AuthContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { Repeat, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';

export default function SwapsPage() {
  const { user, isLoadingAuth } = useAuthContext();
  const { selectedDateRange } = useDateRange();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoadingAuth) {
      setIsLoading(false);
      if (!user) {
        setError("Please log in to view swap transactions.");
      }
    }
  }, [user, isLoadingAuth]);

  if (isLoading) {
    return <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8"><p>Loading swap data...</p></div>;
  }

  if (error) {
    return <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 text-destructive">{error}</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Swap Transactions & Analysis</h1>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>How to Record Swaps & Conversions Currently</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            To accurately track currency swaps (e.g., EUR to BRL within Wise) or crypto trades (e.g., BTC to ETH on Binance), please follow these steps for now:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>
              <strong>Represent Asset Holdings as Separate Accounts:</strong> For platforms like Wise or Binance, create separate "accounts" in GoldQuest for each currency/asset you hold. For example:
              <ul className="list-disc list-inside ml-4">
                <li>"Wise EUR" (Currency: EUR)</li>
                <li>"Wise BRL" (Currency: BRL)</li>
                <li>"Binance BTC" (Currency: BTC)</li>
                <li>"Binance ETH" (Currency: ETH)</li>
              </ul>
            </li>
            <li>
              <strong>Record the Swap/Conversion as a Transfer:</strong> Use the "Add Transfer" functionality.
              <ul className="list-disc list-inside ml-4">
                <li>From: The source "account" and currency (e.g., "Wise EUR").</li>
                <li>Amount: The amount of the source currency converted (e.g., 100 EUR).</li>
                <li>To: The destination "account" and currency (e.g., "Wise BRL").</li>
                <li>Amount in Destination Account: The amount of the destination currency received (e.g., 530 BRL). The app will show the effective rate.</li>
              </ul>
            </li>
            <li>
              <strong>Record Fees Separately:</strong> If there was a fee for the swap/conversion, record it as a separate "Expense" transaction from the relevant account/currency (e.g., an expense of 0.50 EUR from "Wise EUR", categorized as "FX Fees" or "Trading Fees").
            </li>
          </ol>
          <p className="mt-3">
            <strong>Future Enhancements:</strong> This "Swaps" page will be enhanced to automatically identify these patterns, provide a consolidated view of your swap activities, analyze effective exchange rates, and track associated fees more directly. A dedicated "Record Swap" form is also planned.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Repeat className="mr-2 h-6 w-6 text-primary" />
            Swap Activity Overview
          </CardTitle>
          <CardDescription>
            Consolidated view of your currency and cryptocurrency swaps, including effective rates and fees (Coming Soon).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-20">
            <Repeat className="mx-auto h-24 w-24 text-muted-foreground opacity-50" strokeWidth={1.5} />
            <p className="mt-4 text-xl font-semibold text-foreground">
              Detailed Swap Analysis Coming Soon!
            </p>
            <p className="text-muted-foreground">
              This section will provide insights into your swap activities, helping you track conversions and understand associated costs.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
