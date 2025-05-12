'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import InvestmentPricePanel from "@/components/investments/investment-price-panel";
import { AreaChart, DollarSign, Euro, Bitcoin as BitcoinIcon, PoundSterling } from "lucide-react";
import { getUserPreferences } from '@/lib/preferences';
import { convertCurrency, getCurrencySymbol, supportedCurrencies as allAppSupportedCurrencies } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';

const BRLIcon = () => (
  <span className="font-bold text-lg">R$</span>
);

// Define icons for each display currency for the panel
const currencyIcons: { [key: string]: React.ReactNode } = {
  BRL: <BRLIcon />,
  USD: <DollarSign className="h-6 w-6" />,
  EUR: <Euro className="h-6 w-6" />,
  GBP: <PoundSterling className="h-6 w-6" />,
  BTC: <BitcoinIcon className="h-6 w-6" />,
};

// Define names for each display currency
const currencyNames: { [key: string]: string } = {
  BRL: "Real Brasileiro",
  USD: "Dólar Americano",
  EUR: "Euro",
  GBP: "Libra Esterlina",
  BTC: "Bitcoin",
};

// Currencies we want to display prices FOR in the panel
const displayAssetCodes = ["BRL", "USD", "EUR", "GBP", "BTC"];


export default function InvestmentsPage() {
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPrefs = async () => {
      setIsLoading(true);
      if (typeof window !== 'undefined') {
        try {
          const prefs = await getUserPreferences();
          setPreferredCurrency(prefs.preferredCurrency.toUpperCase());
        } catch (error) {
          console.error("Failed to fetch user preferences:", error);
          // Keep default BRL on error
        }
      }
      setIsLoading(false);
    };
    fetchPrefs();
  }, []);


  const dynamicPriceData = useMemo(() => {
    if (isLoading || !preferredCurrency) return [];

    return displayAssetCodes.map(assetCode => {
      let priceInPreferredCurrency;
      // The price of the preferredCurrency itself, in terms of itself, is 1.
      if (assetCode === preferredCurrency) {
        priceInPreferredCurrency = 1.00;
      } else {
        // Convert 1 unit of assetCode to preferredCurrency
        // convertCurrency(amount, sourceCurrency, targetCurrency)
        priceInPreferredCurrency = convertCurrency(1, assetCode, preferredCurrency);
      }
      
      // The "change" data is static for now, can be made dynamic later
      let staticChange = "+0.00%";
      if(assetCode === "USD") staticChange = "-0.15%";
      if(assetCode === "EUR") staticChange = "+0.10%";
      if(assetCode === "BTC") staticChange = "+2.50%";
      if(assetCode === "GBP") staticChange = "-0.05%";


      return {
        name: currencyNames[assetCode] || assetCode,
        code: assetCode,
        price: priceInPreferredCurrency, // This is: 1 unit of assetCode = X units of preferredCurrency
        change: staticChange, 
        icon: currencyIcons[assetCode] || <DollarSign className="h-6 w-6" />, // Default icon
        against: preferredCurrency, // All prices are against the preferred currency
      };
    }).filter(item => allAppSupportedCurrencies.includes(item.code) && allAppSupportedCurrencies.includes(item.against)); // Ensure both currencies are supported by our static rates

  }, [preferredCurrency, isLoading]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 space-y-8">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <Skeleton className="h-24 w-24" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Investments</h1>
      </div>

      <InvestmentPricePanel prices={dynamicPriceData} />

      <Card>
        <CardHeader>
          <CardTitle>My Portfolio</CardTitle>
          <CardDescription>
            Overview of your investment accounts and performance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <AreaChart className="mx-auto h-24 w-24 text-muted-foreground" strokeWidth={1.5}/>
            <p className="mt-4 text-muted-foreground">
              Investment portfolio tracking feature coming soon!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
