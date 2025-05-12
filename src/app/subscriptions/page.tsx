
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function SubscriptionsPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Subscriptions</h1>

      <Card>
        <CardHeader>
          <CardTitle>Manage Recurring Subscriptions</CardTitle>
          <CardDescription>
            Keep track of your monthly and annual subscriptions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Subscriptions tracking feature coming soon!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
