
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon for ultimate fallback

// Remove all imports from @token-icons/react or @web3icons/react to ensure stability
// We will default all crypto icons to generic ones for now.

const defaultIconSize = 20;

const DefaultCryptoIcon = () => {
  return React.createElement(WalletCards, {
    size: defaultIconSize,
    className: "text-muted-foreground",
  });
};

export interface CryptoProviderInfo {
  name: string;
  type: 'exchange' | 'wallet'; // To distinguish for potential future specific icon logic
  iconComponent: ReactNode;
  dataAiHint?: string;
}

// This map is now empty as we are defaulting all crypto icons.
// It's kept as a placeholder if we re-introduce specific icons later.
const specificCryptoIconDetails: {
  [key: string]: { type: 'exchange' | 'wallet'; nameProp: string; color?: string; iconComponent?: React.ElementType };
} = {};

// Simplified function: Will always return DefaultCryptoIcon for now.
const createSpecificIcon = (
  providerOfficialName: string,
  _providerType: 'exchange' | 'wallet' // _providerType is kept for signature consistency if we re-add logic
): ReactNode => {
  // const details = specificCryptoIconDetails[providerOfficialName];
  // if (details && details.iconComponent) {
  //   try {
  //     return React.createElement(details.iconComponent, {
  //       name: details.nameProp, // 'name' prop for dynamic icons like <ExchangeIcon name="binance" />
  //       size: defaultIconSize,
  //       variant: "branded", // Common prop for branded versions
  //       color: details.color, // Optional color override
  //     });
  //   } catch (e) {
  //     console.warn(`Error creating specific icon for ${providerOfficialName}, falling back to default. Error:`, e);
  //     return React.createElement(DefaultCryptoIcon);
  //   }
  // }
  return React.createElement(DefaultCryptoIcon);
};


const popularExchangesRaw: Array<Omit<CryptoProviderInfo, 'iconComponent'>> = [
  { name: "Binance", type: "exchange", dataAiHint: "Binance logo" },
  { name: "Coinbase", type: "exchange", dataAiHint: "Coinbase logo" },
  { name: "Kraken", type: "exchange", dataAiHint: "Kraken logo" },
  { name: "OKX", type: "exchange", dataAiHint: "OKX logo" },
  { name: "KuCoin", type: "exchange", dataAiHint: "KuCoin logo" },
  { name: "Bitstamp", type: "exchange", dataAiHint: "Bitstamp logo" },
  { name: "Gate.io", type: "exchange", dataAiHint: "Gate.io logo" },
  { name: "Huobi (HTX)", type: "exchange", dataAiHint: "Huobi logo" },
  { name: "Bitfinex", type: "exchange", dataAiHint: "Bitfinex logo" },
];

const popularWalletsRaw: Array<Omit<CryptoProviderInfo, 'iconComponent'>> = [
  { name: "Ledger Nano S/X/Stax", type: "wallet", dataAiHint: "Ledger wallet" },
  { name: "Trezor Model One/T", type: "wallet", dataAiHint: "Trezor wallet" },
  { name: "MetaMask", type: "wallet", dataAiHint: "MetaMask fox" },
  { name: "Trust Wallet", type: "wallet", dataAiHint: "Trust Wallet shield" },
  { name: "Exodus", type: "wallet", dataAiHint: "Exodus logo" },
  { name: "Phantom (Solana)", type: "wallet", dataAiHint: "Phantom ghost" },
  { name: "Coinbase Wallet", type: "wallet", dataAiHint: "Coinbase Wallet logo" },
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
