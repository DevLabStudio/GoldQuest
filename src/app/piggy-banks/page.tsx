
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function PiggyBanksPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Piggy Banks</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your Savings Goals</CardTitle>
          <CardDescription>
            Set up and track progress towards your savings goals (Piggy Banks).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Piggy Banks feature coming soon!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
