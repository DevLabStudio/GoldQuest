'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { getTags, addTag, updateTag, deleteTag, type Tag, getTagStyle } from "@/services/tags.tsx"; // Import tag service
import AddTagForm from '@/components/tags/add-tag-form'; // Import Add form (needs creation)
import EditTagForm from '@/components/tags/edit-tag-form'; // Import Edit form (needs creation)
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // State for delete confirmation
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null); // For edit/delete
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();


  useEffect(() => {
    let isMounted = true;
    const fetchTags = async () => {
        if(isMounted) setIsLoading(true);
        if(isMounted) setError(null);
        try {
            const fetchedTags = await getTags();
            fetchedTags.sort((a, b) => a.name.localeCompare(b.name));
            if(isMounted) setTags(fetchedTags);
        } catch (err) {
            console.error("Failed to fetch tags:", err);
            if(isMounted) setError("Could not load tags.");
            if(isMounted) toast({
                title: "Error",
                description: "Failed to load tags.",
                variant: "destructive",
            });
        } finally {
            if(isMounted) setIsLoading(false);
        }
    };

    fetchTags();

    const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && event.key === 'userTags' && isMounted) {
            console.log("Tag storage changed, refetching...");
            fetchTags();
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
  }, [toast]); // Added toast to dependency array

  const localFetchTags = async () => { // Local refetch function for handlers
    setIsLoading(true); setError(null);
    try {
        const fetched = await getTags();
        fetched.sort((a, b) => a.name.localeCompare(b.name));
        setTags(fetched);
    } catch(e) { console.error(e); setError("Could not reload tags."); toast({title: "Error", description: "Failed to reload tags.", variant: "destructive"});}
    finally { setIsLoading(false); }
  };

  // Add Tag Handler
  const handleAddTag = async (tagName: string) => {
    setIsLoading(true);
    try {
      await addTag(tagName);
      await localFetchTags(); // Refetch after adding
      setIsAddDialogOpen(false);
      toast({
        title: "Success",
        description: `Tag "${tagName}" added.`,
      });
    } catch (err: any) {
      console.error("Failed to add tag:", err);
      toast({
        title: "Error Adding Tag",
        description: err.message || "Could not add the tag.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Edit Tag Handler
   const handleUpdateTag = async (tagId: string, newName: string) => {
     setIsLoading(true);
     try {
       await updateTag(tagId, newName);
       await localFetchTags(); // Refetch after updating
       setIsEditDialogOpen(false);
       setSelectedTag(null);
       toast({
         title: "Success",
         description: `Tag updated to "${newName}".`,
       });
     } catch (err: any) {
       console.error("Failed to update tag:", err);
       toast({
         title: "Error Updating Tag",
         description: err.message || "Could not update the tag.",
         variant: "destructive",
       });
     } finally {
        setIsLoading(false);
     }
   };

   // Delete Tag Handler
   const handleDeleteTagConfirm = async () => {
       if (!selectedTag) return;
       setIsDeleting(true);
       try {
           await deleteTag(selectedTag.id);
           await localFetchTags(); // Refetch after deleting
           toast({
               title: "Tag Deleted",
               description: `Tag "${selectedTag.name}" removed.`,
           });
       } catch (err: any) {
           console.error("Failed to delete tag:", err);
           toast({
               title: "Error Deleting Tag",
               description: err.message || "Could not delete the tag.",
               variant: "destructive",
           });
       } finally {
           setIsDeleting(false);
           setSelectedTag(null);
       }
   };


  // Open Edit Dialog
  const openEditDialog = (tag: Tag) => {
    setSelectedTag(tag);
    setIsEditDialogOpen(true);
  };

   // Open Delete Confirmation Dialog
   const openDeleteDialog = (tag: Tag) => {
      setSelectedTag(tag);
      // The AlertDialog trigger will handle opening the dialog
   };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Tags</h1>
        {/* Add Tag Dialog Trigger */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
             <Button variant="default" size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Tag
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Tag</DialogTitle>
              <DialogDescription>
                Enter the name for your new tag.
              </DialogDescription>
            </DialogHeader>
             {/* Pass handler and loading state */}
             <AddTagForm onTagAdded={handleAddTag} isLoading={isLoading} />
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
          <CardTitle>Manage Tags</CardTitle>
          <CardDescription>
            View, add, edit, or delete your transaction tags.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && tags.length === 0 ? ( // Show skeleton only on initial load
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
               {[...Array(12)].map((_, i) => (
                   <Skeleton key={i} className="h-8 w-full rounded-full" />
               ))}
            </div>
          ) : tags.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => {
                const { icon: TagIcon, color } = getTagStyle(tag.name);
                return (
                  <div key={tag.id} className="group relative">
                     <Badge variant="outline" className={`justify-between py-1 px-2.5 text-sm ${color} border items-center`}>
                       <div className="flex items-center gap-1 overflow-hidden mr-8"> {/* Add margin-right */}
                         <TagIcon />
                         <span className="truncate">{tag.name}</span>
                       </div>
                       {/* Action buttons (Positioned absolutely on the right) */}
                       <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center gap-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => openEditDialog(tag)}>
                              <Edit className="h-3.5 w-3.5" />
                              <span className="sr-only">Edit</span>
                          </Button>
                           {/* Use AlertDialog for Delete Confirmation */}
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => openDeleteDialog(tag)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                               {/* Render content only if this specific tag is selected for deletion */}
                              {selectedTag?.id === tag.id && (
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This action cannot be undone. This will permanently delete the tag "{selectedTag.name}". Transactions using this tag will lose the association.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setSelectedTag(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteTagConfirm} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                No tags found.
              </p>
              {/* Button to open Add Dialog */}
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                 <DialogTrigger asChild>
                    <Button variant="link" className="mt-2 px-0 h-auto text-primary">
                         Add your first tag
                    </Button>
                  </DialogTrigger>
                 <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add New Tag</DialogTitle>
                      <DialogDescription>
                        Enter the name for your new tag.
                      </DialogDescription>
                    </DialogHeader>
                    <AddTagForm onTagAdded={handleAddTag} isLoading={isLoading} />
                 </DialogContent>
               </Dialog>
            </div>
          )}
        </CardContent>
        {/* Footer Add Button (visible if tags exist) */}
         {!isLoading && tags.length > 0 && (
            <CardContent className="pt-4 border-t flex justify-start">
                 <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                       <Button variant="default" size="sm">
                          <PlusCircle className="mr-2 h-4 w-4" /> Add New Tag
                       </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Add New Tag</DialogTitle>
                        <DialogDescription>
                          Enter the name for your new tag.
                        </DialogDescription>
                      </DialogHeader>
                       <AddTagForm onTagAdded={handleAddTag} isLoading={isLoading} />
                    </DialogContent>
                  </Dialog>
            </CardContent>
         )}
      </Card>

        {/* Edit Tag Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setSelectedTag(null); // Clear selection when closing
        }}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Tag</DialogTitle>
                    <DialogDescription>
                        Modify the name of the tag.
                    </DialogDescription>
                </DialogHeader>
                {selectedTag && (
                    <EditTagForm
                        tag={selectedTag}
                        onTagUpdated={handleUpdateTag}
                        isLoading={isLoading}
                    />
                )}
            </DialogContent>
        </Dialog>

    </div>
  );
}

