
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon

// Removed all specific imports from '@token-icons/react' as they were causing build errors.
// We will default all crypto icons to DefaultCryptoIcon for now.

const defaultIconSize = 20;

const DefaultCryptoIcon = () => {
  return React.createElement(WalletCards, {
    size: defaultIconSize,
    className: "text-muted-foreground"
  });
};

export interface CryptoProviderInfo {
  name: string;
  iconComponent: ReactNode;
  dataAiHint?: string;
}

// This map can be used later if we find working specific icons and their correct import names.
// For now, it will be effectively unused as we default all icons.
const specificCryptoIconDetails: { [key: string]: { nameProp: string; color?: string; type: 'exchange' | 'wallet' } } = {
  // Example structure if we were using dynamic components like <ExchangeIcon name="binance" />
  // "Binance": { nameProp: "binance", color: "#F0B90B", type: "exchange" },
  // "Coinbase": { nameProp: "coinbase", color: "#0052FF", type: "exchange" },
  // "Kraken": { nameProp: "kraken", color: "#5842C1", type: "exchange" },
  // "MetaMask": { nameProp: "metamask", color: "#E2761B", type: "wallet" },
  // "Ledger": { nameProp: "ledger", color: "#1A1A1A", type: "wallet" }, // Used for "Ledger Nano S/X/Stax"
  // "Trust Wallet": { nameProp: "trustwallet", color: "#3375BB", type: "wallet" },
};

// Simplified createSpecificIcon - for now, it will always lead to DefaultCryptoIcon.
const createSpecificIcon = (providerName: string): ReactNode => {
  // const details = specificCryptoIconDetails[providerName];
  // If a working dynamic icon component (e.g., from a future version of @web3icons/react)
  // was available and imported as, for example, DynamicCryptoPlatformIcon, the logic would be:
  // if (details) {
  //   try {
  //     return React.createElement(DynamicCryptoPlatformIcon, { // This component name is hypothetical
  //       type: details.type, // 'exchange' or 'wallet'
  //       name: details.nameProp, // e.g., 'binance', 'metamask'
  //       size: defaultIconSize,
  //       variant: "branded", // Assuming this prop exists
  //       color: details.color,
  //     });
  //   } catch (e) {
  //     console.warn(`Error creating specific icon for ${providerName}:`, e);
  //     return React.createElement(DefaultCryptoIcon);
  //   }
  // }
  return React.createElement(DefaultCryptoIcon);
};

export const popularExchanges: CryptoProviderInfo[] = [
  { name: "Binance", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "Binance logo" },
  { name: "Coinbase", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "Coinbase logo" },
  { name: "Kraken", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "Kraken logo" },
  { name: "OKX", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "OKX logo" },
  { name: "KuCoin", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "KuCoin logo" },
  { name: "Bitstamp", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "Bitstamp logo" },
  { name: "Gate.io", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "Gate.io logo" },
  { name: "Huobi (HTX)", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "Huobi logo" },
  { name: "Bitfinex", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "Bitfinex logo" },
];

export const popularWallets: CryptoProviderInfo[] = [
  { name: "Ledger Nano S/X/Stax", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "Ledger wallet" },
  { name: "Trezor Model One/T", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "Trezor wallet" },
  { name: "MetaMask", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "MetaMask fox" },
  { name: "Trust Wallet", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "Trust Wallet shield" },
  { name: "Exodus", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "Exodus logo" },
  { name: "Phantom (Solana)", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "Phantom ghost" },
  { name: "Coinbase Wallet", iconComponent: React.createElement(DefaultCryptoIcon), dataAiHint: "Coinbase Wallet logo" },
];

const allProvidersRaw = [
    ...popularExchanges,
    ...popularWallets
];

const uniqueProviderNames = new Set<string>();
export const allCryptoProviders: CryptoProviderInfo[] = allProvidersRaw
  .filter(provider => {
    if (uniqueProviderNames.has(provider.name)) {
      return false;
    }
    uniqueProviderNames.add(provider.name);
    return true;
  })
  .sort((a, b) => a.name.localeCompare(b.name));

