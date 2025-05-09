
'use client';

import type { FC, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SpendingItem {
  name: string;
  amount: number;
  icon: ReactNode;
  bgColor: string;
}

interface SpendingsBreakdownProps {
  title: string;
  data: SpendingItem[];
  currency: string;
}

const SpendingsBreakdown: FC<SpendingsBreakdownProps> = ({ title, data, currency }) => {
  return (
    <Card className="shadow-lg bg-card text-card-foreground h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {data.map((item) => {
            const formattedAmount = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: currency === '$' ? 'USD' : currency,
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(item.amount).replace('US$', '$');

            return (
              <li key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${item.bgColor}`}>
                    {item.icon}
                  </div>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <span className="text-sm font-semibold">{formattedAmount}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
};

export default SpendingsBreakdown;
