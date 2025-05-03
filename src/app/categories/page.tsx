
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function CategoriesPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Categories</h1>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Categories</CardTitle>
          <CardDescription>
            Manage your spending and income categories here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Category management feature coming soon!
            </p>
            {/* Placeholder for future content like category list, add/edit forms etc. */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
