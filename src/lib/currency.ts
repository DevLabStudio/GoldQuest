'use client'; // This module depends on localStorage via getUserPreferences

import { getUserPreferences } from './preferences'; // Import preference getter
import type { UserPreferences } from './preferences';

// --- Static Exchange Rates (Relative to BRL for simplicity) ---
// Rates represent: 1 unit of the KEY currency = VALUE units of BRL
// In a real app, fetch these from an API (e.g., Open Exchange Rates, Fixer.io)
const exchangeRates: { [key: string]: number } = {
  BRL: 1,    // 1 BRL = 1 BRL (Base)
  USD: 5.30, // 1 USD = 5.30 BRL (Example rate)
  EUR: 5.70, // 1 EUR = 5.70 BRL (Example rate)
  GBP: 6.50, // 1 GBP = 6.50 BRL (Example rate)
  // Add more currencies as needed
};

export const supportedCurrencies = Object.keys(exchangeRates);

/**
 * Converts an amount from a source currency to a target currency using static rates.
 * Assumes exchangeRates are defined as 1 unit of KEY currency = VALUE units of BASE currency (BRL).
 * @param amount The amount to convert.
 * @param sourceCurrency The currency code of the original amount (e.g., 'USD').
 * @param targetCurrency The currency code to convert to (e.g., 'BRL').
 * @returns The converted amount in the target currency, or the original amount if conversion fails.
 */
export function convertCurrency(amount: number, sourceCurrency: string, targetCurrency: string): number {
  const sourceUpper = sourceCurrency.toUpperCase();
  const targetUpper = targetCurrency.toUpperCase();

  if (sourceUpper === targetUpper) {
      return amount; // No conversion needed
  }

  const sourceRate = exchangeRates[sourceUpper]; // Rate: 1 SOURCE = sourceRate BASE (BRL)
  const targetRate = exchangeRates[targetUpper]; // Rate: 1 TARGET = targetRate BASE (BRL)

  if (!sourceRate || !targetRate) {
    console.warn(`Cannot convert currency: Invalid source (${sourceCurrency}) or target (${targetCurrency}) currency.`);
    return amount; // Return original amount if rates are missing
  }

  // 1. Convert source amount to base currency (BRL)
  // Example: 100 USD to BRL -> 100 * 5.30 = 530 BRL
  const amountInBase = amount * sourceRate;

  // 2. Convert base amount (BRL) to target currency
  // Example: 530 BRL to EUR -> 530 / 5.70 = 92.98 EUR
  const convertedAmount = amountInBase / targetRate;

  return convertedAmount;
}

/**
 * Determines the appropriate locale string for currency formatting based on the currency code.
 * @param currencyCode The currency code (e.g., 'BRL', 'USD').
 * @returns A locale string (e.g., 'pt-BR', 'en-US').
 */
function getLocaleForCurrency(currencyCode: string | undefined | null): string {
    if (!currencyCode) {
      return 'en-US'; // Default fallback if currencyCode is undefined/null
    }
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
    let userPrefs: UserPreferences = { preferredCurrency: 'BRL' }; // Default if not client-side
    if (typeof window !== 'undefined') {
      // This is a simplified synchronous call for client-side only.
      // Consider making getUserPreferences async and handling it appropriately in calling components
      // if more complex async logic is needed here. For now, this mimics previous behavior.
      try {
        const storedPrefs = localStorage.getItem('userPreferences');
        if (storedPrefs) {
          const parsedPrefs = JSON.parse(storedPrefs) as Partial<UserPreferences>;
          if (parsedPrefs.preferredCurrency && supportedCurrencies.includes(parsedPrefs.preferredCurrency.toUpperCase())) {
            userPrefs.preferredCurrency = parsedPrefs.preferredCurrency.toUpperCase();
          }
        }
      } catch (e) {
        console.warn("Could not parse user preferences from localStorage, using default.", e);
      }
    }
    const { preferredCurrency } = userPrefs;

    let displayAmount = amount;
    let displayCurrency = accountCurrency?.toUpperCase(); // Handle potentially undefined accountCurrency
    let displayLocale = locale;

    if (!displayCurrency) {
      // console.warn("formatCurrency: accountCurrency is undefined. Using preferredCurrency or default BRL.");
      displayCurrency = preferredCurrency || 'BRL';
    }

    if (convertToPreferred && typeof window !== 'undefined') {
        const targetCurrency = preferredCurrency || displayCurrency; // Fallback
        if (displayCurrency !== targetCurrency.toUpperCase()) {
             displayAmount = convertCurrency(amount, displayCurrency, targetCurrency);
        }
        displayCurrency = targetCurrency.toUpperCase();
    }

    if (!displayLocale) {
        displayLocale = getLocaleForCurrency(displayCurrency);
    }

    try {
        return new Intl.NumberFormat(displayLocale, {
            style: 'currency',
            currency: displayCurrency,
        }).format(displayAmount);
    } catch (error: any) {
        // Handle cases where currency code might be invalid for Intl.NumberFormat
        if (error.message.includes("Invalid currency code")) {
            // console.warn(`formatCurrency: Invalid currency code "${displayCurrency}" for Intl.NumberFormat. Falling back to code and amount.`);
            return `${displayCurrency} ${displayAmount.toFixed(2)}`;
        }
        console.error(`Error formatting currency: Amount=${displayAmount}, Currency=${displayCurrency}, Locale=${displayLocale}`, error);
        return `${displayCurrency} ${displayAmount.toFixed(2)}`; // Fallback formatting
    }
}

/**
 * Gets the symbol for a given currency code.
 * Note: This provides a basic symbol mapping. Intl.NumberFormat is more reliable for display.
 * @param currencyCode The currency code (e.g., 'BRL', 'USD').
 * @returns The currency symbol (e.g., 'R$', '$') or the code itself if not found, or '¤' for invalid.
 */
export function getCurrencySymbol(currencyCode: string | undefined | null): string {
    if (!currencyCode || typeof currencyCode !== 'string' || currencyCode.trim() === "") {
        // console.warn(`getCurrencySymbol: currencyCode is invalid ('${currencyCode}'). Returning generic symbol '¤'.`);
        return '¤'; // Generic currency symbol for undefined, null, or empty string
    }
    const upperCaseCode = currencyCode.toUpperCase();
    switch (upperCaseCode) {
        case 'BRL': return 'R$';
        case 'USD': return '$';
        case 'EUR': return '€';
        case 'GBP': return '£';
        // Add more symbols as needed
        default: return upperCaseCode; // Fallback to the code itself if known symbol not found
    }
}
