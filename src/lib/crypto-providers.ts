
import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon
import {
    ExchangeBinance, ExchangeCoinbase, ExchangeKraken, ExchangeBybit, ExchangeOkx, ExchangeKucoin, ExchangeBitstamp, ExchangeGateio, ExchangeHuobi, ExchangeBitfinex,
    WalletLedger, WalletTrezor, WalletMetamask, WalletTrust, WalletExodus, WalletPhantom, WalletCoinbase as WalletCoinbaseIcon // Renamed to avoid conflict
} from '@token-icons/react';

const defaultIconSize = 20;

const DefaultCryptoIcon = () => {
  return (
    <WalletCards
      size={20} // Hardcoded size
      className="text-muted-foreground"
    />
  );
};


export interface CryptoProviderInfo {
  name: string;
  iconComponent: ReactNode;
}

export const popularExchanges: CryptoProviderInfo[] = [
    { name: "Binance", iconComponent: <ExchangeBinance size={defaultIconSize} /> },
    { name: "Coinbase", iconComponent: <ExchangeCoinbase size={defaultIconSize} /> },
    { name: "Kraken", iconComponent: <ExchangeKraken size={defaultIconSize} /> },
    { name: "Bybit", iconComponent: <ExchangeBybit size={defaultIconSize} /> },
    { name: "OKX", iconComponent: <ExchangeOkx size={defaultIconSize} /> },
    { name: "KuCoin", iconComponent: <ExchangeKucoin size={defaultIconSize} /> },
    { name: "Bitstamp", iconComponent: <ExchangeBitstamp size={defaultIconSize} /> },
    { name: "Gate.io", iconComponent: <ExchangeGateio size={defaultIconSize} /> },
    { name: "Huobi (HTX)", iconComponent: <ExchangeHuobi size={defaultIconSize} /> },
    { name: "Bitfinex", iconComponent: <ExchangeBitfinex size={defaultIconSize} /> },
];

export const popularWallets: CryptoProviderInfo[] = [
    // Hardware Wallets
    { name: "Ledger Nano S/X/Stax", iconComponent: <WalletLedger size={defaultIconSize} /> },
    { name: "Trezor Model One/T", iconComponent: <WalletTrezor size={defaultIconSize} /> },
    // Software/Mobile Wallets
    { name: "MetaMask", iconComponent: <WalletMetamask size={defaultIconSize} /> },
    { name: "Trust Wallet", iconComponent: <WalletTrust size={defaultIconSize} /> },
    { name: "Exodus", iconComponent: <WalletExodus size={defaultIconSize} /> },
    { name: "Electrum", iconComponent: <DefaultCryptoIcon /> }, // Placeholder, check @token-icons/react
    { name: "MyEtherWallet (MEW)", iconComponent: <DefaultCryptoIcon /> }, // Placeholder
    { name: "Phantom (Solana)", iconComponent: <WalletPhantom size={defaultIconSize} /> },
    { name: "Coinbase Wallet", iconComponent: <WalletCoinbaseIcon size={defaultIconSize} /> },
    { name: "Atomic Wallet", iconComponent: <DefaultCryptoIcon /> }, // Placeholder
    { name: "BlueWallet (Bitcoin)", iconComponent: <DefaultCryptoIcon /> }, // Placeholder
];

// Fallback for icons not found
popularExchanges.forEach(provider => {
    if (provider.iconComponent === undefined) {
        provider.iconComponent = <DefaultCryptoIcon />;
    }
});
popularWallets.forEach(provider => {
    if (provider.iconComponent === undefined) {
        provider.iconComponent = <DefaultCryptoIcon />;
    }
});

// Combine and sort for potential unified dropdowns or filtering
export const allCryptoProviders: CryptoProviderInfo[] = [...new Set([...popularExchanges, ...popularWallets])].sort(
    (a, b) => a.name.localeCompare(b.name)
);

popularExchanges.sort((a, b) => a.name.localeCompare(b.name));
popularWallets.sort((a, b) => a.name.localeCompare(b.name));
