
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon

// Attempt to import only the dynamic WalletIcon from @token-icons/react
// If this import fails, the createSpecificIcon function will always fallback.
let WalletIconComponent: React.ElementType | undefined = undefined;
try {
  const tokenIcons = require('@token-icons/react');
  WalletIconComponent = tokenIcons.WalletIcon;
} catch (e) {
  console.warn("Could not load WalletIcon from @token-icons/react. Crypto icons will use generic fallback.", e);
}

const defaultIconSize = 20;

const DefaultCryptoIcon = () => {
  return React.createElement(WalletCards, {
    size: defaultIconSize,
    className: "text-muted-foreground",
  });
};

export interface CryptoProviderInfo {
  name: string;
  iconComponent: ReactNode;
  dataAiHint?: string;
}

// Details for specific icons we want to try.
// `nameProp` should be the lowercase string expected by WalletIcon's `name` prop.
const specificCryptoIconDetails: { [key: string]: { type: 'wallet' | 'exchange'; nameProp: string; color?: string } } = {
  "Coinbase Wallet": { type: "wallet", nameProp: "coinbase", color: "#0052FF" },
  // We can add more here one by one after verifying their 'nameProp' for WalletIcon or ExchangeIcon
  // e.g., "MetaMask": { type: "wallet", nameProp: "metamask", color: "#E2761B" },
  // e.g., "Binance": { type: "exchange", nameProp: "binance", color: "#F0B90B" },
};

const createSpecificIcon = (providerOfficialName: string): ReactNode => {
  const details = specificCryptoIconDetails[providerOfficialName];

  if (details) {
    try {
      if (details.type === 'wallet' && WalletIconComponent) {
        return React.createElement(WalletIconComponent, {
          name: details.nameProp,
          size: defaultIconSize,
          variant: "branded",
          color: details.color, // This might be overridden by the 'branded' variant for some icons
        });
      }
      // Add similar logic for ExchangeIcon if we import it and have 'exchange' types
      // else if (details.type === 'exchange' && ExchangeIconComponent) { ... }
    } catch (e) {
      console.error(`Error creating specific icon for ${providerOfficialName}:`, e);
      // Fall through to default if specific icon creation fails
    }
  }
  return React.createElement(DefaultCryptoIcon);
};

export const popularExchanges: CryptoProviderInfo[] = [
  { name: "Binance", iconComponent: createSpecificIcon("Binance"), dataAiHint: "Binance logo" },
  { name: "Coinbase", iconComponent: createSpecificIcon("Coinbase"), dataAiHint: "Coinbase logo" },
  { name: "Kraken", iconComponent: createSpecificIcon("Kraken"), dataAiHint: "Kraken logo" },
  { name: "OKX", iconComponent: createSpecificIcon("OKX"), dataAiHint: "OKX logo" },
  { name: "KuCoin", iconComponent: createSpecificIcon("KuCoin"), dataAiHint: "KuCoin logo" },
  { name: "Bitstamp", iconComponent: createSpecificIcon("Bitstamp"), dataAiHint: "Bitstamp logo" },
  { name: "Gate.io", iconComponent: createSpecificIcon("Gate.io"), dataAiHint: "Gate.io logo" },
  { name: "Huobi (HTX)", iconComponent: createSpecificIcon("Huobi (HTX)"), dataAiHint: "Huobi logo" },
  { name: "Bitfinex", iconComponent: createSpecificIcon("Bitfinex"), dataAiHint: "Bitfinex logo" },
];

export const popularWallets: CryptoProviderInfo[] = [
  { name: "Ledger Nano S/X/Stax", iconComponent: createSpecificIcon("Ledger Nano S/X/Stax"), dataAiHint: "Ledger wallet" },
  { name: "Trezor Model One/T", iconComponent: createSpecificIcon("Trezor Model One/T"), dataAiHint: "Trezor wallet" },
  { name: "MetaMask", iconComponent: createSpecificIcon("MetaMask"), dataAiHint: "MetaMask fox" },
  { name: "Trust Wallet", iconComponent: createSpecificIcon("Trust Wallet"), dataAiHint: "Trust Wallet shield" },
  { name: "Exodus", iconComponent: createSpecificIcon("Exodus"), dataAiHint: "Exodus logo" },
  { name: "Phantom (Solana)", iconComponent: createSpecificIcon("Phantom (Solana)"), dataAiHint: "Phantom ghost" },
  { name: "Coinbase Wallet", iconComponent: createSpecificIcon("Coinbase Wallet"), dataAiHint: "Coinbase Wallet logo" }, // This will now attempt the specific icon
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
