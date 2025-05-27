
import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon
import {
    SiBinance, SiCoinbase, SiKraken, SiOkx, SiKucoin, SiGateDotIo, SiHuobi, SiBitfinex, SiBitstamp,
    SiLedger, SiTrezor, SiMetamask, SiTrustwallet, SiExodus, SiPhantom
} from 'react-icons/si'; // Import from react-icons/si

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
 { name: "Binance", iconComponent: React.createElement(SiBinance, { size: defaultIconSize }) },
    { name: "Coinbase", iconComponent: React.createElement(SiCoinbase, { size: defaultIconSize }) },
    { name: "Kraken", iconComponent: React.createElement(SiKraken, { size: defaultIconSize }) },
    { name: "Bybit", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "OKX", iconComponent: React.createElement(SiOkx, { size: defaultIconSize }) },
    { name: "KuCoin", iconComponent: React.createElement(SiKucoin, { size: defaultIconSize }) },
    { name: "Bitstamp", iconComponent: React.createElement(SiBitstamp, { size: defaultIconSize }) },
    { name: "Gate.io", iconComponent: React.createElement(SiGateDotIo, { size: defaultIconSize }) },
    { name: "Huobi (HTX)", iconComponent: React.createElement(SiHuobi, { size: defaultIconSize }) },
    { name: "Bitfinex", iconComponent: React.createElement(SiBitfinex, { size: defaultIconSize }) },
];

export const popularWallets: CryptoProviderInfo[] = [
    // Hardware Wallets
    { name: "Ledger Nano S/X/Stax", iconComponent: React.createElement(SiLedger, { size: defaultIconSize }) },
    { name: "Trezor Model One/T", iconComponent: React.createElement(SiTrezor, { size: defaultIconSize }) },
    // Software/Mobile Wallets
    { name: "MetaMask", iconComponent: React.createElement(SiMetamask, { size: defaultIconSize }) },
    { name: "Trust Wallet", iconComponent: React.createElement(SiTrustwallet, { size: defaultIconSize }) },
    { name: "Exodus", iconComponent: React.createElement(SiExodus, { size: defaultIconSize }) },
    { name: "Electrum", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "MyEtherWallet (MEW)", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "Phantom (Solana)", iconComponent: React.createElement(SiPhantom, { size: defaultIconSize }) },
    { name: "Coinbase Wallet", iconComponent: React.createElement(SiCoinbase, { size: defaultIconSize }) }, // Using SiCoinbase as a general Coinbase wallet icon
    { name: "Atomic Wallet", iconComponent: React.createElement(DefaultCryptoIcon) },
    { name: "BlueWallet (Bitcoin)", iconComponent: React.createElement(DefaultCryptoIcon) },
];

// Combine and sort for potential unified dropdowns or filtering
export const allCryptoProviders: CryptoProviderInfo[] = [...new Set([...popularExchanges, ...popularWallets])].sort(
    (a, b) => a.name.localeCompare(b.name)
);

popularExchanges.sort((a, b) => a.name.localeCompare(b.name));
popularWallets.sort((a, b) => a.name.localeCompare(b.name));
    
