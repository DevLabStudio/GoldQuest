
'use client';

import type { FC, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  tooltip: string;
  icon: ReactNode;
  valueClassName?: string;
  isPercentage?: boolean; // To handle formatting of percentages
}

const KpiCard: FC<KpiCardProps> = ({ title, value, tooltip, icon, valueClassName, isPercentage }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="shadow-lg hover:shadow-primary/20 transition-shadow duration-300 h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            {icon}
          </CardHeader>
          <CardContent className="p-4 pt-0"> {/* Reduced padding from p-6 to p-4 */}
            <div className={cn("text-2xl font-bold", valueClassName)}>
              {value}
            </div>
            {/* Optional: Add a small trend indicator or comparison here if needed */}
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default KpiCard;
