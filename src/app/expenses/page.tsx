
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ExpensesPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Expenses</h1>

      <Card>
        <CardHeader>
          <CardTitle>Expense Tracking</CardTitle>
          <CardDescription>
            View and manage your expenses here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Expense tracking feature coming soon!
            </p>
            {/* Placeholder for future content like expense list, charts, add/edit forms etc. */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
