
'use client';

import type { FC, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency as formatCurrencyUtil, getCurrencySymbol } from '@/lib/currency';

interface SpendingItem {
  name: string;
  amount: number;
  icon: ReactNode;
  bgColor: string;
}

interface SpendingsBreakdownProps {
  title: string;
  data: SpendingItem[];
  currency: string; // Expecting ISO currency code like "USD", "EUR", "BRL"
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
            let formattedAmount;
            try {
                // Format amount with the explicit currency symbol
                formattedAmount = formatCurrencyUtil(item.amount, currency, currency, false);

            } catch (error) {
                console.error("Error formatting currency in SpendingsBreakdown:", error);
                formattedAmount = `${getCurrencySymbol(currency)} ${item.amount.toFixed(0)}`; // Fallback with symbol
            }


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

