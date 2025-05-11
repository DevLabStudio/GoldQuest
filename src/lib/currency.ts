
'use client'; 

import type { UserPreferences } from './preferences';
import { supportedCurrencies as staticSupportedCurrencies, getCurrencySymbol as staticGetCurrencySymbol } from './static-currency-data';

// --- Static Exchange Rates (Relative to BRL for simplicity) ---
const exchangeRates: { [key: string]: number } = {
  BRL: 1,    // 1 BRL = 1 BRL (Base)
  USD: 5.00, 
  EUR: 5.40, 
  GBP: 6.20, 
  // Add more currencies as needed
};

export const supportedCurrencies = Object.keys(exchangeRates);

export function convertCurrency(amount: number, sourceCurrency: string, targetCurrency: string): number {
  const sourceUpper = sourceCurrency?.toUpperCase();
  const targetUpper = targetCurrency?.toUpperCase();

  if (!sourceUpper || !targetUpper) {
    return amount;
  }

  if (sourceUpper === targetUpper) {
      return amount; 
  }

  const sourceRate = exchangeRates[sourceUpper]; 
  const targetRate = exchangeRates[targetUpper]; 

  if (sourceRate === undefined || targetRate === undefined) { 
    console.warn(`Cannot convert currency: Invalid or unsupported source (${sourceCurrency}) or target (${targetCurrency}) currency.`);
    return amount; 
  }
  
  const amountInBase = amount * sourceRate;
  const convertedAmount = amountInBase / targetRate;

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
    convertToTargetCurrency: boolean = true,
    explicitLocale?: string
): string {
    let amountToFormat = amount;
    let currencyForFormatting: string;

    const effectiveSourceCurrency = sourceCurrencyOfAmount?.toUpperCase();
    const effectiveTargetCurrency = targetFormatOrConversionCurrency?.toUpperCase();

    if (!effectiveSourceCurrency) {
        // Fallback if source currency is somehow missing; format in target or BRL
        currencyForFormatting = effectiveTargetCurrency || 'BRL';
        console.warn(`formatCurrency: sourceCurrencyOfAmount was undefined. Formatting as ${currencyForFormatting}.`);
    } else if (convertToTargetCurrency && effectiveTargetCurrency && effectiveSourceCurrency !== effectiveTargetCurrency) {
        // Convert to target currency and format in target currency
        amountToFormat = convertCurrency(amount, effectiveSourceCurrency, effectiveTargetCurrency);
        currencyForFormatting = effectiveTargetCurrency;
    } else {
        // Not converting (or target is same as source, or no target provided for conversion step)
        // Format in the source currency
        amountToFormat = amount;
        currencyForFormatting = effectiveSourceCurrency;
    }

    const displayLocale = explicitLocale || getLocaleForCurrency(currencyForFormatting);

    try {
        return new Intl.NumberFormat(displayLocale, {
            style: 'currency',
            currency: currencyForFormatting,
        }).format(amountToFormat);
    } catch (error: any) {
        console.error(`Error formatting currency: Amount=${amountToFormat}, Currency=${currencyForFormatting}, Locale=${displayLocale}`, error);
        // Fallback for invalid currency codes passed to Intl.NumberFormat
        return `${currencyForFormatting} ${amountToFormat.toFixed(2)}`;
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
        default: return upperCaseCode; 
    }
}
