
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
      <CardHeader className="pb-2"> {/* Reduced pb from 4 to 2 */}
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle> {/* text-base to text-sm */}
      </CardHeader>
      <CardContent className="pt-2"> {/* Reduced pt from default p-6 (via CardContent default) or specific value to pt-2 */}
        <ul className="space-y-3"> {/* Reduced space-y from 4 to 3 */}
          {data.map((item) => {
            const formattedAmount = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: currency === '$' ? 'USD' : currency,
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(item.amount).replace('US$', '$');

            return (
              <li key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2"> {/* Reduced gap from 3 to 2 */}
                  <div className={`p-2 rounded-md ${item.bgColor}`}> {/* Reduced p from 2.5 to 2, rounded-lg to rounded-md */}
                    {item.icon}
                  </div>
                  <span className="text-xs font-medium">{item.name}</span> {/* text-sm to text-xs */}
                </div>
                <span className="text-xs font-semibold">{formattedAmount}</span> {/* text-sm to text-xs */}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
};

export default SpendingsBreakdown;
