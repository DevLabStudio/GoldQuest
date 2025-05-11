
'use client';

import type { FC, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { formatCurrency as formatCurrencyUtil } from '@/lib/currency'; // Renamed to avoid conflict

interface KpiCardProps {
  title: string;
  value: string | number; // Can be a pre-formatted string or a number
  tooltip: string;
  icon: ReactNode;
  valueClassName?: string;
  isPercentage?: boolean; 
  currency?: string; // Optional: currency code for formatting if value is a number
  href?: string; // For navigation link
}

const KpiCard: FC<KpiCardProps> = ({ title, value, tooltip, icon, valueClassName, isPercentage, currency, href }) => {
  let displayValue = value;
  if (typeof value === 'number' && !isPercentage && currency) {
    displayValue = formatCurrencyUtil(value, currency, currency, false); // Format in the given currency, don't convert
  } else if (typeof value === 'number' && isPercentage) {
    displayValue = `${value.toFixed(1)}%`;
  }

  const cardContent = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="shadow-lg hover:shadow-primary/20 transition-shadow duration-300 h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            {icon}
          </CardHeader>
          <CardContent className="p-4 pt-0"> 
            <div className={cn("text-2xl font-bold", valueClassName)}>
              {displayValue}
            </div>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
  
  if (href) {
      return <a href={href} className="block h-full">{cardContent}</a>;
  }

  return cardContent;
};

export default KpiCard;

