
'use client';

import type { ReactNode, FC } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  Auth,
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth as firebaseAuthInstance, googleAuthProvider as firebaseGoogleAuthProviderInstance, firebaseInitialized, firebaseInitializationError } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import type { UserPreferences } from '@/lib/preferences';
import { getUserPreferences, saveUserPreferences } from '@/lib/preferences';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isFirebaseActive: boolean;
  firebaseError: string | null;
  theme: UserPreferences['theme'];
  setAppTheme: (newTheme: UserPreferences['theme']) => Promise<void>;
  signUp: (email: string, pass: string) => Promise<User | null>;
  signIn: (email: string, pass: string) => Promise<User | null>;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  userPreferences: UserPreferences | null;
  refreshUserPreferences: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [currentTheme, setCurrentTheme] = useState<UserPreferences['theme']>('system'); // Renamed from setThemeState to avoid confusion
  const router = useRouter();

  const fetchUserPreferences = useCallback(async (firebaseUser: User | null) => {
    if (firebaseInitialized && firebaseUser) {
      try {
        const prefs = await getUserPreferences();
        setUserPreferences(prefs);
        setCurrentTheme(prefs.theme || 'system');
      } catch (error) {
        console.error("AuthProvider: Failed to fetch user preferences:", error);
        const defaultPrefs = { preferredCurrency: 'BRL', investmentsPreferredCurrency: 'USD', theme: 'system' } as UserPreferences;
        setUserPreferences(defaultPrefs);
        setCurrentTheme(defaultPrefs.theme);
      }
    } else {
        const defaultPrefs = { preferredCurrency: 'BRL', investmentsPreferredCurrency: 'USD', theme: 'system' } as UserPreferences;
        setUserPreferences(defaultPrefs);
        setCurrentTheme(defaultPrefs.theme);
    }
  }, []); // Removed firebaseAuthInstance from dependencies as it's stable or handled by firebaseInitialized

  useEffect(() => {
    if (!firebaseInitialized || !firebaseAuthInstance) {
      setIsLoadingAuth(false);
      setUser(null);
      fetchUserPreferences(null); // Fetch default/localStorage preferences
      console.warn(`AuthContext: Firebase not properly initialized. ${firebaseInitializationError || "Authentication features may be disabled."}`);
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(firebaseAuthInstance, async (firebaseUser) => {
      setUser(firebaseUser);
      await fetchUserPreferences(firebaseUser); // Pass firebaseUser to fetchUserPreferences
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [firebaseInitialized, firebaseInitializationError, fetchUserPreferences]); // fetchUserPreferences is stable due to useCallback

  const ensureFirebaseAuth = useCallback((): Auth => {
    if (!firebaseInitialized || !firebaseAuthInstance) {
      throw new Error(firebaseInitializationError || "Firebase authentication service is not available. Please check configuration.");
    }
    return firebaseAuthInstance;
  }, [firebaseInitializationError]); // Added firebaseInitializationError

  const ensureGoogleAuthProvider = useCallback((): GoogleAuthProvider => {
    if (!firebaseInitialized || !firebaseGoogleAuthProviderInstance) {
        throw new Error(firebaseInitializationError || "Firebase Google Auth Provider is not available. Please check configuration.");
    }
    return firebaseGoogleAuthProviderInstance;
  },[firebaseInitializationError]); // Added firebaseInitializationError

  const setAppTheme = async (newTheme: UserPreferences['theme']) => {
    const currentPrefs = userPreferences || { preferredCurrency: 'BRL', investmentsPreferredCurrency: 'USD', theme: 'system' };
    const updatedPrefs: UserPreferences = { ...currentPrefs, theme: newTheme };
    try {
      await saveUserPreferences(updatedPrefs);
      setUserPreferences(updatedPrefs);
      setCurrentTheme(newTheme);
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error("AuthProvider: Failed to save theme preference:", error);
    }
  };
  
  const refreshUserPreferences = async () => {
    await fetchUserPreferences(user); // Pass current user to refresh
  };


  const signUp = useCallback(async (email: string, pass: string): Promise<User | null> => {
    const currentAuth = ensureFirebaseAuth();
    try {
      const userCredential = await createUserWithEmailAndPassword(currentAuth, email, pass);
      await fetchUserPreferences(userCredential.user); // Fetch prefs for new user
      return userCredential.user;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  }, [ensureFirebaseAuth, fetchUserPreferences]);

  const signIn = useCallback(async (email: string, pass: string): Promise<User | null> => {
    const currentAuth = ensureFirebaseAuth();
    try {
      const userCredential = await signInWithEmailAndPassword(currentAuth, email, pass);
      await fetchUserPreferences(userCredential.user); // Fetch prefs on sign in
      return userCredential.user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }, [ensureFirebaseAuth, fetchUserPreferences]);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    const currentAuth = ensureFirebaseAuth();
    const provider = ensureGoogleAuthProvider();
    try {
      const result = await signInWithPopup(currentAuth, provider);
      await fetchUserPreferences(result.user); // Fetch prefs on Google sign in
      return result.user;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  }, [ensureFirebaseAuth, ensureGoogleAuthProvider, fetchUserPreferences]);

  const signOut = useCallback(async () => {
    const currentAuth = ensureFirebaseAuth();
    try {
      await firebaseSignOut(currentAuth);
      // Preferences are reset by onAuthStateChanged -> fetchUserPreferences(null)
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }, [router, ensureFirebaseAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && firebaseInitialized,
        isLoadingAuth,
        isFirebaseActive: firebaseInitialized,
        firebaseError: firebaseInitializationError,
        theme: currentTheme || 'system', // Use currentTheme state here
        setAppTheme,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        userPreferences,
        refreshUserPreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
