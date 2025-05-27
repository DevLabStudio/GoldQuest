
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon
// Usando @token-icons/react@2.14.0 conforme a instalação bem-sucedida anterior
// Se os nomes exatos dos ícones abaixo não funcionarem para @token-icons/react@2.14.0, eles usarão o DefaultCryptoIcon.
import {
    ExchangeBinance,
    ExchangeCoinbase,
    ExchangeKraken,
    // ExchangeBybit, // Exemplo, verificar se existe
    ExchangeOkx,
    ExchangeKucoin,
    // ExchangeBitstamp, // Verificar
    // ExchangeGateio,  // Verificar
    // ExchangeHuobi,   // Verificar
    // ExchangeBitfinex, // Verificar
    WalletLedger,
    WalletTrezor,
    WalletMetamask,
    WalletTrust, // Nome comum, verificar se é WalletTrustWallet
    WalletExodus,
    WalletPhantom,
    WalletCoinbase as WalletCoinbaseIcon // Alias para evitar conflito com ExchangeCoinbase
} from '@token-icons/react'; // Atenção: Este pacote foi renomeado para @web3icons/react

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

// Helper para criar ícones com fallback
const createIcon = (SpecificIconComponent?: React.ElementType, props?: any) => {
  if (SpecificIconComponent) {
    try {
      return React.createElement(SpecificIconComponent, { size: defaultIconSize, variant: 'branded', ...props });
    } catch (e) {
      console.warn(`Error creating specific crypto icon for ${props?.name || 'unknown provider'}, falling back to default. Ensure the icon name is correct for @token-icons/react@2.14.0.`, e);
      return React.createElement(DefaultCryptoIcon);
    }
  }
  return React.createElement(DefaultCryptoIcon);
};

// Tentar com nomes que são mais prováveis de existir em @token-icons/react@2.14.0
export const popularExchanges: CryptoProviderInfo[] = [
    { name: "Binance", iconComponent: createIcon(ExchangeBinance, {name: "Binance"}) },
    { name: "Coinbase", iconComponent: createIcon(ExchangeCoinbase, {name: "Coinbase"}) },
    { name: "Kraken", iconComponent: createIcon(ExchangeKraken, {name: "Kraken"}) },
    { name: "OKX", iconComponent: createIcon(ExchangeOkx, {name: "OKX"}) },
    { name: "KuCoin", iconComponent: createIcon(ExchangeKucoin, {name: "KuCoin"}) },
    { name: "Bitstamp", iconComponent: createIcon(undefined, {name: "Bitstamp"}) }, // Fallback
    { name: "Gate.io", iconComponent: createIcon(undefined, {name: "Gate.io"}) },   // Fallback
    { name: "Huobi (HTX)", iconComponent: createIcon(undefined, {name: "Huobi"}) }, // Fallback
    { name: "Bitfinex", iconComponent: createIcon(undefined, {name: "Bitfinex"}) },  // Fallback
    // Adicionar outros conforme necessário, verificando os nomes em @token-icons/react@2.14.0
];

export const popularWallets: CryptoProviderInfo[] = [
    { name: "Ledger Nano S/X/Stax", iconComponent: createIcon(WalletLedger, {name: "Ledger"}) },
    { name: "Trezor Model One/T", iconComponent: createIcon(WalletTrezor, {name: "Trezor"}) },
    { name: "MetaMask", iconComponent: createIcon(WalletMetamask, {name: "MetaMask"}) },
    { name: "Trust Wallet", iconComponent: createIcon(WalletTrust, {name: "Trust Wallet"}) }, // WalletTrust pode ser o nome correto
    { name: "Exodus", iconComponent: createIcon(WalletExodus, {name: "Exodus"}) },
    { name: "Phantom (Solana)", iconComponent: createIcon(WalletPhantom, {name: "Phantom"}) },
    { name: "Coinbase Wallet", iconComponent: createIcon(WalletCoinbaseIcon, {name: "Coinbase Wallet"}) },
    { name: "Atomic Wallet", iconComponent: createIcon(undefined, {name: "Atomic Wallet"}) }, // Fallback
    { name: "BlueWallet (Bitcoin)", iconComponent: createIcon(undefined, {name: "BlueWallet"}) }, // Fallback
];

export const allCryptoProviders: CryptoProviderInfo[] = [...new Set([...popularExchanges, ...popularWallets])].sort(
    (a, b) => a.name.localeCompare(b.name)
);

popularExchanges.sort((a, b) => a.name.localeCompare(b.name));
popularWallets.sort((a, b) => a.name.localeCompare(b.name));
