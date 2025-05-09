
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
  { name: "Housing", amount: 3452, icon: <Home className="h-5 w-5 text-white" />,bgColor: "bg-purple-500" }, // Icon size adjusted
  { name: "Personal", amount: 2200, icon: <Users className="h-5 w-5 text-white" />, bgColor: "bg-pink-500" }, // Icon size adjusted
  { name: "Transportation", amount: 2190, icon: <Car className="h-5 w-5 text-white" />, bgColor: "bg-orange-500" }, // Icon size adjusted
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
  { month: "Dec", income: 20239, expenses: 20239 }, 
];

const assetsData = [
  { name: "Gold", value: 15700, fill: "hsl(var(--chart-4))" }, 
  { name: "Stock", value: 22500, fill: "hsl(var(--chart-1))" }, 
  { name: "Warehouse", value: 120000, fill: "hsl(var(--chart-3))" }, 
  { name: "Land", value: 135000, fill: "hsl(var(--chart-2))" }, 
];


export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 space-y-6 min-h-screen">
      
      {/* First Row of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-2">
          <TotalNetWorthCard amount={278378} currency="$" />
        </div>
        <SmallStatCard title="Spendings" amount={9228} currency="$" chartType="negative" />
        <SpendingsBreakdown title="Spendings" data={spendingsBreakdownData} currency="$" />
      </div>

      {/* Second Row of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-2">
          <IncomeSourceChart data={incomeSourceData} currency="$" />
        </div>
        <SmallStatCard title="Income" amount={24050} currency="$" chartType="positive" />
        {/* The 4th column in this row is empty as per the visual structure of the image */}
      </div>

      {/* Third Row of Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <IncomeExpensesChart data={monthlyIncomeExpensesData} currency="$" />
        <AssetsChart data={assetsData} currency="$" />
      </div>
    </div>
  );
}
