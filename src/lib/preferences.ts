'use client'; // This module interacts with localStorage, so it must be client-side

import { supportedCurrencies } from './currency';

export interface UserPreferences {
  preferredCurrency: string;
  // Add other preferences here later, e.g., theme, date format
}

const PREFERENCES_STORAGE_KEY = 'userPreferences';

// Default preferences
const defaultPreferences: UserPreferences = {
  preferredCurrency: 'BRL', // Default to Brazilian Real
};

/**
 * Retrieves user preferences from localStorage.
 * Returns default preferences if none are found or if stored data is invalid.
 *
 * @returns The user's preferences object.
 */
export function getUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') {
    // Return default if on server-side (shouldn't happen with 'use client')
    return defaultPreferences;
  }
  try {
    const storedPrefs = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (storedPrefs) {
      const parsedPrefs = JSON.parse(storedPrefs) as Partial<UserPreferences>;
      // Validate and merge with defaults
      return {
        preferredCurrency: supportedCurrencies.includes(parsedPrefs.preferredCurrency?.toUpperCase() ?? '')
          ? parsedPrefs.preferredCurrency!.toUpperCase()
          : defaultPreferences.preferredCurrency,
        // Merge other potential future preferences here
      };
    }
  } catch (error) {
    console.error("Failed to retrieve or parse user preferences:", error);
  }
  // Return default preferences if not found or on error
  return defaultPreferences;
}

/**
 * Saves user preferences to localStorage.
 *
 * @param preferences The preferences object to save.
 */
export function saveUserPreferences(preferences: UserPreferences): void {
   if (typeof window === 'undefined') {
    console.warn("Cannot save preferences on the server.");
    return;
  }
  try {
     // Ensure currency code is uppercase and valid before saving
    const prefsToSave: UserPreferences = {
        ...preferences,
        preferredCurrency: supportedCurrencies.includes(preferences.preferredCurrency.toUpperCase())
            ? preferences.preferredCurrency.toUpperCase()
            : defaultPreferences.preferredCurrency,
    };
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefsToSave));
  } catch (error) {
    console.error("Failed to save user preferences:", error);
  }
}

/**
 * Updates specific user preferences in localStorage.
 * Merges the provided updates with existing preferences.
 *
 * @param updates Partial preferences object with the fields to update.
 */
export function updateUserPreferences(updates: Partial<UserPreferences>): void {
  const currentPrefs = getUserPreferences();
  const newPrefs = { ...currentPrefs, ...updates };
  saveUserPreferences(newPrefs);
}
