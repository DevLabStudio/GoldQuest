
import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon
import {
 ExchangeCoinbase, ExchangeKraken, ExchangeOkx, ExchangeKucoin, ExchangeGateio, ExchangeHuobi, ExchangeBinance, ExchangeBitfinex, ExchangeBitstamp, WalletLedger, WalletTrezor, WalletMetamask, WalletTrust, WalletExodus, WalletPhantom, WalletCoinbase as WalletCoinbaseIcon
} from '@token-icons/react'; // Reverted to @token-icons/react

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
 { name: "Binance", iconComponent: React.createElement(ExchangeBinance, { size: defaultIconSize }) },
    { name: "Coinbase", iconComponent: React.createElement(ExchangeCoinbase, { size: defaultIconSize }) },
    { name: "Kraken", iconComponent: React.createElement(ExchangeKraken, { size: defaultIconSize }) },
    { name: "Bybit", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "OKX", iconComponent: React.createElement(ExchangeOkx, { size: defaultIconSize }) },
    { name: "KuCoin", iconComponent: React.createElement(ExchangeKucoin, { size: defaultIconSize }) },
    { name: "Bitstamp", iconComponent: React.createElement(ExchangeBitstamp, { size: defaultIconSize }) },
    { name: "Gate.io", iconComponent: React.createElement(ExchangeGateio, { size: defaultIconSize }) },
    { name: "Huobi (HTX)", iconComponent: React.createElement(ExchangeHuobi, { size: defaultIconSize }) },
    { name: "Bitfinex", iconComponent: React.createElement(ExchangeBitfinex, { size: defaultIconSize }) },
];

export const popularWallets: CryptoProviderInfo[] = [
    // Hardware Wallets
    { name: "Ledger Nano S/X/Stax", iconComponent: React.createElement(WalletLedger, { size: defaultIconSize }) },
    { name: "Trezor Model One/T", iconComponent: React.createElement(WalletTrezor, { size: defaultIconSize }) },
    // Software/Mobile Wallets
    { name: "MetaMask", iconComponent: React.createElement(WalletMetamask, { size: defaultIconSize }) },
    { name: "Trust Wallet", iconComponent: React.createElement(WalletTrust, { size: defaultIconSize }) },
    { name: "Exodus", iconComponent: React.createElement(WalletExodus, { size: defaultIconSize }) },
    { name: "Electrum", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "MyEtherWallet (MEW)", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Phantom (Solana)", iconComponent: React.createElement(WalletPhantom, { size: defaultIconSize }) },
    { name: "Coinbase Wallet", iconComponent: React.createElement(WalletCoinbaseIcon, { size: defaultIconSize }) },
    { name: "Atomic Wallet", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "BlueWallet (Bitcoin)", iconComponent: React.createElement(DefaultCryptoIcon) },
];

// Combine and sort for potential unified dropdowns or filtering
export const allCryptoProviders: CryptoProviderInfo[] = [...new Set([...popularExchanges, ...popularWallets])].sort(
    (a, b) => a.name.localeCompare(b.name)
);

popularExchanges.sort((a, b) => a.name.localeCompare(b.name));
popularWallets.sort((a, b) => a.name.localeCompare(b.name));
    
