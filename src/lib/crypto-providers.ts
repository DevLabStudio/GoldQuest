
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon
// Attempt to import only ExchangeBinance from @token-icons/react
// All other specific crypto icons will be removed from imports to isolate issues
import { ExchangeBinance } from '@token-icons/react'; // Assuming @token-icons/react@2.14.0 is installed

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
}

// Helper to create icons with fallback, attempting specific icon first
const createIcon = (SpecificIconComponent?: React.ElementType, props?: any) => {
  if (SpecificIconComponent) {
    try {
      // @ts-ignore variant prop might not exist on all icons or DefaultCryptoIcon
      return React.createElement(SpecificIconComponent, { size: defaultIconSize, variant: 'branded', ...props });
    } catch (e) {
      console.warn(`Error creating specific crypto icon for ${props?.name || 'unknown provider'}, falling back to default. Ensure the icon component is valid. Error: ${e}`);
      return React.createElement(DefaultCryptoIcon);
    }
  }
  return React.createElement(DefaultCryptoIcon);
};

export const popularExchanges: CryptoProviderInfo[] = [
    { name: "Binance", iconComponent: createIcon(ExchangeBinance, { name: "Binance" }) }, // Only Binance attempts a specific icon
    { name: "Coinbase", iconComponent: createIcon(undefined, { name: "Coinbase" }) },
    { name: "Kraken", iconComponent: createIcon(undefined, { name: "Kraken" }) },
    { name: "OKX", iconComponent: createIcon(undefined, { name: "OKX" }) },
    { name: "KuCoin", iconComponent: createIcon(undefined, { name: "KuCoin" }) },
    { name: "Bitstamp", iconComponent: createIcon(undefined, { name: "Bitstamp" }) },
    { name: "Gate.io", iconComponent: createIcon(undefined, { name: "Gate.io" }) },
    { name: "Huobi (HTX)", iconComponent: createIcon(undefined, { name: "Huobi" }) },
    { name: "Bitfinex", iconComponent: createIcon(undefined, { name: "Bitfinex" }) },
];

export const popularWallets: CryptoProviderInfo[] = [
    { name: "Ledger Nano S/X/Stax", iconComponent: createIcon(undefined, { name: "Ledger" }) },
    { name: "Trezor Model One/T", iconComponent: createIcon(undefined, { name: "Trezor" }) },
    { name: "MetaMask", iconComponent: createIcon(undefined, { name: "MetaMask" }) },
    { name: "Trust Wallet", iconComponent: createIcon(undefined, { name: "Trust Wallet" }) },
    { name: "Exodus", iconComponent: createIcon(undefined, { name: "Exodus" }) },
    { name: "Phantom (Solana)", iconComponent: createIcon(undefined, { name: "Phantom" }) },
    { name: "Coinbase Wallet", iconComponent: createIcon(undefined, { name: "Coinbase Wallet" }) },
    { name: "Atomic Wallet", iconComponent: createIcon(undefined, { name: "Atomic Wallet" }) },
    { name: "BlueWallet (Bitcoin)", iconComponent: createIcon(undefined, { name: "BlueWallet" }) },
];

export const allCryptoProviders: CryptoProviderInfo[] = [...new Set([...popularExchanges, ...popularWallets])].sort(
    (a, b) => a.name.localeCompare(b.name)
);

popularExchanges.sort((a, b) => a.name.localeCompare(b.name));
popularWallets.sort((a, b) => a.name.localeCompare(b.name));
