'use client';

import { database, auth } from '@/lib/firebase';
import { ref, set, get } from 'firebase/database';
import type { User } from 'firebase/auth';
import { supportedCurrencies } from './currency';

export interface UserPreferences {
  preferredCurrency: string;
}

const defaultPreferences: UserPreferences = {
  preferredCurrency: 'BRL',
};

function getPreferencesRefPath(currentUser: User | null) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access preferences.");
  return `users/${currentUser.uid}/preferences`;
}

export async function getUserPreferences(): Promise<UserPreferences> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    // For client components that might call this before auth is fully resolved,
    // return default or handle appropriately.
    // For server components, this function shouldn't be called without user context.
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
    ...preferences,
    preferredCurrency: supportedCurrencies.includes(preferences.preferredCurrency.toUpperCase())
        ? preferences.preferredCurrency.toUpperCase()
        : defaultPreferences.preferredCurrency,
  };

  try {
    await set(preferencesRef, prefsToSave);
  } catch (error) {
    console.error("Failed to save user preferences to Firebase:", error);
    throw error;
  }
}

export async function updateUserPreferences(updates: Partial<UserPreferences>): Promise<void> {
  const currentPrefs = await getUserPreferences(); // This now fetches from Firebase
  const newPrefs = { ...currentPrefs, ...updates };
  await saveUserPreferences(newPrefs); // This now saves to Firebase
}