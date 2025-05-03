import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getAccounts, type Account } from "@/services/account-sync";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import SpendingChart from "@/components/dashboard/spending-chart";
import { formatCurrency } from '@/lib/currency'; // Use the new currency formatter
import { getUserPreferences } from '@/lib/preferences'; // Get user preferences


export default async function Dashboard() {
  let accounts: Account[] = [];
  let totalBalanceInPreferred = 0;
  let preferredCurrency = 'BRL'; // Default

  // IMPORTANT: Data fetching might happen server-side, but localStorage access is client-side only.
  // This component is likely a Server Component by default in App Router.
  // To handle localStorage preferences correctly for display, we might need client-side logic
  // or pass preferences down from a client component parent.
  // For now, we'll proceed assuming we can get preferences, but be aware of this constraint.

  try {
    // Attempt to get preferences - this will only work correctly if executed client-side
    // or if preferences are somehow made available server-side (e.g., via cookies or API).
    // Let's assume getUserPreferences provides a default if run server-side.
    const prefs = getUserPreferences();
    preferredCurrency = prefs.preferredCurrency;

    // Fetch accounts - If getAccounts relies on localStorage, this needs client-side execution.
    // For Server Components, getAccounts should ideally fetch from a DB/API.
    // We'll assume getAccounts works for now.
    accounts = await getAccounts();

    // Calculate total balance in the preferred currency
    totalBalanceInPreferred = accounts.reduce((sum, account) => {
        // formatCurrency handles the conversion based on user preferences
        // We need the raw converted value, not the formatted string here.
        // Let's adjust formatCurrency or add a dedicated conversion function if needed.
        // For now, we'll use formatCurrency's internal logic (conceptually).
        const numericValueInPreferred = parseFloat(
            formatCurrency(account.balance, account.currency)
            .replace(/[^0-9,-]+/g,"") // Remove currency symbols, thousands separators
            .replace(",", ".") // Replace decimal comma with dot if locale uses comma
        );
       return sum + (isNaN(numericValueInPreferred) ? 0 : numericValueInPreferred);
    }, 0);

  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    // Handle error state in UI if needed, maybe show fallback values or error message.
    // If the error is due to localStorage access server-side, the component needs refactoring.
  }


  // Placeholder data for spending trends
  const monthlyIncome = 5000; // Assume this is in preferred currency for simplicity
  const monthlyExpenses = 3500; // Assume this is in preferred currency
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

  // Placeholder spending data for the chart (assume in preferred currency)
  const spendingData = [
    { category: "Groceries", amount: 450.75 },
    { category: "Utilities", amount: 150.30 },
    { category: "Rent", amount: 1200.00 },
    { category: "Transport", amount: 180.50 },
    { category: "Food", amount: 350.00 },
    { category: "Other", amount: 200.00 },
  ];

  // Format the total balance for display using the preferred currency settings
  // We need a way to format without conversion if the value is already converted.
  // Let's create a simple formatter for the already-converted total.
  const formatTotalBalance = (amount: number, currencyCode: string): string => {
       try {
        // Determine locale based on target currency
        let formatLocale;
        switch (currencyCode.toUpperCase()) {
            case 'BRL': formatLocale = 'pt-BR'; break;
            case 'USD': formatLocale = 'en-US'; break;
            case 'EUR': formatLocale = 'de-DE'; break; // Example
            case 'GBP': formatLocale = 'en-GB'; break;
            default: formatLocale = 'en-US';
        }
        return new Intl.NumberFormat(formatLocale, {
            style: 'currency',
            currency: currencyCode.toUpperCase(),
        }).format(amount);
    } catch (error) {
        console.error(`Error formatting total balance: Amount=${amount}, Currency=${currencyCode}`, error);
        return `${currencyCode.toUpperCase()} ${amount.toFixed(2)}`;
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard Overview</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance ({preferredCurrency})</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {/* Display total balance formatted in preferred currency */}
            <div className="text-2xl font-bold">{formatTotalBalance(totalBalanceInPreferred, preferredCurrency)}</div>
            <p className="text-xs text-muted-foreground">Across {accounts.length} accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Income ({preferredCurrency} - Placeholder)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {/* Format placeholder income in preferred currency */}
            <div className="text-2xl font-bold">{formatTotalBalance(monthlyIncome, preferredCurrency)}</div>
            <p className="text-xs text-muted-foreground">+2.1% from last month (example)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Expenses ({preferredCurrency} - Placeholder)</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {/* Format placeholder expenses in preferred currency */}
            <div className="text-2xl font-bold">{formatTotalBalance(monthlyExpenses, preferredCurrency)}</div>
             <p className="text-xs text-muted-foreground">-5.3% from last month (example)</p>
          </CardContent>
        </Card>

         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Savings Rate (Placeholder)</CardTitle>
             <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{savingsRate.toFixed(1)}%</div>
             <p className="text-xs text-muted-foreground">Based on current month placeholders</p>
          </CardContent>
        </Card>
      </div>

       <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Account Balances</CardTitle>
            <CardDescription>Current balance for each account (shown in your preferred currency: {preferredCurrency}).</CardDescription>
          </CardHeader>
          <CardContent>
             {accounts.length > 0 ? (
                 <ul className="space-y-4">
                 {accounts.map((account) => (
                   <li key={account.id} className="flex justify-between items-center border-b pb-2 last:border-b-0">
                     <div>
                       <p className="font-medium">{account.name}</p>
                       <p className="text-sm text-muted-foreground capitalize">{account.type} ({account.currency})</p>
                     </div>
                     {/* Use formatCurrency which now handles conversion */}
                     <p className="font-semibold">{formatCurrency(account.balance, account.currency)}</p>
                   </li>
                 ))}
               </ul>
             ) : (
                <p className="text-muted-foreground">No accounts found. Add accounts to see balances.</p>
             )}
          </CardContent>
        </Card>
       </div>

       {/* Spending Trends Chart */}
       <div className="mt-8">
           <Card>
               <CardHeader>
                   <CardTitle>Spending Trends ({preferredCurrency} - Placeholder)</CardTitle>
                   <CardDescription>Monthly spending by category.</CardDescription>
               </CardHeader>
               <CardContent className="h-80"> {/* Increased height for better chart display */}
                  {/* Pass preferred currency to chart if it needs to format tooltips/labels */}
                  <SpendingChart data={spendingData} currency={preferredCurrency} />
               </CardContent>
           </Card>
       </div>
    </div>
  );
}
