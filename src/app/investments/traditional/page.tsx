
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart } from "lucide-react";

export default function TraditionalInvestmentsPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Traditional Finances</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Traditional Assets Overview</CardTitle>
          <CardDescription>
            Track your stocks, bonds, real estate, and other traditional investments here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-20">
            <AreaChart className="mx-auto h-24 w-24 text-muted-foreground" strokeWidth={1.5}/>
            <p className="mt-4 text-xl font-semibold text-foreground">
              Traditional Investment Tracking Coming Soon!
            </p>
            <p className="text-muted-foreground">
              This section will allow you to manage and analyze your traditional finance portfolio.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
