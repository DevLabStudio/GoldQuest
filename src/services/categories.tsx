'use client';

import React from 'react';
import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove } from 'firebase/database';
import type { User } from 'firebase/auth';
import { ArrowLeftRight, Tag as TagIcon, ShoppingCart, Home, Lightbulb, Car, Utensils, Briefcase, TrendingUp, HelpCircle, Settings } from 'lucide-react'; // Added more icons

export interface Category {
  id: string;
  name: string;
  icon?: string; // Optional: User-defined icon (e.g., emoji or Lucide icon name)
}

// --- Category Styling (Keep this mapping static or as fallback) ---
export const categoryStyles: { [key: string]: { icon: React.ElementType, color: string } } = {
  groceries: { icon: ShoppingCart, color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' },
  rent: { icon: Home, color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' },
  utilities: { icon: Lightbulb, color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700' },
  transportation: { icon: Car, color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700' },
  food: { icon: Utensils, color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' },
  income: { icon: Briefcase, color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700' }, // Changed icon from 💰
  salary: { icon: Briefcase, color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700' },
  investment: { icon: TrendingUp, color: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700' },
  default: { icon: HelpCircle, color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700/30 dark:text-gray-300 dark:border-gray-600' },
  uncategorized: { icon: TagIcon, color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700/30 dark:text-gray-300 dark:border-gray-600' },
  transfer: { icon: ArrowLeftRight, color: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-700/30 dark:text-slate-300 dark:border-slate-600' },
  'opening balance': { icon: Settings, color: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700' },
};


export const getCategoryStyle = (categoryNameOrObject: string | Category | undefined | null) => {
    let categoryName: string;
    let categoryIconString: string | undefined;

    if (typeof categoryNameOrObject === 'string' || categoryNameOrObject === null || categoryNameOrObject === undefined) {
        categoryName = categoryNameOrObject || 'uncategorized';
    } else {
        categoryName = categoryNameOrObject.name || 'uncategorized';
        categoryIconString = categoryNameOrObject.icon;
    }

    const lowerCategory = categoryName.toLowerCase();
    const baseStyle = categoryStyles[lowerCategory] || categoryStyles.default;

    if (categoryIconString) { // User-defined icon (emoji) takes precedence
        // For Lucide icons, we'd need a map string to component, for emojis just render
        const isEmoji = /\p{Emoji}/u.test(categoryIconString);
        if (isEmoji) {
            return {
                icon: () => <span className="mr-1 text-base">{categoryIconString}</span>, // Ensure emojis are visible
                color: baseStyle.color,
            };
        }
        // Potentially handle Lucide icon names here if stored as string
        // For now, if not emoji, and it's user-defined, let's assume it's an emoji or simple char
         return {
            icon: () => <span className="mr-1 text-base">{categoryIconString}</span>,
            color: baseStyle.color,
        };
    }
    return baseStyle;
};


const defaultCategoriesFirebase: Omit<Category, 'id'>[] = Object.entries(categoryStyles)
    .filter(([name]) => name !== 'default' && name !== 'uncategorized')
    .map(([name, style]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize default names
        // Default icons can be derived from the style map or left undefined initially
        // icon: (we can decide later if default Lucide names should be stored here)
    }));


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
      console.log("No categories found for user, initializing with defaults...");
      const initialCategories: { [key: string]: Omit<Category, 'id'> } = {};
      const createdCategories: Category[] = [];

      for (const catData of defaultCategoriesFirebase) {
        const newCatRef = push(categoriesRef);
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

export async function addCategory(categoryName: string, icon?: string): Promise<Category> {
  const currentUser = auth.currentUser;
  const categoriesRefPath = getCategoriesRefPath(currentUser);
  const categoriesRef = ref(database, categoriesRefPath);

  if (!categoryName || typeof categoryName !== 'string' || categoryName.trim().length === 0) {
    throw new Error("Category name cannot be empty.");
  }
  const normalizedName = categoryName.trim();

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
  if (icon && icon.trim() !== '') {
    newCategoryData.icon = icon.trim();
  }


  try {
    await set(newCategoryRef, newCategoryData);
    return { id: newCategoryRef.key, ...newCategoryData };
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

  const currentCategories = await getCategories();
  if (currentCategories.some(cat => cat.id !== categoryId && cat.name.toLowerCase() === normalizedNewName.toLowerCase())) {
      throw new Error(`Another category named "${normalizedNewName}" already exists.`);
  }

  const updatedCategoryData: Omit<Category, 'id'> = { name: normalizedNewName };
  if (newIcon && newIcon.trim() !== '') {
    updatedCategoryData.icon = newIcon.trim();
  } else if (newIcon === '') { // If empty string is passed, explicitly remove the icon
    // For Firebase, to remove a field, you can set it to null or update only specific fields.
    // Here, we'll construct the object to ensure 'icon' is not present if newIcon is empty.
    // Or, more simply, just don't include icon in updatedCategoryData if newIcon is empty.
    // The approach below sets icon to undefined which will remove it if it exists
    // but this behavior might depend on firebase SDK version.
    // A safer way is to fetch the existing category, modify, then set.
    // However, for simplicity, if newIcon is empty, we don't add it to updatedCategoryData.
    // If you want to explicitly delete an icon field, a specific update({icon: null}) might be needed.
  }


  try {
    // To explicitly remove the icon field if newIcon is an empty string
    const updates: Partial<Category> = { name: normalizedNewName };
    if (newIcon !== undefined) { // Allow setting empty string to clear, or a new icon
        updates.icon = newIcon.trim() === '' ? undefined : newIcon.trim(); // Store undefined to remove from Firebase
    }
    await set(categoryRef, updates); // Using set will replace the node; use update for partial updates

    // Or, for more precise control, fetch and then set:
    // const snapshot = await get(categoryRef);
    // if (snapshot.exists()) {
    //   const existingData = snapshot.val();
    //   const dataToSave: Omit<Category, 'id'> = { ...existingData, name: normalizedNewName };
    //   if (newIcon !== undefined) {
    //     dataToSave.icon = newIcon.trim() === '' ? undefined : newIcon.trim();
    //   }
    //   await set(categoryRef, dataToSave);
    //   return { id: categoryId, ...dataToSave };
    // } else {
    //   throw new Error("Category not found for update.");
    // }
    return { id: categoryId, name: normalizedNewName, icon: updates.icon };

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
