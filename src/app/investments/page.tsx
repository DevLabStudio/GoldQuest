
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import InvestmentPricePanel from "@/components/investments/investment-price-panel";
import { AreaChart, DollarSign, Euro, Bitcoin as BitcoinIcon, WalletCards, LinkIcon, UnlinkIcon } from "lucide-react"; // Added WalletCards, LinkIcon, UnlinkIcon
import { getUserPreferences } from '@/lib/preferences';
import { convertCurrency, getCurrencySymbol, supportedCurrencies as allAppSupportedCurrencies } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button'; // Added Button
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert
import { AlertCircle } from 'lucide-react'; // Added AlertCircle

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

  // Wallet Connection State
  const [connectedWalletAddress, setConnectedWalletAddress] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

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
        // Fallback to using internal conversion if API fails, useful if BTC is manually added as an account
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
              priceInPreferredCurrency = convertCurrency(1, "BTC", preferredCurrency); // Fallback if API fails
              displayChange = "Error";
          } else if (bitcoinPrice !== null) {
              priceInPreferredCurrency = bitcoinPrice;
              // For now, we don't have historical data from CoinGecko for percentage change.
              displayChange = "N/A";
          } else {
               priceInPreferredCurrency = convertCurrency(1, "BTC", preferredCurrency); // Fallback if API fails
               displayChange = "N/A"; // Or "Error"
          }
      } else {
          priceInPreferredCurrency = convertCurrency(1, assetCode, preferredCurrency);
          // Example placeholder changes, replace with actual data if available
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
        allAppSupportedCurrencies.includes(item.code.toUpperCase()) &&
        allAppSupportedCurrencies.includes(item.against.toUpperCase())
    );

  }, [preferredCurrency, isLoadingAuth, isLoadingPrefs, bitcoinPrice, isBitcoinPriceLoading, bitcoinPriceError]);

  const handleConnectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      setWalletError("MetaMask (or a compatible Web3 wallet) is not installed. Please install it to connect.");
      return;
    }
    setIsConnectingWallet(true);
    setWalletError(null);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setConnectedWalletAddress(accounts[0]);
      } else {
        setWalletError("No accounts found. Please ensure your wallet is set up correctly.");
      }
    } catch (error: any) {
      console.error("Wallet connection error:", error);
      setWalletError(error.message || "Failed to connect wallet. User rejected or an unknown error occurred.");
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleDisconnectWallet = () => {
    setConnectedWalletAddress(null);
    setWalletError(null);
  };

  const truncateAddress = (address: string | null) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  if (isLoadingAuth || isLoadingPrefs) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 space-y-8">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-40 w-full mb-8" /> {/* Placeholder for Price Panel */}
        <Skeleton className="h-64 w-full" /> {/* Placeholder for Portfolio Card */}
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
          <CardTitle>Wallet Connection</CardTitle>
          <CardDescription>Connect your Web3 wallet to track your crypto portfolio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {walletError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>{walletError}</AlertDescription>
            </Alert>
          )}
          {!connectedWalletAddress ? (
            <Button onClick={handleConnectWallet} disabled={isConnectingWallet}>
              <LinkIcon className="mr-2 h-4 w-4" />
              {isConnectingWallet ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-sm">
                <span className="font-medium text-muted-foreground">Connected: </span>
                <span className="font-semibold text-primary" title={connectedWalletAddress}>
                  {truncateAddress(connectedWalletAddress)}
                </span>
              </div>
              <Button variant="outline" onClick={handleDisconnectWallet}>
                <UnlinkIcon className="mr-2 h-4 w-4" />
                Disconnect Wallet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Portfolio</CardTitle>
          <CardDescription>
            {connectedWalletAddress 
              ? "Overview of your connected wallet's assets (Portfolio tracking coming soon!)."
              : "Connect your wallet to see your portfolio overview."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            {connectedWalletAddress ? (
              <>
                <WalletCards className="mx-auto h-24 w-24 text-muted-foreground" strokeWidth={1.5}/>
                <p className="mt-4 text-muted-foreground">
                  Portfolio tracking for address <strong className="text-primary">{truncateAddress(connectedWalletAddress)}</strong> is coming soon!
                </p>
              </>
            ) : (
              <>
                <AreaChart className="mx-auto h-24 w-24 text-muted-foreground" strokeWidth={1.5}/>
                <p className="mt-4 text-muted-foreground">
                  Please connect your Web3 wallet to enable portfolio tracking.
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
