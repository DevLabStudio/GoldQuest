
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import InvestmentPricePanel from "@/components/investments/investment-price-panel";
import { AreaChart, DollarSign, Euro, Bitcoin as BitcoinIcon } from "lucide-react"; // Removed PoundSterling
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

const displayAssetCodes = ["BRL", "USD", "EUR", "BTC"]; // Removed GBP


export default function InvestmentsPage() {
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const [isLoading, setIsLoading] = useState(true);
  const [bitcoinPrice, setBitcoinPrice] = useState<number | null>(null);
  const [isBitcoinPriceLoading, setIsBitcoinPriceLoading] = useState(false);
  const [bitcoinPriceError, setBitcoinPriceError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrefs = async () => {
      setIsLoading(true);
      if (typeof window !== 'undefined') {
        try {
          const prefs = await getUserPreferences();
          setPreferredCurrency(prefs.preferredCurrency.toUpperCase());
        } catch (error) {
          console.error("Failed to fetch user preferences:", error);
        }
      }
      setIsLoading(false);
    };
    fetchPrefs();
  }, []);

  useEffect(() => {
    const fetchBitcoinPrice = async () => {
        if (!preferredCurrency || typeof window === 'undefined') return;

        setIsBitcoinPriceLoading(true);
        setBitcoinPriceError(null);
        setBitcoinPrice(null); 

        const preferredCurrencyLower = preferredCurrency.toLowerCase();
        let targetCoingeckoCurrency = preferredCurrencyLower;
        const supportedCoingeckoVsCurrencies = ['usd', 'eur', 'brl', 'gbp']; 

        if (!supportedCoingeckoVsCurrencies.includes(preferredCurrencyLower)) {
            console.warn(`Preferred currency ${preferredCurrency} not directly supported by Coingecko for BTC price. Fetching in USD and converting.`);
            targetCoingeckoCurrency = 'usd';
        }

        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${targetCoingeckoCurrency}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Coingecko API request failed: ${response.status} ${response.statusText} - ${errorData?.error || 'Unknown error'}`);
            }
            const data = await response.json();
            if (data.bitcoin && data.bitcoin[targetCoingeckoCurrency]) {
                let price = data.bitcoin[targetCoingeckoCurrency];
                if (targetCoingeckoCurrency !== preferredCurrencyLower) {
                    price = convertCurrency(price, targetCoingeckoCurrency.toUpperCase(), preferredCurrency);
                }
                setBitcoinPrice(price);
            } else {
                throw new Error("Bitcoin price not found in Coingecko response for the target currency.");
            }
        } catch (err: any) {
            console.error("Failed to fetch Bitcoin price:", err);
            setBitcoinPriceError(err.message || "Could not load Bitcoin price.");
            setBitcoinPrice(convertCurrency(1, "BTC", preferredCurrency)); // Fallback
        } finally {
            setIsBitcoinPriceLoading(false);
        }
    };

    if (preferredCurrency) { // Only fetch if preferredCurrency is set
        fetchBitcoinPrice();
    }
  }, [preferredCurrency]);


  const dynamicPriceData = useMemo(() => {
    if (isLoading) return [];

    return displayAssetCodes.map(assetCode => {
      let priceInPreferredCurrency;
      let displayChange = "+0.00%";
      let isAssetLoading = false;

      if (assetCode === "BTC") {
          if (isBitcoinPriceLoading) {
              isAssetLoading = true;
              priceInPreferredCurrency = 0; // Placeholder
              displayChange = "Loading...";
          } else if (bitcoinPriceError) {
              priceInPreferredCurrency = convertCurrency(1, "BTC", preferredCurrency); // Fallback
              displayChange = "Error";
          } else if (bitcoinPrice !== null) {
              priceInPreferredCurrency = bitcoinPrice;
              // Fetching 24h change from Coingecko requires a different endpoint or more complex logic.
              // For simplicity, we'll use a static placeholder or could calculate if previous day's price was stored.
              displayChange = "+0.00%"; // Placeholder for BTC dynamic change
          } else {
              priceInPreferredCurrency = convertCurrency(1, "BTC", preferredCurrency); // Fallback
          }
      } else if (assetCode === preferredCurrency) {
          priceInPreferredCurrency = 1.00;
      } else {
          priceInPreferredCurrency = convertCurrency(1, assetCode, preferredCurrency);
      }
      
      // Static changes for non-BTC assets
      if(assetCode === "USD") displayChange = "-0.15%";
      if(assetCode === "EUR") displayChange = "+0.10%";

      return {
        name: currencyNames[assetCode] || assetCode,
        code: assetCode,
        price: priceInPreferredCurrency,
        change: displayChange, 
        icon: currencyIcons[assetCode] || <DollarSign className="h-6 w-6" />,
        against: preferredCurrency,
        isLoading: isAssetLoading,
      };
    }).filter(item => 
        allAppSupportedCurrencies.includes(item.code) && 
        allAppSupportedCurrencies.includes(item.against)
    );

  }, [preferredCurrency, isLoading, bitcoinPrice, isBitcoinPriceLoading, bitcoinPriceError]);

  if (isLoading && !preferredCurrency) { // Adjusted loading condition
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 space-y-8">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"> {/* Adjusted grid for 3 items */}
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
