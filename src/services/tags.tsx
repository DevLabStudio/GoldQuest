
'use client'; // This module interacts with localStorage

import React from 'react'; // Import React for JSX types

// Simple tag type
export interface Tag {
  id: string; // Use ID for reliable updates/deletes
  name: string;
  // Future: color?: string; icon?: string;
}

const TAGS_STORAGE_KEY = 'userTags';

// --- Tag Styling (Simple Outline for now) ---
export const getTagStyle = (tagName: string | undefined | null) => {
  // Very basic styling, can be expanded with hashing or predefined colors
  return {
    color: 'border-blue-300 text-blue-800 bg-blue-50 dark:border-blue-600 dark:text-blue-300 dark:bg-blue-900/30',
    icon: () => <span className="mr-1">#</span>, // Simple hash icon
  };
};

// Default tags to initialize with (can be empty)
const defaultTags: Tag[] = [
    { id: 'tag-work', name: 'Work' },
    { id: 'tag-personal', name: 'Personal' },
    { id: 'tag-project-x', name: 'Project X' },
];

/**
 * Retrieves tags from localStorage. Initializes with defaults if none exist.
 * @returns A promise resolving to an array of Tag objects.
 */
export async function getTags(): Promise<Tag[]> {
  if (typeof window === 'undefined') {
    return [...defaultTags]; // Return default on server
  }
  await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async
  try {
    const stored = localStorage.getItem(TAGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
         // Ensure all items have id and name
         return parsed.filter(tag => tag && typeof tag.id === 'string' && typeof tag.name === 'string');
      }
    }
  } catch (error) {
    console.error("Failed to retrieve or parse tags:", error);
  }
  // If no stored data or error, set and return defaults
  localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(defaultTags));
  return [...defaultTags];
}

/**
 * Saves the entire list of tags to localStorage.
 * @param tags The array of tags to save.
 * @returns A promise that resolves when saving is complete.
 */
async function saveTags(tags: Tag[]): Promise<void> {
   if (typeof window === 'undefined') return;
   await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async
   try {
     localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags));
   } catch (error) {
     console.error("Failed to save tags:", error);
     throw error; // Re-throw to indicate failure
   }
}

/**
 * Adds a new tag. If tag name already exists (case-insensitive), returns the existing tag.
 * @param tagName The name of the tag to add.
 * @returns A promise resolving to the newly created or existing Tag object.
 */
export async function addTag(tagName: string): Promise<Tag> {
  if (!tagName || typeof tagName !== 'string' || tagName.trim().length === 0) {
      throw new Error("Tag name cannot be empty.");
  }
  const currentTags = await getTags();
  const normalizedName = tagName.trim();

  const existingTag = currentTags.find(tag => tag.name.toLowerCase() === normalizedName.toLowerCase());
  if (existingTag) {
     console.log(`Tag "${normalizedName}" already exists. Returning existing.`);
     return existingTag;
  }

  const newTag: Tag = {
    id: `tag-${normalizedName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    name: normalizedName,
  };

  const updatedTags = [...currentTags, newTag];
  await saveTags(updatedTags);
  return newTag;
}

/**
 * Updates an existing tag's name.
 * @param tagId The ID of the tag to update.
 * @param newName The new name for the tag.
 * @returns A promise resolving to the updated Tag object.
 */
export async function updateTag(tagId: string, newName: string): Promise<Tag> {
   if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
      throw new Error("New tag name cannot be empty.");
  }
  const currentTags = await getTags();
  const normalizedNewName = newName.trim();
  const index = currentTags.findIndex(tag => tag.id === tagId);

  if (index === -1) {
    throw new Error(`Tag with ID ${tagId} not found.`);
  }

  if (currentTags.some(tag => tag.id !== tagId && tag.name.toLowerCase() === normalizedNewName.toLowerCase())) {
      throw new Error(`Another tag named "${normalizedNewName}" already exists.`);
  }

  const updatedTag = { ...currentTags[index], name: normalizedNewName };
  currentTags[index] = updatedTag;

  await saveTags(currentTags);
  return updatedTag;
}

/**
 * Deletes a tag by its ID.
 * @param tagId The ID of the tag to delete.
 * @returns A promise resolving when deletion is complete.
 */
export async function deleteTag(tagId: string): Promise<void> {
  const currentTags = await getTags();
  const updatedTags = currentTags.filter(tag => tag.id !== tagId);

  if (updatedTags.length === currentTags.length) {
      console.warn(`Tag with ID ${tagId} not found for deletion.`);
  }

  await saveTags(updatedTags);
}
