
'use client';

import React from 'react';
import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove } from 'firebase/database';
import type { User } from 'firebase/auth';

export interface Tag {
  id: string;
  name: string;
}

export const getTagStyle = (tagName: string | undefined | null) => {
  return {
    color: 'border-blue-300 text-blue-800 bg-blue-50 dark:border-blue-600 dark:text-blue-300 dark:bg-blue-900/30',
    icon: () => <span className="mr-1">#</span>,
  };
};

const defaultTagsFirebase: Omit<Tag, 'id'>[] = [
    { name: 'Work' },
    { name: 'Personal' },
    { name: 'Project X' },
];

export function getTagsRefPath(currentUser: User | null) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access tags.");
  return `users/${currentUser.uid}/tags`;
}

export function getSingleTagRefPath(currentUser: User | null, tagId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access tag.");
  return `users/${currentUser.uid}/tags/${tagId}`;
}

export async function getTags(): Promise<Tag[]> {
  const currentUser = auth.currentUser;
  const tagsRefPath = getTagsRefPath(currentUser);
  const tagsRef = ref(database, tagsRefPath);

  try {
    const snapshot = await get(tagsRef);
    if (snapshot.exists()) {
      const tagsData = snapshot.val();
      return Object.entries(tagsData).map(([id, data]) => ({
        id,
        ...(data as Omit<Tag, 'id'>),
      }));
    } else {
      // Initialize with default tags if none exist
      console.log("No tags found for user, initializing with defaults...");
      const initialTags: { [key: string]: Omit<Tag, 'id'> } = {};
      const createdTags: Tag[] = [];
      for (const tagData of defaultTagsFirebase) {
        const newTagRef = push(tagsRef);
        if (newTagRef.key) {
          initialTags[newTagRef.key] = tagData;
          createdTags.push({ id: newTagRef.key, ...tagData });
        }
      }
      if (Object.keys(initialTags).length > 0) {
        await set(tagsRef, initialTags);
      }
      return createdTags;
    }
  } catch (error) {
    console.error("Error fetching tags from Firebase:", error);
    throw error;
  }
}

export async function addTag(tagName: string): Promise<Tag> {
  const currentUser = auth.currentUser;
  const tagsRefPath = getTagsRefPath(currentUser);
  const tagsRef = ref(database, tagsRefPath);

  if (!tagName || typeof tagName !== 'string' || tagName.trim().length === 0) {
      throw new Error("Tag name cannot be empty.");
  }
  const normalizedName = tagName.trim();

  const currentTags = await getTags();
  const existingTag = currentTags.find(tag => tag.name.toLowerCase() === normalizedName.toLowerCase());
  if (existingTag) {
     console.log(`Tag "${normalizedName}" already exists. Returning existing.`);
     return existingTag;
  }

  const newTagRef = push(tagsRef);
  if (!newTagRef.key) {
    throw new Error("Failed to generate a new tag ID.");
  }
  const newTagData: Omit<Tag, 'id'> = { name: normalizedName };

  try {
    await set(newTagRef, newTagData);
    return { id: newTagRef.key, ...newTagData };
  } catch (error) {
    console.error("Error adding tag to Firebase:", error);
    throw error;
  }
}

export async function updateTag(tagId: string, newName: string): Promise<Tag> {
  const currentUser = auth.currentUser;
  const tagRefPath = getSingleTagRefPath(currentUser, tagId);
  const tagRef = ref(database, tagRefPath);

  if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
      throw new Error("New tag name cannot be empty.");
  }
  const normalizedNewName = newName.trim();

  const currentTags = await getTags();
  if (currentTags.some(tag => tag.id !== tagId && tag.name.toLowerCase() === normalizedNewName.toLowerCase())) {
      throw new Error(`Another tag named "${normalizedNewName}" already exists.`);
  }

  const updatedTagData: Omit<Tag, 'id'> = { name: normalizedNewName };
  try {
    await set(tagRef, updatedTagData);
    return { id: tagId, ...updatedTagData };
  } catch (error) {
    console.error("Error updating tag in Firebase:", error);
    throw error;
  }
}

export async function deleteTag(tagId: string): Promise<void> {
  const currentUser = auth.currentUser;
  const tagRefPath = getSingleTagRefPath(currentUser, tagId);
  const tagRef = ref(database, tagRefPath);
  try {
    await remove(tagRef);
  } catch (error) {
    console.error("Error deleting tag from Firebase:", error);
    throw error;
  }
}
