
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
    // Load preferences client-side
    if (typeof window !== 'undefined') {
      try {
        const loadedPrefs = getUserPreferences();
        setPreferences(loadedPrefs);
      } catch (error) {
        console.error("Failed to load preferences:", error);
        toast({
          title: "Error",
          description: "Could not load your preferences.",
          variant: "destructive",
        });
        // Set default preferences on error to allow UI interaction
        setPreferences({ preferredCurrency: 'BRL' });
      } finally {
          setIsLoading(false);
      }
    } else {
        setIsLoading(false); // Stop loading if on server
    }
  }, [toast]);

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
         // Optional: Trigger a custom event or slightly delay then reload if absolutely necessary
         // for other components relying heavily on localStorage without listeners.
         // window.dispatchEvent(new Event('preferencesUpdated'));
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

              {/* Add more preference options here later */}

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
