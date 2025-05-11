
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
    { name: "Binance", iconUrl: "https://picsum.photos/seed/binance/20/20", dataAiHint: "Binance logo" },
    { name: "Coinbase", iconUrl: "https://picsum.photos/seed/coinbaseexchange/20/20", dataAiHint: "Coinbase logo" },
    { name: "Kraken", iconUrl: "https://picsum.photos/seed/kraken/20/20", dataAiHint: "Kraken logo" },
    { name: "Bybit", iconUrl: "https://picsum.photos/seed/bybit/20/20", dataAiHint: "Bybit logo" },
    { name: "OKX", iconUrl: "https://picsum.photos/seed/okx/20/20", dataAiHint: "OKX logo" },
    { name: "KuCoin", iconUrl: "https://picsum.photos/seed/kucoin/20/20", dataAiHint: "KuCoin logo" },
    { name: "Bitstamp", iconUrl: "https://picsum.photos/seed/bitstamp/20/20", dataAiHint: "Bitstamp logo" },
    { name: "Gate.io", iconUrl: "https://picsum.photos/seed/gateio/20/20", dataAiHint: "Gateio logo" },
    { name: "Huobi (HTX)", iconUrl: "https://picsum.photos/seed/huobi/20/20", dataAiHint: "Huobi logo" },
    { name: "Bitfinex", iconUrl: "https://picsum.photos/seed/bitfinex/20/20", dataAiHint: "Bitfinex logo" },
];

export const popularWallets: CryptoProviderInfo[] = [
    // Hardware Wallets
    { name: "Ledger Nano S/X/Stax", iconUrl: "https://picsum.photos/seed/ledger/20/20", dataAiHint: "Ledger logo" },
    { name: "Trezor Model One/T", iconUrl: "https://picsum.photos/seed/trezor/20/20", dataAiHint: "Trezor logo" },
    // Software/Mobile Wallets
    { name: "MetaMask", iconUrl: "https://picsum.photos/seed/metamask/20/20", dataAiHint: "MetaMask logo" },
    { name: "Trust Wallet", iconUrl: "https://picsum.photos/seed/trustwallet/20/20", dataAiHint: "Trust Wallet" },
    { name: "Exodus", iconUrl: "https://picsum.photos/seed/exodus/20/20", dataAiHint: "Exodus logo" },
    { name: "Electrum", iconUrl: "https://picsum.photos/seed/electrum/20/20", dataAiHint: "Electrum logo" },
    { name: "MyEtherWallet (MEW)", iconUrl: "https://picsum.photos/seed/mew/20/20", dataAiHint: "MEW logo" },
    { name: "Phantom (Solana)", iconUrl: "https://picsum.photos/seed/phantom/20/20", dataAiHint: "Phantom Wallet" },
    { name: "Coinbase Wallet", iconUrl: "https://picsum.photos/seed/coinbasewallet/20/20", dataAiHint: "Coinbase Wallet" }, // Separate from the exchange
    { name: "Atomic Wallet", iconUrl: "https://picsum.photos/seed/atomicwallet/20/20", dataAiHint: "Atomic Wallet" },
    { name: "BlueWallet (Bitcoin)", iconUrl: "https://picsum.photos/seed/bluewallet/20/20", dataAiHint: "BlueWallet logo" },
];

// Combine and sort for potential unified dropdowns or filtering
export const allCryptoProviders: CryptoProviderInfo[] = [...new Set([...popularExchanges, ...popularWallets])].sort(
    (a, b) => a.name.localeCompare(b.name)
);

popularExchanges.sort((a, b) => a.name.localeCompare(b.name));
popularWallets.sort((a, b) => a.name.localeCompare(b.name));

