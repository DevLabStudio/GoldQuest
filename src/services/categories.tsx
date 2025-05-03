
'use client'; // This module interacts with localStorage

import React from 'react'; // Import React for JSX types

// Simple category type for now
export interface Category {
  id: string; // Use ID for reliable updates/deletes
  name: string;
  // Future: icon?: string; color?: string;
}

const CATEGORIES_STORAGE_KEY = 'userCategories';

// --- Category Styling (Keep this mapping static for now for consistent display across app) ---
// This maps known category names (lowercase) to styles. It doesn't need to be stored in localStorage yet.
export const categoryStyles: { [key: string]: { icon: React.ElementType, color: string } } = {
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

// Function to get style based on category name
export const getCategoryStyle = (categoryName: string | undefined | null) => {
    const lowerCategory = categoryName?.toLowerCase() || 'uncategorized';
    return categoryStyles[lowerCategory] || categoryStyles.default;
}

// Default categories to initialize with
const defaultCategories: Category[] = Object.keys(categoryStyles)
    .filter(name => name !== 'default')
    .map(name => ({ id: `cat-${name}`, name }));

/**
 * Retrieves categories from localStorage. Initializes with defaults if none exist.
 * @returns A promise resolving to an array of Category objects.
 */
export async function getCategories(): Promise<Category[]> {
  if (typeof window === 'undefined') {
    return [...defaultCategories]; // Return default on server
  }
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async
  try {
    const stored = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (stored) {
      // Basic validation: ensure it's an array
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Ensure all items have id and name
         return parsed.filter(cat => cat && typeof cat.id === 'string' && typeof cat.name === 'string');
      }
    }
  } catch (error) {
    console.error("Failed to retrieve or parse categories:", error);
  }
  // If no stored data or error, set and return defaults
  localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(defaultCategories));
  return [...defaultCategories];
}

/**
 * Saves the entire list of categories to localStorage.
 * @param categories The array of categories to save.
 * @returns A promise that resolves when saving is complete.
 */
async function saveCategories(categories: Category[]): Promise<void> {
   if (typeof window === 'undefined') return;
   await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async
   try {
     localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
   } catch (error) {
     console.error("Failed to save categories:", error);
     throw error; // Re-throw to indicate failure
   }
}

/**
 * Adds a new category. If category name already exists (case-insensitive), returns the existing category.
 * @param categoryName The name of the category to add.
 * @returns A promise resolving to the newly created or existing Category object.
 */
export async function addCategory(categoryName: string): Promise<Category> {
  if (!categoryName || typeof categoryName !== 'string' || categoryName.trim().length === 0) {
      throw new Error("Category name cannot be empty.");
  }
  const currentCategories = await getCategories();
  const normalizedName = categoryName.trim();

  // Check for duplicates (case-insensitive)
  const existingCategory = currentCategories.find(cat => cat.name.toLowerCase() === normalizedName.toLowerCase());
  if (existingCategory) {
     console.log(`Category "${normalizedName}" already exists. Returning existing.`);
     return existingCategory; // Return the existing category if found
    // throw new Error(`Category "${normalizedName}" already exists.`);
  }

  const newCategory: Category = {
    // Generate a more robust ID maybe? For now, use name + timestamp
    id: `cat-${normalizedName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    name: normalizedName,
  };

  const updatedCategories = [...currentCategories, newCategory];
  await saveCategories(updatedCategories);
  return newCategory;
}

/**
 * Updates an existing category's name.
 * @param categoryId The ID of the category to update.
 * @param newName The new name for the category.
 * @returns A promise resolving to the updated Category object.
 */
export async function updateCategory(categoryId: string, newName: string): Promise<Category> {
   if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
      throw new Error("New category name cannot be empty.");
  }
  const currentCategories = await getCategories();
  const normalizedNewName = newName.trim();
  const index = currentCategories.findIndex(cat => cat.id === categoryId);

  if (index === -1) {
    throw new Error(`Category with ID ${categoryId} not found.`);
  }

  // Check if the new name causes a duplicate (excluding the category being edited)
  if (currentCategories.some(cat => cat.id !== categoryId && cat.name.toLowerCase() === normalizedNewName.toLowerCase())) {
      throw new Error(`Another category named "${normalizedNewName}" already exists.`);
  }

  const updatedCategory = { ...currentCategories[index], name: normalizedNewName };
  currentCategories[index] = updatedCategory;

  await saveCategories(currentCategories);
  return updatedCategory;
}

/**
 * Deletes a category by its ID.
 * @param categoryId The ID of the category to delete.
 * @returns A promise resolving when deletion is complete.
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  const currentCategories = await getCategories();
  const updatedCategories = currentCategories.filter(cat => cat.id !== categoryId);

  if (updatedCategories.length === currentCategories.length) {
      console.warn(`Category with ID ${categoryId} not found for deletion.`);
      // Optionally throw an error here if needed
      // throw new Error(`Category with ID ${categoryId} not found.`);
  }

  await saveCategories(updatedCategories);
}
