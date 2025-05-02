import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function InvestmentsPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Investments</h1>

      <Card>
        <CardHeader>
          <CardTitle>Investment Portfolio</CardTitle>
          <CardDescription>
            Overview of your investment accounts and performance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Investment tracking feature coming soon!
            </p>
            {/* Placeholder for future content like charts, tables, etc. */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
