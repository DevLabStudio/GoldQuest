// This file contains static currency data that does not depend on client-side localStorage.

// --- Static Exchange Rates (Relative to BRL for simplicity) ---
// Prices are: 1 unit of KEY currency = VALUE in BRL
const staticExchangeRates: { [key: string]: number } = {
  BRL: 1,    // 1 BRL = 1 BRL (Base)
  USD: 5.25, // 1 USD = 5.25 BRL
  EUR: 5.70, // 1 EUR = 5.70 BRL
  GBP: 6.30, // 1 GBP = 6.30 BRL
  BTC: 350000.00, // 1 BTC = 350,000.00 BRL
};

export const supportedCurrencies = Object.keys(staticExchangeRates);

export function getCurrencySymbol(currencyCode: string | undefined | null): string {
    if (!currencyCode || typeof currencyCode !== 'string' || currencyCode.trim() === "") {
        return '¤'; 
    }
    const upperCaseCode = currencyCode.toUpperCase();
    switch (upperCaseCode) {
        case 'BRL': return 'R$';
        case 'USD': return '$';
        case 'EUR': return '€';
        case 'GBP': return '£';
        case 'BTC': return '₿'; // Bitcoin symbol
        default: return upperCaseCode; 
    }
}

