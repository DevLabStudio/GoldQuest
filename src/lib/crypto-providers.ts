
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon

// Removed problematic import:
// import { ExchangeIcon, WalletIcon } from '@token-icons/react';

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

interface SpecificIconDetail {
  nameProp: string; // Lowercase name for the 'name' prop if we were using dynamic components
  color?: string;
  type: 'exchange' | 'wallet';
}

// This map can be used for colors/names if we find a working dynamic icon component later
const specificCryptoIconDetails: { [key: string]: SpecificIconDetail } = {
  "Binance": { nameProp: "binance", color: "#F0B90B", type: "exchange" },
  "Coinbase": { nameProp: "coinbase", color: "#0052FF", type: "exchange" },
  "Kraken": { nameProp: "kraken", color: "#5842C1", type: "exchange" },
  "OKX": { nameProp: "okx", type: "exchange", color: "#FFFFFF" }, // OKX primary is often black, icon on dark bg might need white
  "KuCoin": { nameProp: "kucoin", type: "exchange", color: "#24AE8F" },
  "Bitstamp": { nameProp: "bitstamp", type: "exchange", color: "#0054DF" },
  "Gate.io": { nameProp: "gateio", type: "exchange", color: "#1D65EF" },
  "Huobi (HTX)": { nameProp: "huobi", type: "exchange", color: "#0080CC" },
  "Bitfinex": { nameProp: "bitfinex", type: "exchange", color: "#19A778" },
  "MetaMask": { nameProp: "metamask", color: "#E2761B", type: "wallet" },
  "Ledger Nano S/X/Stax": { nameProp: "ledger", type: "wallet", color: "#FFFFFF" }, // Ledger icon often appears white on dark
  "Trust Wallet": { nameProp: "trustwallet", color: "#3375BB", type: "wallet" },
  "Exodus": { nameProp: "exodus", type: "wallet", color: "#6B4DFF" },
  "Phantom (Solana)": { nameProp: "phantom", type: "wallet", color: "#5A43E9" },
  "Coinbase Wallet": { nameProp: "coinbasewallet", type: "wallet", color: "#0052FF" },
  "Trezor Model One/T": { nameProp: "trezor", type: "wallet", color: "#272727" },
};

// Simplified createSpecificIcon to always return DefaultCryptoIcon for now
const createSpecificIcon = (providerKey: string): ReactNode => {
  // The logic to use ExchangeIcon/WalletIcon was removed as they can't be imported.
  // We could try react-icons/si here if we identify specific icons for exchanges/wallets from that lib.
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
    { name: "Coinbase Wallet", iconComponent: createSpecificIcon("Coinbase Wallet"), dataAiHint: "Coinbase Wallet logo" },
];

const allProvidersRaw = [...popularExchanges, ...popularWallets];
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
