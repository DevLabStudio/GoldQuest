import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAccounts, type Account } from "@/services/account-sync";
import { PlusCircle } from "lucide-react";

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
};

export default async function AccountsPage() {
  let accounts: Account[] = [];
  try {
    accounts = await getAccounts();
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
    // Handle error state in UI if needed
  }

  const handleConnectAccount = () => {
    // TODO: Implement actual account connection flow (e.g., Plaid Link)
    alert("Connect New Account functionality not implemented yet.");
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Accounts</h1>
        {/*
          This button is disabled because the functionality is not implemented.
          Remove the 'disabled' prop and add an onClick handler when ready.
         */}
        <Button disabled>
          <PlusCircle className="mr-2 h-4 w-4" /> Connect New Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            View and manage your linked financial accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length > 0 ? (
            <ul className="space-y-4">
              {accounts.map((account) => (
                <li key={account.id} className="flex flex-col md:flex-row justify-between items-start md:items-center border p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="mb-2 md:mb-0">
                    <p className="font-semibold text-lg">{account.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">Type: {account.type}</p>
                     <p className="text-sm text-muted-foreground">ID: {account.id}</p>
                  </div>
                  <div className="flex flex-col items-end">
                     <p className="font-bold text-xl text-primary">{formatCurrency(account.balance)}</p>
                     <p className="text-xs text-muted-foreground">Current Balance</p>
                      {/* Placeholder for Actions */}
                      <div className="mt-2 space-x-2">
                          <Button variant="outline" size="sm" disabled>Refresh</Button>
                          <Button variant="destructive" size="sm" disabled>Disconnect</Button>
                      </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground mb-4">No accounts connected yet.</p>
              <Button disabled>
                <PlusCircle className="mr-2 h-4 w-4" /> Connect Your First Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
