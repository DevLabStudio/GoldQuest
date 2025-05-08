
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Landmark, Scale, PiggyBank, PieChart as PieChartIcon } from "lucide-react"; // Added PieChartIcon
import KpiCard from "@/components/dashboard/kpi-card";
import NetWorthCompositionChart from "@/components/dashboard/net-worth-composition-chart"; // Import new chart
import { getUserPreferences } from '@/lib/preferences';
import { formatCurrency } from '@/lib/currency';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(true);

  // Placeholder data for accounts and transactions (replace with actual data fetching)
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const prefs = getUserPreferences();
      setPreferredCurrency(prefs.preferredCurrency);
      setLastUpdated(new Date());
      // Simulate fetching chart data
      setTimeout(() => {
        setIsChartLoading(false);
      }, 1200);
    }
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setIsChartLoading(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      // Simulate fetching actual data
      // fetchDashboardData();
      setIsLoading(false);
      setIsChartLoading(false);
    }, 1000);
  };

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return "Atualizando...";
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    if (diffSeconds < 60) return `Atualizado há ${diffSeconds} segundos`;
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes === 1) return "Atualizado há 1 minuto";
    return `Atualizado há ${diffMinutes} minutos`;
  };

  // Placeholder data for Personal Finance KPIs
  const personalKpiData = {
    totalNetWorth: 125000.75,
    totalAssets: 150000.50,
    totalLiabilities: 24999.75,
    monthlyIncome: 7500.00,
    monthlyExpenses: -4850.25,
    savingsRate: 0.3533,
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
                <CardTitle className="text-xl">Resumo Financeiro</CardTitle>
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <span className="text-xs text-muted-foreground">{formatLastUpdated(lastUpdated)}</span>
                <Button variant="default" size="sm" onClick={handleRefresh} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="date-range" className="text-xs font-medium text-muted-foreground">Período</label>
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
              <label htmlFor="account-filter" className="text-xs font-medium text-muted-foreground">Conta</label>
              <Select defaultValue="all">
                <SelectTrigger id="account-filter">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Contas</SelectItem>
                   <SelectItem value="placeholder-1">Conta Placeholder 1</SelectItem>
                   <SelectItem value="placeholder-2">Conta Placeholder 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="category-filter" className="text-xs font-medium text-muted-foreground">Categoria</label>
              <Select defaultValue="all">
                <SelectTrigger id="category-filter">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                   <SelectItem value="cat-placeholder-1">Categoria Placeholder 1</SelectItem>
                   <SelectItem value="cat-placeholder-2">Categoria Placeholder 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <KpiCard
            title="Patrimônio Líquido"
            value={formatCurrency(personalKpiData.totalNetWorth, preferredCurrency, undefined, true)}
            tooltip="Seu patrimônio total (Ativos - Passivos)."
            icon={<Wallet className="text-primary" />}
          />
          <KpiCard
            title="Receitas do Mês"
            value={formatCurrency(personalKpiData.monthlyIncome, preferredCurrency, undefined, true)}
            tooltip="Total de receitas recebidas neste mês."
            icon={<TrendingUp className="text-green-500" />}
            valueClassName="text-green-600 dark:text-green-500"
          />
          <KpiCard
            title="Despesas do Mês"
            value={formatCurrency(personalKpiData.monthlyExpenses, preferredCurrency, undefined, true)}
            tooltip="Total de despesas realizadas neste mês."
            icon={<TrendingDown className="text-red-500" />}
            valueClassName="text-red-600 dark:text-red-500"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           <KpiCard
            title="Total de Ativos"
            value={formatCurrency(personalKpiData.totalAssets, preferredCurrency, undefined, true)}
            tooltip="Soma de todos os seus ativos (contas, investimentos, etc.)."
            icon={<Landmark className="text-primary" />}
          />
          <KpiCard
            title="Total de Passivos"
            value={formatCurrency(personalKpiData.totalLiabilities, preferredCurrency, undefined, true)}
            tooltip="Soma de todas as suas dívidas e obrigações."
            icon={<Scale className="text-primary" />}
          />
          <KpiCard
            title="Taxa de Poupança"
            value={`${(personalKpiData.savingsRate * 100).toFixed(1)}%`}
            tooltip="Percentual da sua renda que você está economizando."
            isPercentage={true}
            icon={<PiggyBank className="text-primary" />}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Composição do Patrimônio ({preferredCurrency})</CardTitle>
              <CardDescription>Distribuição entre ativos e passivos.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] sm:h-[350px]">
              {isChartLoading ? (
                <Skeleton className="h-full w-full" />
              ) : personalKpiData.totalAssets > 0 || personalKpiData.totalLiabilities > 0 ? (
                <NetWorthCompositionChart
                  totalAssets={personalKpiData.totalAssets}
                  totalLiabilities={personalKpiData.totalLiabilities}
                  currency={preferredCurrency}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Sem dados para exibir a composição do patrimônio.
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Fluxo de Caixa Mensal (Em Breve)</CardTitle>
              <CardDescription>Compare suas receitas e despesas ao longo do tempo.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] sm:h-[350px] flex items-center justify-center">
               {isChartLoading ? (
                  <Skeleton className="h-full w-full" />
               ) : (
                 <p className="text-muted-foreground">Gráfico de fluxo de caixa em desenvolvimento.</p>
               )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

