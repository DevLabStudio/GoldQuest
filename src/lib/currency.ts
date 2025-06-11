
'use client'; 

import type { UserPreferences } from './preferences';
import { supportedCurrencies as staticSupportedCurrencies, getCurrencySymbol as staticGetCurrencySymbol } from './static-currency-data';

// --- Static Exchange Rates (Relative to BRL for simplicity) ---
// These rates are for demonstration and fallback.
// For real-time rates, integrate a dedicated currency API (see comments below).
// Current rates based on recent discussion (approximate):
// 1 USD = 5.40 BRL
// 1 EUR = 5.80 BRL
// To maintain BRL as the base for these static rates:
// 1 BRL = 1 BRL
// 1 USD = 5.40 BRL
// 1 EUR = 5.80 BRL
// 1 GBP = (e.g., if 1 GBP = 1.18 EUR, then 1.18 * 5.80 BRL) approx 6.84 BRL
// 1 BTC = (e.g., if 1 BTC = 60000 EUR, then 60000 * 5.80 BRL) approx 348,000 BRL (This is fetched dynamically on Investments page)

const staticExchangeRates: { [key: string]: number } = {
  BRL: 1,
  USD: 5.40, // Updated based on discussion
  EUR: 5.80, // Updated based on discussion
  GBP: 6.84, // Example derived rate, adjust as needed
  BTC: 348000.00, // Static fallback, actual BTC price is fetched dynamically
};

export const supportedCurrencies = Object.keys(staticExchangeRates);

/**
 * To implement dynamic real-time fiat currency rates:
 * 1. Choose an API provider (e.g., ExchangeRate-API.com, Open Exchange Rates).
 * 2. Obtain an API key from the provider.
 * 3. Store the API key securely as an environment variable (e.g., NEXT_PUBLIC_EXCHANGE_RATE_API_KEY).
 * 4. Create a function here to fetch rates:
 *    async function fetchDynamicRates() {
 *      const apiKey = process.env.NEXT_PUBLIC_EXCHANGE_RATE_API_KEY;
 *      if (!apiKey) { console.warn("Dynamic rate API key not set."); return null; }
 *      try {
 *        const response = await fetch(`YOUR_API_ENDPOINT_HERE?apikey=${apiKey}`);
 *        const data = await response.json();
 *        // Process data.rates and store them, perhaps in a global state or cache.
 *        // Ensure the rates are structured similarly to staticExchangeRates (e.g., relative to BRL or USD).
 *      } catch (error) { console.error("Failed to fetch dynamic rates:", error); return null; }
 *    }
 * 5. Modify `convertCurrency` to use dynamic rates if available, falling back to static.
 *    This might involve making `convertCurrency` an async function, which would
 *    require updating all call sites to use `await`.
 */

export function convertCurrency(amount: number, sourceCurrency: string, targetCurrency: string): number {
  const sourceUpper = sourceCurrency?.toUpperCase();
  const targetUpper = targetCurrency?.toUpperCase();

  if (!sourceUpper || !targetUpper || typeof amount !== 'number') {
    return amount || 0;
  }
  if (sourceUpper === targetUpper) {
    return amount;
  }

  // Using static rates for now
  const ratesToUse = staticExchangeRates;
  const baseCurrencyForRates = 'BRL'; // Static rates are BRL-based

  let amountInBase: number;

  if (sourceUpper === baseCurrencyForRates) {
    amountInBase = amount;
  } else {
    const sourceRate = ratesToUse[sourceUpper];
    if (sourceRate === undefined) {
      console.warn(`Unsupported source currency (${sourceUpper}) in static rate set.`);
      return amount; // Cannot convert
    }
    // Static rates are defined as (X units of BRL for 1 unit of Foreign Currency)
    // So, to convert Foreign Currency to BRL (base), we multiply.
    amountInBase = amount * sourceRate;
  }

  // Convert amount in base (BRL) to target currency
  if (targetUpper === baseCurrencyForRates) {
    return amountInBase;
  } else {
    const targetRate = ratesToUse[targetUpper];
    if (targetRate === undefined) {
      console.warn(`Unsupported target currency (${targetUpper}) in static rate set.`);
      return amount; // Cannot convert
    }
    // To convert BRL (base) to Foreign Currency, we divide by (BRL units for 1 Foreign unit).
    return amountInBase / targetRate;
  }
}


function getLocaleForCurrency(currencyCode: string | undefined | null): string {
    if (!currencyCode) {
      return 'en-US'; 
    }
    switch (currencyCode.toUpperCase()) {
        case 'BRL': return 'pt-BR';
        case 'USD': return 'en-US';
        case 'EUR': return 'en-IE'; // Changed from de-DE to en-IE for Euro symbol before number
        case 'GBP': return 'en-GB';
        case 'BTC': return 'en-US';
        default: return 'en-US'; 
    }
}

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
    let effectiveTargetCurrency = targetFormatOrConversionCurrency?.toUpperCase();

    if (!effectiveTargetCurrency && convertToTargetCurrency) {
        // If target is not specified but conversion is requested, assume target is same as source (no conversion)
        // OR, if we had a global preferred currency, we could use that. For now, format in source.
        effectiveTargetCurrency = effectiveSourceCurrency;
    }


    if (!effectiveSourceCurrency) {
        currencyForFormatting = effectiveTargetCurrency || 'BRL'; // Fallback
        console.warn(`formatCurrency: sourceCurrencyOfAmount was undefined. Formatting as ${currencyForFormatting}.`);
    } else if (convertToTargetCurrency && effectiveTargetCurrency && effectiveSourceCurrency !== effectiveTargetCurrency) {
        amountToFormat = convertCurrency(amount, effectiveSourceCurrency, effectiveTargetCurrency);
        currencyForFormatting = effectiveTargetCurrency;
    } else { // convertToTargetCurrency is false OR source and target are same OR target is undefined (and convert=false)
        amountToFormat = amount;
        currencyForFormatting = effectiveSourceCurrency; // Use source currency for formatting
    }
    
    // Ensure currencyForFormatting is always defined before calling getLocaleForCurrency
    if (!currencyForFormatting) {
        console.warn("formatCurrency: currencyForFormatting ended up undefined. Defaulting to BRL for locale.");
        currencyForFormatting = 'BRL';
    }


    const displayLocale = explicitLocale || getLocaleForCurrency(currencyForFormatting);
    
    let options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currencyForFormatting,
    };

    // Specific fraction digits for certain currencies
    if (currencyForFormatting === 'BTC') {
        options.minimumFractionDigits = 2; 
        options.maximumFractionDigits = 8; 
    } else if (['BRL', 'USD', 'EUR', 'GBP'].includes(currencyForFormatting)) {
        options.minimumFractionDigits = 2;
        options.maximumFractionDigits = 2;
    }
    // For other currencies, Intl.NumberFormat will use its default fraction digits for that currency.

    try {
        return new Intl.NumberFormat(displayLocale, options).format(amountToFormat);
    } catch (error: any) {
        console.error(`Error formatting currency: Amount=${amountToFormat}, Currency=${currencyForFormatting}, Locale=${displayLocale}`, error);
        // Fallback formatting if Intl.NumberFormat fails (e.g., invalid locale/currency combo though unlikely with checks)
        const symbol = getCurrencySymbol(currencyForFormatting);
        return `${symbol} ${amountToFormat.toFixed(options.minimumFractionDigits || 2)}`;
    }
}

export function getCurrencySymbol(currencyCode: string | undefined | null): string {
    if (!currencyCode || typeof currencyCode !== 'string' || currencyCode.trim() === "") {
        return '¤'; // Generic currency sign
    }
    const upperCaseCode = currencyCode.toUpperCase();
    switch (upperCaseCode) {
        case 'BRL': return 'R$';
        case 'USD': return '$';
        case 'EUR': return '€';
        case 'GBP': return '£';
        case 'BTC': return '₿'; // Bitcoin symbol
        // Add more common symbols if needed
        default: return upperCaseCode; // Fallback to the code itself if symbol is unknown
    }
}

    
