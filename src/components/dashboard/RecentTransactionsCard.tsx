
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
import { ArrowRight } from 'lucide-react';

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
      <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-md">
            <CategoryIcon />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground truncate max-w-[150px] sm:max-w-[200px]" title={transaction.description}>
              {transaction.description}
            </p>
            <p className="text-xs text-muted-foreground">{account?.name || 'N/A'} - {transaction.category}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-sm font-semibold ${transaction.amount >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
            {formatCurrency(transaction.amount, transaction.transactionCurrency, transaction.transactionCurrency, false)}
          </p>
          <p className="text-xs text-muted-foreground">{formatDateFns(parseISO(transaction.date), 'dd MMM, yyyy')}</p>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div>
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="text-right">
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your latest financial activities.</CardDescription>
        </div>
        <Link href="/transactions" passHref>
            <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80">
                View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab}>
            {filteredTransactions.length > 0 ? (
              <ScrollArea className="h-[280px] pr-3"> {/* Adjust height as needed */}
                {filteredTransactions.map(tx => <TransactionItem key={tx.id} transaction={tx} />)}
              </ScrollArea>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
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
