
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import InvestmentPricePanel from "@/components/investments/investment-price-panel";
import { AreaChart, DollarSign, Euro, Bitcoin as BitcoinIcon } from "lucide-react";
import { getUserPreferences } from '@/lib/preferences';
import { convertCurrency, getCurrencySymbol, supportedCurrencies as allAppSupportedCurrencies } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';

const BRLIcon = () => (
  <span className="font-bold text-lg">R$</span>
);

const currencyIcons: { [key: string]: React.ReactNode } = {
  BRL: <BRLIcon />,
  USD: <DollarSign className="h-6 w-6" />,
  EUR: <Euro className="h-6 w-6" />,
  BTC: <BitcoinIcon className="h-6 w-6" />,
};

const currencyNames: { [key: string]: string } = {
  BRL: "Real Brasileiro",
  USD: "Dólar Americano",
  EUR: "Euro",
  BTC: "Bitcoin",
};

const displayAssetCodes = ["BRL", "USD", "EUR", "BTC"];


export default function InvestmentsPage() {
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const [isLoading, setIsLoading] = useState(true);
  const [bitcoinPrice, setBitcoinPrice] = useState<number | null>(null);
  const [isBitcoinPriceLoading, setIsBitcoinPriceLoading] = useState(true); // Start as true
  const [bitcoinPriceError, setBitcoinPriceError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrefs = async () => {
      setIsLoading(true); // General loading for preferences
      if (typeof window !== 'undefined') {
        try {
          const prefs = await getUserPreferences();
          setPreferredCurrency(prefs.preferredCurrency.toUpperCase());
        } catch (error) {
          console.error("Failed to fetch user preferences:", error);
          // Keep default preferredCurrency if error
        }
      }
      setIsLoading(false); // Preferences loading finished
    };
    fetchPrefs();
  }, []);

  useEffect(() => {
    const fetchBitcoinPrice = async () => {
        if (!preferredCurrency || typeof window === 'undefined') {
             setIsBitcoinPriceLoading(false);
             return;
        }

        setIsBitcoinPriceLoading(true);
        setBitcoinPriceError(null);
        setBitcoinPrice(null);

        const preferredCurrencyLower = preferredCurrency.toLowerCase();
        // Common currencies supported by CoinGecko for `vs_currencies`
        const directlySupportedVsCurrencies = ['usd', 'eur', 'brl', 'gbp', 'jpy', 'cad', 'aud', 'chf']; 
        let targetCoingeckoCurrency = preferredCurrencyLower;

        if (!directlySupportedVsCurrencies.includes(preferredCurrencyLower)) {
            console.warn(`Preferred currency ${preferredCurrency} might not be directly supported by Coingecko for BTC price. Fetching in USD and will convert.`);
            targetCoingeckoCurrency = 'usd'; // Fallback to USD
        }

        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${targetCoingeckoCurrency}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Unknown API error structure" }));
                throw new Error(`Coingecko API request failed: ${response.status} ${response.statusText} - ${errorData?.error || 'Details unavailable'}`);
            }
            const data = await response.json();

            if (data.bitcoin && data.bitcoin[targetCoingeckoCurrency]) {
                let priceInTargetCoinGeckoCurrency = data.bitcoin[targetCoingeckoCurrency];
                if (targetCoingeckoCurrency.toUpperCase() !== preferredCurrency.toUpperCase()) {
                    // Convert if we fetched in a fallback currency (e.g., USD)
                    const convertedPrice = convertCurrency(priceInTargetCoinGeckoCurrency, targetCoingeckoCurrency.toUpperCase(), preferredCurrency);
                    setBitcoinPrice(convertedPrice);
                } else {
                    setBitcoinPrice(priceInTargetCoinGeckoCurrency);
                }
            } else {
                throw new Error(`Bitcoin price not found in Coingecko response for the target currency '${targetCoingeckoCurrency}'.`);
            }
        } catch (err: any) {
            console.error("Failed to fetch Bitcoin price:", err);
            setBitcoinPriceError(err.message || "Could not load Bitcoin price.");
            // Attempt a fallback conversion if error occurs during API fetch
            setBitcoinPrice(convertCurrency(1, "BTC", preferredCurrency)); 
        } finally {
            setIsBitcoinPriceLoading(false);
        }
    };

    if (preferredCurrency && !isLoading) { // Only fetch if preferredCurrency is set and initial prefs loading is done
        fetchBitcoinPrice();
    }
  }, [preferredCurrency, isLoading]); // Re-fetch if preferredCurrency or general isLoading state changes


  const dynamicPriceData = useMemo(() => {
    // isLoading here refers to the general page loading (preferences)
    if (isLoading) return displayAssetCodes.map(code => ({
        name: currencyNames[code] || code,
        code: code,
        price: null,
        change: "Loading...",
        icon: currencyIcons[code] || <DollarSign className="h-6 w-6" />,
        against: preferredCurrency,
        isLoading: true,
    }));


    return displayAssetCodes.map(assetCode => {
      let priceInPreferredCurrency: number | null = null;
      let displayChange = "+0.00%"; // Default change
      let isAssetSpecificLoading = false;

      if (assetCode === "BTC") {
          isAssetSpecificLoading = isBitcoinPriceLoading;
          if (isBitcoinPriceLoading) {
              displayChange = "Loading...";
          } else if (bitcoinPriceError) {
              priceInPreferredCurrency = convertCurrency(1, "BTC", preferredCurrency); // Show fallback converted price
              displayChange = "Error";
          } else if (bitcoinPrice !== null) {
              priceInPreferredCurrency = bitcoinPrice;
              // Note: CoinGecko simple price doesn't provide 24h change.
              // A more complex API call or storing previous day's price would be needed for dynamic change.
              displayChange = "N/A"; // Or fetch if you have a source for 24h change
          } else {
              // This case might occur if fetchBitcoinPrice hasn't completed yet or failed silently before error state set
              priceInPreferredCurrency = convertCurrency(1, "BTC", preferredCurrency); // Fallback
              displayChange = "N/A";
          }
      } else if (assetCode === preferredCurrency) {
          priceInPreferredCurrency = 1.00;
      } else {
          priceInPreferredCurrency = convertCurrency(1, assetCode, preferredCurrency);
           // Example static changes for non-BTC, non-preferred assets
          if(assetCode === "USD") displayChange = "-0.05%";
          if(assetCode === "EUR") displayChange = "+0.02%";
          if(assetCode === "BRL") displayChange = "-0.01%"; // Example if BRL is not preferred
      }
      
      return {
        name: currencyNames[assetCode] || assetCode,
        code: assetCode,
        price: priceInPreferredCurrency,
        change: displayChange, 
        icon: currencyIcons[assetCode] || <DollarSign className="h-6 w-6" />,
        against: preferredCurrency,
        isLoading: isAssetSpecificLoading,
      };
    }).filter(item => 
        allAppSupportedCurrencies.includes(item.code) && 
        allAppSupportedCurrencies.includes(item.against)
    );

  }, [preferredCurrency, isLoading, bitcoinPrice, isBitcoinPriceLoading, bitcoinPriceError]);

  if (isLoading && !preferredCurrency) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 space-y-8">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
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

