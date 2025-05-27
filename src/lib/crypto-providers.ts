'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon
// REMOVED all imports from '@token-icons/react' to ensure build stability.
// We will default all crypto providers to the generic icon for now.

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

// Helper to create icons. Since specific icons are removed, this will always use DefaultCryptoIcon.
// The SpecificIconComponent parameter is kept for potential future re-introduction if issues are resolved.
const createIcon = (SpecificIconComponent?: React.ElementType, props?: any) => {
  // For now, always return DefaultCryptoIcon to ensure stability.
  // When re-introducing specific icons, the try-catch logic can be used.
  return React.createElement(DefaultCryptoIcon);
};

// All providers will now use the DefaultCryptoIcon
export const popularExchanges: CryptoProviderInfo[] = [
    { name: "Binance", iconComponent: createIcon(undefined, { name: "Binance" }) },
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
