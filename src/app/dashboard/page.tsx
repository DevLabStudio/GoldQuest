
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Landmark, Scale, PiggyBank } from "lucide-react"; // Updated icons
import KpiCard from "@/components/dashboard/kpi-card";
// PaymentDistributionChart and related data will be removed or replaced
// import PaymentDistributionChart from "@/components/dashboard/payment-distribution-chart";
import { getUserPreferences } from '@/lib/preferences';
import { formatCurrency } from '@/lib/currency';
import { TooltipProvider } from '@/components/ui/tooltip'; // TooltipProvider was already there

export default function DashboardPage() {
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For refresh button

  // TODO: Fetch actual account and transaction data to calculate these KPIs
  const [accounts, setAccounts] = useState<any[]>([]); // Placeholder for actual account data
  const [transactions, setTransactions] = useState<any[]>([]); // Placeholder for actual transaction data

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const prefs = getUserPreferences();
      setPreferredCurrency(prefs.preferredCurrency);
      setLastUpdated(new Date()); // Set initial last updated time
      // Simulate fetching data or use actual data fetching logic here
      // fetchDashboardData();
    }
  }, []);

  // const fetchDashboardData = async () => {
  //   setIsLoading(true);
  //   // const fetchedAccounts = await getAccounts(); // Your service to get accounts
  //   // const fetchedTransactions = await getAllTransactions(); // Your service for transactions
  //   // setAccounts(fetchedAccounts);
  //   // setTransactions(fetchedTransactions);
  //   // setLastUpdated(new Date());
  //   setIsLoading(false);
  // };

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate data refresh
    setTimeout(() => {
      // fetchDashboardData(); // Call your data fetching function
      setLastUpdated(new Date()); // For now, just update the timestamp
      setIsLoading(false);
    }, 1000);
  };

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return "Atualizando..."; // "Updating..."
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    if (diffSeconds < 60) return `Atualizado há ${diffSeconds} segundos`; // "Updated X seconds ago"
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes === 1) return "Atualizado há 1 minuto"; // "Updated 1 minute ago"
    return `Atualizado há ${diffMinutes} minutos`; // "Updated X minutes ago"
  };

  // Placeholder data for Personal Finance KPIs - In a real app, calculate this from fetched data
  const personalKpiData = {
    totalNetWorth: 125000.75,
    totalAssets: 150000.50,
    totalLiabilities: 24999.75,
    monthlyIncome: 7500.00,
    monthlyExpenses: -4850.25, // Expenses are typically negative
    savingsRate: 0.3533, // (7500 - 4850.25) / 7500 = 2649.75 / 7500 = 0.3533 => 35.3%
    // Add more relevant KPIs like:
    // upcomingBills: 350.00,
    // investmentPortfolioValue: 50000.00,
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
        </div>

        {/* Resumo Card with Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <CardTitle className="text-xl">Resumo Financeiro</CardTitle> {/* Financial Summary */}
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <span className="text-xs text-muted-foreground">{formatLastUpdated(lastUpdated)}</span>
                <Button variant="default" size="sm" onClick={handleRefresh} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar {/* Refresh */}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"> {/* Adjusted grid for fewer filters */}
            <div>
              <label htmlFor="date-range" className="text-xs font-medium text-muted-foreground">Período</label> {/* Period */}
              <Select defaultValue="thisMonth">
                <SelectTrigger id="date-range">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thisMonth">Este Mês</SelectItem>
                  <SelectItem value="lastMonth">Mês Passado</SelectItem>
                  <SelectItem value="last3months">Últimos 3 Meses</SelectItem>
                  <SelectItem value="thisYear">Este Ano</SelectItem>
                  <SelectItem value="allTime">Desde o Início</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="account-filter" className="text-xs font-medium text-muted-foreground">Conta</label> {/* Account */}
              <Select defaultValue="all">
                <SelectTrigger id="account-filter">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Contas</SelectItem>
                  {/* TODO: Populate with actual accounts from state */}
                  {/* {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)} */}
                   <SelectItem value="placeholder-1">Conta Placeholder 1</SelectItem>
                   <SelectItem value="placeholder-2">Conta Placeholder 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
             {/* Removed Platform and Product filters as they are not relevant for personal finance */}
            <div>
              <label htmlFor="category-filter" className="text-xs font-medium text-muted-foreground">Categoria</label> {/* Category */}
              <Select defaultValue="all">
                <SelectTrigger id="category-filter">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                   {/* TODO: Populate with actual categories */}
                   <SelectItem value="cat-placeholder-1">Categoria Placeholder 1</SelectItem>
                   <SelectItem value="cat-placeholder-2">Categoria Placeholder 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPI Grid - Updated for Personal Finance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"> {/* Adjusted to 3 columns for key overview KPIs */}
          <KpiCard
            title="Patrimônio Líquido" // Net Worth
            value={formatCurrency(personalKpiData.totalNetWorth, preferredCurrency, undefined, true)}
            tooltip="Seu patrimônio total (Ativos - Passivos)."
            icon={<Wallet className="text-primary" />} // Added icon
          />
          <KpiCard
            title="Receitas do Mês" // Monthly Income
            value={formatCurrency(personalKpiData.monthlyIncome, preferredCurrency, undefined, true)}
            tooltip="Total de receitas recebidas neste mês."
            icon={<TrendingUp className="text-green-500" />} // Added icon
            valueClassName="text-green-600 dark:text-green-500"
          />
          <KpiCard
            title="Despesas do Mês" // Monthly Expenses
            value={formatCurrency(personalKpiData.monthlyExpenses, preferredCurrency, undefined, true)}
            tooltip="Total de despesas realizadas neste mês."
            icon={<TrendingDown className="text-red-500" />} // Added icon
            valueClassName="text-red-600 dark:text-red-500"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           <KpiCard
            title="Total de Ativos" // Total Assets
            value={formatCurrency(personalKpiData.totalAssets, preferredCurrency, undefined, true)}
            tooltip="Soma de todos os seus ativos (contas, investimentos, etc.)."
            icon={<Landmark className="text-primary" />} // Added icon
          />
          <KpiCard
            title="Total de Passivos" // Total Liabilities
            value={formatCurrency(personalKpiData.totalLiabilities, preferredCurrency, undefined, true)}
            tooltip="Soma de todas as suas dívidas e obrigações."
            icon={<Scale className="text-primary" />} // Added icon
          />
          <KpiCard
            title="Taxa de Poupança" // Savings Rate
            value={`${(personalKpiData.savingsRate * 100).toFixed(1)}%`}
            tooltip="Percentual da sua renda que você está economizando."
            isPercentage={true}
            icon={<PiggyBank className="text-primary" />} // Added icon
          />
        </div>

        {/* Charts Section - Placeholder for new charts like Expense Breakdown or Net Worth Trend */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Despesas por Categoria (Em Breve)</CardTitle>
              <CardDescription>Visualização das suas despesas agrupadas por categoria.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] sm:h-[350px] flex items-center justify-center">
              <p className="text-muted-foreground">Gráfico de despesas em desenvolvimento.</p>
              {/* Placeholder for ExpenseBreakdownChart */}
              {/* <ExpenseBreakdownChart data={expenseBreakdownData} totalValue={totalMonthlyExpenses} currency={preferredCurrency} /> */}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Evolução do Patrimônio (Em Breve)</CardTitle>
              <CardDescription>Acompanhe o crescimento do seu patrimônio líquido ao longo do tempo.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] sm:h-[350px] flex items-center justify-center">
              <p className="text-muted-foreground">Gráfico de patrimônio em desenvolvimento.</p>
              {/* Placeholder for NetWorthTrendChart */}
            </CardContent>
          </Card>
        </div>
        {/* Removed the Vendas por Pagamento chart and other sales-specific KPIs */}
      </div>
    </TooltipProvider>
  );
}

