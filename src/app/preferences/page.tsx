
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { UserPreferences } from '@/lib/preferences';
import { saveUserPreferences } from '@/lib/preferences';
import { supportedCurrencies, getCurrencySymbol } from '@/lib/currency';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/contexts/AuthContext';

export default function PreferencesPage() {
  const { user, isLoadingAuth, userPreferences, refreshUserPreferences } = useAuthContext();
  const [preferredCurrency, setPreferredCurrency] = useState(userPreferences?.preferredCurrency || 'BRL');
  const [selectedTheme, setSelectedTheme] = useState<UserPreferences['theme']>(userPreferences?.theme || 'system');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userPreferences) {
      setPreferredCurrency(userPreferences.preferredCurrency);
      setSelectedTheme(userPreferences.theme);
    }
  }, [userPreferences]);

  const handleCurrencyChange = (newCurrency: string) => {
    setPreferredCurrency(newCurrency);
  };

  const handleThemeChange = (newTheme: UserPreferences['theme']) => {
    setSelectedTheme(newTheme);
  };

  const handleSaveChanges = async () => {
    if (!user) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const newPreferencesToSave: UserPreferences = {
        preferredCurrency: preferredCurrency,
        theme: selectedTheme,
      };
      await saveUserPreferences(newPreferencesToSave);
      await refreshUserPreferences();
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
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingAuth || (!userPreferences && user)) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
        <Skeleton className="h-8 w-1/3 mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full md:w-1/2" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full md:w-1/2" />
            </div>
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 space-y-8">
      <h1 className="text-3xl font-bold">Preferences</h1>

      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
          <CardDescription>
            Choose how financial information and theme are displayed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!user && !isLoadingAuth ? (
             <p className="text-destructive">Please log in to manage your preferences.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="preferred-currency">Preferred Currency</Label>
                <Select
                  value={preferredCurrency}
                  onValueChange={handleCurrencyChange}
                  disabled={!user || isSaving}
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

              <div className="space-y-2">
                <Label htmlFor="theme-preference">Theme</Label>
                <Select
                  value={selectedTheme}
                  onValueChange={(value) => handleThemeChange(value as UserPreferences['theme'])}
                  disabled={!user || isSaving}
                >
                  <SelectTrigger id="theme-preference" className="w-full md:w-1/2">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System Default</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred application theme.
                </p>
              </div>
              <Button onClick={handleSaveChanges} disabled={!user || isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
