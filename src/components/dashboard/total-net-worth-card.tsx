
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
    <Card className="bg-primary text-primary-foreground shadow-xl h-full flex flex-col justify-center p-6">
      <CardHeader className="pb-2 pt-2">
        <CardTitle className="text-lg font-medium">Total Net Worth</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-5xl font-bold">{formattedAmount}</div>
      </CardContent>
    </Card>
  );
};

export default TotalNetWorthCard;
