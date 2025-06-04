
'use client';

import type { FC } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Account } from '@/services/account-sync';
import { formatCurrency, convertCurrency } from '@/lib/currency';
import { ArrowRight, CreditCard, Landmark, Bitcoin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface TotalBalanceCardProps {
  accounts: Account[];
  preferredCurrency: string;
  isLoading: boolean;
}

const AccountTypeIcon = ({ type, category }: { type: string, category: string }) => {
    if (category === 'crypto') return <Bitcoin className="h-5 w-5 text-primary-foreground/80" />;
    switch (type.toLowerCase()) {
        case 'credit card': return <CreditCard className="h-5 w-5 text-primary-foreground/80" />;
        case 'checking':
        case 'savings':
        default: return <Landmark className="h-5 w-5 text-primary-foreground/80" />;
    }
};

const TotalBalanceCard: FC<TotalBalanceCardProps> = ({ accounts, preferredCurrency, isLoading }) => {
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

  if (isLoading) {
    return (
      <Card className="bg-primary text-primary-foreground shadow-xl p-4 flex flex-col justify-between min-h-[10rem]"> {/* Use min-h instead of fixed h */}
        <div>
          <Skeleton className="h-5 w-1/3 bg-primary-foreground/20" />
          <Skeleton className="h-8 w-1/2 bg-primary-foreground/20 mt-2" />
        </div>
        <Skeleton className="h-10 w-full bg-primary-foreground/20 mt-4" />
      </Card>
    );
  }

  return (
    <Card className="bg-primary text-primary-foreground shadow-xl p-4 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-0.5">
          <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
          <Link href="/accounts" passHref>
            <Button variant="ghost" size="sm" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 h-auto px-1.5 py-0.5 text-xs">
              All Accounts <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="text-3xl font-bold">{formattedNetWorth}</div>
      </div>
      
      {includedAccounts.length > 0 ? (
        <ScrollArea className="mt-3 max-h-[calc(10rem-2rem-3rem)]"> {/* Approx available height for scroll */}
          <div className="space-y-1.5 pr-2">
            {includedAccounts.map(account => {
              const primaryBalanceEntry = account.balances.find(b => b.currency === account.primaryCurrency) || account.balances[0];
              if (!primaryBalanceEntry) return null; // Should not happen if accounts are well-formed

              return (
                <div 
                  key={account.id}
                  className="bg-primary-foreground/10 p-1.5 rounded-md flex items-center justify-between hover:bg-primary-foreground/20 transition-colors cursor-pointer"
                  onClick={() => router.push(`/accounts/${account.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') router.push(`/accounts/${account.id}`)}}
                >
                  <div className="flex items-center gap-1.5">
                    <AccountTypeIcon type={account.type} category={account.category} />
                    <div>
                      <p className="text-xs text-primary-foreground/90 truncate max-w-[100px] sm:max-w-[120px]" title={account.name}>{account.name}</p>
                      <p className="text-[0.65rem] text-primary-foreground/70">{account.type.charAt(0).toUpperCase() + account.type.slice(1)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary-foreground">
                        {formatCurrency(primaryBalanceEntry.amount, primaryBalanceEntry.currency, primaryBalanceEntry.currency, false)}
                    </p>
                    {primaryBalanceEntry.currency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                        <p className="text-[0.65rem] text-primary-foreground/70">
                            (≈ {formatCurrency(primaryBalanceEntry.amount, primaryBalanceEntry.currency, preferredCurrency, true)})
                        </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      ) : (
        <div className="text-xs text-primary-foreground/70 mt-3">No accounts to display.</div>
      )}
    </Card>
  );
};

export default TotalBalanceCard;
