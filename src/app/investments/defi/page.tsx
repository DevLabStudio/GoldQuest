
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import InvestmentPricePanel from "@/components/investments/investment-price-panel";
import { AreaChart, DollarSign, Euro, Bitcoin as BitcoinIcon, WalletCards, LinkIcon, UnlinkIcon, CircleDollarSign } from "lucide-react";
import { getUserPreferences } from '@/lib/preferences';
import { convertCurrency, getCurrencySymbol, supportedCurrencies as allAppSupportedCurrencies } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';

const BRLIcon = () => (
  <span className="font-bold text-lg">R$</span>
);

// Updated icons and names for specific cryptos
const currencyIcons: { [key: string]: React.ReactNode } = {
  BRL: <BRLIcon />, // Still useful for preferredCurrency display
  USD: <DollarSign className="h-6 w-6" />, // Still useful for preferredCurrency display
  EUR: <Euro className="h-6 w-6" />, // Still useful for preferredCurrency display
  BTC: <BitcoinIcon className="h-6 w-6" />,
  ETH: <CircleDollarSign className="h-6 w-6 text-blue-500" />, // Placeholder for ETH
  SOL: <CircleDollarSign className="h-6 w-6 text-purple-500" />, // Placeholder for SOL
};

const currencyNames: { [key: string]: string } = {
  BRL: "Real Brasileiro",
  USD: "Dólar Americano",
  EUR: "Euro",
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
};

// Updated display asset codes
const displayAssetCodes = ["ETH", "SOL", "BTC"];
const coingeckoAssetIds = {
  ETH: "ethereum",
  SOL: "solana",
  BTC: "bitcoin",
};


export default function DeFiInvestmentsPage() {
  const { user, isLoadingAuth } = useAuthContext();
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
  
  // Updated state for crypto prices
  const [cryptoPrices, setCryptoPrices] = useState<{ [key: string]: number | null }>({ ETH: null, SOL: null, BTC: null });
  const [isCryptoPricesLoading, setIsCryptoPricesLoading] = useState(true);
  const [cryptoPricesError, setCryptoPricesError] = useState<string | null>(null);

  const [connectedWalletAddress, setConnectedWalletAddress] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const fetchPrefs = useCallback(async () => {
    if (!user || isLoadingAuth || typeof window === 'undefined') {
        setIsLoadingPrefs(false);
        if (!user && !isLoadingAuth) console.log("User not logged in, using default preferences for DeFi investments page.");
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

  // Renamed and generalized function to fetch prices for ETH, SOL, BTC
  const fetchCryptoPrices = useCallback(async () => {
    if (!preferredCurrency || typeof window === 'undefined' || isLoadingPrefs) {
            setIsCryptoPricesLoading(false);
            return;
    }

    setIsCryptoPricesLoading(true);
    setCryptoPricesError(null);
    setCryptoPrices({ ETH: null, SOL: null, BTC: null }); // Reset prices

    const preferredCurrencyLower = preferredCurrency.toLowerCase();
    const directlySupportedVsCurrencies = ['usd', 'eur', 'brl', 'gbp', 'jpy', 'cad', 'aud', 'chf']; // Common CoinGecko vs_currencies
    let targetCoingeckoCurrency = preferredCurrencyLower;

    if (!directlySupportedVsCurrencies.includes(preferredCurrencyLower)) {
        console.warn(`Preferred currency ${preferredCurrency} might not be directly supported by CoinGecko for all assets. Fetching in USD and will convert.`);
        targetCoingeckoCurrency = 'usd';
    }
    
    const assetIdsString = Object.values(coingeckoAssetIds).join(',');

    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${assetIdsString}&vs_currencies=${targetCoingeckoCurrency}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown API error structure" }));
            throw new Error(`CoinGecko API request failed: ${response.status} ${response.statusText} - ${errorData?.error || 'Details unavailable'}`);
        }
        const data = await response.json();
        const newPrices: { [key: string]: number | null } = {};

        for (const code of displayAssetCodes) {
            const coingeckoId = (coingeckoAssetIds as any)[code];
            if (data[coingeckoId] && data[coingeckoId][targetCoingeckoCurrency]) {
                let priceInTargetCoinGeckoCurrency = data[coingeckoId][targetCoingeckoCurrency];
                if (targetCoingeckoCurrency.toUpperCase() !== preferredCurrency.toUpperCase()) {
                    // Convert if fetched currency is not the preferred one (e.g., fetched in USD, need BRL)
                    newPrices[code] = convertCurrency(priceInTargetCoinGeckoCurrency, targetCoingeckoCurrency.toUpperCase(), preferredCurrency);
                } else {
                    newPrices[code] = priceInTargetCoinGeckoCurrency;
                }
            } else {
                 console.warn(`Price for ${code} not found in Coingecko response for target currency '${targetCoingeckoCurrency}'. Will try to convert from static BTC rate if ${code} is BTC.`);
                 if(code === 'BTC') { // Fallback for BTC if primary fetch fails for it
                    newPrices[code] = convertCurrency(1, "BTC", preferredCurrency);
                 } else {
                    newPrices[code] = null;
                 }
            }
        }
        setCryptoPrices(newPrices);

    } catch (err: any) {
        console.error("Failed to fetch crypto prices:", err);
        setCryptoPricesError(err.message || "Could not load crypto prices.");
        // Fallback for all display assets on error
        const fallbackPrices: { [key: string]: number | null } = {};
        displayAssetCodes.forEach(code => {
            fallbackPrices[code] = convertCurrency(1, code, preferredCurrency); // Assumes convertCurrency can handle BTC, ETH, SOL if static rates for them exist or as a concept
        });
        setCryptoPrices(fallbackPrices);
    } finally {
        setIsCryptoPricesLoading(false);
    }
  }, [preferredCurrency, isLoadingPrefs]);

  useEffect(() => {
    if (user && !isLoadingAuth && !isLoadingPrefs) {
      fetchCryptoPrices();
    } else if (!isLoadingAuth && !user && !isLoadingPrefs) { // Also check isLoadingPrefs
        setIsCryptoPricesLoading(false);
    }
  }, [fetchCryptoPrices, user, isLoadingAuth, isLoadingPrefs]);


  const dynamicPriceData = useMemo(() => {
    // Filter for the new displayAssetCodes (ETH, SOL, BTC)
    // No need to filter out preferredCurrency as these are cryptos
    const codesToDisplay = displayAssetCodes;

    if (isLoadingAuth || isLoadingPrefs) {
      return codesToDisplay.map(code => ({
        name: currencyNames[code] || code,
        code: code,
        price: null,
        change: "Loading...",
        icon: currencyIcons[code] || <DollarSign className="h-6 w-6" />,
        against: preferredCurrency,
        isLoading: true,
      }));
    }

    return codesToDisplay.map(assetCode => {
      let priceInPreferredCurrency: number | null = cryptoPrices[assetCode];
      let displayChange = "N/A"; // Real-time change % is complex, setting to N/A for now
      let isAssetSpecificLoading = isCryptoPricesLoading;

      if (isCryptoPricesLoading) {
          displayChange = "Loading...";
      } else if (cryptoPricesError && cryptoPrices[assetCode] === null) { // Error specific to this asset or general error
          displayChange = "Error";
          // Attempt to use static conversion if available, mainly for BTC
          if (assetCode === "BTC") priceInPreferredCurrency = convertCurrency(1, "BTC", preferredCurrency);
          else priceInPreferredCurrency = null; // For ETH/SOL, if API fails, show null
      } else if (priceInPreferredCurrency === null && !isCryptoPricesLoading) {
           displayChange = "N/A"; // Price not found or API issue
      }
      
      return {
        name: currencyNames[assetCode] || assetCode,
        code: assetCode,
        price: priceInPreferredCurrency,
        change: displayChange, // Real-time change requires more complex API or websockets
        icon: currencyIcons[assetCode] || <CircleDollarSign className="h-6 w-6" />,
        against: preferredCurrency,
        isLoading: isAssetSpecificLoading,
      };
    });
  }, [preferredCurrency, isLoadingAuth, isLoadingPrefs, cryptoPrices, isCryptoPricesLoading, cryptoPricesError]);

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
        <Skeleton className="h-40 w-full mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Decentralized Finances (DeFi)</h1>
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


    