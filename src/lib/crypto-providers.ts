
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon for ultimate fallback
import { FaExchangeAlt, FaWallet } from 'react-icons/fa'; // Fallback icons from react-icons

// Dynamically and safely import ExchangeIcon and WalletIcon from @token-icons/react
let ExchangeIcon: React.ElementType | undefined = undefined;
let WalletIcon: React.ElementType | undefined = undefined;
try {
  const tokenIcons = require('@token-icons/react');
  ExchangeIcon = tokenIcons.ExchangeIcon;
  WalletIcon = tokenIcons.WalletIcon;
  if (!ExchangeIcon || !WalletIcon) {
    console.warn("@token-icons/react loaded, but ExchangeIcon or WalletIcon is undefined. Specific crypto icons might not render.");
  }
} catch (e) {
  console.warn("Could not load '@token-icons/react'. Specific crypto exchange/wallet icons will use fallbacks.", e);
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
  type: 'exchange' | 'wallet';
  iconComponent: ReactNode;
  dataAiHint?: string;
}

// This map helps normalize provider names to the 'name' prop expected by @token-icons/react
const cryptoNamePropMap: { [key: string]: string } = {
  "Binance": "binance",
  "Coinbase": "coinbase",
  "Kraken": "kraken",
  "OKX": "okx",
  "KuCoin": "kucoin",
  "Bitstamp": "bitstamp",
  "Gate.io": "gateio", // Common variation
  "Huobi (HTX)": "huobi",
  "Bitfinex": "bitfinex",
  "Ledger Nano S/X/Stax": "ledger",
  "Trezor Model One/T": "trezor",
  "MetaMask": "metamask",
  "Trust Wallet": "trustwallet",
  "Exodus": "exodus",
  "Phantom (Solana)": "phantom",
  "Coinbase Wallet": "coinbase", // WalletIcon might also use 'coinbase'
};

// Brand colors for specific icons
const cryptoBrandColors: { [key: string]: string } = {
    "binance": "#F0B90B",
    "coinbase": "#0052FF",
    "kraken": "#5842C1",
    "metamask": "#E2761B",
    "ledger": "#1A1A1A", // Dark, might need adjustment based on theme
    "trustwallet": "#3375BB",
    "phantom": "#4B00C4", // Phantom purple
    "exodus": "#1A2B6B",  // Exodus dark blue
};


function getProviderIcon({ type, name: providerOfficialName, size = defaultIconSize, variant = 'branded' }: { type: 'exchange' | 'wallet'; name: string; size?: number; variant?: string }): ReactNode {
  const normalizedNameProp = cryptoNamePropMap[providerOfficialName] || providerOfficialName.toLowerCase().replace(/\s+/g, '');
  const brandColor = cryptoBrandColors[normalizedNameProp];

  try {
    if (type === 'exchange' && ExchangeIcon) {
      return React.createElement(ExchangeIcon, { name: normalizedNameProp, size, variant, color: brandColor });
    } else if (type === 'wallet' && WalletIcon) {
      return React.createElement(WalletIcon, { name: normalizedNameProp, size, variant, color: brandColor });
    }
  } catch (e) {
    console.warn(`Error rendering specific @token-icons/react icon for ${providerOfficialName} (nameProp: ${normalizedNameProp}):`, e);
  }

  // Fallback to react-icons/fa
  if (type === 'exchange') {
    return React.createElement(FaExchangeAlt, { size });
  } else if (type === 'wallet') {
    return React.createElement(FaWallet, { size });
  }

  // Ultimate fallback
  return React.createElement(DefaultCryptoIcon);
}


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
    iconComponent: getProviderIcon({ type: provider.type, name: provider.name, size: defaultIconSize }),
}));

export const popularWallets: CryptoProviderInfo[] = popularWalletsRaw.map(provider => ({
    ...provider,
    iconComponent: getProviderIcon({ type: provider.type, name: provider.name, size: defaultIconSize }),
}));


const allProvidersRaw = [
    ...popularExchangesRaw,
    ...popularWalletsRaw
];

const uniqueProviderNames = new Set<string>();
export const allCryptoProviders: CryptoProviderInfo[] = allProvidersRaw
  .map(provider => ({
    ...provider,
    iconComponent: getProviderIcon({ type: provider.type, name: provider.name, size: defaultIconSize }),
  }))
  .filter(provider => {
    if (uniqueProviderNames.has(provider.name)) {
      return false;
    }
    uniqueProviderNames.add(provider.name);
    return true;
  })
  .sort((a, b) => a.name.localeCompare(b.name));
