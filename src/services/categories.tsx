'use client';

import React from 'react';
import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove, update } from 'firebase/database';
import type { User } from 'firebase/auth';
import { HelpCircle } from 'lucide-react';

export interface Category {
  id: string;
  name: string;
  icon?: string; // User-defined icon (emoji or short string)
}

// This maps known category names (lowercase) to styles.
// It's used if no user-defined icon is present for a category.
// Colors are Tailwind classes.
const predefinedCategoryStyles: { [key: string]: { icon: React.ElementType, color: string } } = {
  groceries: { icon: () => <span className="mr-1">🛒</span>, color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' },
  rent: { icon: () => <span className="mr-1">🏠</span>, color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' },
  utilities: { icon: () => <span className="mr-1">💡</span>, color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700' },
  transportation: { icon: () => <span className="mr-1">🚗</span>, color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700' },
  food: { icon: () => <span className="mr-1">🍔</span>, color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' },
  entertainment: { icon: () => <span className="mr-1">🎬</span>, color: 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-700' },
  health: { icon: () => <span className="mr-1">❤️</span>, color: 'bg-red-200 text-red-900 border-red-400 dark:bg-red-800/30 dark:text-red-400 dark:border-red-600' },
  education: { icon: () => <span className="mr-1">📚</span>, color: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700' },
  shopping: { icon: () => <span className="mr-1">🛍️</span>, color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700' },
  salary: { icon: () => <span className="mr-1">💰</span>, color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700'},
  investment: { icon: () => <span className="mr-1">📈</span>, color: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700'},
  transfer: { icon: () => <span className="mr-1">🔄</span>, color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700/30 dark:text-gray-300 dark:border-gray-600'},
  'opening balance': { icon: () => <span className="mr-1">🏦</span>, color: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-700/30 dark:text-slate-300 dark:border-slate-600'},
  uncategorized: { icon: HelpCircle, color: 'bg-stone-100 text-stone-800 border-stone-300 dark:bg-stone-700/30 dark:text-stone-300 dark:border-stone-600' },
  // Add more predefined categories as needed
};


export const getCategoryStyle = (category: Category | string | undefined | null): { icon: React.ElementType, color: string } => {
  const categoryName = typeof category === 'string' ? category : category?.name;
  const categoryIconProp = typeof category === 'object' && category?.icon ? category.icon : undefined;

  if (categoryIconProp && categoryIconProp.trim() !== "") {
    // User-defined icon (emoji or short text)
    const IconComponent = () => <span className="mr-1">{categoryIconProp}</span>;
    const style = predefinedCategoryStyles[categoryName?.toLowerCase() || 'uncategorized'] || predefinedCategoryStyles.uncategorized;
    return { icon: IconComponent, color: style.color };
  }

  const normalizedName = categoryName?.toLowerCase() || 'uncategorized';
  return predefinedCategoryStyles[normalizedName] || predefinedCategoryStyles.uncategorized;
};


const defaultCategoriesFirebase: Omit<Category, 'id'>[] = [
    { name: 'Groceries', icon: '🛒' },
    { name: 'Rent', icon: '🏠' },
    { name: 'Utilities', icon: '💡' },
    { name: 'Transportation', icon: '🚗' },
    { name: 'Food', icon: '🍔' },
    { name: 'Entertainment', icon: '🎬' },
    { name: 'Salary', icon: '💰' },
    { name: 'Investment', icon: '📈' },
    { name: 'Transfer', icon: '🔄' },
    { name: 'Opening Balance', icon: '🏦'},
    { name: 'Uncategorized', icon: '❓' }
];


function getCategoriesRefPath(currentUser: User | null) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access categories.");
  return `users/${currentUser.uid}/categories`;
}

function getSingleCategoryRefPath(currentUser: User | null, categoryId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access category.");
  return `users/${currentUser.uid}/categories/${categoryId}`;
}


export async function getCategories(): Promise<Category[]> {
  const currentUser = auth.currentUser;
  const categoriesRefPath = getCategoriesRefPath(currentUser);
  const categoriesRef = ref(database, categoriesRefPath);

  try {
    const snapshot = await get(categoriesRef);
    if (snapshot.exists()) {
      const categoriesData = snapshot.val();
      return Object.entries(categoriesData).map(([id, data]) => ({
        id,
        ...(data as Omit<Category, 'id'>),
      })).sort((a,b) => a.name.localeCompare(b.name));
    } else {
      // Initialize with default categories if none exist for the user
      console.log("No categories found for user, initializing with defaults...");
      const initialCategories: { [key: string]: Omit<Category, 'id'> } = {};
      const createdCategories: Category[] = [];

      for (const catData of defaultCategoriesFirebase) {
        const newCategoryRef = push(categoriesRef); // Create a new ref for each default category
        if (newCategoryRef.key) {
          initialCategories[newCategoryRef.key] = catData; // Use the new key
          createdCategories.push({ id: newCategoryRef.key, ...catData });
        }
      }
      if (Object.keys(initialCategories).length > 0) {
         await set(categoriesRef, initialCategories); // Set the whole object of default categories
      }
      return createdCategories.sort((a,b) => a.name.localeCompare(b.name));
    }
  } catch (error) {
    console.error("Error fetching categories from Firebase:", error);
    throw error;
  }
}

export async function addCategory(categoryName: string, icon?: string): Promise<Category> {
  const currentUser = auth.currentUser;
  const categoriesRefPath = getCategoriesRefPath(currentUser);
  const categoriesRef = ref(database, categoriesRefPath);

  if (!categoryName || typeof categoryName !== 'string' || categoryName.trim().length === 0) {
      throw new Error("Category name cannot be empty.");
  }
  const normalizedName = categoryName.trim();

  // Check if category already exists (case-insensitive)
  const currentCategories = await getCategories();
  const existingCategory = currentCategories.find(cat => cat.name.toLowerCase() === normalizedName.toLowerCase());
  if (existingCategory) {
      console.log(`Category "${normalizedName}" already exists. Returning existing.`);
      return existingCategory;
  }

  const newCategoryRef = push(categoriesRef); // Generates a unique ID
  if (!newCategoryRef.key) {
    throw new Error("Failed to generate a new category ID.");
  }

  const dataToSave: { name: string; icon?: string } = { name: normalizedName };
  if (icon && icon.trim()) {
    dataToSave.icon = icon.trim();
  }

  try {
    await set(newCategoryRef, dataToSave);
    return { id: newCategoryRef.key, name: normalizedName, icon: dataToSave.icon };
  } catch (error) {
    console.error("Error adding category to Firebase:", error);
    throw error;
  }
}

export async function updateCategory(categoryId: string, newName: string, newIcon?: string): Promise<Category> {
  const currentUser = auth.currentUser;
  const categoryRefPath = getSingleCategoryRefPath(currentUser, categoryId);
  const categoryRef = ref(database, categoryRefPath);

  if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
      throw new Error("New category name cannot be empty.");
  }
  const normalizedNewName = newName.trim();

  // Check for name collision (case-insensitive, excluding the current category being updated)
  const currentCategories = await getCategories();
  if (currentCategories.some(cat => cat.id !== categoryId && cat.name.toLowerCase() === normalizedNewName.toLowerCase())) {
      throw new Error(`Another category named "${normalizedNewName}" already exists.`);
  }

  const updates: { name: string; icon?: string | null } = { name: normalizedNewName };

  if (newIcon !== undefined) { // If newIcon was explicitly passed (even as empty string)
    if (newIcon && newIcon.trim() !== "") {
      updates.icon = newIcon.trim(); // Set to new icon value
    } else {
      updates.icon = null; // Set to null to remove the icon field in Firebase (or if empty string means remove)
    }
  }
  // If newIcon is undefined (not passed), the 'icon' property is not added to 'updates',
  // so Firebase 'update' will not change the existing icon.

  try {
    await update(categoryRef, updates); // Use update for partial modifications
    // Fetch the updated category to ensure we return the full, correct object.
    const snapshot = await get(categoryRef);
    if (snapshot.exists()) {
        // Ensure returned object matches Category interface (icon might be null from DB if removed)
        const val = snapshot.val() as Omit<Category, 'id'|'icon'> & {icon?: string | null};
        return { id: categoryId, name: val.name, icon: val.icon || undefined };
    }
    throw new Error("Failed to fetch updated category after update.");
  } catch (error) {
    console.error("Error updating category in Firebase:", error);
    throw error;
  }
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const currentUser = auth.currentUser;
  const categoryRefPath = getSingleCategoryRefPath(currentUser, categoryId);
  const categoryRef = ref(database, categoryRefPath);
  try {
    await remove(categoryRef);
  } catch (error) {
    console.error("Error deleting category from Firebase:", error);
    throw error;
  }
}
