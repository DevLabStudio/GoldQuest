import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getAccounts, type Account } from "@/services/account-sync";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import SpendingChart from "@/components/dashboard/spending-chart"; // Import the chart component

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
};


export default async function Dashboard() {
  let accounts: Account[] = [];
  let totalBalance = 0;
  try {
    accounts = await getAccounts();
    totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
    // Handle error state in UI if needed
  }


  // Placeholder data for spending trends
  const monthlyIncome = 5000;
  const monthlyExpenses = 3500;
  const savingsRate = ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100;

  // Placeholder spending data for the chart
  const spendingData = [
    { category: "Groceries", amount: 450.75 },
    { category: "Utilities", amount: 150.30 },
    { category: "Rent", amount: 1200.00 },
    { category: "Transport", amount: 180.50 },
    { category: "Food", amount: 350.00 },
    { category: "Other", amount: 200.00 },
  ];

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard Overview</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
            <p className="text-xs text-muted-foreground">Across {accounts.length} accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Income (Placeholder)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthlyIncome)}</div>
            <p className="text-xs text-muted-foreground">+2.1% from last month (example)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Expenses (Placeholder)</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthlyExpenses)}</div>
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
            <CardDescription>Current balance for each connected account.</CardDescription>
          </CardHeader>
          <CardContent>
             {accounts.length > 0 ? (
                 <ul className="space-y-4">
                 {accounts.map((account) => (
                   <li key={account.id} className="flex justify-between items-center border-b pb-2 last:border-b-0">
                     <div>
                       <p className="font-medium">{account.name}</p>
                       <p className="text-sm text-muted-foreground capitalize">{account.type}</p>
                     </div>
                     <p className="font-semibold">{formatCurrency(account.balance)}</p>
                   </li>
                 ))}
               </ul>
             ) : (
                <p className="text-muted-foreground">No accounts found. Connect your accounts to see balances.</p>
             )}
          </CardContent>
        </Card>
       </div>

       {/* Spending Trends Chart */}
       <div className="mt-8">
           <Card>
               <CardHeader>
                   <CardTitle>Spending Trends (Placeholder)</CardTitle>
                   <CardDescription>Monthly spending by category.</CardDescription>
               </CardHeader>
               <CardContent className="h-80"> {/* Increased height for better chart display */}
                  <SpendingChart data={spendingData} />
               </CardContent>
           </Card>
       </div>
    </div>
  );
}
