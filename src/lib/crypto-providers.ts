
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon
// Only import icons we are confident about for now, or fall back to generic
// For crypto, we are now trying to fetch logos via API for selected providers
// and using WalletCards as a general fallback.

const defaultIconSize = 20;

const DefaultCryptoIcon = () => {
  return React.createElement(WalletCards, {
    size: defaultIconSize,
    className: "text-muted-foreground",
  });
};

export interface CryptoProviderInfo {
  name: string;
  type: 'exchange' | 'wallet';
  iconComponent: ReactNode;
  coingeckoExchangeId?: string; // For fetching exchange logos
  dataAiHint?: string;
}

// This map is less critical now as we try to fetch logos for specific exchanges
// and use dynamic components or fallbacks for others.
const specificCryptoIconDetails: {
  [key: string]: { type: 'exchange' | 'wallet'; nameProp: string; color?: string, coingeckoExchangeId?: string };
} = {
  "Binance": { type: "exchange", nameProp: "binance", color: "#F0B90B", coingeckoExchangeId: "binance" },
  "Coinbase": { type: "exchange", nameProp: "coinbase", color: "#0052FF", coingeckoExchangeId: "coinbase_exchange" }, // Or just "coinbase" if it's for the general brand
  "Kraken": { type: "exchange", nameProp: "kraken", color: "#5842C1" },
  "MetaMask": { type: "wallet", nameProp: "metamask", color: "#E2761B" },
  "Ledger": { type: "wallet", nameProp: "ledger" }, // Color can be default
  "Trust Wallet": { type: "wallet", nameProp: "trustwallet", color: "#3375BB" },
};

// This function will primarily serve as a fallback mechanism now.
// The forms will attempt to fetch live logos for Binance/Coinbase.
const createSpecificIcon = (
  providerOfficialName: string,
  _providerType: 'exchange' | 'wallet'
): ReactNode => {
  // For now, always return the default icon.
  // The logo fetching will happen in the forms for Binance/Coinbase.
  // Other icons would require a similar API or a robust library.
  return React.createElement(DefaultCryptoIcon);
};


const popularExchangesRaw: Array<Omit<CryptoProviderInfo, 'iconComponent'>> = [
  { name: "Binance", type: "exchange", dataAiHint: "Binance logo", coingeckoExchangeId: "binance" },
  { name: "Coinbase", type: "exchange", dataAiHint: "Coinbase logo", coingeckoExchangeId: "coinbase_exchange" }, // Note: CoinGecko has "coinbase_exchange"
  { name: "Kraken", type: "exchange", dataAiHint: "Kraken logo", coingeckoExchangeId: "kraken" },
  { name: "OKX", type: "exchange", dataAiHint: "OKX logo", coingeckoExchangeId: "okex" }, // okex is the id for OKX
  { name: "KuCoin", type: "exchange", dataAiHint: "KuCoin logo", coingeckoExchangeId: "kucoin" },
  { name: "Bitstamp", type: "exchange", dataAiHint: "Bitstamp logo", coingeckoExchangeId: "bitstamp" },
  { name: "Gate.io", type: "exchange", dataAiHint: "Gate.io logo", coingeckoExchangeId: "gate" }, // gate is id for Gate.io
  { name: "Huobi (HTX)", type: "exchange", dataAiHint: "Huobi logo", coingeckoExchangeId: "huobi" },
  { name: "Bitfinex", type: "exchange", dataAiHint: "Bitfinex logo", coingeckoExchangeId: "bitfinex" },
];

const popularWalletsRaw: Array<Omit<CryptoProviderInfo, 'iconComponent'>> = [
  { name: "Ledger Nano S/X/Stax", type: "wallet", dataAiHint: "Ledger wallet" },
  { name: "Trezor Model One/T", type: "wallet", dataAiHint: "Trezor wallet" },
  { name: "MetaMask", type: "wallet", dataAiHint: "MetaMask fox" },
  { name: "Trust Wallet", type: "wallet", dataAiHint: "Trust Wallet shield" },
  { name: "Exodus", type: "wallet", dataAiHint: "Exodus logo" },
  { name: "Phantom (Solana)", type: "wallet", dataAiHint: "Phantom ghost" },
  { name: "Coinbase Wallet", type: "wallet", dataAiHint: "Coinbase Wallet logo" }, // This is distinct from Coinbase Exchange
];

export const popularExchanges: CryptoProviderInfo[] = popularExchangesRaw.map(provider => ({
    ...provider,
    iconComponent: createSpecificIcon(provider.name, provider.type),
}));

export const popularWallets: CryptoProviderInfo[] = popularWalletsRaw.map(provider => ({
    ...provider,
    iconComponent: createSpecificIcon(provider.name, provider.type),
}));

const allProvidersRaw = [
    ...popularExchangesRaw,
    ...popularWalletsRaw
];

const uniqueProviderNames = new Set<string>();
export const allCryptoProviders: CryptoProviderInfo[] = allProvidersRaw
  .map(provider => ({
    ...provider,
    iconComponent: createSpecificIcon(provider.name, provider.type),
  }))
  .filter(provider => {
    if (uniqueProviderNames.has(provider.name)) {
      return false;
    }
    uniqueProviderNames.add(provider.name);
    return true;
  })
  .sort((a, b) => a.name.localeCompare(b.name));
