
'use client';

import { useState, useEffect, useCallback } from 'react';

const AUTH_KEY = 'isLoggedInGoldenGame'; // Use a unique key

export function useAuth() {
  // Initialize state from localStorage only on the client
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem(AUTH_KEY) === 'true';
      }
      return false; // Default to false on server
  });

  // Effect to update state if localStorage changes in another tab/window
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === AUTH_KEY) {
        setIsAuthenticated(event.newValue === 'true');
      }
    };

    if (typeof window !== 'undefined') {
        // Set initial state again in useEffect to ensure client-side consistency
        setIsAuthenticated(localStorage.getItem(AUTH_KEY) === 'true');
        window.addEventListener('storage', handleStorageChange);
    }

    return () => {
       if (typeof window !== 'undefined') {
            window.removeEventListener('storage', handleStorageChange);
       }
    };
  }, []);

  const login = useCallback((username?: string, password?: string) => {
    // **INSECURE**: In a real app, verify username/password against a backend/service.
    // For this demo, we just set the flag.
    console.log("Simulating successful login for:", username);
    if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_KEY, 'true');
        setIsAuthenticated(true);
         // Dispatch a storage event to notify other components/tabs immediately
        window.dispatchEvent(new StorageEvent('storage', { key: AUTH_KEY, newValue: 'true' }));
    } else {
        console.warn("Login attempt on server?");
    }
  }, []);

  const logout = useCallback(() => {
    console.log("Logging out");
     if (typeof window !== 'undefined') {
        localStorage.removeItem(AUTH_KEY);
        setIsAuthenticated(false);
        // Dispatch a storage event to notify other components/tabs immediately
        window.dispatchEvent(new StorageEvent('storage', { key: AUTH_KEY, newValue: null }));
         // Optional: force reload or redirect to login after logout
         // window.location.href = '/login'; // Hard reload
     } else {
         console.warn("Logout attempt on server?");
     }
  }, []);

  return { isAuthenticated, login, logout };
}
