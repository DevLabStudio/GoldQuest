
'use client';

import { useState, useEffect, useCallback } from 'react';

const AUTH_KEY = 'isLoggedInGoldenGame'; // Use a unique key
const USER_KEY = 'loggedInUserGoldenGame'; // Key for storing username

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false); // Start with a default server-compatible state
  const [user, setUser] = useState<string | null>(null); // Start with a default server-compatible state
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // Add a loading state

  useEffect(() => {
    // This effect runs only on the client
    const loggedIn = localStorage.getItem(AUTH_KEY) === 'true';
    const storedUser = localStorage.getItem(USER_KEY);
    setIsAuthenticated(loggedIn);
    setUser(storedUser);
    setIsLoadingAuth(false); // Auth status loaded

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === AUTH_KEY) {
        setIsAuthenticated(event.newValue === 'true');
      }
      if (event.key === USER_KEY) {
        setUser(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []); // Empty dependency array, runs once on mount client-side


  const login = useCallback((username?: string, password?: string) => {
    // **INSECURE**: In a real app, verify username/password against a backend/service.
    // For this demo, we just set the flag.
    const effectiveUsername = username || "User"; // Default username if not provided
    console.log("Simulating successful login for:", effectiveUsername);

    if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_KEY, 'true');
        localStorage.setItem(USER_KEY, effectiveUsername); // Store username
        setIsAuthenticated(true);
        setUser(effectiveUsername); // Update state
         // Dispatch a storage event to notify other components/tabs immediately
        window.dispatchEvent(new StorageEvent('storage', { key: AUTH_KEY, newValue: 'true' }));
        window.dispatchEvent(new StorageEvent('storage', { key: USER_KEY, newValue: effectiveUsername }));
    } else {
        console.warn("Login attempt on server?");
    }
  }, []);

  const logout = useCallback(() => {
    console.log("Logging out");
     if (typeof window !== 'undefined') {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(USER_KEY); // Remove username
        setIsAuthenticated(false);
        setUser(null); // Clear user state
        // Dispatch a storage event to notify other components/tabs immediately
        window.dispatchEvent(new StorageEvent('storage', { key: AUTH_KEY, newValue: null }));
        window.dispatchEvent(new StorageEvent('storage', { key: USER_KEY, newValue: null }));
         // Optional: force reload or redirect to login after logout
         // window.location.href = '/login'; // Hard reload
     } else {
         console.warn("Logout attempt on server?");
     }
  }, []);

  return { isAuthenticated, user, login, logout, isLoadingAuth }; // Return isLoadingAuth
}

