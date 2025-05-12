'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2, ListTree, Tag as TagIcon } from 'lucide-react'; // Added ListTree and TagIcon
import { getCategories, addCategory, updateCategory, deleteCategory, type Category, getCategoryStyle } from "@/services/categories";
import AddCategoryForm from '@/components/categories/add-category-form';
import EditCategoryForm from '@/components/categories/edit-category-form';
import { getTags, addTag, updateTag, deleteTag, type Tag, getTagStyle } from "@/services/tags";
import AddTagForm from '@/components/tags/add-tag-form';
import EditTagForm from '@/components/tags/edit-tag-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";

export default function OrganizationPage() {
  // Categories State
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Tags State
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [isAddTagDialogOpen, setIsAddTagDialogOpen] = useState(false);
  const [isEditTagDialogOpen, setIsEditTagDialogOpen] = useState(false);
  const [isDeletingTag, setIsDeletingTag] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);

  const { toast } = useToast();

  // Fetch Categories
  useEffect(() => {
    let isMounted = true;
    const fetchCategoriesData = async () => {
        if(isMounted) setIsLoadingCategories(true);
        if(isMounted) setCategoryError(null);
        try {
            const fetchedCategories = await getCategories();
            fetchedCategories.sort((a, b) => a.name.localeCompare(b.name));
            if(isMounted) setCategories(fetchedCategories);
        } catch (err) {
            console.error("Failed to fetch categories:", err);
            if(isMounted) setCategoryError("Could not load categories.");
            if(isMounted) toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
        } finally {
            if(isMounted) setIsLoadingCategories(false);
        }
    };
    fetchCategoriesData();
    const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && event.key === 'userCategories' && isMounted) fetchCategoriesData();
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', handleStorageChange);
    return () => { isMounted = false; if (typeof window !== 'undefined') window.removeEventListener('storage', handleStorageChange); };
  }, [toast]);

  // Fetch Tags
  useEffect(() => {
    let isMounted = true;
    const fetchTagsData = async () => {
        if(isMounted) setIsLoadingTags(true);
        if(isMounted) setTagError(null);
        try {
            const fetchedTags = await getTags();
            fetchedTags.sort((a, b) => a.name.localeCompare(b.name));
            if(isMounted) setTags(fetchedTags);
        } catch (err) {
            console.error("Failed to fetch tags:", err);
            if(isMounted) setTagError("Could not load tags.");
            if(isMounted) toast({ title: "Error", description: "Failed to load tags.", variant: "destructive" });
        } finally {
            if(isMounted) setIsLoadingTags(false);
        }
    };
    fetchTagsData();
    const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && event.key === 'userTags' && isMounted) fetchTagsData();
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', handleStorageChange);
    return () => { isMounted = false; if (typeof window !== 'undefined') window.removeEventListener('storage', handleStorageChange); };
  }, [toast]);

  // Category Handlers
  const localFetchCategories = async () => { /* ... as in categories/page.tsx ... */ };
  const handleAddCategory = async (categoryName: string) => {
    setIsLoadingCategories(true);
    try {
      await addCategory(categoryName);
      const fetched = await getCategories(); fetched.sort((a,b) => a.name.localeCompare(b.name)); setCategories(fetched);
      setIsAddCategoryDialogOpen(false);
      toast({ title: "Success", description: `Category "${categoryName}" added.` });
    } catch (err: any) {
      console.error("Failed to add category:", err);
      toast({ title: "Error Adding Category", description: err.message || "Could not add the category.", variant: "destructive" });
    } finally { setIsLoadingCategories(false); }
  };
  const handleUpdateCategory = async (categoryId: string, newName: string) => {
    setIsLoadingCategories(true);
    try {
      await updateCategory(categoryId, newName);
      const fetched = await getCategories(); fetched.sort((a,b) => a.name.localeCompare(b.name)); setCategories(fetched);
      setIsEditCategoryDialogOpen(false); setSelectedCategory(null);
      toast({ title: "Success", description: `Category updated to "${newName}".` });
    } catch (err: any) {
      console.error("Failed to update category:", err);
      toast({ title: "Error Updating Category", description: err.message || "Could not update the category.", variant: "destructive" });
    } finally { setIsLoadingCategories(false); }
  };
  const handleDeleteCategoryConfirm = async () => {
    if (!selectedCategory) return; setIsDeletingCategory(true);
    try {
      await deleteCategory(selectedCategory.id);
      const fetched = await getCategories(); fetched.sort((a,b) => a.name.localeCompare(b.name)); setCategories(fetched);
      toast({ title: "Category Deleted", description: `Category "${selectedCategory.name}" removed.` });
    } catch (err: any) {
      console.error("Failed to delete category:", err);
      toast({ title: "Error Deleting Category", description: err.message || "Could not delete category.", variant: "destructive" });
    } finally { setIsDeletingCategory(false); setSelectedCategory(null); }
  };
  const openEditCategoryDialog = (category: Category) => { setSelectedCategory(category); setIsEditCategoryDialogOpen(true); };
  const openDeleteCategoryDialog = (category: Category) => { setSelectedCategory(category); };

  // Tag Handlers
  const localFetchTags = async () => { /* ... as in tags/page.tsx ... */ };
  const handleAddTag = async (tagName: string) => {
    setIsLoadingTags(true);
    try {
      await addTag(tagName);
      const fetched = await getTags(); fetched.sort((a,b) => a.name.localeCompare(b.name)); setTags(fetched);
      setIsAddTagDialogOpen(false);
      toast({ title: "Success", description: `Tag "${tagName}" added.` });
    } catch (err: any) {
      console.error("Failed to add tag:", err);
      toast({ title: "Error Adding Tag", description: err.message || "Could not add the tag.", variant: "destructive" });
    } finally { setIsLoadingTags(false); }
  };
  const handleUpdateTag = async (tagId: string, newName: string) => {
    setIsLoadingTags(true);
    try {
      await updateTag(tagId, newName);
      const fetched = await getTags(); fetched.sort((a,b) => a.name.localeCompare(b.name)); setTags(fetched);
      setIsEditTagDialogOpen(false); setSelectedTag(null);
      toast({ title: "Success", description: `Tag updated to "${newName}".` });
    } catch (err: any) {
      console.error("Failed to update tag:", err);
      toast({ title: "Error Updating Tag", description: err.message || "Could not update the tag.", variant: "destructive" });
    } finally { setIsLoadingTags(false); }
  };
  const handleDeleteTagConfirm = async () => {
    if (!selectedTag) return; setIsDeletingTag(true);
    try {
      await deleteTag(selectedTag.id);
      const fetched = await getTags(); fetched.sort((a,b) => a.name.localeCompare(b.name)); setTags(fetched);
      toast({ title: "Tag Deleted", description: `Tag "${selectedTag.name}" removed.` });
    } catch (err: any) {
      console.error("Failed to delete tag:", err);
      toast({ title: "Error Deleting Tag", description: err.message || "Could not delete the tag.", variant: "destructive" });
    } finally { setIsDeletingTag(false); setSelectedTag(null); }
  };
  const openEditTagDialog = (tag: Tag) => { setSelectedTag(tag); setIsEditTagDialogOpen(true); };
  const openDeleteTagDialog = (tag: Tag) => { setSelectedTag(tag); };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Organization</h1>

      {/* Groups Section - Keeping placeholder for now */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Transaction Groups</CardTitle>
          <CardDescription>
            Create and manage groups for budgeting or reporting purposes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Transaction grouping feature coming soon!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Categories Section */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Categories</CardTitle>
            <Dialog open={isAddCategoryDialogOpen} onOpenChange={setIsAddCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Category
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Add New Category</DialogTitle><DialogDescription>Enter details for the new category.</DialogDescription></DialogHeader>
                <AddCategoryForm onCategoryAdded={handleAddCategory} isLoading={isLoadingCategories} />
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>View, add, edit, or delete your transaction categories.</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryError && <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">{categoryError}</div>}
          {isLoadingCategories && categories.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
               {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-full" />)}
            </div>
          ) : categories.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {categories.map((category) => {
                const { icon: CategoryIcon, color } = getCategoryStyle(category.name);
                return (
                  <div key={category.id} className="group relative">
                     <Badge variant="outline" className={`w-full justify-between py-2 px-3 text-sm ${color} border items-center`}>
                       <div className="flex items-center gap-1 overflow-hidden mr-8">
                         <CategoryIcon /> <span className="capitalize truncate">{category.name}</span>
                       </div>
                       <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEditCategoryDialog(category)}><Edit className="h-4 w-4" /><span className="sr-only">Edit</span></Button>
                          <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => openDeleteCategoryDialog(category)}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button></AlertDialogTrigger>
                              {selectedCategory?.id === category.id && (
                                  <AlertDialogContent>
                                      <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will permanently delete "{selectedCategory.name}".</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter><AlertDialogCancel onClick={() => setSelectedCategory(null)} disabled={isDeletingCategory}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteCategoryConfirm} disabled={isDeletingCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeletingCategory ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter>
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
            <div className="text-center py-10"><p className="text-muted-foreground">No categories found.</p></div>
          )}
        </CardContent>
      </Card>

      {/* Tags Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Tags</CardTitle>
            <Dialog open={isAddTagDialogOpen} onOpenChange={setIsAddTagDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Tag
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Add New Tag</DialogTitle><DialogDescription>Enter the name for your new tag.</DialogDescription></DialogHeader>
                <AddTagForm onTagAdded={handleAddTag} isLoading={isLoadingTags} />
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>View, add, edit, or delete your transaction tags.</CardDescription>
        </CardHeader>
        <CardContent>
          {tagError && <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">{tagError}</div>}
          {isLoadingTags && tags.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-full" />)}
            </div>
          ) : tags.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => {
                const { icon: TagIconStyled, color } = getTagStyle(tag.name);
                return (
                  <div key={tag.id} className="group relative">
                    <Badge variant="outline" className={`justify-between py-1 px-2.5 text-sm ${color} border items-center`}>
                      <div className="flex items-center gap-1 overflow-hidden mr-8">
                        <TagIconStyled /> <span className="truncate">{tag.name}</span>
                      </div>
                      <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center gap-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => openEditTagDialog(tag)}><Edit className="h-3.5 w-3.5" /><span className="sr-only">Edit</span></Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => openDeleteTagDialog(tag)}><Trash2 className="h-3.5 w-3.5" /><span className="sr-only">Delete</span></Button></AlertDialogTrigger>
                            {selectedTag?.id === tag.id && (
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the tag "{selectedTag.name}".</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel onClick={() => setSelectedTag(null)} disabled={isDeletingTag}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteTagConfirm} disabled={isDeletingTag} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeletingTag ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter>
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
            <div className="text-center py-10"><p className="text-muted-foreground">No tags found.</p></div>
          )}
        </CardContent>
      </Card>

      {/* Edit Category Dialog */}
        <Dialog open={isEditCategoryDialogOpen} onOpenChange={(open) => { setIsEditCategoryDialogOpen(open); if (!open) setSelectedCategory(null); }}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Edit Category</DialogTitle><DialogDescription>Modify category name.</DialogDescription></DialogHeader>
                {selectedCategory && <EditCategoryForm category={selectedCategory} onCategoryUpdated={handleUpdateCategory} isLoading={isLoadingCategories} />}
            </DialogContent>
        </Dialog>

      {/* Edit Tag Dialog */}
        <Dialog open={isEditTagDialogOpen} onOpenChange={(open) => { setIsEditTagDialogOpen(open); if (!open) setSelectedTag(null); }}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Edit Tag</DialogTitle><DialogDescription>Modify tag name.</DialogDescription></DialogHeader>
                {selectedTag && <EditTagForm tag={selectedTag} onTagUpdated={handleUpdateTag} isLoading={isLoadingTags} />}
            </DialogContent>
        </Dialog>
    </div>
  );
}
