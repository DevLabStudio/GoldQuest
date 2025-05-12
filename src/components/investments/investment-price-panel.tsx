'use client';

import type { FC, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from '@/lib/currency';

interface PriceData {
  name: string;
  code: string; // The code of the asset being priced (e.g., USD, EUR, BTC)
  price: number; // The value of 1 unit of 'code' in terms of 'against' currency
  change: string; // e.g., "+0.05%" or "-0.15%"
  icon: ReactNode;
  against: string; // The currency this price is expressed in (user's preferredCurrency)
}

interface InvestmentPricePanelProps {
  prices: PriceData[];
}

const InvestmentPricePanel: FC<InvestmentPricePanelProps> = ({ prices }) => {
  if (!prices || prices.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-4">Market Prices</h2>
        <p className="text-muted-foreground">Price data is currently unavailable.</p>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Market Prices</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <div className="text-2xl font-bold">
                {/* Format item.price using item.against as the currency for formatting, don't convert */}
                {formatCurrency(item.price, item.against, item.against, false)} 
              </div>
              <p
                className={cn(
                  "text-xs text-muted-foreground flex items-center",
                  item.change.startsWith('+') ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                )}
              >
                {item.change.startsWith('+') ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {item.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default InvestmentPricePanel;
