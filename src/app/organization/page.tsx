
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2, FolderPlus, Settings2, Users, Tag as TagIconLucide, Eye, Edit3 } from 'lucide-react';
import { getCategories, addCategory, updateCategory, deleteCategory, type Category, getCategoryStyle } from "@/services/categories";
import AddCategoryForm from '@/components/categories/add-category-form';
import EditCategoryForm from '@/components/categories/edit-category-form';
import { getTags, addTag, updateTag, deleteTag, type Tag, getTagStyle } from "@/services/tags";
import AddTagForm from '@/components/tags/add-tag-form';
import EditTagForm from '@/components/tags/edit-tag-form';
import { getGroups, addGroup, updateGroup, deleteGroup, type Group } from "@/services/groups";
import AddGroupForm from '@/components/organization/add-group-form';
import EditGroupForm from '@/components/organization/edit-group-form'; 
import ManageGroupCategoriesDialog from '@/components/organization/manage-group-categories-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from '@/lib/utils';


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

  // Groups State
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isAddGroupDialogOpen, setIsAddGroupDialogOpen] = useState(false);
  const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false); 
  const [selectedGroupForEdit, setSelectedGroupForEdit] = useState<Group | null>(null); 
  const [isManageGroupCategoriesDialogOpen, setIsManageGroupCategoriesDialogOpen] = useState(false);
  const [selectedGroupForCategoryManagement, setSelectedGroupForCategoryManagement] = useState<Group | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [selectedGroupForDeletion, setSelectedGroupForDeletion] = useState<Group | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);


  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoadingCategories(true); setIsLoadingTags(true); setIsLoadingGroups(true);
    setCategoryError(null); setTagError(null); setGroupError(null);
    try {
      const [fetchedCategories, fetchedTags, fetchedGroups] = await Promise.all([
        getCategories(),
        getTags(),
        getGroups()
      ]);
      fetchedCategories.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(fetchedCategories);
      fetchedTags.sort((a, b) => a.name.localeCompare(b.name));
      setTags(fetchedTags);
      fetchedGroups.sort((a, b) => a.name.localeCompare(b.name));
      setGroups(fetchedGroups);
    } catch (err) {
      console.error("Failed to fetch organization data:", err);
      const errorMsg = "Could not load organization data.";
      setCategoryError(errorMsg); setTagError(errorMsg); setGroupError(errorMsg);
      toast({ title: "Error", description: "Failed to load organization data.", variant: "destructive" });
    } finally {
      setIsLoadingCategories(false); setIsLoadingTags(false); setIsLoadingGroups(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    
    const handleStorageChange = (event: StorageEvent) => {
        if (event.type === 'storage') {
            const isLikelyOurCustomEvent = event.key === null;
            const relevantKeysForThisPage = ['userCategories', 'userTags', 'userGroups'];
            const isRelevantExternalChange = typeof event.key === 'string' && relevantKeysForThisPage.some(k => event.key!.includes(k));

            if (isLikelyOurCustomEvent || isRelevantExternalChange) {
                console.log(`Storage change for organization page (key: ${event.key || 'custom'}), refetching data...`);
                fetchData();
            }
        }
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', handleStorageChange);
    
    return () => { 
        if (typeof window !== 'undefined') window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchData]);


  // Category Handlers
  const handleAddCategory = async (categoryName: string, icon?: string) => {
    setIsLoadingCategories(true);
    try {
      await addCategory(categoryName, icon);
      // await fetchData(); // Removed direct call, rely on storage event
      setIsAddCategoryDialogOpen(false);
      toast({ title: "Success", description: `Category "${categoryName}" added.` });
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      console.error("Failed to add category:", err);
      toast({ title: "Error Adding Category", description: err.message || "Could not add category.", variant: "destructive" });
    } finally { setIsLoadingCategories(false); }
  };
  const handleUpdateCategory = async (categoryId: string, newName: string, newIcon?: string) => {
    setIsLoadingCategories(true);
    try {
      await updateCategory(categoryId, newName, newIcon);
      // await fetchData(); 
      setIsEditCategoryDialogOpen(false); setSelectedCategory(null);
      toast({ title: "Success", description: `Category updated to "${newName}".` });
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      console.error("Failed to update category:", err);
      toast({ title: "Error Updating Category", description: err.message || "Could not update category.", variant: "destructive" });
    } finally { setIsLoadingCategories(false); }
  };
  const handleDeleteCategoryConfirm = async () => {
    if (!selectedCategory) return; setIsDeletingCategory(true);
    try {
      await deleteCategory(selectedCategory.id);
      // await fetchData(); 
      toast({ title: "Category Deleted", description: `Category "${selectedCategory.name}" removed.` });
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      console.error("Failed to delete category:", err);
      toast({ title: "Error Deleting Category", description: err.message || "Could not delete category.", variant: "destructive" });
    } finally { setIsDeletingCategory(false); setSelectedCategory(null); }
  };
  const openEditCategoryDialog = (category: Category) => { setSelectedCategory(category); setIsEditCategoryDialogOpen(true); };
  const openDeleteCategoryDialog = (category: Category) => { setSelectedCategory(category); };

  // Tag Handlers
  const handleAddTag = async (tagName: string) => {
    setIsLoadingTags(true);
    try {
      await addTag(tagName);
      // await fetchData(); 
      setIsAddTagDialogOpen(false);
      toast({ title: "Success", description: `Tag "${tagName}" added.` });
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      console.error("Failed to add tag:", err);
      toast({ title: "Error Adding Tag", description: err.message || "Could not add tag.", variant: "destructive" });
    } finally { setIsLoadingTags(false); }
  };
  const handleUpdateTag = async (tagId: string, newName: string) => {
    setIsLoadingTags(true);
    try {
      await updateTag(tagId, newName);
      // await fetchData(); 
      setIsEditTagDialogOpen(false); setSelectedTag(null);
      toast({ title: "Success", description: `Tag updated to "${newName}".` });
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      console.error("Failed to update tag:", err);
      toast({ title: "Error Updating Tag", description: err.message || "Could not update tag.", variant: "destructive" });
    } finally { setIsLoadingTags(false); }
  };
  const handleDeleteTagConfirm = async () => {
    if (!selectedTag) return; setIsDeletingTag(true);
    try {
      await deleteTag(selectedTag.id);
      // await fetchData(); 
      toast({ title: "Tag Deleted", description: `Tag "${selectedTag.name}" removed.` });
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      console.error("Failed to delete tag:", err);
      toast({ title: "Error Deleting Tag", description: err.message || "Could not delete tag.", variant: "destructive" });
    } finally { setIsDeletingTag(false); setSelectedTag(null); }
  };
  const openEditTagDialog = (tag: Tag) => { setSelectedTag(tag); setIsEditTagDialogOpen(true); };
  const openDeleteTagDialog = (tag: Tag) => { setSelectedTag(tag); };

  // Group Handlers
  const handleAddGroup = async (groupName: string) => {
    setIsLoadingGroups(true);
    try {
      await addGroup(groupName);
      // await fetchData(); 
      setIsAddGroupDialogOpen(false);
      toast({ title: "Success", description: `Group "${groupName}" added.` });
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      console.error("Failed to add group:", err);
      toast({ title: "Error Adding Group", description: err.message || "Could not add group.", variant: "destructive" });
    } finally { setIsLoadingGroups(false); }
  };

  const handleUpdateGroup = async (groupId: string, newName: string) => {
    setIsLoadingGroups(true);
    const groupToUpdate = groups.find(g => g.id === groupId);
    if (!groupToUpdate) {
        toast({ title: "Error", description: "Group not found for update.", variant: "destructive" });
        setIsLoadingGroups(false);
        return;
    }
    try {
        await updateGroup({ ...groupToUpdate, name: newName }); 
        // await fetchData();
        setIsEditGroupDialogOpen(false);
        setSelectedGroupForEdit(null);
        toast({ title: "Success", description: `Group name updated to "${newName}".` });
        window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
        console.error("Failed to update group name:", err);
        toast({ title: "Error Updating Group Name", description: err.message || "Could not update group name.", variant: "destructive" });
    } finally {
        setIsLoadingGroups(false);
    }
  };

  const openEditGroupDialog = (group: Group) => {
    setSelectedGroupForEdit(group);
    setIsEditGroupDialogOpen(true);
  };


  const handleSaveGroupCategories = async (groupId: string, selectedCategoryIds: string[]) => {
    setIsLoadingGroups(true);
    try {
      const groupToUpdate = groups.find(g => g.id === groupId);
      if (groupToUpdate) {
        await updateGroup({ ...groupToUpdate, categoryIds: selectedCategoryIds });
        // await fetchData();
        setIsManageGroupCategoriesDialogOpen(false);
        setSelectedGroupForCategoryManagement(null);
        toast({ title: "Success", description: "Categories in group updated." });
        window.dispatchEvent(new Event('storage'));
      }
    } catch (err: any) {
      console.error("Failed to update group categories:", err);
      toast({ title: "Error Updating Group", description: err.message || "Could not update group categories.", variant: "destructive" });
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const openManageGroupCategoriesDialog = (group: Group) => {
    setSelectedGroupForCategoryManagement(group);
    setIsManageGroupCategoriesDialogOpen(true);
  };
  
  const handleDeleteGroupConfirm = async () => {
    if (!selectedGroupForDeletion) return;
    setIsDeletingGroup(true);
    try {
      await deleteGroup(selectedGroupForDeletion.id);
      // await fetchData(); 
      toast({ title: "Group Deleted", description: `Group "${selectedGroupForDeletion.name}" removed.` });
      window.dispatchEvent(new Event('storage'));
    } catch (err:any) {
      console.error("Failed to delete group:", err);
      toast({ title: "Error Deleting Group", description: err.message || "Could not delete group.", variant: "destructive" });
    } finally {
      setIsDeletingGroup(false);
      setSelectedGroupForDeletion(null);
    }
  };

  const openDeleteGroupDialog = (group: Group) => {
    setSelectedGroupForDeletion(group);
  };


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Organization</h1>

      {/* Groups Section */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Transaction Groups</CardTitle>
            <Dialog open={isAddGroupDialogOpen} onOpenChange={setIsAddGroupDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <FolderPlus className="mr-2 h-4 w-4" /> Add New Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Group</DialogTitle>
                  <DialogDescription>Enter a unique name for the new group.</DialogDescription>
                </DialogHeader>
                <AddGroupForm onGroupAdded={handleAddGroup} isLoading={isLoadingGroups} />
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>Create and manage groups for budgeting or reporting purposes. Link categories to groups.</CardDescription>
        </CardHeader>
        <CardContent>
          {groupError && <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">{groupError}</div>}
          {isLoadingGroups && groups.length === 0 ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : groups.length > 0 ? (
            <Accordion type="multiple" className="w-full">
              {groups.map((group) => (
                <AccordionItem value={group.id} key={group.id}>
                  <AccordionTrigger>
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{group.name}</span>
                      <div className="flex items-center gap-1">
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 flex items-center gap-1 text-primary hover:text-primary/80" onClick={(e) => e.stopPropagation()}>
                             <Link href={`/groups/${group.id}`} passHref legacyBehavior>
                                <a><Eye className="h-4 w-4" /><span>View Details</span></a>
                             </Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); openEditGroupDialog(group); }}>
                           <Edit3 className="mr-1 h-4 w-4" /> Edit Name
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); openManageGroupCategoriesDialog(group); }}>
                          <Settings2 className="mr-1 h-4 w-4" /> Manage Categories
                        </Button>
                        <AlertDialog
                          open={selectedGroupForDeletion?.id === group.id}
                          onOpenChange={(isOpen) => {
                            if (!isOpen) setSelectedGroupForDeletion(null);
                          }}
                        >
                          <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); openDeleteGroupDialog(group);}}>
                                <Trash2 className="h-4 w-4" /><span className="sr-only">Delete Group</span>
                             </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the group "{selectedGroupForDeletion?.name}". Categories within it will not be deleted but unlinked.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel onClick={() => setSelectedGroupForDeletion(null)} disabled={isDeletingGroup}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteGroupConfirm} disabled={isDeletingGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeletingGroup ? "Deleting..." : "Delete Group"}</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-4 pt-2 pb-2 text-sm text-muted-foreground">
                      {group.categoryIds && group.categoryIds.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {group.categoryIds.map(catId => {
                            const category = categories.find(c => c.id === catId);
                            if (!category) return null;
                            const { icon: CategoryIcon, color } = getCategoryStyle(category);
                            return (
                              <Badge key={catId} variant="outline" className={`flex items-center gap-1 ${color} border`}>
                                <CategoryIcon /> <span className="capitalize">{category.name}</span>
                              </Badge>
                            );
                          })}
                        </div>
                      ) : (
                        "No categories linked to this group yet."
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-10"><p className="text-muted-foreground">No groups created yet.</p></div>
          )}
        </CardContent>
      </Card>
      {selectedGroupForCategoryManagement && (
        <ManageGroupCategoriesDialog
          group={selectedGroupForCategoryManagement}
          allCategories={categories}
          isOpen={isManageGroupCategoriesDialogOpen}
          onOpenChange={(open) => {
            setIsManageGroupCategoriesDialogOpen(open);
            if (!open) setSelectedGroupForCategoryManagement(null);
          }}
          onSave={handleSaveGroupCategories}
          isLoading={isLoadingGroups}
        />
      )}

      <Dialog open={isEditGroupDialogOpen} onOpenChange={(open) => { setIsEditGroupDialogOpen(open); if (!open) setSelectedGroupForEdit(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group Name</DialogTitle>
            <DialogDescription>Change the name of your group.</DialogDescription>
          </DialogHeader>
          {selectedGroupForEdit && (
            <EditGroupForm
              group={selectedGroupForEdit}
              onGroupUpdated={handleUpdateGroup}
              isLoading={isLoadingGroups}
            />
          )}
        </DialogContent>
      </Dialog>


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
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Category</DialogTitle>
                  <DialogDescription>Enter a unique name and optionally an icon (emoji) for the new category.</DialogDescription>
                </DialogHeader>
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
            <div className="flex flex-wrap gap-3">
              {categories.map((category) => {
                const { icon: CategoryIcon, color } = getCategoryStyle(category);
                return (
                  <Link key={category.id} href={`/categories/${category.id}`} passHref legacyBehavior>
                    <a className={cn("group relative", buttonVariants({variant: "outline"}), `w-full sm:w-auto justify-between py-2 px-3 text-sm ${color} border items-center cursor-pointer hover:bg-muted/80`)}>
                       <div className="flex items-center gap-1 overflow-hidden mr-8">
                         <CategoryIcon className="h-4 w-4" /> <span className="capitalize truncate">{category.name}</span>
                       </div>
                       <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={(e) => {e.preventDefault(); e.stopPropagation(); openEditCategoryDialog(category);}}><span><Edit className="h-4 w-4" /><span className="sr-only">Edit</span></span></Button>
                          <AlertDialog
                            open={selectedCategory?.id === category.id && !isEditCategoryDialogOpen && !isDeletingCategory}
                            onOpenChange={(isOpen) => {
                                if (!isOpen) setSelectedCategory(null);
                            }}
                          >
                              <AlertDialogTrigger asChild>
                                  <Button asChild variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => {e.preventDefault(); e.stopPropagation(); openDeleteCategoryDialog(category);}}>
                                      <span><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></span>
                                  </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will permanently delete "{selectedCategory?.name}".</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel onClick={() => setSelectedCategory(null)} disabled={isDeletingCategory}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteCategoryConfirm} disabled={isDeletingCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeletingCategory ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                          </AlertDialog>
                       </div>
                     </a>
                   </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10"><p className="text-muted-foreground">No categories found.</p></div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Tags</CardTitle>
            <Dialog open={isAddTagDialogOpen} onOpenChange={setIsAddTagDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <TagIconLucide className="mr-2 h-4 w-4" /> Add New Tag
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Tag</DialogTitle>
                  <DialogDescription>Enter a unique name for the new tag.</DialogDescription>
                </DialogHeader>
                <AddTagForm onTagAdded={handleAddTag} isLoading={isLoadingTags} />
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>View, add, edit, or delete your transaction tags.</CardDescription>
        </CardHeader>
        <CardContent>
          {tagError && <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">{tagError}</div>}
          {isLoadingTags && tags.length === 0 ? (
            <div className="flex flex-wrap gap-3">
              {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
            </div>
          ) : tags.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => {
                const { icon: TagIconStyledComponent, color } = getTagStyle(tag.name);
                return (
                  <Link key={tag.id} href={`/tags/${tag.id}`} passHref legacyBehavior>
                    <a className={cn("group relative", buttonVariants({variant: "outline"}), `justify-between py-1 px-2.5 text-sm ${color} border items-center cursor-pointer hover:bg-muted/80`)}>
                      <div className="flex items-center gap-1 overflow-hidden mr-8">
                        <TagIconStyledComponent /> <span className="truncate">{tag.name}</span>
                      </div>
                      <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center gap-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <Button asChild variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={(e) => {e.preventDefault(); e.stopPropagation(); openEditTagDialog(tag);}}><span><Edit className="h-3.5 w-3.5" /><span className="sr-only">Edit</span></span></Button>
                        <AlertDialog
                            open={selectedTag?.id === tag.id && !isEditTagDialogOpen && !isDeletingTag}
                            onOpenChange={(isOpen) => {
                                if (!isOpen) setSelectedTag(null);
                            }}
                        >
                            <AlertDialogTrigger asChild>
                                <Button asChild variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={(e) => {e.preventDefault(); e.stopPropagation(); openDeleteTagDialog(tag);}}>
                                    <span><Trash2 className="h-3.5 w-3.5" /><span className="sr-only">Delete</span></span>
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the tag "{selectedTag?.name}".</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel onClick={() => setSelectedTag(null)} disabled={isDeletingTag}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteTagConfirm} disabled={isDeletingTag} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeletingTag ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </a>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10"><p className="text-muted-foreground">No tags found.</p></div>
          )}
        </CardContent>
      </Card>

        <Dialog open={isEditCategoryDialogOpen} onOpenChange={(open) => { setIsEditCategoryDialogOpen(open); if (!open) setSelectedCategory(null); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Category</DialogTitle>
                    <DialogDescription>Modify the name and icon (emoji) of your category.</DialogDescription>
                </DialogHeader>
                {selectedCategory && (
                    <EditCategoryForm 
                        category={selectedCategory} 
                        onCategoryUpdated={handleUpdateCategory} 
                        isLoading={isLoadingCategories} 
                    />
                )}
            </DialogContent>
        </Dialog>

        <Dialog open={isEditTagDialogOpen} onOpenChange={(open) => { setIsEditTagDialogOpen(open); if (!open) setSelectedTag(null); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Tag</DialogTitle>
                    <DialogDescription>Modify the name of your tag.</DialogDescription>
                </DialogHeader>
                {selectedTag && (
                    <EditTagForm 
                        tag={selectedTag} 
                        onTagUpdated={handleUpdateTag} 
                        isLoading={isLoadingTags} 
                    />
                )}
            </DialogContent>
        </Dialog>
    </div>
  );
}
