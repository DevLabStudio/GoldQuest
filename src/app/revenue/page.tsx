
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function RevenuePage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Revenue / Income</h1>

      <Card>
        <CardHeader>
          <CardTitle>Income Tracking</CardTitle>
          <CardDescription>
            View and manage your income sources here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Revenue/Income tracking feature coming soon!
            </p>
            {/* Placeholder for future content like income list, add/edit forms etc. */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
