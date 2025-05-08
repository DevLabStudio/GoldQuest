
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Info, RefreshCw, UserCircle } from "lucide-react";
import KpiCard from "@/components/dashboard/kpi-card";
import PaymentDistributionChart from "@/components/dashboard/payment-distribution-chart";
import { getUserPreferences } from '@/lib/preferences';
import { formatCurrency } from '@/lib/currency';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function DashboardPage() {
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For refresh button

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const prefs = getUserPreferences();
      setPreferredCurrency(prefs.preferredCurrency);
      setLastUpdated(new Date()); // Set initial last updated time
    }
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate data refresh
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsLoading(false);
      // In a real app, you would re-fetch data here
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


  // Placeholder data for KPIs - In a real app, this would come from state/props/API
  const kpiData = {
    faturamentoLiquido: 635789.23,
    gastosAnuncios: 456827.90,
    roas: 1.39,
    lucro: 159887.65,
    vendasPendentes: 89289.38,
    roi: 0.35, // 35.0%
    margemLucro: 0.251, // 25.1%
    vendasReembolsadas: 18459.20,
    reembolsoPercent: 0.024, // 2.4%
    arpu: 238.79,
    imposto: 19073.68,
    chargebackPercent: 0.007, // 0.7%
  };

  const paymentData = [
    { name: 'Pix', value: 2867 * 0.48, percentage: 48, fill: 'hsl(var(--chart-1))' },
    { name: 'Cartão', value: 2867 * 0.27, percentage: 27, fill: 'hsl(var(--chart-2))' },
    { name: 'Boleto', value: 2867 * 0.15, percentage: 15, fill: 'hsl(var(--chart-3))' },
    { name: 'Outros', value: 2867 * 0.08, percentage: 8, fill: 'hsl(var(--chart-4))' },
  ];
  const totalVendasPagamento = 2867;


  return (
    <TooltipProvider>
      <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard - Principal</h1>
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            <span className="text-sm text-muted-foreground">Márcio Valim</span>
            <Avatar className="h-9 w-9">
              <AvatarImage src="https://picsum.photos/40/40" alt="Márcio Valim" data-ai-hint="male user" />
              <AvatarFallback>MV</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Resumo Card with Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <CardTitle className="text-xl">Resumo</CardTitle>
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
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="date-range" className="text-xs font-medium text-muted-foreground">Data de cadastro</label>
              <Select defaultValue="last7days">
                <SelectTrigger id="date-range">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="last30days">Últimos 30 dias</SelectItem>
                  <SelectItem value="thisMonth">Este mês</SelectItem>
                  <SelectItem value="lastMonth">Mês passado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="ad-account" className="text-xs font-medium text-muted-foreground">Conta de Anúncio</label>
              <Select defaultValue="all">
                <SelectTrigger id="ad-account">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {/* Add more accounts here */}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="platform" className="text-xs font-medium text-muted-foreground">Plataforma</label>
              <Select defaultValue="any">
                <SelectTrigger id="platform">
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer</SelectItem>
                  {/* Add more platforms here */}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="product" className="text-xs font-medium text-muted-foreground">Produto</label>
              <Select defaultValue="any">
                <SelectTrigger id="product">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer</SelectItem>
                  {/* Add more products here */}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard title="Faturamento Líquido" value={formatCurrency(kpiData.faturamentoLiquido, preferredCurrency, undefined, false)} tooltip="Receita total menos devoluções e descontos." />
          <KpiCard title="Gastos com anúncios" value={formatCurrency(kpiData.gastosAnuncios, preferredCurrency, undefined, false)} tooltip="Total investido em publicidade." />
          <KpiCard title="ROAS" value={kpiData.roas.toFixed(2)} tooltip="Retorno Sobre o Investimento em Anúncios (Receita de Anúncios / Custo de Anúncios)." isPercentage={false}/>
          <KpiCard title="Lucro" value={formatCurrency(kpiData.lucro, preferredCurrency, undefined, false)} tooltip="Faturamento Líquido menos Gastos com Anúncios e outros custos." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Vendas por Pagamento Card */}
          <Card className="md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">Vendas por Pagamento</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Distribuição das vendas pelos métodos de pagamento.</p>
                </TooltipContent>
              </Tooltip>
            </CardHeader>
            <CardContent className="h-[300px] sm:h-[350px] p-0">
              <PaymentDistributionChart data={paymentData} totalValue={totalVendasPagamento} />
            </CardContent>
          </Card>

          {/* Other KPIs Column */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <KpiCard title="Vendas Pendentes" value={formatCurrency(kpiData.vendasPendentes, preferredCurrency, undefined, false)} tooltip="Valor de vendas aguardando confirmação ou processamento." />
            <KpiCard title="ROI" value={`${(kpiData.roi * 100).toFixed(1)}%`} tooltip="Retorno Sobre o Investimento ((Lucro - Custo do Investimento) / Custo do Investimento)." isPercentage={true}/>
            <KpiCard title="Vendas Reembolsadas" value={formatCurrency(kpiData.vendasReembolsadas, preferredCurrency, undefined, false)} tooltip="Valor total de vendas que foram reembolsadas." />
            <KpiCard title="Margem de Lucro" value={`${(kpiData.margemLucro * 100).toFixed(1)}%`} tooltip="Percentual do lucro sobre o faturamento ((Lucro / Faturamento Líquido) * 100)." isPercentage={true}/>
            <KpiCard title="Imposto" value={formatCurrency(kpiData.imposto, preferredCurrency, undefined, false)} tooltip="Valor estimado ou pago em impostos sobre as vendas." />
            <KpiCard title="Reembolso" value={`${(kpiData.reembolsoPercent * 100).toFixed(1)}%`} tooltip="Percentual de vendas que resultaram em reembolso." isPercentage={true}/>
            <KpiCard title="ARPU" value={formatCurrency(kpiData.arpu, preferredCurrency, undefined, false)} tooltip="Receita Média Por Usuário." />
            <KpiCard title="Chargeback" value={`${(kpiData.chargebackPercent * 100).toFixed(1)}%`} tooltip="Percentual de transações contestadas pelo titular do cartão." isPercentage={true}/>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
