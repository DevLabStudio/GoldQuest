
'use client';

import { database, auth } from '@/lib/firebase';
import { ref, set, get } from 'firebase/database';
import type { User } from 'firebase/auth';
import { supportedCurrencies } from './currency';

export interface UserPreferences {
  preferredCurrency: string;
  theme?: 'light' | 'dark' | 'system'; // Added theme preference
}

const defaultPreferences: UserPreferences = {
  preferredCurrency: 'BRL',
  theme: 'system', // Default theme
};

function getPreferencesRefPath(currentUser: User | null) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access preferences.");
  return `users/${currentUser.uid}/preferences`;
}

export async function getUserPreferences(): Promise<UserPreferences> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("getUserPreferences called without authenticated user, returning default client-side.");
    return defaultPreferences;
  }
  const preferencesRefPath = getPreferencesRefPath(currentUser);
  const preferencesRef = ref(database, preferencesRefPath);

  try {
    const snapshot = await get(preferencesRef);
    if (snapshot.exists()) {
      const prefs = snapshot.val() as Partial<UserPreferences>;
      return {
        preferredCurrency: supportedCurrencies.includes(prefs.preferredCurrency?.toUpperCase() ?? '')
          ? prefs.preferredCurrency!.toUpperCase()
          : defaultPreferences.preferredCurrency,
        theme: prefs.theme && ['light', 'dark', 'system'].includes(prefs.theme)
          ? prefs.theme
          : defaultPreferences.theme,
      };
    }
    // If no prefs in DB, save and return defaults
    await set(preferencesRef, defaultPreferences);
    return defaultPreferences;
  } catch (error) {
    console.error("Failed to retrieve user preferences from Firebase:", error);
    return defaultPreferences; // Fallback to defaults on error
  }
}

export async function saveUserPreferences(preferences: UserPreferences): Promise<void> {
  const currentUser = auth.currentUser;
  const preferencesRefPath = getPreferencesRefPath(currentUser);
  const preferencesRef = ref(database, preferencesRefPath);

  const prefsToSave: UserPreferences = {
    preferredCurrency: supportedCurrencies.includes(preferences.preferredCurrency.toUpperCase())
        ? preferences.preferredCurrency.toUpperCase()
        : defaultPreferences.preferredCurrency,
    theme: preferences.theme && ['light', 'dark', 'system'].includes(preferences.theme)
        ? preferences.theme
        : defaultPreferences.theme,
  };

  try {
    await set(preferencesRef, prefsToSave);
  } catch (error) {
    console.error("Failed to save user preferences to Firebase:", error);
    throw error;
  }
}

export async function updateUserPreferences(updates: Partial<UserPreferences>): Promise<void> {
  const currentPrefs = await getUserPreferences();
  const newPrefs = { ...currentPrefs, ...updates };
  await saveUserPreferences(newPrefs);
}
