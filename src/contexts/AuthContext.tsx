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
  GoogleAuthProvider, // Import GoogleAuthProvider type
} from 'firebase/auth';
import { auth as firebaseAuthInstance, googleAuthProvider as firebaseGoogleAuthProviderInstance, firebaseInitialized, firebaseInitializationError, firebaseApp } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isFirebaseActive: boolean;
  firebaseError: string | null;
  signUp: (email: string, pass: string) => Promise<User | null>;
  signIn: (email: string, pass: string) => Promise<User | null>;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // If Firebase isn't initialized (due to config error), or auth instance is missing.
    if (!firebaseInitialized || !firebaseAuthInstance) {
      setIsLoadingAuth(false);
      setUser(null);
      console.warn(`AuthContext: Firebase not properly initialized. ${firebaseInitializationError || "Authentication features may be disabled."}`);
      return () => {}; // No listener to unsubscribe from
    }

    // Firebase is initialized, set up the auth state listener
    const unsubscribe = onAuthStateChanged(firebaseAuthInstance, (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoadingAuth(false);
      if (firebaseUser) {
        // console.log('AuthContext: User signed in:', firebaseUser.uid);
      } else {
        // console.log('AuthContext: User signed out');
      }
    });
    return () => unsubscribe();
  }, [router, firebaseInitialized, firebaseInitializationError]); // Dependencies


  const ensureFirebaseAuth = useCallback((): Auth => {
    if (!firebaseInitialized || !firebaseAuthInstance) {
      throw new Error(firebaseInitializationError || "Firebase authentication service is not available. Please check configuration.");
    }
    return firebaseAuthInstance;
  }, [firebaseInitialized, firebaseAuthInstance, firebaseInitializationError]);

  const ensureGoogleAuthProvider = useCallback((): GoogleAuthProvider => {
    if (!firebaseInitialized || !firebaseGoogleAuthProviderInstance) {
        throw new Error(firebaseInitializationError || "Firebase Google Auth Provider is not available. Please check configuration.");
    }
    return firebaseGoogleAuthProviderInstance;
  },[firebaseInitialized, firebaseGoogleAuthProviderInstance, firebaseInitializationError]);


  const signUp = useCallback(async (email: string, pass: string): Promise<User | null> => {
    const currentAuth = ensureFirebaseAuth();
    try {
      const userCredential = await createUserWithEmailAndPassword(currentAuth, email, pass);
      return userCredential.user;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  }, [ensureFirebaseAuth]);

  const signIn = useCallback(async (email: string, pass: string): Promise<User | null> => {
    const currentAuth = ensureFirebaseAuth();
    try {
      const userCredential = await signInWithEmailAndPassword(currentAuth, email, pass);
      return userCredential.user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }, [ensureFirebaseAuth]);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    const currentAuth = ensureFirebaseAuth();
    const provider = ensureGoogleAuthProvider();
    try {
      const result = await signInWithPopup(currentAuth, provider);
      return result.user;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  }, [ensureFirebaseAuth, ensureGoogleAuthProvider]);

  const signOut = useCallback(async () => {
    const currentAuth = ensureFirebaseAuth();
    try {
      await firebaseSignOut(currentAuth);
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
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
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
