
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon
// Removed all specific icon imports from @token-icons/react and react-icons/si for this file

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

// specificCryptoIcons is now empty to ensure no specific icons are attempted
const specificCryptoIcons: { [key: string]: ReactNode } = {};

// Helper to create icons. Will always fall back to DefaultCryptoIcon in this setup.
const createIcon = (SpecificIconComponent?: React.ElementType | string, props?: any & { color?: string; name?: string }) => {
  const providerName = props?.name;
  if (providerName && specificCryptoIcons[providerName]) {
    try {
      return specificCryptoIcons[providerName];
    } catch (e) {
        console.warn(`Error rendering specific mapped icon ${providerName}:`, e);
        return React.createElement(DefaultCryptoIcon);
    }
  }
  if (typeof SpecificIconComponent === 'string' && specificCryptoIcons[SpecificIconComponent]) {
     try {
      return specificCryptoIcons[SpecificIconComponent];
    } catch (e) {
        console.warn(`Error rendering specific mapped icon string ${SpecificIconComponent}:`, e);
        return React.createElement(DefaultCryptoIcon);
    }
  }
  // If SpecificIconComponent is an element type (actual component)
  if (SpecificIconComponent && typeof SpecificIconComponent !== 'string') {
    try {
      return React.createElement(SpecificIconComponent, { size: defaultIconSize, variant: "branded", ...props });
    } catch (e) {
      console.warn(`Error creating specific icon component ${props?.name || 'Unknown'}:`, e);
      return React.createElement(DefaultCryptoIcon);
    }
  }
  return React.createElement(DefaultCryptoIcon);
};

// All providers will now use the DefaultCryptoIcon due to empty specificCryptoIcons
// and no specific components being passed to createIcon in these lists.

export const popularExchanges: CryptoProviderInfo[] = [
    { name: "Binance", iconComponent: createIcon(undefined, {name: "Binance"}), dataAiHint: "Binance logo" },
    { name: "Coinbase", iconComponent: createIcon(undefined, {name: "Coinbase"}), dataAiHint: "Coinbase logo" },
    { name: "Kraken", iconComponent: createIcon(undefined, {name: "Kraken"}), dataAiHint: "Kraken logo" },
    { name: "OKX", iconComponent: createIcon(undefined, {name: "OKX"}), dataAiHint: "OKX logo" },
    { name: "KuCoin", iconComponent: createIcon(undefined, {name: "KuCoin"}), dataAiHint: "KuCoin logo" },
    { name: "Bitstamp", iconComponent: createIcon(undefined, {name: "Bitstamp"}), dataAiHint: "Bitstamp logo" },
    { name: "Gate.io", iconComponent: createIcon(undefined, {name: "Gate.io"}), dataAiHint: "Gate.io logo" },
    { name: "Huobi (HTX)", iconComponent: createIcon(undefined, {name: "Huobi (HTX)"}), dataAiHint: "Huobi logo" },
    { name: "Bitfinex", iconComponent: createIcon(undefined, {name: "Bitfinex"}), dataAiHint: "Bitfinex logo" },
];

export const popularWallets: CryptoProviderInfo[] = [
    { name: "Ledger Nano S/X/Stax", iconComponent: createIcon(undefined, {name: "Ledger Nano S/X/Stax"}), dataAiHint: "Ledger wallet" },
    { name: "Trezor Model One/T", iconComponent: createIcon(undefined, {name: "Trezor Model One/T"}), dataAiHint: "Trezor wallet" },
    { name: "MetaMask", iconComponent: createIcon(undefined, {name: "MetaMask"}), dataAiHint: "MetaMask fox" },
    { name: "Trust Wallet", iconComponent: createIcon(undefined, {name: "Trust Wallet"}), dataAiHint: "Trust Wallet shield" },
    { name: "Exodus", iconComponent: createIcon(undefined, {name: "Exodus"}), dataAiHint: "Exodus logo" },
    { name: "Phantom (Solana)", iconComponent: createIcon(undefined, {name: "Phantom (Solana)"}), dataAiHint: "Phantom ghost" },
    { name: "Coinbase Wallet", iconComponent: createIcon(undefined, {name: "Coinbase Wallet"}), dataAiHint: "Coinbase Wallet logo" },
    { name: "Atomic Wallet", iconComponent: createIcon(undefined, {name: "Atomic Wallet"}), dataAiHint: "Atomic Wallet logo" },
    { name: "BlueWallet (Bitcoin)", iconComponent: createIcon(undefined, {name: "BlueWallet (Bitcoin)"}), dataAiHint: "BlueWallet logo" },
];

export const allCryptoProviders: CryptoProviderInfo[] = [...new Set([...popularExchanges, ...popularWallets])].sort(
    (a, b) => a.name.localeCompare(b.name)
);

popularExchanges.sort((a, b) => a.name.localeCompare(b.name));
popularWallets.sort((a, b) => a.name.localeCompare(b.name));
