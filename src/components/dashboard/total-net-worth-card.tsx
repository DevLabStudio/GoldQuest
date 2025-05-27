
'use client';

import type { FC } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Account } from '@/services/account-sync';
import { formatCurrency, convertCurrency, getCurrencySymbol } from '@/lib/currency';

interface TotalNetWorthCardProps {
  accounts: Account[];
  preferredCurrency: string;
}

const TotalNetWorthCard: FC<TotalNetWorthCardProps> = ({ accounts, preferredCurrency }) => {
  const router = useRouter();

  const includedAccounts = accounts.filter(acc => acc.includeInNetWorth !== false);

  const netWorth = includedAccounts.reduce((sum, account) => {
    if (account.balances && account.balances.length > 0) {
      account.balances.forEach(balanceEntry => {
        sum += convertCurrency(balanceEntry.amount, balanceEntry.currency, preferredCurrency);
      });
    }
    return sum;
  }, 0);

  const formattedNetWorth = formatCurrency(netWorth, preferredCurrency, preferredCurrency, false);

  const handleAccountItemClick = (accountId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    router.push(`/accounts/${accountId}`);
  };

  return (
    <Link href="/accounts" passHref legacyBehavior>
      <a className="block h-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg">
        <Card className="bg-primary text-primary-foreground shadow-xl h-full flex flex-col p-4 hover:bg-primary/90 transition-colors cursor-pointer">
          <CardHeader className="pb-1 pt-2">
            <CardTitle className="text-base font-medium">Total Net Worth</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 flex-grow flex flex-col">
            <div className="text-4xl font-bold mb-3">{formattedNetWorth}</div>
            {includedAccounts.length > 0 ? (
              <ScrollArea className="flex-grow h-32">
                <div className="space-y-1 pr-3">
                  {includedAccounts.map(account => {
                    const primaryBalanceEntry = account.balances && account.balances.length > 0
                      ? account.balances.find(b => b.currency === account.primaryCurrency) || account.balances[0]
                      : null;
                    const displayBalance = primaryBalanceEntry ? primaryBalanceEntry.amount : 0;
                    const displayCurrency = primaryBalanceEntry ? primaryBalanceEntry.currency : (account.primaryCurrency || 'N/A');

                    return (
                      <div
                        key={account.id}
                        className="text-xs flex justify-between items-center py-0.5 hover:bg-primary-foreground/10 rounded px-1 transition-colors cursor-pointer"
                        onClick={(e) => handleAccountItemClick(account.id, e)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleAccountItemClick(account.id, e);
                          }
                        }}
                        role="link"
                        tabIndex={0}
                      >
                        <span className="truncate max-w-[60%]">{account.name}</span>
                        <div className="text-right">
                          <span className="font-medium">
                            {formatCurrency(displayBalance, displayCurrency, displayCurrency, false)}
                          </span>
                          {displayCurrency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                            <span className="text-primary-foreground/70 ml-1">
                              (≈{formatCurrency(displayBalance, displayCurrency, preferredCurrency, true)})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-xs text-primary-foreground/80 mt-2">No accounts included in net worth calculation.</p>
            )}
          </CardContent>
        </Card>
      </a>
    </Link>
  );
};

export default TotalNetWorthCard;

    