
/**
 * Lists of popular cryptocurrency exchanges and self-custody wallets, now with icon placeholders.
 * These lists are not exhaustive and can be expanded.
 */

export interface CryptoProviderInfo {
  name: string;
  iconUrl: string;
  dataAiHint: string;
}

export const popularExchanges: CryptoProviderInfo[] = [
    { name: "Binance", iconUrl: "https://picsum.photos/seed/binance/40/40", dataAiHint: "Binance logo" },
    { name: "Coinbase", iconUrl: "https://picsum.photos/seed/coinbaseexchange/40/40", dataAiHint: "Coinbase logo" },
    { name: "Kraken", iconUrl: "https://picsum.photos/seed/kraken/40/40", dataAiHint: "Kraken logo" },
    { name: "Bybit", iconUrl: "https://picsum.photos/seed/bybit/40/40", dataAiHint: "Bybit logo" },
    { name: "OKX", iconUrl: "https://picsum.photos/seed/okx/40/40", dataAiHint: "OKX logo" },
    { name: "KuCoin", iconUrl: "https://picsum.photos/seed/kucoin/40/40", dataAiHint: "KuCoin logo" },
    { name: "Bitstamp", iconUrl: "https://picsum.photos/seed/bitstamp/40/40", dataAiHint: "Bitstamp logo" },
    { name: "Gate.io", iconUrl: "https://picsum.photos/seed/gateio/40/40", dataAiHint: "Gateio logo" },
    { name: "Huobi (HTX)", iconUrl: "https://picsum.photos/seed/huobi/40/40", dataAiHint: "Huobi logo" },
    { name: "Bitfinex", iconUrl: "https://picsum.photos/seed/bitfinex/40/40", dataAiHint: "Bitfinex logo" },
];

export const popularWallets: CryptoProviderInfo[] = [
    // Hardware Wallets
    { name: "Ledger Nano S/X/Stax", iconUrl: "https://picsum.photos/seed/ledger/40/40", dataAiHint: "Ledger logo" },
    { name: "Trezor Model One/T", iconUrl: "https://picsum.photos/seed/trezor/40/40", dataAiHint: "Trezor logo" },
    // Software/Mobile Wallets
    { name: "MetaMask", iconUrl: "https://picsum.photos/seed/metamask/40/40", dataAiHint: "MetaMask logo" },
    { name: "Trust Wallet", iconUrl: "https://picsum.photos/seed/trustwallet/40/40", dataAiHint: "Trust Wallet" },
    { name: "Exodus", iconUrl: "https://picsum.photos/seed/exodus/40/40", dataAiHint: "Exodus logo" },
    { name: "Electrum", iconUrl: "https://picsum.photos/seed/electrum/40/40", dataAiHint: "Electrum logo" },
    { name: "MyEtherWallet (MEW)", iconUrl: "https://picsum.photos/seed/mew/40/40", dataAiHint: "MEW logo" },
    { name: "Phantom (Solana)", iconUrl: "https://picsum.photos/seed/phantom/40/40", dataAiHint: "Phantom Wallet" },
    { name: "Coinbase Wallet", iconUrl: "https://picsum.photos/seed/coinbasewallet/40/40", dataAiHint: "Coinbase Wallet" },
    { name: "Atomic Wallet", iconUrl: "https://picsum.photos/seed/atomicwallet/40/40", dataAiHint: "Atomic Wallet" },
    { name: "BlueWallet (Bitcoin)", iconUrl: "https://picsum.photos/seed/bluewallet/40/40", dataAiHint: "BlueWallet logo" },
];

// Combine and sort for potential unified dropdowns or filtering
export const allCryptoProviders: CryptoProviderInfo[] = [...new Set([...popularExchanges, ...popularWallets])].sort(
    (a, b) => a.name.localeCompare(b.name)
);

popularExchanges.sort((a, b) => a.name.localeCompare(b.name));
popularWallets.sort((a, b) => a.name.localeCompare(b.name));
