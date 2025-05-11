import { database, auth } from '@/lib/firebase';
import { ref, set, get, child, push, remove, update } from 'firebase/database';
import type { User } from 'firebase/auth';

/**
 * Represents a financial account.
 */
export interface Account {
  id: string;
  name: string;
  type: string; // 'checking', 'savings', 'credit card', 'investment', 'other', 'exchange', 'wallet', 'staking'
  balance: number;
  currency: string;
  providerName?: string;
  isActive?: boolean;
  lastActivity?: string;
  balanceDifference?: number;
  category: 'asset' | 'crypto';
  includeInNetWorth?: boolean; // New field
}

export type NewAccountData = Omit<Account, 'id'>;

function getAccountsRefPath(currentUser: User | null) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access accounts.");
  return `users/${currentUser.uid}/accounts`;
}

function getSingleAccountRefPath(currentUser: User | null, accountId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access account.");
  return `users/${currentUser.uid}/accounts/${accountId}`;
}

// Helper function to provide default values for potentially missing fields
function getDefaultAccountValues(category: 'asset' | 'crypto'): Partial<Account> {
    return {
        isActive: true,
        lastActivity: new Date().toISOString(),
        balanceDifference: 0,
        category: category,
        includeInNetWorth: true, // Default to true
    };
}

export async function getAccounts(): Promise<Account[]> {
  const currentUser = auth.currentUser;
  // Ensure currentUser is available before proceeding
  if (!currentUser) {
    console.warn("getAccounts called before user authentication is resolved. Returning empty array.");
    return [];
  }
  const accountsRefPath = getAccountsRefPath(currentUser);
  const accountsRef = ref(database, accountsRefPath);

  try {
    const snapshot = await get(accountsRef);
    if (snapshot.exists()) {
      const accountsData = snapshot.val();
      // Firebase returns an object; convert it to an array
      return Object.entries(accountsData).map(([id, data]) => ({
        id,
        ...getDefaultAccountValues((data as Account).category || 'asset'), // Ensure defaults
        ...(data as Omit<Account, 'id'>),
        includeInNetWorth: (data as Account).includeInNetWorth === undefined ? true : (data as Account).includeInNetWorth, // Ensure default if field is missing
      }));
    }
    return []; // No accounts found
  } catch (error: any) {
    if (error.message && (error.message.toLowerCase().includes("permission_denied") || error.message.toLowerCase().includes("permission denied"))) {
        console.error(`Firebase Permission Denied: Could not fetch accounts from ${accountsRefPath}. Please check your Firebase Realtime Database security rules to ensure authenticated users have read access to their data under 'users/\${uid}/accounts'. Example rule: { "rules": { "users": { "$uid": { ".read": "$uid === auth.uid", ".write": "$uid === auth.uid" } } } }`);
        throw new Error(`Permission Denied: Cannot read accounts. Please verify Firebase security rules.`);
    }
    console.error("Error fetching accounts from Firebase:", error);
    throw error; // Re-throw other errors
  }
}

export async function addAccount(accountData: NewAccountData): Promise<Account> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot add account.");
  }
  const accountsRefPath = getAccountsRefPath(currentUser);
  const accountsRef = ref(database, accountsRefPath);
  const newAccountRef = push(accountsRef); // Generates a unique ID

  if (!newAccountRef.key) {
    throw new Error("Failed to generate a new account ID.");
  }

  const newAccountWithDefaults: Omit<Account, 'id'> = {
      ...getDefaultAccountValues(accountData.category),
      ...accountData,
      includeInNetWorth: accountData.includeInNetWorth === undefined ? true : accountData.includeInNetWorth,
  };

  const newAccountWithId: Account = {
    id: newAccountRef.key,
    ...newAccountWithDefaults,
  };

  try {
    await set(newAccountRef, newAccountWithDefaults); // Save data without the id field itself
    return newAccountWithId;
  } catch (error) {
    console.error("Error adding account to Firebase:", error);
    throw error;
  }
}

export async function updateAccount(updatedAccountData: Account): Promise<Account> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot update account.");
  }
  if (!updatedAccountData.id) throw new Error("Account ID is required for update.");
  const accountRefPath = getSingleAccountRefPath(currentUser, updatedAccountData.id);
  const accountRef = ref(database, accountRefPath);

  // Fetch existing to merge, or create if it doesn't exist (though update usually implies existence)
  const snapshot = await get(accountRef);
  let dataToSet: Omit<Account, 'id'>;

  const categoryToUse = updatedAccountData.category || (snapshot.exists() ? (snapshot.val() as Account).category : 'asset');


  if (snapshot.exists()) {
      const existingData = snapshot.val() as Omit<Account, 'id'>;
      dataToSet = {
          ...getDefaultAccountValues(categoryToUse),
          ...existingData,
          ...updatedAccountData, // Apply updates
          includeInNetWorth: updatedAccountData.includeInNetWorth === undefined ? (existingData.includeInNetWorth === undefined ? true : existingData.includeInNetWorth) : updatedAccountData.includeInNetWorth,
      };
      delete (dataToSet as any).id; // Remove id from the object to be saved
  } else {
      // If for some reason it doesn't exist, treat as adding it with this ID
      dataToSet = {
          ...getDefaultAccountValues(categoryToUse),
          ...updatedAccountData,
          includeInNetWorth: updatedAccountData.includeInNetWorth === undefined ? true : updatedAccountData.includeInNetWorth,
      };
      delete (dataToSet as any).id;
  }


  try {
    await set(accountRef, dataToSet); // Using set to overwrite with new data
    return { ...updatedAccountData, includeInNetWorth: dataToSet.includeInNetWorth }; // Return the full account object passed in, ensuring includeInNetWorth is resolved
  } catch (error) {
    console.error("Error updating account in Firebase:", error);
    throw error;
  }
}

export async function deleteAccount(accountId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot delete account.");
  }
  const accountRefPath = getSingleAccountRefPath(currentUser, accountId);
  const accountRef = ref(database, accountRefPath);

  try {
    await remove(accountRef);
    // Also delete associated transactions for this account
    const transactionsBasePath = `users/${currentUser?.uid}/transactions/${accountId}`;
    const transactionsForAccountRef = ref(database, transactionsBasePath);
    await remove(transactionsForAccountRef);
    console.log(`Also deleted transactions for account ${accountId} at ${transactionsBasePath}`);
  } catch (error) {
    console.error("Error deleting account from Firebase:", error);
    throw error;
  }
}
