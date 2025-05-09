
'use client';

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TotalNetWorthCardProps {
  amount: number;
  currency: string;
}

const TotalNetWorthCard: FC<TotalNetWorthCardProps> = ({ amount, currency }) => {
  const formattedAmount = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: currency === '$' ? 'USD' : currency, // Assuming $ is USD
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('US$', '$'); // Remove USD prefix if present for $

  return (
    <Card className="bg-primary text-primary-foreground shadow-xl h-full flex flex-col justify-center p-4"> {/* p-6 to p-4 */}
      <CardHeader className="pb-1 pt-2"> {/* pb-2 to pb-1 */}
        <CardTitle className="text-base font-medium">Total Net Worth</CardTitle> {/* text-lg to text-base */}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-4xl font-bold">{formattedAmount}</div> {/* text-5xl to text-4xl */}
      </CardContent>
    </Card>
  );
};

export default TotalNetWorthCard;
