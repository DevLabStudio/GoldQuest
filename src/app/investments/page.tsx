
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import InvestmentPricePanel from "@/components/investments/investment-price-panel";
import { AreaChart, DollarSign, Euro, Bitcoin as BitcoinIcon } from "lucide-react";
import { getUserPreferences } from '@/lib/preferences';
import { convertCurrency, getCurrencySymbol, supportedCurrencies as allAppSupportedCurrencies } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/contexts/AuthContext';

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
  const { user, isLoadingAuth } = useAuthContext();
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
  const [bitcoinPrice, setBitcoinPrice] = useState<number | null>(null);
  const [isBitcoinPriceLoading, setIsBitcoinPriceLoading] = useState(true);
  const [bitcoinPriceError, setBitcoinPriceError] = useState<string | null>(null);

  const fetchPrefs = useCallback(async () => {
    if (!user || isLoadingAuth || typeof window === 'undefined') {
        setIsLoadingPrefs(false);
        if (!user && !isLoadingAuth) console.log("User not logged in, using default preferences for investments page.");
        return;
    }
    setIsLoadingPrefs(true);
    try {
        const prefs = await getUserPreferences();
        setPreferredCurrency(prefs.preferredCurrency.toUpperCase());
    } catch (error) {
        console.error("Failed to fetch user preferences:", error);
    } finally {
        setIsLoadingPrefs(false);
    }
  }, [user, isLoadingAuth]);

  useEffect(() => {
      fetchPrefs();
  }, [fetchPrefs]);

  const fetchBitcoinPrice = useCallback(async () => {
    if (!preferredCurrency || typeof window === 'undefined' || isLoadingPrefs) {
            setIsBitcoinPriceLoading(false);
            return;
    }

    setIsBitcoinPriceLoading(true);
    setBitcoinPriceError(null);
    setBitcoinPrice(null);

    const preferredCurrencyLower = preferredCurrency.toLowerCase();
    const directlySupportedVsCurrencies = ['usd', 'eur', 'brl', 'gbp', 'jpy', 'cad', 'aud', 'chf'];
    let targetCoingeckoCurrency = preferredCurrencyLower;

    if (!directlySupportedVsCurrencies.includes(preferredCurrencyLower)) {
        console.warn(`Preferred currency ${preferredCurrency} might not be directly supported by Coingecko for BTC price. Fetching in USD and will convert.`);
        targetCoingeckoCurrency = 'usd';
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
        setBitcoinPrice(convertCurrency(1, "BTC", preferredCurrency));
    } finally {
        setIsBitcoinPriceLoading(false);
    }
  }, [preferredCurrency, isLoadingPrefs]);

  useEffect(() => {
    if (user && !isLoadingAuth && !isLoadingPrefs) {
      fetchBitcoinPrice();
    }
  }, [fetchBitcoinPrice, user, isLoadingAuth, isLoadingPrefs]);


  const dynamicPriceData = useMemo(() => {
    const filteredAssetCodes = displayAssetCodes.filter(code => code !== preferredCurrency);

    if (isLoadingAuth || isLoadingPrefs) {
      return filteredAssetCodes.map(code => ({
        name: currencyNames[code] || code,
        code: code,
        price: null,
        change: "Loading...",
        icon: currencyIcons[code] || <DollarSign className="h-6 w-6" />,
        against: preferredCurrency,
        isLoading: true,
      }));
    }

    return filteredAssetCodes.map(assetCode => {
      let priceInPreferredCurrency: number | null = null;
      let displayChange = "+0.00%";
      let isAssetSpecificLoading = false;

      if (assetCode === "BTC") {
          isAssetSpecificLoading = isBitcoinPriceLoading;
          if (isBitcoinPriceLoading) {
              displayChange = "Loading...";
          } else if (bitcoinPriceError) {
              priceInPreferredCurrency = convertCurrency(1, "BTC", preferredCurrency);
              displayChange = "Error";
          } else if (bitcoinPrice !== null) {
              priceInPreferredCurrency = bitcoinPrice;
              displayChange = "N/A";
          } else {
              priceInPreferredCurrency = convertCurrency(1, "BTC", preferredCurrency);
              displayChange = "N/A";
          }
      } else {
          priceInPreferredCurrency = convertCurrency(1, assetCode, preferredCurrency);
          if(assetCode === "USD") displayChange = "-0.05%";
          if(assetCode === "EUR") displayChange = "+0.02%";
          if(assetCode === "BRL") displayChange = "-0.01%";
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

  }, [preferredCurrency, isLoadingAuth, isLoadingPrefs, bitcoinPrice, isBitcoinPriceLoading, bitcoinPriceError]);

  if (isLoadingAuth || isLoadingPrefs) {
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

