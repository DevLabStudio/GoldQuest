
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon

// Attempt to import specific icons from @token-icons/react@2.14.0
// If any of these cause "Export doesn't exist" errors during build,
// it means the name is incorrect for v2.14.0 or the icon isn't in that version.
// In that case, it should be removed from this import list and its corresponding
// entry in specificCryptoIcons should also be removed, so it defaults to DefaultCryptoIcon.
import {
    ExchangeBinance,
    ExchangeCoinbase,
    ExchangeKraken,
    WalletMetamask,
    WalletLedger,
    WalletTrustwallet
    // Add other specific exchange/wallet icons here if verified for v2.14.0
    // Example: ExchangeOkx, ExchangeKucoin, WalletExodus, WalletPhantom etc.
} from '@token-icons/react'; // Assuming @token-icons/react@2.14.0 is installed

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

// Map of crypto provider names (as used in your app) to their specific icon components
// This map should only contain entries for icons that are confirmed to be correctly imported above.
const specificCryptoIcons: { [key: string]: ReactNode } = {
  "Binance": React.createElement(ExchangeBinance, { size: defaultIconSize, variant: "branded", color: "#F0B90B" }),
  "Coinbase": React.createElement(ExchangeCoinbase, { size: defaultIconSize, variant: "branded", color: "#0052FF" }),
  "Kraken": React.createElement(ExchangeKraken, { size: defaultIconSize, variant: "branded", color: "#5842C1" }),
  "MetaMask": React.createElement(WalletMetamask, { size: defaultIconSize, variant: "branded", color: "#E2761B" }),
  "Ledger Nano S/X/Stax": React.createElement(WalletLedger, { size: defaultIconSize, variant: "branded" }), // Ledger logo is often monochrome or uses context color
  "Trust Wallet": React.createElement(WalletTrustwallet, { size: defaultIconSize, variant: "branded", color: "#3375BB" }),
  // "Coinbase Wallet" might use ExchangeCoinbase or a specific WalletCoinbase if available
  // "Phantom (Solana)" would need WalletPhantom
};

export const popularExchanges: CryptoProviderInfo[] = [
    { name: "Binance", iconComponent: specificCryptoIcons["Binance"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Binance logo" },
    { name: "Coinbase", iconComponent: specificCryptoIcons["Coinbase"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Coinbase logo" },
    { name: "Kraken", iconComponent: specificCryptoIcons["Kraken"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Kraken logo" },
    { name: "OKX", iconComponent: specificCryptoIcons["OKX"] || React.createElement(DefaultCryptoIcon), dataAiHint: "OKX logo" },
    { name: "KuCoin", iconComponent: specificCryptoIcons["KuCoin"] || React.createElement(DefaultCryptoIcon), dataAiHint: "KuCoin logo" },
    { name: "Bitstamp", iconComponent: specificCryptoIcons["Bitstamp"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Bitstamp logo" },
    { name: "Gate.io", iconComponent: specificCryptoIcons["Gate.io"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Gate.io logo" },
    { name: "Huobi (HTX)", iconComponent: specificCryptoIcons["Huobi (HTX)"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Huobi logo" },
    { name: "Bitfinex", iconComponent: specificCryptoIcons["Bitfinex"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Bitfinex logo" },
];

export const popularWallets: CryptoProviderInfo[] = [
    { name: "Ledger Nano S/X/Stax", iconComponent: specificCryptoIcons["Ledger Nano S/X/Stax"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Ledger wallet" },
    { name: "Trezor Model One/T", iconComponent: specificCryptoIcons["Trezor Model One/T"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Trezor wallet" },
    { name: "MetaMask", iconComponent: specificCryptoIcons["MetaMask"] || React.createElement(DefaultCryptoIcon), dataAiHint: "MetaMask fox" },
    { name: "Trust Wallet", iconComponent: specificCryptoIcons["Trust Wallet"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Trust Wallet shield" },
    { name: "Exodus", iconComponent: specificCryptoIcons["Exodus"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Exodus logo" },
    { name: "Phantom (Solana)", iconComponent: specificCryptoIcons["Phantom (Solana)"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Phantom ghost" },
    { name: "Coinbase Wallet", iconComponent: specificCryptoIcons["Coinbase Wallet"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Coinbase Wallet logo" },
    { name: "Atomic Wallet", iconComponent: specificCryptoIcons["Atomic Wallet"] || React.createElement(DefaultCryptoIcon), dataAiHint: "Atomic Wallet logo" },
    { name: "BlueWallet (Bitcoin)", iconComponent: specificCryptoIcons["BlueWallet (Bitcoin)"] || React.createElement(DefaultCryptoIcon), dataAiHint: "BlueWallet logo" },
];

export const allCryptoProviders: CryptoProviderInfo[] = [...new Set([...popularExchanges, ...popularWallets])].sort(
    (a, b) => a.name.localeCompare(b.name)
);
