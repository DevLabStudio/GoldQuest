'use client'; 

import type { UserPreferences } from './preferences';
import { supportedCurrencies as staticSupportedCurrencies, getCurrencySymbol as staticGetCurrencySymbol } from './static-currency-data';

// --- Static Exchange Rates (Relative to BRL for simplicity) ---
// Prices are: 1 unit of KEY currency = VALUE in BRL
const exchangeRates: { [key: string]: number } = {
  BRL: 1,    // 1 BRL = 1 BRL (Base)
  USD: 5.25, // 1 USD = 5.25 BRL
  EUR: 5.70, // 1 EUR = 5.70 BRL
  GBP: 6.30, // 1 GBP = 6.30 BRL (Example update)
  BTC: 350000.00, // 1 BTC = 350,000.00 BRL
  // Add more currencies as needed
};

export const supportedCurrencies = Object.keys(exchangeRates);

/**
 * Converts an amount from a source currency to a target currency.
 * Uses BRL as an intermediary if direct rates are not available.
 * @param amount The amount to convert.
 * @param sourceCurrency The currency code of the amount.
 * @param targetCurrency The currency code to convert to.
 * @returns The converted amount in the target currency.
 */
export function convertCurrency(amount: number, sourceCurrency: string, targetCurrency: string): number {
  const sourceUpper = sourceCurrency?.toUpperCase();
  const targetUpper = targetCurrency?.toUpperCase();

  if (!sourceUpper || !targetUpper || !amount) { // Also check for amount to avoid NaN issues with 0
    return amount || 0; // Return 0 if amount is undefined/null/0
  }

  if (sourceUpper === targetUpper) {
      return amount;
  }

  const sourceRateToBRL = exchangeRates[sourceUpper];
  const targetRateToBRL = exchangeRates[targetUpper];

  if (sourceRateToBRL === undefined) {
    console.warn(`Cannot convert currency: Unsupported source currency (${sourceCurrency}). Rates relative to BRL are missing.`);
    return amount; // Or throw an error, or return NaN
  }
  if (targetRateToBRL === undefined) {
    console.warn(`Cannot convert currency: Unsupported target currency (${targetCurrency}). Rates relative to BRL are missing.`);
    return amount; // Or throw an error, or return NaN
  }

  // Convert source amount to BRL
  const amountInBRL = amount * sourceRateToBRL;

  // Convert amount in BRL to target currency
  const convertedAmount = amountInBRL / targetRateToBRL;
  
  return convertedAmount;
}


function getLocaleForCurrency(currencyCode: string | undefined | null): string {
    if (!currencyCode) {
      return 'en-US'; 
    }
    switch (currencyCode.toUpperCase()) {
        case 'BRL': return 'pt-BR';
        case 'USD': return 'en-US';
        case 'EUR': return 'de-DE'; 
        case 'GBP': return 'en-GB';
        case 'BTC': return 'en-US'; // Bitcoin often uses USD-like formatting for subdivision
        default: return 'en-US'; 
    }
}

/**
 * Formats a number as currency.
 *
 * @param amount The numeric amount to format.
 * @param sourceCurrencyOfAmount The currency code of the input `amount` (e.g., 'USD', 'BRL').
 * @param targetFormatOrConversionCurrency Optional. If `convertToTargetCurrency` is true, this is the currency to convert to.
 *                                        If `convertToTargetCurrency` is false, this parameter is largely ignored for currency choice,
 *                                        but can influence locale if `explicitLocale` is not provided. Formatting will be in `sourceCurrencyOfAmount`.
 * @param convertToTargetCurrency If true (default), converts `amount` from `sourceCurrencyOfAmount` to `targetFormatOrConversionCurrency` before formatting.
 *                                If false, `amount` is formatted in `sourceCurrencyOfAmount`.
 * @param explicitLocale Optional. The locale string for formatting (e.g., 'pt-BR', 'en-US'). If omitted, derived from the final formatting currency.
 * @returns A formatted currency string.
 */
export function formatCurrency(
    amount: number,
    sourceCurrencyOfAmount: string,
    targetFormatOrConversionCurrency?: string,
    convertToTargetCurrency: boolean = true, // Default to true, common use case
    explicitLocale?: string
): string {
    let amountToFormat = amount;
    let currencyForFormatting: string;

    const effectiveSourceCurrency = sourceCurrencyOfAmount?.toUpperCase();
    const effectiveTargetCurrency = targetFormatOrConversionCurrency?.toUpperCase();

    if (!effectiveSourceCurrency) {
        currencyForFormatting = effectiveTargetCurrency || 'BRL';
        console.warn(`formatCurrency: sourceCurrencyOfAmount was undefined. Formatting as ${currencyForFormatting}.`);
    } else if (convertToTargetCurrency && effectiveTargetCurrency && effectiveSourceCurrency !== effectiveTargetCurrency) {
        amountToFormat = convertCurrency(amount, effectiveSourceCurrency, effectiveTargetCurrency);
        currencyForFormatting = effectiveTargetCurrency;
    } else {
        amountToFormat = amount;
        currencyForFormatting = effectiveSourceCurrency;
    }

    const displayLocale = explicitLocale || getLocaleForCurrency(currencyForFormatting);
    
    let options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currencyForFormatting,
    };

    if (currencyForFormatting === 'BTC') {
        options.minimumFractionDigits = 2; // Show more precision for BTC
        options.maximumFractionDigits = 8; // Max for BTC
    } else if (currencyForFormatting === 'BRL' || currencyForFormatting === 'USD' || currencyForFormatting === 'EUR' || currencyForFormatting === 'GBP') {
        options.minimumFractionDigits = 2;
        options.maximumFractionDigits = 2;
    }


    try {
        return new Intl.NumberFormat(displayLocale, options).format(amountToFormat);
    } catch (error: any) {
        console.error(`Error formatting currency: Amount=${amountToFormat}, Currency=${currencyForFormatting}, Locale=${displayLocale}`, error);
        const symbol = getCurrencySymbol(currencyForFormatting);
        return `${symbol} ${amountToFormat.toFixed(options.minimumFractionDigits || 2)}`;
    }
}

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

