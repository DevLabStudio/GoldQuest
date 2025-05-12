
'use client';

import type { FC, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';

interface PriceData {
  name: string;
  code: string; 
  price: number | null;
  change: string; 
  icon: ReactNode;
  against: string; 
  isLoading?: boolean;
}

interface InvestmentPricePanelProps {
  prices: PriceData[];
}

const InvestmentPricePanel: FC<InvestmentPricePanelProps> = ({ prices }) => {
  if (!prices || prices.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Market Prices</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => ( 
            <Card key={`skeleton-price-${i}`} className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-5 w-2/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-7 w-1/2 mb-1" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Market Prices</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {prices.map((item) => (
          <Card key={`${item.code}-${item.against}`} className="shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.name} ({item.code}/{item.against})
              </CardTitle>
              <div className="text-primary">
                {item.icon}
              </div>
            </CardHeader>
            <CardContent>
              {item.isLoading ? (
                <div className="flex flex-col items-start justify-center h-[44px]">
                  <Skeleton className="h-7 w-24 mb-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ) : item.price === null && item.change === "Error" ? (
                <div className="flex flex-col items-start justify-center h-[44px]">
                    <div className="text-xl font-bold text-destructive/80">Error</div>
                    <p className="text-xs text-destructive/70 truncate" title="Could not load price.">Could not load.</p>
                </div>
              ) : item.price === null ? (
                <div className="flex flex-col items-start justify-center h-[44px]">
                    <div className="text-xl font-bold text-muted-foreground">N/A</div>
                    <p className="text-xs text-muted-foreground">Price unavailable.</p>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(item.price, item.code, item.against, false)} 
                  </div>
                  <p
                    className={cn(
                      "text-xs text-muted-foreground flex items-center",
                      item.change === "Loading..." ? "text-blue-500 dark:text-blue-400" :
                      item.change === "Error" ? "text-destructive dark:text-destructive/80" :
                      item.change === "N/A" ? "text-muted-foreground" :
                      item.change.startsWith('+') ? 'text-green-500 dark:text-green-400' : 
                      item.change.startsWith('-') ? 'text-red-500 dark:text-red-400' : ''
                    )}
                  >
                    {item.change === "Loading..." || item.change === "Error" || item.change === "N/A" ? null : 
                     (item.change.startsWith('+') ? <TrendingUp className="h-4 w-4 mr-1" /> : 
                      item.change.startsWith('-') ? <TrendingDown className="h-4 w-4 mr-1" /> : null)}
                    {item.change}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default InvestmentPricePanel;

