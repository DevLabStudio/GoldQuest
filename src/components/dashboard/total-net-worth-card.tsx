
'use client';

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Account } from '@/services/account-sync';
import { formatCurrency, convertCurrency, getCurrencySymbol } from '@/lib/currency';

interface TotalNetWorthCardProps {
  accounts: Account[];
  preferredCurrency: string;
}

const TotalNetWorthCard: FC<TotalNetWorthCardProps> = ({ accounts, preferredCurrency }) => {
  const includedAccounts = accounts.filter(acc => acc.includeInNetWorth !== false);

  const netWorth = includedAccounts.reduce((sum, account) => {
    return sum + convertCurrency(account.balance, account.currency, preferredCurrency);
  }, 0);

  const formattedNetWorth = formatCurrency(netWorth, preferredCurrency, preferredCurrency, false);


  return (
    <Card className="bg-primary text-primary-foreground shadow-xl h-full flex flex-col p-4">
      <CardHeader className="pb-1 pt-2">
        <CardTitle className="text-base font-medium">Total Net Worth</CardTitle>
        <CardDescription className="text-primary-foreground/80">Sum of all included accounts converted to {getCurrencySymbol(preferredCurrency)}.</CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex-grow flex flex-col">
        <div className="text-4xl font-bold mb-3">{formattedNetWorth}</div>
        {includedAccounts.length > 0 ? (
          <ScrollArea className="flex-grow h-32"> {/* Adjust height as needed */}
            <div className="space-y-1 pr-3">
              {includedAccounts.map(account => (
                <div key={account.id} className="text-xs flex justify-between items-center py-0.5">
                  <span className="truncate max-w-[60%]">{account.name}</span>
                  <div className="text-right">
                    <span className="font-medium">
                      {formatCurrency(account.balance, account.currency, account.currency, false)}
                    </span>
                    {account.currency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                      <span className="text-primary-foreground/70 ml-1">
                        (≈{formatCurrency(account.balance, account.currency, preferredCurrency, true)})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-xs text-primary-foreground/80 mt-2">No accounts included in net worth calculation.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default TotalNetWorthCard;
