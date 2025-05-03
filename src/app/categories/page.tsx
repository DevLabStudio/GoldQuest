
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2 } from 'lucide-react'; // For future management actions
import { getTransactions, type Transaction } from "@/services/transactions.tsx"; // Import transactions service
import { Skeleton } from '@/components/ui/skeleton';

// Reuse category styles logic from transactions page
const categoryStyles: { [key: string]: { icon: React.ElementType, color: string } } = {
  groceries: { icon: () => <span className="mr-1">🛒</span>, color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' },
  rent: { icon: () => <span className="mr-1">🏠</span>, color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' },
  utilities: { icon: () => <span className="mr-1">💡</span>, color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700' },
  transportation: { icon: () => <span className="mr-1">🚗</span>, color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700' },
  food: { icon: () => <span className="mr-1">🍔</span>, color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' },
  income: { icon: () => <span className="mr-1">💰</span>, color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700' },
  salary: { icon: () => <span className="mr-1">💼</span>, color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700' },
  investment: { icon: () => <span className="mr-1">📈</span>, color: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700' },
  default: { icon: () => <span className="mr-1">❓</span>, color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700/30 dark:text-gray-300 dark:border-gray-600' },
  uncategorized: { icon: () => <span className="mr-1">🏷️</span>, color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700/30 dark:text-gray-300 dark:border-gray-600' },
};

const getCategoryStyle = (category: string) => {
    const lowerCategory = category?.toLowerCase() || 'default';
    return categoryStyles[lowerCategory] || categoryStyles.default;
}

// Get unique categories from the predefined styles object
const predefinedCategories = Object.keys(categoryStyles).filter(cat => cat !== 'default');


export default function CategoriesPage() {
  // For now, we'll use the predefined categories.
  // Later, we could fetch actual unique categories from transactions if needed.
  const [categories, setCategories] = useState<string[]>(predefinedCategories);
  const [isLoading, setIsLoading] = useState(false); // Set to false as we use predefined data

  // Placeholder for future fetch logic
  // useEffect(() => {
  //   const fetchCategories = async () => {
  //     setIsLoading(true);
  //     try {
  //       // Option 1: Fetch all transactions and derive categories (can be slow)
  //       // const allTx = await getAllTransactions(); // Need to implement this in service
  //       // const uniqueCategories = [...new Set(allTx.map(tx => tx.category || 'uncategorized'))];
  //       // setCategories(uniqueCategories);

  //       // Option 2: Use predefined categories (faster, less dynamic)
  //        setCategories(predefinedCategories);
  //     } catch (error) {
  //       console.error("Failed to fetch categories:", error);
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };
  //   fetchCategories();
  // }, []);


  // Handlers for future management actions (placeholders)
  const handleAddCategory = () => {
    console.log("Add category clicked");
    // Open Add Category Dialog/Form
  };

  const handleEditCategory = (category: string) => {
    console.log("Edit category:", category);
    // Open Edit Category Dialog/Form
  };

  const handleDeleteCategory = (category: string) => {
    console.log("Delete category:", category);
    // Show confirmation and delete
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Categories</h1>
        <Button variant="default" size="sm" onClick={handleAddCategory}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Category
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage Categories</CardTitle>
          <CardDescription>
            View, add, edit, or delete your transaction categories.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
               {[...Array(8)].map((_, i) => (
                   <Skeleton key={i} className="h-10 w-full" />
               ))}
            </div>
          ) : categories.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {categories.map((category) => {
                const { icon: CategoryIcon, color } = getCategoryStyle(category);
                return (
                  <div key={category} className="group relative">
                     <Badge variant="outline" className={`w-full justify-between py-2 px-3 text-sm ${color} border`}>
                       <div className="flex items-center gap-1 overflow-hidden">
                         <CategoryIcon />
                         <span className="capitalize truncate">{category}</span>
                       </div>
                       {/* Action buttons (Initially hidden, shown on hover/focus) */}
                       {/*
                       <div className="absolute inset-0 bg-background/80 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleEditCategory(category)}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteCategory(category)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                          </Button>
                       </div>
                       */}
                     </Badge>
                   </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                No categories found. Add your first category.
              </p>
               <Button variant="link" className="mt-2 px-0 h-auto text-primary" onClick={handleAddCategory}>
                    Add a Category
               </Button>
            </div>
          )}
        </CardContent>
        {/* Optional Footer */}
         {categories.length > 0 && (
            <CardContent className="pt-4 border-t">
               <Button variant="default" size="sm" onClick={handleAddCategory}>
                 <PlusCircle className="mr-2 h-4 w-4" /> Add New Category
               </Button>
            </CardContent>
         )}
      </Card>
    </div>
  );
}
