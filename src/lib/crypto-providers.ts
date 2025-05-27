'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { WalletCards } from 'lucide-react'; // Generic icon
// Não importaremos ícones específicos de @token-icons/react ou react-icons/si por enquanto
// para garantir estabilidade. Todos usarão o ícone genérico.

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

// Mapa para ícones específicos de cripto. Ficará vazio por enquanto.
// Adicionar aqui gradualmente após confirmar nomes e cores, e se a biblioteca de ícones estiver estável.
const specificCryptoIcons: { [key: string]: ReactNode } = {
  // Exemplo se quisermos adicionar Binance depois de verificar:
  // "Binance": React.createElement(ExchangeBinance, { size: defaultIconSize, color: "#F0B90B", variant: "branded" }),
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

// Não precisamos mais da função createIcon se estamos usando o mapa diretamente.
// A lógica de fallback está na atribuição do iconComponent.
