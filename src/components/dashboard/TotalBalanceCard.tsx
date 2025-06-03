
'use client';

import type { FC } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Account } from '@/services/account-sync';
import { formatCurrency, convertCurrency } from '@/lib/currency';
import { ArrowRight, TrendingUp, CreditCard, Landmark, Bitcoin } from 'lucide-react';
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

  // For the "Account Type" display, let's pick the first account or a primary one if logic exists.
  // This is a simplification of the carousel in the image.
  const displayAccount = includedAccounts.length > 0 ? includedAccounts[0] : null;
  
  const displayAccountPrimaryBalance = displayAccount
    ? (displayAccount.balances.find(b => b.currency === displayAccount.primaryCurrency) || displayAccount.balances[0])
    : null;

  if (isLoading) {
    return (
      <Card className="bg-primary text-primary-foreground shadow-xl p-6 h-48 flex flex-col justify-between">
        <Skeleton className="h-6 w-1/3 bg-primary-foreground/20" />
        <Skeleton className="h-10 w-1/2 bg-primary-foreground/20" />
        <Skeleton className="h-12 w-full bg-primary-foreground/20" />
      </Card>
    );
  }

  return (
    <Card className="bg-primary text-primary-foreground shadow-xl p-6 h-48 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start">
          <CardTitle className="text-base font-medium">Total Balance</CardTitle>
          <Link href="/accounts" passHref>
            <Button variant="ghost" size="sm" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 h-auto px-2 py-1 text-xs">
              All Accounts <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="text-4xl font-bold mt-1">{formattedNetWorth}</div>
      </div>
      
      {displayAccount && displayAccountPrimaryBalance ? (
        <div 
          className="bg-primary-foreground/10 p-3 rounded-lg flex items-center justify-between hover:bg-primary-foreground/20 transition-colors cursor-pointer"
          onClick={() => router.push(`/accounts/${displayAccount.id}`)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') router.push(`/accounts/${displayAccount.id}`)}}
        >
          <div className="flex items-center gap-3">
            <AccountTypeIcon type={displayAccount.type} category={displayAccount.category} />
            <div>
              <p className="text-xs text-primary-foreground/90">{displayAccount.type.charAt(0).toUpperCase() + displayAccount.type.slice(1)}</p>
              <p className="text-sm font-semibold text-primary-foreground">{displayAccount.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-primary-foreground">
                {formatCurrency(displayAccountPrimaryBalance.amount, displayAccountPrimaryBalance.currency, displayAccountPrimaryBalance.currency, false)}
            </p>
            {displayAccountPrimaryBalance.currency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                <p className="text-xs text-primary-foreground/70">
                    (≈ {formatCurrency(displayAccountPrimaryBalance.amount, displayAccountPrimaryBalance.currency, preferredCurrency, true)})
                </p>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-primary-foreground/70 mt-2">No accounts to display summary for.</div>
      )}
    </Card>
  );
};

export default TotalBalanceCard;
