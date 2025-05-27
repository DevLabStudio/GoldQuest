
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon
// Using @token-icons/react as per successful install, will show deprecation warning for @web3icons/react
import {
    ExchangeBinance, ExchangeCoinbase, ExchangeKraken, ExchangeOkx, ExchangeKucoin, ExchangeGateio, ExchangeHuobi,
    // ExchangeBitfinex, ExchangeBitstamp, // These were often problematic, defaulting them
    WalletLedger, WalletTrezor, WalletMetamask, WalletTrustWallet as WalletTrust, WalletExodus, WalletPhantom, WalletCoinbase as WalletCoinbaseIcon
} from '@token-icons/react';

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
      // @token-icons/react uses variant="branded"
      return React.createElement(SpecificIconComponent, { size: defaultIconSize, variant: 'branded', ...props });
    } catch (e) {
      console.warn(`Error creating specific icon for ${props?.name || 'unknown provider'}, falling back to default.`, e);
      return React.createElement(DefaultCryptoIcon);
    }
  }
  return React.createElement(DefaultCryptoIcon);
};

export const popularExchanges: CryptoProviderInfo[] = [
    { name: "Binance", iconComponent: createIcon(ExchangeBinance, {name: "Binance"}) },
    { name: "Coinbase", iconComponent: createIcon(ExchangeCoinbase, {name: "Coinbase"}) },
    { name: "Kraken", iconComponent: createIcon(ExchangeKraken, {name: "Kraken"}) },
    { name: "OKX", iconComponent: createIcon(ExchangeOkx, {name: "OKX"}) },
    { name: "KuCoin", iconComponent: createIcon(ExchangeKucoin, {name: "KuCoin"}) },
    { name: "Bitstamp", iconComponent: createIcon(undefined, {name: "Bitstamp"}) }, // Defaulted
    { name: "Gate.io", iconComponent: createIcon(ExchangeGateio, {name: "Gate.io"}) },
    { name: "Huobi (HTX)", iconComponent: createIcon(ExchangeHuobi, {name: "Huobi"}) },
    { name: "Bitfinex", iconComponent: createIcon(undefined, {name: "Bitfinex"}) }, // Defaulted
];

export const popularWallets: CryptoProviderInfo[] = [
    { name: "Ledger Nano S/X/Stax", iconComponent: createIcon(WalletLedger, {name: "Ledger"}) },
    { name: "Trezor Model One/T", iconComponent: createIcon(WalletTrezor, {name: "Trezor"}) },
    { name: "MetaMask", iconComponent: createIcon(WalletMetamask, {name: "MetaMask"}) },
    { name: "Trust Wallet", iconComponent: createIcon(WalletTrust, {name: "Trust Wallet"}) },
    { name: "Exodus", iconComponent: createIcon(WalletExodus, {name: "Exodus"}) },
    { name: "Phantom (Solana)", iconComponent: createIcon(WalletPhantom, {name: "Phantom"}) },
    { name: "Coinbase Wallet", iconComponent: createIcon(WalletCoinbaseIcon, {name: "Coinbase Wallet"}) },
    { name: "Atomic Wallet", iconComponent: createIcon(undefined, {name: "Atomic Wallet"}) }, // Defaulted
    { name: "BlueWallet (Bitcoin)", iconComponent: createIcon(undefined, {name: "BlueWallet"}) }, // Defaulted
];

export const allCryptoProviders: CryptoProviderInfo[] = [...new Set([...popularExchanges, ...popularWallets])].sort(
    (a, b) => a.name.localeCompare(b.name)
);

popularExchanges.sort((a, b) => a.name.localeCompare(b.name));
popularWallets.sort((a, b) => a.name.localeCompare(b.name));
