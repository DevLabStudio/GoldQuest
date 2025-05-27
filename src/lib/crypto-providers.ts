
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon
// Import from the older @token-icons/react package
import {
    ExchangeBinance, ExchangeCoinbase, ExchangeKraken, ExchangeOkx, ExchangeKucoin, ExchangeGateio, ExchangeHuobi, //ExchangeBitfinex, ExchangeBitstamp, // These were causing issues
    WalletLedger, WalletTrezor, WalletMetamask, WalletTrustWallet as WalletTrust, WalletExodus, WalletPhantom, WalletCoinbase as WalletCoinbaseIcon
} from '@token-icons/react'; // Reverted to @token-icons/react

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

// Helper to safely create icon elements, falling back to default
const createIcon = (SpecificIconComponent?: React.ElementType, props?: any) => {
  if (SpecificIconComponent) {
    try {
      // @token-icons/react uses `variant="branded"`
      return React.createElement(SpecificIconComponent, { size: defaultIconSize, variant: 'branded', ...props });
    } catch (e) {
      console.warn(`Error creating specific icon, falling back to default for props:`, props, e);
      return React.createElement(DefaultCryptoIcon);
    }
  }
  return React.createElement(DefaultCryptoIcon);
};

export const popularExchanges: CryptoProviderInfo[] = [
    { name: "Binance", iconComponent: createIcon(ExchangeBinance) },
    { name: "Coinbase", iconComponent: createIcon(ExchangeCoinbase) },
    { name: "Kraken", iconComponent: createIcon(ExchangeKraken) },
    // { name: "Bybit", iconComponent: createIcon(ExchangeBybit) }, // ExchangeBybit was not a valid import
    { name: "OKX", iconComponent: createIcon(ExchangeOkx) },
    { name: "KuCoin", iconComponent: createIcon(ExchangeKucoin) },
    { name: "Bitstamp", iconComponent: createIcon(DefaultCryptoIcon) }, // Fallback
    { name: "Gate.io", iconComponent: createIcon(ExchangeGateio) },
    { name: "Huobi (HTX)", iconComponent: createIcon(ExchangeHuobi) },
    { name: "Bitfinex", iconComponent: createIcon(DefaultCryptoIcon) }, // Fallback
];

export const popularWallets: CryptoProviderInfo[] = [
    { name: "Ledger Nano S/X/Stax", iconComponent: createIcon(WalletLedger) },
    { name: "Trezor Model One/T", iconComponent: createIcon(WalletTrezor) },
    { name: "MetaMask", iconComponent: createIcon(WalletMetamask) },
    { name: "Trust Wallet", iconComponent: createIcon(WalletTrust) },
    { name: "Exodus", iconComponent: createIcon(WalletExodus) },
    { name: "Phantom (Solana)", iconComponent: createIcon(WalletPhantom) },
    { name: "Coinbase Wallet", iconComponent: createIcon(WalletCoinbaseIcon) },
    { name: "Atomic Wallet", iconComponent: createIcon(DefaultCryptoIcon) },
    { name: "BlueWallet (Bitcoin)", iconComponent: createIcon(DefaultCryptoIcon) },
];

export const allCryptoProviders: CryptoProviderInfo[] = [...new Set([...popularExchanges, ...popularWallets])].sort(
    (a, b) => a.name.localeCompare(b.name)
);

popularExchanges.sort((a, b) => a.name.localeCompare(b.name));
popularWallets.sort((a, b) => a.name.localeCompare(b.name));
