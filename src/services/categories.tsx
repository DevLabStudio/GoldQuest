'use client';

import React from 'react';
import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove } from 'firebase/database';
import type { User } from 'firebase/auth';

export interface Category {
  id: string;
  name: string;
}

// --- Category Styling (Keep this mapping static) ---
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
  transfer: { icon: () => <ArrowLeftRight className="mr-1 h-4 w-4" />, color: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-700/30 dark:text-slate-300 dark:border-slate-600' }, // Added Transfer
};
import { ArrowLeftRight } from 'lucide-react'; // Import icon for Transfer

export const getCategoryStyle = (categoryName: string | undefined | null) => {
    const lowerCategory = categoryName?.toLowerCase() || 'uncategorized';
    return categoryStyles[lowerCategory] || categoryStyles.default;
};

const defaultCategoriesFirebase: Omit<Category, 'id'>[] = Object.keys(categoryStyles)
    .filter(name => name !== 'default' && name !== 'uncategorized') // Exclude 'uncategorized' from defaults
    .map(name => ({ name }));


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
      }));
    } else {
      // Initialize with default categories if none exist for the user
      console.log("No categories found for user, initializing with defaults...");
      const initialCategories: { [key: string]: Omit<Category, 'id'> } = {};
      const createdCategories: Category[] = [];

      for (const catData of defaultCategoriesFirebase) {
        const newCatRef = push(categoriesRef); // Generate unique ID
        if (newCatRef.key) {
          initialCategories[newCatRef.key] = catData;
          createdCategories.push({ id: newCatRef.key, ...catData });
        }
      }
      if (Object.keys(initialCategories).length > 0) {
        await set(categoriesRef, initialCategories);
      }
      return createdCategories;
    }
  } catch (error) {
    console.error("Error fetching categories from Firebase:", error);
    throw error;
  }
}

export async function addCategory(categoryName: string): Promise<Category> {
  const currentUser = auth.currentUser;
  const categoriesRefPath = getCategoriesRefPath(currentUser);
  const categoriesRef = ref(database, categoriesRefPath);

  if (!categoryName || typeof categoryName !== 'string' || categoryName.trim().length === 0) {
    throw new Error("Category name cannot be empty.");
  }
  const normalizedName = categoryName.trim();

  // Check for duplicates (case-insensitive) - Firebase queries would be better for larger scale
  const currentCategories = await getCategories();
  const existingCategory = currentCategories.find(cat => cat.name.toLowerCase() === normalizedName.toLowerCase());
  if (existingCategory) {
     console.log(`Category "${normalizedName}" already exists. Returning existing.`);
     return existingCategory;
  }

  const newCategoryRef = push(categoriesRef);
  if (!newCategoryRef.key) {
    throw new Error("Failed to generate a new category ID.");
  }
  const newCategoryData: Omit<Category, 'id'> = { name: normalizedName };

  try {
    await set(newCategoryRef, newCategoryData);
    return { id: newCategoryRef.key, ...newCategoryData };
  } catch (error) {
    console.error("Error adding category to Firebase:", error);
    throw error;
  }
}

export async function updateCategory(categoryId: string, newName: string): Promise<Category> {
  const currentUser = auth.currentUser;
  const categoryRefPath = getSingleCategoryRefPath(currentUser, categoryId);
  const categoryRef = ref(database, categoryRefPath);

  if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
    throw new Error("New category name cannot be empty.");
  }
  const normalizedNewName = newName.trim();

  // Check for name collision
  const currentCategories = await getCategories();
  if (currentCategories.some(cat => cat.id !== categoryId && cat.name.toLowerCase() === normalizedNewName.toLowerCase())) {
      throw new Error(`Another category named "${normalizedNewName}" already exists.`);
  }

  const updatedCategoryData: Omit<Category, 'id'> = { name: normalizedNewName };
  try {
    await set(categoryRef, updatedCategoryData); // Overwrites the data at this specific category ID
    return { id: categoryId, ...updatedCategoryData };
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