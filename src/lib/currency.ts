
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
  const sourceUpper = sourceCurrency.toUpperCase();
  const targetUpper = targetCurrency.toUpperCase();

  if (sourceUpper === targetUpper) {
      return amount; // No conversion needed
  }

  const sourceRate = exchangeRates[sourceUpper];
  const targetRate = exchangeRates[targetUpper];

  if (!sourceRate || !targetRate) {
    console.warn(`Cannot convert currency: Invalid source (${sourceCurrency}) or target (${targetCurrency}) currency.`);
    return amount; // Return original amount if rates are missing
  }

  // Convert source amount to base currency (BRL in this case)
  const amountInBase = amount / sourceRate; // Correction: Divide by source rate to get to base

  // Convert base amount to target currency
  const convertedAmount = amountInBase * targetRate; // Correction: Multiply by target rate

  return convertedAmount;
}

/**
 * Determines the appropriate locale string for currency formatting based on the currency code.
 * @param currencyCode The currency code (e.g., 'BRL', 'USD').
 * @returns A locale string (e.g., 'pt-BR', 'en-US').
 */
function getLocaleForCurrency(currencyCode: string): string {
    switch (currencyCode.toUpperCase()) {
        case 'BRL': return 'pt-BR';
        case 'USD': return 'en-US';
        case 'EUR': return 'de-DE'; // Example European locale (Germany uses EUR)
        case 'GBP': return 'en-GB';
        default: return 'en-US'; // Default fallback locale
    }
}


/**
 * Formats a number as currency according to the specified currency code and locale.
 * Optionally converts the amount to the user's preferred currency before formatting.
 *
 * @param amount The numeric amount.
 * @param accountCurrency The currency code of the account (e.g., 'USD', 'BRL').
 * @param locale Optional The locale string for formatting (e.g., 'pt-BR', 'en-US'). If omitted, derived from target currency.
 * @param convertToPreferred Optional If true (default), converts to user's preferred currency. If false, formats in accountCurrency.
 * @returns A formatted currency string (e.g., "R$ 1.234,56", "$1,234.56").
 */
export function formatCurrency(
    amount: number,
    accountCurrency: string,
    locale?: string,
    convertToPreferred: boolean = true // Default to true
): string {
    const { preferredCurrency } = getUserPreferences();

    let displayAmount = amount;
    let displayCurrency = accountCurrency.toUpperCase();
    let displayLocale = locale;

    if (convertToPreferred) {
        const targetCurrency = preferredCurrency || accountCurrency; // Fallback if preference somehow missing
        displayAmount = convertCurrency(amount, accountCurrency, targetCurrency);
        displayCurrency = targetCurrency.toUpperCase();
    } else {
        // Keep original amount and currency if convertToPreferred is false
        displayAmount = amount;
        displayCurrency = accountCurrency.toUpperCase();
    }

    // Determine locale based on the currency being displayed if locale wasn't provided
    if (!displayLocale) {
        displayLocale = getLocaleForCurrency(displayCurrency);
    }


    try {
        return new Intl.NumberFormat(displayLocale, {
            style: 'currency',
            currency: displayCurrency,
        }).format(displayAmount);
    } catch (error) {
        console.error(`Error formatting currency: Amount=${displayAmount}, Currency=${displayCurrency}, Locale=${displayLocale}`, error);
        // Fallback formatting
        return `${displayCurrency} ${displayAmount.toFixed(2)}`;
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
