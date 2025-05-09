'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getUserPreferences, saveUserPreferences, type UserPreferences } from '@/lib/preferences';
import { supportedCurrencies, getCurrencySymbol } from '@/lib/currency';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    if (typeof window !== 'undefined') {
      try {
        const loadedPrefs = getUserPreferences();
        if (isMounted) setPreferences(loadedPrefs);
      } catch (error) {
        console.error("Failed to load preferences:", error);
        if (isMounted) toast({
          title: "Error",
          description: "Could not load your preferences.",
          variant: "destructive",
        });
        if (isMounted) setPreferences({ preferredCurrency: 'BRL' });
      } finally {
          if (isMounted) setIsLoading(false);
      }
    } else {
        if (isMounted) setIsLoading(false); 
    }
    return () => {
        isMounted = false;
    }
  }, []); // Corrected dependency array

  const handleCurrencyChange = (newCurrency: string) => {
    if (preferences) {
      setPreferences({ ...preferences, preferredCurrency: newCurrency });
    }
  };

  const handleSaveChanges = () => {
    if (preferences) {
      try {
        saveUserPreferences(preferences);
        toast({
          title: "Preferences Saved",
          description: "Your preferences have been updated successfully.",
        });
          window.dispatchEvent(new Event('storage')); 
      } catch (error) {
        console.error("Failed to save preferences:", error);
        toast({
          title: "Error",
          description: "Could not save your preferences.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Preferences</h1>

      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
          <CardDescription>
            Choose how financial information is displayed throughout the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
             <div className="space-y-4">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full md:w-1/2" />
                </div>
                <Skeleton className="h-10 w-32" />
             </div>
          ) : preferences ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="preferred-currency">Preferred Currency</Label>
                <Select
                  value={preferences.preferredCurrency}
                  onValueChange={handleCurrencyChange}
                >
                  <SelectTrigger id="preferred-currency" className="w-full md:w-1/2">
                    <SelectValue placeholder="Select your preferred currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedCurrencies.map((curr) => (
                      <SelectItem key={curr} value={curr}>
                        {curr} ({getCurrencySymbol(curr)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Balances and totals will be converted and displayed in this currency.
                </p>
              </div>


              <Button onClick={handleSaveChanges}>Save Changes</Button>
            </>
          ) : (
              <p className="text-destructive">Could not load preferences.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

