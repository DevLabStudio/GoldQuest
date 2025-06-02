
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { recalculateAllAccountBalances } from '@/services/account-sync'; // Import the new service
import { AlertCircle } from 'lucide-react';

export default function PreferencesPage() {
  const { user, isLoadingAuth, userPreferences, refreshUserPreferences } = useAuthContext();
  const [preferredCurrency, setPreferredCurrency] = useState(userPreferences?.preferredCurrency || 'BRL');
  const [selectedInvestmentsCurrency, setSelectedInvestmentsCurrency] = useState(userPreferences?.investmentsPreferredCurrency || 'USD');
  const [selectedTheme, setSelectedTheme] = useState<UserPreferences['theme']>(userPreferences?.theme || 'system');
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userPreferences) {
      setPreferredCurrency(userPreferences.preferredCurrency);
      setSelectedInvestmentsCurrency(userPreferences.investmentsPreferredCurrency || 'USD');
      setSelectedTheme(userPreferences.theme || 'system');
    }
  }, [userPreferences]);

  const handleCurrencyChange = (newCurrency: string) => {
    setPreferredCurrency(newCurrency);
  };

  const handleInvestmentsCurrencyChange = (newCurrency: string) => {
    setSelectedInvestmentsCurrency(newCurrency);
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
        investmentsPreferredCurrency: selectedInvestmentsCurrency,
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

  const handleRecalculateBalances = async () => {
    if (!user) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    setIsRecalculating(true);
    try {
      await recalculateAllAccountBalances();
      toast({
        title: "Balances Recalculated",
        description: "All account balances have been successfully updated from transaction history.",
      });
      window.dispatchEvent(new Event('storage')); // Trigger UI updates across the app
    } catch (error: any) {
      console.error("Failed to recalculate balances:", error);
      toast({
        title: "Recalculation Error",
        description: error.message || "Could not recalculate account balances.",
        variant: "destructive",
      });
    } finally {
      setIsRecalculating(false);
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
                <Label htmlFor="preferred-currency">Main Preferred Currency</Label>
                <Select
                  value={preferredCurrency}
                  onValueChange={handleCurrencyChange}
                  disabled={!user || isSaving || isRecalculating}
                >
                  <SelectTrigger id="preferred-currency" className="w-full md:w-1/2">
                    <SelectValue placeholder="Select your main preferred currency" />
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
                  General balances and totals will be converted and displayed in this currency.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="investments-preferred-currency">Investments Preferred Currency</Label>
                <Select
                  value={selectedInvestmentsCurrency}
                  onValueChange={handleInvestmentsCurrencyChange}
                  disabled={!user || isSaving || isRecalculating}
                >
                  <SelectTrigger id="investments-preferred-currency" className="w-full md:w-1/2">
                    <SelectValue placeholder="Select currency for investments" />
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
                  Investment values (like crypto prices) will be displayed in this currency.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme-preference">Theme</Label>
                <Select
                  value={selectedTheme}
                  onValueChange={(value) => handleThemeChange(value as UserPreferences['theme'])}
                  disabled={!user || isSaving || isRecalculating}
                >
                  <SelectTrigger id="theme-preference" className="w-full md:w-1/2">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="goldquest">GoldQuest</SelectItem>
                    <SelectItem value="system">System Default</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred application theme.
                </p>
              </div>
              <Button onClick={handleSaveChanges} disabled={!user || isSaving || isRecalculating}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle>Data Integrity</CardTitle>
            <CardDescription>
              Tools to help ensure your financial data is accurate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex flex-col space-y-2 items-start">
                <Label className="font-semibold">Recalculate Account Balances</Label>
                <p className="text-sm text-muted-foreground">
                    If you suspect any discrepancies in your account balances, this action will recalculate them based on your complete transaction history. This can take a few moments.
                </p>
             </div>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={isRecalculating || isSaving}>
                        {isRecalculating ? "Recalculating..." : "Recalculate All Balances"}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will re-evaluate every transaction for every account to correct balances.
                        This process cannot be undone, but it aims to fix any inconsistencies.
                        It might take some time depending on your data.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel disabled={isRecalculating}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRecalculateBalances} disabled={isRecalculating}>
                        {isRecalculating ? "Processing..." : "Yes, Recalculate Balances"}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
