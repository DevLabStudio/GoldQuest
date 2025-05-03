
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function GroupsPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Transaction Groups</h1>

      <Card>
        <CardHeader>
          <CardTitle>Manage Groups</CardTitle>
          <CardDescription>
            Create and manage groups for budgeting or reporting purposes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Transaction grouping feature coming soon!
            </p>
            {/* Placeholder for future content */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
