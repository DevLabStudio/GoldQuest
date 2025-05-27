
import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon
// Removed all specific Si* icon imports from 'react-icons/si' to prevent build errors.
// Specific icons can be re-added carefully one by one if they are confirmed to exist.

const defaultIconSize = 20;

// Define DefaultCryptoIcon using React.createElement
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

export const popularExchanges: CryptoProviderInfo[] = [
    { name: "Binance", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Coinbase", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Kraken", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Bybit", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "OKX", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "KuCoin", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Bitstamp", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Gate.io", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Huobi (HTX)", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Bitfinex", iconComponent: React.createElement(DefaultCryptoIcon) },
];

export const popularWallets: CryptoProviderInfo[] = [
    // Hardware Wallets
    { name: "Ledger Nano S/X/Stax", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Trezor Model One/T", iconComponent: React.createElement(DefaultCryptoIcon) },
    // Software/Mobile Wallets
    { name: "MetaMask", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Trust Wallet", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Exodus", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Electrum", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "MyEtherWallet (MEW)", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Phantom (Solana)", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Coinbase Wallet", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Atomic Wallet", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "BlueWallet (Bitcoin)", iconComponent: React.createElement(DefaultCryptoIcon) },
];

// Combine and sort for potential unified dropdowns or filtering
export const allCryptoProviders: CryptoProviderInfo[] = [...new Set([...popularExchanges, ...popularWallets])].sort(
    (a, b) => a.name.localeCompare(b.name)
);

popularExchanges.sort((a, b) => a.name.localeCompare(b.name));
popularWallets.sort((a, b) => a.name.localeCompare(b.name));
