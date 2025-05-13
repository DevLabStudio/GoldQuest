
'use client';

import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove, update } from 'firebase/database';
import type { User } from 'firebase/auth';

export interface Group {
  id: string;
  name: string;
  categoryIds: string[]; // Array of category IDs belonging to this group
}

export type NewGroupData = Omit<Group, 'id' | 'categoryIds'> & { categoryIds?: string[] };

export function getGroupsRefPath(currentUser: User | null) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access groups.");
  return `users/${currentUser.uid}/groups`;
}

export function getSingleGroupRefPath(currentUser: User | null, groupId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access group.");
  return `users/${currentUser.uid}/groups/${groupId}`;
}

export async function getGroups(): Promise<Group[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("getGroups called without authenticated user, returning empty array.");
    return [];
  }
  const groupsRefPath = getGroupsRefPath(currentUser);
  const groupsRef = ref(database, groupsRefPath);

  try {
    const snapshot = await get(groupsRef);
    if (snapshot.exists()) {
      const groupsData = snapshot.val();
      return Object.entries(groupsData).map(([id, data]) => ({
        id,
        ...(data as Omit<Group, 'id'>),
        categoryIds: (data as Group).categoryIds || [], // Ensure categoryIds is an array
      }));
    }
    return [];
  } catch (error) {
    console.error("Error fetching groups from Firebase:", error);
    throw error;
  }
}

export async function addGroup(groupName: string): Promise<Group> {
  const currentUser = auth.currentUser;
  const groupsRefPath = getGroupsRefPath(currentUser);
  const groupsRef = ref(database, groupsRefPath);

  if (!groupName || typeof groupName !== 'string' || groupName.trim().length === 0) {
    throw new Error("Group name cannot be empty.");
  }
  const normalizedName = groupName.trim();

  const currentGroups = await getGroups();
  if (currentGroups.some(group => group.name.toLowerCase() === normalizedName.toLowerCase())) {
    throw new Error(`A group named "${normalizedName}" already exists.`);
  }

  const newGroupRef = push(groupsRef);
  if (!newGroupRef.key) {
    throw new Error("Failed to generate a new group ID.");
  }
  const newGroupData: Omit<Group, 'id'> = { name: normalizedName, categoryIds: [] };

  try {
    await set(newGroupRef, newGroupData);
    return { id: newGroupRef.key, ...newGroupData };
  } catch (error) {
    console.error("Error adding group to Firebase:", error);
    throw error;
  }
}

export async function updateGroup(updatedGroupData: Group): Promise<Group> {
  const currentUser = auth.currentUser;
  if (!updatedGroupData.id) throw new Error("Group ID is required for update.");
  const groupRefPath = getSingleGroupRefPath(currentUser, updatedGroupData.id);
  const groupRef = ref(database, groupRefPath);

  const dataToSet: Omit<Group, 'id'> = {
    name: updatedGroupData.name.trim(),
    categoryIds: updatedGroupData.categoryIds || [],
  };

  // Check for name collision if name is being changed
  if (updatedGroupData.name) {
    const currentGroups = await getGroups();
    const existingGroup = await get(groupRef);
    if (existingGroup.exists() && (existingGroup.val() as Group).name.toLowerCase() !== updatedGroupData.name.toLowerCase()) {
       if (currentGroups.some(g => g.id !== updatedGroupData.id && g.name.toLowerCase() === updatedGroupData.name.toLowerCase())) {
        throw new Error(`Another group named "${updatedGroupData.name}" already exists.`);
      }
    }
  }


  try {
    await update(groupRef, dataToSet); // Use update to modify specific fields or create if not exists
    return { id: updatedGroupData.id, ...dataToSet };
  } catch (error) {
    console.error("Error updating group in Firebase:", error);
    throw error;
  }
}

export async function deleteGroup(groupId: string): Promise<void> {
  const currentUser = auth.currentUser;
  const groupRefPath = getSingleGroupRefPath(currentUser, groupId);
  const groupRef = ref(database, groupRefPath);
  try {
    await remove(groupRef);
  } catch (error) {
    console.error("Error deleting group from Firebase:", error);
    throw error;
  }
}

export async function linkCategoryToGroup(groupId: string, categoryId: string): Promise<void> {
  const currentUser = auth.currentUser;
  const groupRefPath = getSingleGroupRefPath(currentUser, groupId);
  const groupRef = ref(database, groupRefPath);

  const snapshot = await get(groupRef);
  if (snapshot.exists()) {
    const group = snapshot.val() as Omit<Group, 'id'>;
    const updatedCategoryIds = Array.from(new Set([...(group.categoryIds || []), categoryId]));
    await update(groupRef, { categoryIds: updatedCategoryIds });
  } else {
    throw new Error(`Group with ID ${groupId} not found.`);
  }
}

export async function unlinkCategoryFromGroup(groupId: string, categoryId: string): Promise<void> {
  const currentUser = auth.currentUser;
  const groupRefPath = getSingleGroupRefPath(currentUser, groupId);
  const groupRef = ref(database, groupRefPath);

  const snapshot = await get(groupRef);
  if (snapshot.exists()) {
    const group = snapshot.val() as Omit<Group, 'id'>;
    const updatedCategoryIds = (group.categoryIds || []).filter(id => id !== categoryId);
    await update(groupRef, { categoryIds: updatedCategoryIds });
  } else {
    throw new Error(`Group with ID ${groupId} not found.`);
  }
}
