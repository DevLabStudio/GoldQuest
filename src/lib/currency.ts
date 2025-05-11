
'use client'; 

import type { UserPreferences } from './preferences'; // Assuming preferences.ts is also updated
import { supportedCurrencies as staticSupportedCurrencies, getCurrencySymbol as staticGetCurrencySymbol } from './static-currency-data'; // Renamed original content

// --- Static Exchange Rates (Relative to BRL for simplicity) ---
// Rates represent: 1 unit of the KEY currency = VALUE units of BRL
// In a real app, fetch these from an API (e.g., Open Exchange Rates, Fixer.io)
const exchangeRates: { [key: string]: number } = {
  BRL: 1,    // 1 BRL = 1 BRL (Base)
  USD: 5.00, // Updated example rate
  EUR: 5.40, // Updated example rate
  GBP: 6.20, // Updated example rate
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
  const sourceUpper = sourceCurrency?.toUpperCase();
  const targetUpper = targetCurrency?.toUpperCase();

  if (!sourceUpper || !targetUpper) {
    // console.warn("convertCurrency: Source or target currency is undefined. Returning original amount.");
    return amount;
  }

  if (sourceUpper === targetUpper) {
      return amount; // No conversion needed
  }

  const sourceRate = exchangeRates[sourceUpper]; 
  const targetRate = exchangeRates[targetUpper]; 

  if (sourceRate === undefined || targetRate === undefined) { // Check for undefined specifically
    console.warn(`Cannot convert currency: Invalid or unsupported source (${sourceCurrency}) or target (${targetCurrency}) currency.`);
    return amount; 
  }
  
  const amountInBase = amount * sourceRate;
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
      return 'en-US'; 
    }
    switch (currencyCode.toUpperCase()) {
        case 'BRL': return 'pt-BR';
        case 'USD': return 'en-US';
        case 'EUR': return 'de-DE'; 
        case 'GBP': return 'en-GB';
        default: return 'en-US'; 
    }
}


/**
 * Formats a number as currency according to the specified currency code and locale.
 * Optionally converts the amount to the user's preferred currency before formatting.
 *
 * @param amount The numeric amount.
 * @param accountCurrency The currency code of the account (e.g., 'USD', 'BRL').
 * @param preferredCurrencyFromCaller Optional The user's preferred currency code. If provided and convertToPreferred is true, amount will be converted.
 * @param locale Optional The locale string for formatting (e.g., 'pt-BR', 'en-US'). If omitted, derived from target currency.
 * @param convertToPreferred Optional If true (default), converts to user's preferred currency (if provided). If false, formats in accountCurrency.
 * @returns A formatted currency string (e.g., "R$ 1.234,56", "$1,234.56").
 */
export function formatCurrency(
    amount: number,
    accountCurrency: string,
    preferredCurrencyFromCaller?: string,
    locale?: string,
    convertToPreferred: boolean = true
): string {
    let displayAmount = amount;
    let displayCurrency = accountCurrency?.toUpperCase();
    let displayLocale = locale;

    if (!displayCurrency) {
      // console.warn("formatCurrency: accountCurrency is undefined. Using preferredCurrencyFromCaller or default BRL.");
      displayCurrency = preferredCurrencyFromCaller?.toUpperCase() || 'BRL';
    }

    if (convertToPreferred && preferredCurrencyFromCaller) {
        const targetCurrency = preferredCurrencyFromCaller.toUpperCase();
        if (displayCurrency !== targetCurrency) {
             displayAmount = convertCurrency(amount, displayCurrency, targetCurrency);
        }
        displayCurrency = targetCurrency;
    } else if (convertToPreferred && !preferredCurrencyFromCaller && typeof window !== 'undefined') {
        // This case implies convertToPreferred is true, but the caller didn't supply the preference.
        // This is a fallback and ideally, callers should provide the preference.
        // console.warn("formatCurrency: convertToPreferred is true, but preferredCurrencyFromCaller not provided. Attempting to use a default or account currency.");
        // It will just format in accountCurrency if preferredCurrencyFromCaller is missing.
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
        if (error.message.includes("Invalid currency code")) {
            return `${displayCurrency} ${displayAmount.toFixed(2)}`;
        }
        console.error(`Error formatting currency: Amount=${displayAmount}, Currency=${displayCurrency}, Locale=${displayLocale}`, error);
        return `${displayCurrency} ${displayAmount.toFixed(2)}`; 
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

