'use client';

import type { FC } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// ScrollArea import removed
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

  if (isLoading && includedAccounts.length === 0) { // Show main card skeleton only if no accounts yet during loading
    return (
      <Card className="bg-primary text-primary-foreground shadow-xl p-4">
        <div>
          <Skeleton className="h-5 w-1/3 bg-primary-foreground/20" />
          <Skeleton className="h-8 w-1/2 bg-primary-foreground/20 mt-2 mb-3" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
            {[...Array(4)].map((_, i) => (
                <Skeleton key={`acc-skel-${i}`} className="h-20 w-full bg-primary-foreground/20 rounded-md" />
            ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-primary text-primary-foreground shadow-xl p-4">
      {/* Top section: Title, Total Balance, All Accounts link */}
      <div className="flex justify-between items-start mb-1">
        <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
        <Link href="/accounts" passHref>
          <Button variant="ghost" size="sm" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 h-auto px-1.5 py-0.5 text-xs">
            All Accounts <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
      <div className="text-3xl font-bold mb-3">{formattedNetWorth}</div>

      {/* Grid for account cards */}
      {isLoading && includedAccounts.length > 0 ? ( // Show skeletons for account cards if accounts are already partially loaded
         <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
            {includedAccounts.map((_,i) => ( // Use includedAccounts length if available for more accurate skeleton count
                <Skeleton key={`acc-skel-loading-${i}`} className="h-20 w-full bg-primary-foreground/20 rounded-md" />
            ))}
         </div>
      ) : includedAccounts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
          {includedAccounts.map(account => {
            const primaryBalanceEntry = account.balances.find(b => b.currency === account.primaryCurrency) || account.balances[0];
            if (!primaryBalanceEntry) return null;

            return (
              <div
                key={account.id}
                className="bg-primary-foreground/10 p-2.5 rounded-lg flex flex-col cursor-pointer hover:bg-primary-foreground/20 transition-colors justify-between min-h-[5rem]" // Added min-height and p-2.5, justify-between
                onClick={() => router.push(`/accounts/${account.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') router.push(`/accounts/${account.id}`)}}
              >
                <div className="flex items-start gap-1.5"> {/* Changed to items-start */}
                  <AccountTypeIcon type={account.type} category={account.category} />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-primary-foreground/90 truncate max-w-[calc(100%-1.25rem)]" title={account.name}>{account.name}</span>
                    <span className="text-[0.65rem] text-primary-foreground/70 leading-tight">{account.type.charAt(0).toUpperCase() + account.type.slice(1)}</span>
                  </div>
                </div>
                <div className="text-right w-full mt-1"> {/* Added mt-1 */}
                  <p className="text-sm font-semibold text-primary-foreground">
                    {formatCurrency(primaryBalanceEntry.amount, primaryBalanceEntry.currency, primaryBalanceEntry.currency, false)}
                  </p>
                  {/* Optional: Converted balance (consider removing if too cluttered) */}
                  {/* {primaryBalanceEntry.currency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                    <p className="text-[0.6rem] text-primary-foreground/60">
                      (≈ {formatCurrency(primaryBalanceEntry.amount, primaryBalanceEntry.currency, preferredCurrency, true)})
                    </p>
                  )} */}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-primary-foreground/70 mt-2">No accounts to display. Add accounts to see them here.</div>
      )}
    </Card>
  );
};

export default TotalBalanceCard;
