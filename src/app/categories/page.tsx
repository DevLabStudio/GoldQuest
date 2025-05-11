'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { getCategories, addCategory, updateCategory, deleteCategory, type Category, getCategoryStyle } from "@/services/categories.tsx";
import AddCategoryForm from '@/components/categories/add-category-form';
import EditCategoryForm from '@/components/categories/edit-category-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";


export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); 
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null); 
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();


  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
        if(isMounted) setIsLoading(true);
        if(isMounted) setError(null);
        try {
            const fetchedCategories = await getCategories();
            fetchedCategories.sort((a, b) => a.name.localeCompare(b.name));
            if(isMounted) setCategories(fetchedCategories);
        } catch (err) {
            console.error("Failed to fetch categories:", err);
            if(isMounted) setError("Could not load categories.");
            if(isMounted) toast({
                title: "Error",
                description: "Failed to load categories.",
                variant: "destructive",
            });
        } finally {
            if(isMounted) setIsLoading(false);
        }
    };

    fetchCategories();

    const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && event.key === 'userCategories' && isMounted) {
            console.log("Category storage changed, refetching...");
            fetchCategories();
        }
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorageChange);
    }

    return () => {
        isMounted = false;
        if (typeof window !== 'undefined') {
            window.removeEventListener('storage', handleStorageChange);
        }
    };
  }, [toast]); 

  const localFetchCategories = async () => {
    setIsLoading(true); setError(null);
    try {
        const fetched = await getCategories();
        fetched.sort((a, b) => a.name.localeCompare(b.name));
        setCategories(fetched);
    } catch (e) { console.error(e); setError("Could not reload categories.");}
    finally { setIsLoading(false); }
  };

  const handleAddCategory = async (categoryName: string) => {
    setIsLoading(true);
    try {
      await addCategory(categoryName);
      await localFetchCategories();
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

   const handleUpdateCategory = async (categoryId: string, newName: string) => {
     setIsLoading(true);
     try {
       await updateCategory(categoryId, newName);
       await localFetchCategories();
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

   const handleDeleteCategoryConfirm = async () => {
       if (!selectedCategory) return;
       setIsDeleting(true);
       try {
           await deleteCategory(selectedCategory.id);
           await localFetchCategories();
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
           setSelectedCategory(null);
       }
   };


  const openEditDialog = (category: Category) => {
    setSelectedCategory(category);
    setIsEditDialogOpen(true);
  };

   const openDeleteDialog = (category: Category) => {
      setSelectedCategory(category);
   };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Categories</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
             <Button variant="default" size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Category
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
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
          {isLoading && categories.length === 0 ? ( 
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
                       <div className="flex items-center gap-1 overflow-hidden mr-8"> 
                         <CategoryIcon />
                         <span className="capitalize truncate">{category.name}</span>
                       </div>
                       <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEditDialog(category)}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                          </Button>
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => openDeleteDialog(category)}>
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
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
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                 <DialogTrigger asChild>
                    <Button variant="link" className="mt-2 px-0 h-auto text-primary">
                         Add your first category
                    </Button>
                  </DialogTrigger>
                 <DialogContent className="sm:max-w-2xl">
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
         {!isLoading && categories.length > 0 && (
            <CardContent className="pt-4 border-t flex justify-start">
                 <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                       <Button variant="default" size="sm">
                          <PlusCircle className="mr-2 h-4 w-4" /> Add New Category
                       </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
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

        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setSelectedCategory(null); 
        }}>
            <DialogContent className="sm:max-w-2xl">
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
