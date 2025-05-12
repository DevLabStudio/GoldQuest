
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function BudgetsPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Budgets</h1>

      <Card>
        <CardHeader>
          <CardTitle>Manage Your Budgets</CardTitle>
          <CardDescription>
            Create and track your spending against budgets for different categories.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Budgets feature coming soon!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
