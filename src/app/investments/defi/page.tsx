
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import InvestmentPricePanel from "@/components/investments/investment-price-panel";
import { AreaChart, DollarSign, Euro, Bitcoin as BitcoinIcon, WalletCards, LinkIcon, UnlinkIcon, CircleDollarSign } from "lucide-react";
// getUserPreferences removed as we get it from AuthContext
import { convertCurrency, getCurrencySymbol } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';

const BRLIcon = () => (
  <span className="font-bold text-lg">R$</span>
);

const currencyIcons: { [key: string]: React.ReactNode } = {
  BRL: <BRLIcon />,
  USD: <DollarSign className="h-6 w-6" />,
  EUR: <Euro className="h-6 w-6" />,
  BTC: <BitcoinIcon className="h-6 w-6" />,
  ETH: <CircleDollarSign className="h-6 w-6 text-blue-500" />,
  SOL: <CircleDollarSign className="h-6 w-6 text-purple-500" />,
};

const currencyNames: { [key: string]: string } = {
  BRL: "Real Brasileiro",
  USD: "Dólar Americano",
  EUR: "Euro",
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
};

const displayAssetCodes = ["ETH", "SOL", "BTC"];
const coingeckoAssetIds = {
  ETH: "ethereum",
  SOL: "solana",
  BTC: "bitcoin",
};

export default function DeFiInvestmentsPage() {
  const { user, isLoadingAuth, userPreferences } = useAuthContext();
  // Use investment-specific currency from preferences, fallback to global or 'USD'
  const investmentsDisplayCurrency = useMemo(() => {
      return userPreferences?.investmentsPreferredCurrency || userPreferences?.preferredCurrency || 'USD';
  }, [userPreferences]);

  const [cryptoPrices, setCryptoPrices] = useState<{ [key: string]: number | null }>({ ETH: null, SOL: null, BTC: null });
  const [isCryptoPricesLoading, setIsCryptoPricesLoading] = useState(true);
  const [cryptoPricesError, setCryptoPricesError] = useState<string | null>(null);

  const [connectedWalletAddress, setConnectedWalletAddress] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);


  const fetchCryptoPrices = useCallback(async () => {
    if (typeof window === 'undefined' || !investmentsDisplayCurrency) {
            setIsCryptoPricesLoading(false);
            return;
    }

    setIsCryptoPricesLoading(true);
    setCryptoPricesError(null);
    setCryptoPrices({ ETH: null, SOL: null, BTC: null });

    const targetVsCurrencyLower = investmentsDisplayCurrency.toLowerCase();
    const directlySupportedVsCurrencies = ['usd', 'eur', 'brl', 'gbp', 'jpy', 'cad', 'aud', 'chf'];
    let fetchAgainstCurrency = targetVsCurrencyLower;

    if (!directlySupportedVsCurrencies.includes(targetVsCurrencyLower)) {
        console.warn(`Investments currency ${investmentsDisplayCurrency} might not be directly supported by CoinGecko for all assets. Fetching in USD and will convert.`);
        fetchAgainstCurrency = 'usd';
    }
    
    const assetIdsString = Object.values(coingeckoAssetIds).join(',');

    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${assetIdsString}&vs_currencies=${fetchAgainstCurrency}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown API error structure" }));
            throw new Error(`CoinGecko API request failed: ${response.status} ${response.statusText} - ${errorData?.error || 'Details unavailable'}`);
        }
        const data = await response.json();
        const newPrices: { [key: string]: number | null } = {};

        for (const code of displayAssetCodes) {
            const coingeckoId = (coingeckoAssetIds as any)[code];
            if (data[coingeckoId] && data[coingeckoId][fetchAgainstCurrency]) {
                let priceInFetchedCurrency = data[coingeckoId][fetchAgainstCurrency];
                if (fetchAgainstCurrency.toUpperCase() !== investmentsDisplayCurrency.toUpperCase()) {
                    newPrices[code] = convertCurrency(priceInFetchedCurrency, fetchAgainstCurrency.toUpperCase(), investmentsDisplayCurrency);
                } else {
                    newPrices[code] = priceInFetchedCurrency;
                }
            } else {
                 console.warn(`Price for ${code} not found in Coingecko response for target currency '${fetchAgainstCurrency}'.`);
                 newPrices[code] = null; // Explicitly set to null if not found
            }
        }
        setCryptoPrices(newPrices);

    } catch (err: any) {
        console.error("Failed to fetch crypto prices:", err);
        setCryptoPricesError(err.message || "Could not load crypto prices.");
        const fallbackPrices: { [key: string]: number | null } = {};
        displayAssetCodes.forEach(code => {
            fallbackPrices[code] = null; // Ensure fallback is null on error
        });
        setCryptoPrices(fallbackPrices);
    } finally {
        setIsCryptoPricesLoading(false);
    }
  }, [investmentsDisplayCurrency]);

  useEffect(() => {
    // Fetch prices if user is loaded, not loading auth, and we have the investment display currency
    if (user && !isLoadingAuth && investmentsDisplayCurrency) {
      fetchCryptoPrices();
    } else if (!isLoadingAuth && !user) {
        setIsCryptoPricesLoading(false); // Stop loading if no user
    }
  }, [fetchCryptoPrices, user, isLoadingAuth, investmentsDisplayCurrency]);


  const dynamicPriceData = useMemo(() => {
    const codesToDisplay = displayAssetCodes;

    if (isLoadingAuth || !userPreferences) { // Check for userPreferences existence as well
      return codesToDisplay.map(code => ({
        name: currencyNames[code] || code,
        code: code,
        price: null,
        change: "Loading...",
        icon: currencyIcons[code] || <DollarSign className="h-6 w-6" />,
        against: investmentsDisplayCurrency,
        isLoading: true,
      }));
    }

    return codesToDisplay.map(assetCode => {
      let priceInPreferredCurrency: number | null = cryptoPrices[assetCode];
      let displayChange = "N/A"; 
      let isAssetSpecificLoading = isCryptoPricesLoading;

      if (isCryptoPricesLoading) {
          displayChange = "Loading...";
      } else if (cryptoPricesError && cryptoPrices[assetCode] === null) { 
          displayChange = "Error";
          priceInPreferredCurrency = null; 
      } else if (priceInPreferredCurrency === null && !isCryptoPricesLoading) {
           displayChange = "N/A";
      }
      
      return {
        name: currencyNames[assetCode] || assetCode,
        code: assetCode,
        price: priceInPreferredCurrency,
        change: displayChange,
        icon: currencyIcons[assetCode] || <CircleDollarSign className="h-6 w-6" />,
        against: investmentsDisplayCurrency,
        isLoading: isAssetSpecificLoading,
      };
    });
  }, [investmentsDisplayCurrency, isLoadingAuth, userPreferences, cryptoPrices, isCryptoPricesLoading, cryptoPricesError]);

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

  if (isLoadingAuth || !userPreferences) {
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
