// Potentially used in server components later, but the functions themselves are not server actions.
// Removing 'use server;' to resolve build error.

import { getUserPreferences } from './preferences'; // Import preference getter

// --- Static Exchange Rates (Relative to BRL for simplicity) ---
// In a real app, fetch these from an API (e.g., Open Exchange Rates, Fixer.io)
const exchangeRates: { [key: string]: number } = {
  BRL: 1,
  USD: 5.30, // 1 USD = 5.30 BRL (Example rate)
  EUR: 5.70, // 1 EUR = 5.70 BRL (Example rate)
  GBP: 6.50, // 1 GBP = 6.50 BRL (Example rate)
  // Add more currencies as needed
};

export const supportedCurrencies = Object.keys(exchangeRates);

/**
 * Converts an amount from a source currency to a target currency using static rates.
 * @param amount The amount to convert.
 * @param sourceCurrency The currency code of the original amount (e.g., 'USD').
 * @param targetCurrency The currency code to convert to (e.g., 'BRL').
 * @returns The converted amount in the target currency, or the original amount if conversion fails.
 */
function convertCurrency(amount: number, sourceCurrency: string, targetCurrency: string): number {
  const sourceRate = exchangeRates[sourceCurrency.toUpperCase()];
  const targetRate = exchangeRates[targetCurrency.toUpperCase()];

  if (!sourceRate || !targetRate) {
    console.warn(`Cannot convert currency: Invalid source (${sourceCurrency}) or target (${targetCurrency}) currency.`);
    return amount; // Return original amount if rates are missing
  }

  // Convert source amount to base currency (BRL in this case)
  const amountInBase = amount * sourceRate;

  // Convert base amount to target currency
  const convertedAmount = amountInBase / targetRate;

  return convertedAmount;
}

/**
 * Formats a number as currency according to the specified currency code and locale.
 * Optionally converts the amount to the user's preferred currency before formatting.
 *
 * @param amount The numeric amount.
 * @param accountCurrency The currency code of the account (e.g., 'USD', 'BRL').
 * @param locale The locale string for formatting (e.g., 'pt-BR', 'en-US'). Defaults based on preferred currency.
 * @returns A formatted currency string (e.g., "R$ 1.234,56", "$1,234.56").
 */
export function formatCurrency(amount: number, accountCurrency: string, locale?: string): string {
    const { preferredCurrency } = getUserPreferences(); // Get preferred currency from storage

    const targetCurrency = preferredCurrency || accountCurrency; // Use preferred or fallback to account's currency
    const displayAmount = convertCurrency(amount, accountCurrency, targetCurrency);

    // Determine locale based on target currency if not provided
    let formatLocale = locale;
    if (!formatLocale) {
        switch (targetCurrency.toUpperCase()) {
            case 'BRL':
                formatLocale = 'pt-BR';
                break;
            case 'USD':
                formatLocale = 'en-US';
                break;
            case 'EUR':
                formatLocale = 'de-DE'; // Example European locale
                break;
            case 'GBP':
                formatLocale = 'en-GB';
                break;
            default:
                formatLocale = 'en-US'; // Default fallback locale
        }
    }

    try {
        return new Intl.NumberFormat(formatLocale, {
            style: 'currency',
            currency: targetCurrency.toUpperCase(),
        }).format(displayAmount);
    } catch (error) {
        console.error(`Error formatting currency: Amount=${displayAmount}, Currency=${targetCurrency}, Locale=${formatLocale}`, error);
        // Fallback formatting
        return `${targetCurrency.toUpperCase()} ${displayAmount.toFixed(2)}`;
    }
}

/**
 * Gets the symbol for a given currency code.
 * Note: This provides a basic symbol mapping. Intl.NumberFormat is more reliable for display.
 * @param currencyCode The currency code (e.g., 'BRL', 'USD').
 * @returns The currency symbol (e.g., 'R$', '$') or the code itself if not found.
 */
export function getCurrencySymbol(currencyCode: string): string {
    const upperCaseCode = currencyCode.toUpperCase();
    switch (upperCaseCode) {
        case 'BRL': return 'R$';
        case 'USD': return '$';
        case 'EUR': return '€';
        case 'GBP': return '£';
        // Add more symbols as needed
        default: return upperCaseCode; // Fallback to the code itself
    }
}

// You might add functions here later to fetch real-time exchange rates
// async function getRealTimeRates() { ... }
