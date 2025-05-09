
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import TotalNetWorthCard from "@/components/dashboard/total-net-worth-card";
import SmallStatCard from "@/components/dashboard/small-stat-card";
import IncomeSourceChart from "@/components/dashboard/income-source-chart";
import SpendingsBreakdown from "@/components/dashboard/spendings-breakdown";
import IncomeExpensesChart from "@/components/dashboard/income-expenses-chart";
import AssetsChart from "@/components/dashboard/assets-chart";
import { DollarSign, TrendingUp, TrendingDown, Home, Users, Car } from "lucide-react";

const incomeSourceData = [
  { source: "E-commerce", amount: 2100, fill: "hsl(var(--chart-1))" },
  { source: "Google Adsense", amount: 950, fill: "hsl(var(--chart-3))" },
  { source: "My Shop", amount: 8000, fill: "hsl(var(--chart-5))" },
  { source: "Salary", amount: 13000, fill: "hsl(var(--chart-2))" },
];

const spendingsBreakdownData = [
  { name: "Housing", amount: 3452, icon: <Home className="h-6 w-6 text-white" />,bgColor: "bg-purple-500" },
  { name: "Personal", amount: 2200, icon: <Users className="h-6 w-6 text-white" />, bgColor: "bg-pink-500" },
  { name: "Transportation", amount: 2190, icon: <Car className="h-6 w-6 text-white" />, bgColor: "bg-orange-500" },
];

const monthlyIncomeExpensesData = [
  { month: "Jan", income: 12000, expenses: 8000 },
  { month: "Feb", income: 15000, expenses: 9500 },
  { month: "Mar", income: 18000, expenses: 12000 },
  { month: "Apr", income: 14000, expenses: 15000 },
  { month: "May", income: 22000, expenses: 10000 },
  { month: "Jun", income: 25000, expenses: 11000 },
  { month: "Jul", income: 23000, expenses: 13000 },
  { month: "Aug", income: 20000, expenses: 12500 },
  { month: "Sep", income: 19000, expenses: 10000 },
  { month: "Oct", income: 21000, expenses: 9000 },
  { month: "Nov", income: 24000, expenses: 11500 },
  { month: "Dec", income: 20239, expenses: 20239 }, // Max values from image
];

const assetsData = [
  { name: "Gold", value: 15700, fill: "hsl(var(--chart-4))" }, // Reddish-pink
  { name: "Stock", value: 22500, fill: "hsl(var(--chart-1))" }, // Blue
  { name: "Warehouse", value: 120000, fill: "hsl(var(--chart-3))" }, // Purple
  { name: "Land", value: 135000, fill: "hsl(var(--chart-2))" }, // Teal/Green
];


export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 space-y-6 min-h-screen">
      {/* Header can be added here if needed, e.g., "Dashboard" title */}
      {/* <h1 className="text-3xl font-bold text-foreground mb-6">Dashboard</h1> */}
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Row 1 */}
        <div className="xl:col-span-2">
          <TotalNetWorthCard amount={278378} currency="$" />
        </div>
        <SmallStatCard title="Spendings" amount={9228} currency="$" chartType="negative" />
        <SpendingsBreakdown title="Spendings" data={spendingsBreakdownData} currency="$" />

        {/* Row 2 */}
        <div className="xl:col-span-2">
          <IncomeSourceChart data={incomeSourceData} currency="$" />
        </div>
        <SmallStatCard title="Income" amount={24050} currency="$" chartType="positive" />
        {/* The image implies assets chart spans to this area or the small income card is shorter. 
            For a simpler grid, I'll place assets on the next row taking more space.
            If Assets chart needs to be here, the parent grid needs to be more complex (e.g. grid-template-areas)
            or this row needs specific col-span adjustments for children.
            For now, let's assume Assets chart is on its own or with Income & Expenses.
        */}
         <div className="xl:col-span-2"> {/* Placeholder for assets if it were here, or could be empty or another small card */}
          {/* If assets chart were to span to the right of income source, it would be here */}
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
         {/* Row 3 */}
        <IncomeExpensesChart data={monthlyIncomeExpensesData} currency="$" />
        <AssetsChart data={assetsData} currency="$" />
      </div>
    </div>
  );
}
