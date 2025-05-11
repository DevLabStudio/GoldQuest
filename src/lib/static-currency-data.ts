
// This file contains static currency data that does not depend on client-side localStorage.

// --- Static Exchange Rates (Relative to BRL for simplicity) ---
const staticExchangeRates: { [key: string]: number } = {
  BRL: 1,    // 1 BRL = 1 BRL (Base)
  USD: 5.00, // Example rate
  EUR: 5.40, // Example rate
  GBP: 6.20, // Example rate
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
        default: return upperCaseCode; 
    }
}
