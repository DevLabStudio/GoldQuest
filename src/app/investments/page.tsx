
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import InvestmentPricePanel from "@/components/investments/investment-price-panel";
import { AreaChart, DollarSign, Euro, Bitcoin as BitcoinIcon } from "lucide-react";

const BRLIcon = () => (
  <span className="font-bold text-lg">R$</span>
);


export default function InvestmentsPage() {
  const priceData = [
    { name: "Real Brasileiro", code: "BRL", price: 1.00, change: "+0.05%", icon: <BRLIcon /> , against: "BRL" },
    { name: "Dólar Americano", code: "USD", price: 5.25, change: "-0.15%", icon: <DollarSign className="h-6 w-6" />, against: "BRL" },
    { name: "Euro", code: "EUR", price: 5.70, change: "+0.10%", icon: <Euro className="h-6 w-6" />, against: "BRL" },
    { name: "Bitcoin", code: "BTC", price: 350000.00, change: "+2.50%", icon: <BitcoinIcon className="h-6 w-6" />, against: "BRL" },
  ];


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Investments</h1>
        {/* Add button for new investment can go here */}
      </div>

      <InvestmentPricePanel prices={priceData} />

      <Card>
        <CardHeader>
          <CardTitle>My Portfolio</CardTitle>
          <CardDescription>
            Overview of your investment accounts and performance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <AreaChart className="mx-auto h-24 w-24 text-muted-foreground" strokeWidth={1.5}/>
            <p className="mt-4 text-muted-foreground">
              Investment portfolio tracking feature coming soon!
            </p>
            {/* Placeholder for future content like charts, tables, etc. */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
