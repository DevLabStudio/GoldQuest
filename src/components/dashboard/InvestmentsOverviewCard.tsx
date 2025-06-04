
'use client';

import type { FC } from 'react';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { formatCurrency, convertCurrency } from '@/lib/currency';
import { TrendingUp, ArrowRight, Landmark, Bitcoin as BitcoinIcon, MoreHorizontal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Account } from '@/services/account-sync';
import Link from 'next/link';

interface InvestmentsOverviewCardProps {
  accounts: Account[];
  preferredCurrency: string;
  isLoading: boolean;
}

interface InvestmentItem {
  name: string;
  value: number;
  percentage: number;
  icon: React.ReactNode;
  color: string; // Tailwind color class for the square icon
  href: string;
}

const InvestmentsOverviewCard: FC<InvestmentsOverviewCardProps> = ({ accounts, preferredCurrency, isLoading }) => {

  const traditionalAssetsValue = useMemo(() => {
    return accounts
      .filter(acc => acc.category === 'asset' && acc.includeInNetWorth !== false && acc.balances && acc.primaryCurrency)
      .reduce((sum, acc) => {
        const primaryBalance = acc.balances.find(b => b.currency === acc.primaryCurrency);
        if (primaryBalance && primaryBalance.amount > 0) {
          sum += convertCurrency(primaryBalance.amount, acc.primaryCurrency!, preferredCurrency);
        }
        return sum;
      }, 0);
  }, [accounts, preferredCurrency]);

  const cryptoAssetsValue = useMemo(() => {
    return accounts
      .filter(acc => acc.category === 'crypto' && acc.includeInNetWorth !== false && acc.balances && acc.primaryCurrency)
      .reduce((sum, acc) => {
        const primaryBalance = acc.balances.find(b => b.currency === acc.primaryCurrency);
        if (primaryBalance && primaryBalance.amount > 0) {
          sum += convertCurrency(primaryBalance.amount, acc.primaryCurrency!, preferredCurrency);
        }
        return sum;
      }, 0);
  }, [accounts, preferredCurrency]);

  const totalInvestmentsValue = traditionalAssetsValue + cryptoAssetsValue;

  const investmentItems: InvestmentItem[] = useMemo(() => {
    const items: InvestmentItem[] = [];
    if (traditionalAssetsValue > 0) {
      items.push({
        name: 'Traditional',
        value: traditionalAssetsValue,
        percentage: totalInvestmentsValue > 0 ? (traditionalAssetsValue / totalInvestmentsValue) * 100 : 0,
        icon: <Landmark className="h-5 w-5" />,
        color: 'bg-sky-400', // Example color
        href: '/investments/traditional'
      });
    }
    if (cryptoAssetsValue > 0) {
      items.push({
        name: 'Crypto',
        value: cryptoAssetsValue,
        percentage: totalInvestmentsValue > 0 ? (cryptoAssetsValue / totalInvestmentsValue) * 100 : 0,
        icon: <BitcoinIcon className="h-5 w-5" />,
        color: 'bg-amber-400', // Example color
        href: '/investments/defi'
      });
    }
    return items;
  }, [traditionalAssetsValue, cryptoAssetsValue, totalInvestmentsValue]);

  const progressSegments = useMemo(() => {
    if (totalInvestmentsValue === 0) return [];
    return investmentItems.map(item => ({
      name: item.name,
      value: item.percentage,
      color: item.color,
    }));
  }, [investmentItems, totalInvestmentsValue]);


  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </CardHeader>
        <CardContent className="px-4 py-3 space-y-3">
          <Skeleton className="h-10 w-1/3" />
          <div className="flex flex-col space-y-1.5">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-3 w-3/4 rounded-full" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Investments Overview</CardTitle>
        </div>
         <Link href="/investments" passHref>
            <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80 h-auto px-1.5 py-0.5">
                Manage <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
        </Link>
      </CardHeader>
      <CardContent className="px-4 py-3 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">
            {formatCurrency(totalInvestmentsValue, preferredCurrency, preferredCurrency, false)}
          </span>
          {/* Placeholder for trend, can be removed or made dynamic later */}
          {/* <div className={`flex items-center text-xs font-medium text-green-500`}>
            <TrendingUp className="h-3.5 w-3.5" />
            10.2%
          </div> */}
        </div>

        {progressSegments.length > 0 ? (
            <div className="space-y-1.5">
            {progressSegments.map((item) => (
                <div key={item.name} className="flex items-center text-xs">
                <span className="w-20 shrink-0 text-muted-foreground">{item.name}</span>
                <div className="flex-grow h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.value}%` }} />
                </div>
                <span className="ml-2 w-10 text-right font-medium">{item.value.toFixed(0)}%</span>
                </div>
            ))}
            </div>
        ) : (
            <p className="text-sm text-muted-foreground text-center py-2">No investment assets to display.</p>
        )}


        {investmentItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {investmentItems.map((item) => (
                 <Link key={item.name} href={item.href} className="block">
                    <div className="bg-muted/40 p-3 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
                            <span className="text-xs font-medium text-foreground">{item.name}</span>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="text-lg font-semibold text-foreground">
                            {formatCurrency(item.value, preferredCurrency, preferredCurrency, false)}
                        </div>
                        {/* Placeholder for trend */}
                        {/* <div className={`text-xs flex items-center text-green-500`}>
                            <TrendingUp className="h-3 w-3 mr-0.5" />
                            {Math.floor(Math.random() * 15) + 1}% 
                        </div> */}
                    </div>
                </Link>
            ))}
            </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default InvestmentsOverviewCard;
