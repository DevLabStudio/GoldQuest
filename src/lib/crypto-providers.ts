
/**
 * Lists of popular cryptocurrency exchanges and self-custody wallets.
 * These lists are not exhaustive and can be expanded.
 */

export const popularExchanges: string[] = [
    "Binance",
    "Coinbase",
    "Kraken",
    "Bybit",
    "OKX",
    "KuCoin",
    "Bitstamp",
    "Gate.io",
    "Huobi (HTX)",
    "Bitfinex",
    // Add more as needed
];

export const popularWallets: string[] = [
    // Hardware Wallets
    "Ledger Nano S/X/Stax",
    "Trezor Model One/T",
    // Software/Mobile Wallets
    "MetaMask",
    "Trust Wallet",
    "Exodus",
    "Electrum",
    "MyEtherWallet (MEW)",
    "Phantom (Solana)",
    "Coinbase Wallet", // Separate from the exchange, offers self-custody
    "Exodus",
    "Atomic Wallet",
    "BlueWallet (Bitcoin)",
    // Add more as needed
];

// Combine and sort for potential unified dropdowns or filtering
export const allCryptoProviders: string[] = [...new Set([...popularExchanges, ...popularWallets])].sort();

popularExchanges.sort();
popularWallets.sort();

