
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { getCategories, addCategory, updateCategory, deleteCategory, type Category, getCategoryStyle } from "@/services/categories"; // Import new service
import AddCategoryForm from '@/components/categories/add-category-form'; // Import Add form
import EditCategoryForm from '@/components/categories/edit-category-form'; // Import Edit form
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";

// Removed duplicate categoryStyles and getCategoryStyle as they are now imported from the service

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // State for delete confirmation
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null); // For edit/delete
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCategories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedCategories = await getCategories();
      // Sort categories alphabetically by name for consistent display
      fetchedCategories.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(fetchedCategories);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      setError("Could not load categories.");
      toast({
        title: "Error",
        description: "Failed to load categories.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    // Add storage listener if category service uses localStorage
     const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && event.key === 'userCategories') {
            console.log("Category storage changed, refetching...");
            fetchCategories();
        }
     };
     if (typeof window !== 'undefined') {
       window.addEventListener('storage', handleStorageChange);
     }
     return () => {
       if (typeof window !== 'undefined') {
         window.removeEventListener('storage', handleStorageChange);
       }
     };
  }, []); // Fetch on mount and listen for storage changes

  // Add Category Handler
  const handleAddCategory = async (categoryName: string) => {
    setIsLoading(true); // Use isLoading for button state during add
    try {
      await addCategory(categoryName);
      await fetchCategories(); // Refetch after adding
      setIsAddDialogOpen(false);
      toast({
        title: "Success",
        description: `Category "${categoryName}" added.`,
      });
    } catch (err: any) {
      console.error("Failed to add category:", err);
      toast({
        title: "Error Adding Category",
        description: err.message || "Could not add the category.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Edit Category Handler
   const handleUpdateCategory = async (categoryId: string, newName: string) => {
     setIsLoading(true); // Use isLoading for button state during update
     try {
       await updateCategory(categoryId, newName);
       await fetchCategories(); // Refetch after updating
       setIsEditDialogOpen(false);
       setSelectedCategory(null);
       toast({
         title: "Success",
         description: `Category updated to "${newName}".`,
       });
     } catch (err: any) {
       console.error("Failed to update category:", err);
       toast({
         title: "Error Updating Category",
         description: err.message || "Could not update the category.",
         variant: "destructive",
       });
     } finally {
        setIsLoading(false);
     }
   };

   // Delete Category Handler
   const handleDeleteCategoryConfirm = async () => {
       if (!selectedCategory) return;
       setIsDeleting(true); // Show loading/disabled state on confirmation button
       try {
           await deleteCategory(selectedCategory.id);
           await fetchCategories(); // Refetch after deleting
           toast({
               title: "Category Deleted",
               description: `Category "${selectedCategory.name}" removed.`,
           });
       } catch (err: any) {
           console.error("Failed to delete category:", err);
           toast({
               title: "Error Deleting Category",
               description: err.message || "Could not delete the category.",
               variant: "destructive",
           });
       } finally {
           setIsDeleting(false);
           setSelectedCategory(null); // Close the confirmation dialog implicitly by resetting selectedCategory
       }
   };


  // Open Edit Dialog
  const openEditDialog = (category: Category) => {
    setSelectedCategory(category);
    setIsEditDialogOpen(true);
  };

   // Open Delete Confirmation Dialog
   const openDeleteDialog = (category: Category) => {
      setSelectedCategory(category);
      // The AlertDialog trigger will handle opening the dialog
   };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Categories</h1>
        {/* Add Category Dialog Trigger */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
             <Button variant="default" size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Category
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Category</DialogTitle>
              <DialogDescription>
                Enter the details for your new category.
              </DialogDescription>
            </DialogHeader>
             {/* Pass handler and loading state */}
             <AddCategoryForm onCategoryAdded={handleAddCategory} isLoading={isLoading} />
          </DialogContent>
        </Dialog>
      </div>

       {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">
              {error}
          </div>
       )}

      <Card>
        <CardHeader>
          <CardTitle>Manage Categories</CardTitle>
          <CardDescription>
            View, add, edit, or delete your transaction categories.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && categories.length === 0 ? ( // Show skeleton only on initial load
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
               {[...Array(10)].map((_, i) => (
                   <Skeleton key={i} className="h-10 w-full rounded-full" />
               ))}
            </div>
          ) : categories.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {categories.map((category) => {
                const { icon: CategoryIcon, color } = getCategoryStyle(category.name);
                return (
                  <div key={category.id} className="group relative">
                     <Badge variant="outline" className={`w-full justify-between py-2 px-3 text-sm ${color} border items-center`}>
                       <div className="flex items-center gap-1 overflow-hidden mr-8"> {/* Add margin-right */}
                         <CategoryIcon />
                         <span className="capitalize truncate">{category.name}</span>
                       </div>
                       {/* Action buttons (Positioned absolutely on the right) */}
                       <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEditDialog(category)}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                          </Button>
                           {/* Use AlertDialog for Delete Confirmation */}
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => openDeleteDialog(category)}>
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                               {/* Render content only if this specific category is selected for deletion */}
                              {selectedCategory?.id === category.id && (
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This action cannot be undone. This will permanently delete the category "{selectedCategory.name}". Transactions using this category might need recategorization.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setSelectedCategory(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteCategoryConfirm} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                          {isDeleting ? "Deleting..." : "Delete"}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                  </AlertDialogContent>
                              )}
                          </AlertDialog>
                       </div>
                     </Badge>
                   </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                No categories found.
              </p>
              {/* Button to open Add Dialog */}
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                 <DialogTrigger asChild>
                    <Button variant="link" className="mt-2 px-0 h-auto text-primary">
                         Add your first category
                    </Button>
                  </DialogTrigger>
                 <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add New Category</DialogTitle>
                      <DialogDescription>
                        Enter the details for your new category.
                      </DialogDescription>
                    </DialogHeader>
                    <AddCategoryForm onCategoryAdded={handleAddCategory} isLoading={isLoading} />
                 </DialogContent>
               </Dialog>
            </div>
          )}
        </CardContent>
        {/* Footer Add Button (visible if categories exist) */}
         {!isLoading && categories.length > 0 && (
            <CardContent className="pt-4 border-t flex justify-start">
                 <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                       <Button variant="default" size="sm">
                          <PlusCircle className="mr-2 h-4 w-4" /> Add New Category
                       </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Add New Category</DialogTitle>
                        <DialogDescription>
                          Enter the details for your new category.
                        </DialogDescription>
                      </DialogHeader>
                       <AddCategoryForm onCategoryAdded={handleAddCategory} isLoading={isLoading} />
                    </DialogContent>
                  </Dialog>
            </CardContent>
         )}
      </Card>

        {/* Edit Category Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setSelectedCategory(null); // Clear selection when closing
        }}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Category</DialogTitle>
                    <DialogDescription>
                        Modify the name of the category.
                    </DialogDescription>
                </DialogHeader>
                {selectedCategory && (
                    <EditCategoryForm
                        category={selectedCategory}
                        onCategoryUpdated={handleUpdateCategory}
                        isLoading={isLoading}
                    />
                )}
            </DialogContent>
        </Dialog>

    </div>
  );
}
