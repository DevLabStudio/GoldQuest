
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface KpiCardProps {
  title: string;
  value: string | number;
  tooltip?: string;
  isPercentage?: boolean;
  valueClassName?: string;
}

const KpiCard: FC<KpiCardProps> = ({ title, value, tooltip, isPercentage = false, valueClassName }) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground opacity-70 hover:opacity-100">
                <Info className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <div className={`text-2xl font-bold ${isPercentage ? 'text-green-600 dark:text-green-500' : 'text-foreground'} ${valueClassName}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
};

export default KpiCard;
