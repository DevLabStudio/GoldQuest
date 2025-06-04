
'use client';

import type { FC } from 'react';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { Transaction } from '@/services/transactions';
import type { Account } from '@/services/account-sync';
import type { Category } from '@/services/categories';
import { getCategoryStyle } from '@/services/categories';
import { formatCurrency, convertCurrency } from '@/lib/currency';
import { format as formatDateFns, parseISO } from 'date-fns';
import { ArrowRight, LayoutList } from 'lucide-react';

interface RecentTransactionsCardProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  preferredCurrency: string;
  isLoading: boolean;
}

const RecentTransactionsCard: FC<RecentTransactionsCardProps> = ({ 
    transactions, accounts, categories, preferredCurrency, isLoading 
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'revenue' | 'expenses'>('all');

  const filteredTransactions = useMemo(() => {
    if (activeTab === 'all') return transactions;
    if (activeTab === 'revenue') return transactions.filter(tx => tx.amount > 0);
    if (activeTab === 'expenses') return transactions.filter(tx => tx.amount < 0);
    return [];
  }, [transactions, activeTab]);

  const TransactionItem: FC<{ transaction: Transaction }> = ({ transaction }) => {
    const account = accounts.find(acc => acc.id === transaction.accountId);
    const categoryDetails = categories.find(c => c.name === transaction.category);
    const { icon: CategoryIcon } = getCategoryStyle(categoryDetails);

    return (
      <div className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-muted rounded-md">
            <CategoryIcon />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground truncate max-w-[120px] sm:max-w-[180px]" title={transaction.description}>
              {transaction.description}
            </p>
            <p className="text-xs text-muted-foreground">{account?.name || 'N/A'} - {transaction.category}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-xs font-semibold ${transaction.amount >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
            {formatCurrency(transaction.amount, transaction.transactionCurrency, transaction.transactionCurrency, false)}
          </p>
          <p className="text-xs text-muted-foreground">{formatDateFns(parseISO(transaction.date), 'dd MMM, yyyy')}</p>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2 mt-0.5" />
        </CardHeader>
        <CardContent className="space-y-3 pt-2 pb-3 px-4">
          <Skeleton className="h-9 w-full mb-3" /> 
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div>
                  <Skeleton className="h-3 w-28 mb-0.5" />
                  <Skeleton className="h-2 w-20" />
                </div>
              </div>
              <div className="text-right">
                <Skeleton className="h-3 w-16 mb-0.5" />
                <Skeleton className="h-2 w-12" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <div>
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <CardDescription className="text-xs">Your latest financial activities.</CardDescription>
        </div>
        <Link href="/transactions" passHref>
            <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80 h-auto px-1.5 py-0.5">
                View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-2 pb-3 px-4">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-3 h-9">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="revenue" className="text-xs">Revenue</TabsTrigger>
            <TabsTrigger value="expenses" className="text-xs">Expenses</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className={filteredTransactions.length === 0 ? "min-h-[100px] flex flex-col items-center justify-center" : ""}>
            {filteredTransactions.length > 0 ? (
              <ScrollArea className="h-[240px] pr-2"> {/* Height maintained when transactions exist */}
                {filteredTransactions.map(tx => <TransactionItem key={tx.id} transaction={tx} />)}
              </ScrollArea>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm"> {/* Reduced padding for empty state */}
                <LayoutList className="mx-auto h-8 w-8 text-muted-foreground/50 mb-1" />
                No {activeTab !== 'all' ? activeTab : ''} transactions to display.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default RecentTransactionsCard;
