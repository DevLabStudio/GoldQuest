import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove, update, serverTimestamp } from 'firebase/database';
import type { User } from 'firebase/auth';
import { getAccounts as getAllAccounts, updateAccount as updateAccountInDb, type Account } from './account-sync'; // Renamed getAccounts to avoid conflict
import { convertCurrency } from '@/lib/currency';
// Import ref path getters from other services
import { getCategoriesRefPath } from './categories';
import { getTagsRefPath } from './tags';
import { getGroupsRefPath } from './groups';
import { getSubscriptionsRefPath } from './subscriptions';


export interface Transaction {
  id: string;
  date: string; // ISO string: YYYY-MM-DD
  amount: number; // Positive for income, negative for expenses
  transactionCurrency: string; // Currency of the amount field
  description: string;
  category: string;
  accountId: string;
  tags?: string[];
  createdAt?: object | string; // For server timestamp or ISO string for localStorage
  updatedAt?: object | string; // For server timestamp or ISO string for localStorage
  // Optional: to store original CSV foreign values for reference if needed
  originalImportData?: {
    foreignAmount?: number | null;
    foreignCurrency?: string | null;
  }
}

// Type for data passed to addTransaction - transactionCurrency is now mandatory
export type NewTransactionData = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & {
    transactionCurrency: string;
    originalImportData?: { // Ensure this is part of the type if passed directly
        foreignAmount?: number | null;
        foreignCurrency?: string | null;
    }
};


function getTransactionsRefPath(currentUser: User | null, accountId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access transactions.");
  return `users/${currentUser.uid}/transactions/${accountId}`;
}

function getSingleTransactionRefPath(currentUser: User | null, accountId: string, transactionId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access transaction.");
  return `users/${currentUser.uid}/transactions/${accountId}/${transactionId}`;
}

async function modifyAccountBalance(accountId: string, amountInTransactionCurrency: number, transactionCurrency: string, operation: 'add' | 'subtract') {
    const accounts = await getAllAccounts();
    const accountToUpdate = accounts.find(acc => acc.id === accountId);

    if (accountToUpdate) {
        let amountInAccountCurrency = amountInTransactionCurrency;
        if (transactionCurrency.toUpperCase() !== accountToUpdate.currency.toUpperCase()) {
            amountInAccountCurrency = convertCurrency(
                amountInTransactionCurrency,
                transactionCurrency,
                accountToUpdate.currency
            );
        }
        const balanceChange = operation === 'add' ? amountInAccountCurrency : -amountInAccountCurrency;
        // Ensure newBalance calculation handles floating point inaccuracies for currency
        const newBalance = parseFloat((accountToUpdate.balance + balanceChange).toFixed(2));


        await updateAccountInDb({
            ...accountToUpdate,
            balance: newBalance,
            lastActivity: new Date().toISOString(),
        });
        console.log(`Account ${accountToUpdate.name} balance updated by ${balanceChange} ${accountToUpdate.currency}. New balance: ${newBalance}`);
    } else {
        console.warn(`Account ID ${accountId} not found for balance update.`);
    }
}

// Helper function to get transactions from localStorage (internal to this service)
async function _getTransactionsFromLocalStorage(accountId: string): Promise<Transaction[]> {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return [];
    const key = `transactions-${accountId}-${currentUser.uid}`;
    const data = localStorage.getItem(key);
    try {
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Error parsing transactions from localStorage for account:", accountId, e);
        return []; // Return empty array on parsing error
    }
}

// Helper function to save transactions to localStorage (internal to this service)
async function _saveTransactionsToLocalStorage(accountId: string, transactions: Transaction[]): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return;
    const key = `transactions-${accountId}-${currentUser.uid}`;
    localStorage.setItem(key, JSON.stringify(transactions));
}


export async function getTransactions(
    accountId: string,
    options?: { limit?: number }
): Promise<Transaction[]> {
  const currentUser = auth.currentUser;
   if (!currentUser?.uid) {
    console.warn("getTransactions called without authenticated user. Returning empty array.");
    return [];
  }
  const storageKey = `transactions-${accountId}-${currentUser.uid}`;
  const data = localStorage.getItem(storageKey);

  console.log("Fetching transactions for account:", accountId, "from localStorage key:", storageKey);

  if (data) {
      try {
        const allAppAccounts = await getAllAccounts(); // Fetch accounts for currency fallback
        const transactionsArray = (JSON.parse(data) as Transaction[])
            .map(tx => ({ // Ensure default values for robustness with old data
                ...tx,
                tags: tx.tags || [],
                category: tx.category || 'Uncategorized',
                transactionCurrency: tx.transactionCurrency || allAppAccounts.find(a=>a.id === tx.accountId)?.currency || 'USD'
            }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (options?.limit && options.limit > 0) {
            return transactionsArray.slice(0, options.limit);
        }
        return transactionsArray;
      } catch(e) {
          console.error("Error parsing transactions from localStorage during getTransactions for account:", accountId, e);
          localStorage.removeItem(storageKey); // Clear corrupted data
          return []; // Return empty if parsing fails
      }
  }
  return [];
}

export async function addTransaction(transactionData: NewTransactionData): Promise<Transaction> {
  const currentUser = auth.currentUser;
  const { accountId, amount, transactionCurrency, category } = transactionData;
  const transactionsRefPath = getTransactionsRefPath(currentUser, accountId);
  const accountTransactionsRef = ref(database, transactionsRefPath);
  const newTransactionRef = push(accountTransactionsRef);

  if (!newTransactionRef.key) {
    throw new Error("Failed to generate a new transaction ID.");
  }

  const newTransaction: Transaction = {
    ...transactionData,
    id: newTransactionRef.key,
    category: category?.trim() || 'Uncategorized',
    tags: transactionData.tags || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    originalImportData: {
        foreignAmount: transactionData.originalImportData?.foreignAmount ?? null,
        foreignCurrency: transactionData.originalImportData?.foreignCurrency ?? null,
    }
  };

  const dataToSave = { ...newTransaction } as any;
  delete dataToSave.id;


  console.log("Adding transaction to Firebase RTDB:", newTransaction);
  try {
    await set(newTransactionRef, dataToSave);
    if (category?.toLowerCase() !== 'opening balance') {
        await modifyAccountBalance(accountId, amount, transactionCurrency, 'add');
    }

    // Update localStorage transaction list
    const storedTransactions = await _getTransactionsFromLocalStorage(accountId);
    // Ensure createdAt/updatedAt are strings for localStorage
    const newTxForStorage = { ...newTransaction, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    storedTransactions.push(newTxForStorage);
    await _saveTransactionsToLocalStorage(accountId, storedTransactions);


    return newTransaction;
  } catch (error) {
    console.error("Error adding transaction to Firebase:", error);
    throw error;
  }
}

export async function updateTransaction(updatedTransaction: Transaction): Promise<Transaction> {
  const currentUser = auth.currentUser;
  const { id, accountId, amount, transactionCurrency } = updatedTransaction;
  const transactionRefPath = getSingleTransactionRefPath(currentUser, accountId, id);
  const transactionRef = ref(database, transactionRefPath);

  const originalSnapshot = await get(transactionRef); // Get from DB for balance adjustment
  if (!originalSnapshot.exists()) {
    throw new Error(`Transaction with ID ${id} not found for update.`);
  }
  const originalTransactionDataFromDB = originalSnapshot.val() as Omit<Transaction, 'id'>;
  const allAppAccounts = await getAllAccounts();
  const originalDbTxCurrency = originalTransactionDataFromDB.transactionCurrency || allAppAccounts.find(a => a.id === accountId)?.currency || 'USD';


  const dataToUpdateFirebase = { // Data for Firebase update
    ...updatedTransaction,
    updatedAt: serverTimestamp(),
    originalImportData: {
        foreignAmount: updatedTransaction.originalImportData?.foreignAmount ?? null,
        foreignCurrency: updatedTransaction.originalImportData?.foreignCurrency ?? null,
    }
  } as any;
  delete dataToUpdateFirebase.id;


  console.log("Updating transaction in Firebase RTDB:", id, dataToUpdateFirebase);
  try {
    await update(transactionRef, dataToUpdateFirebase); // Update DB

    // Adjust account balances based on original (from DB) and new transaction amounts
    await modifyAccountBalance(accountId, originalTransactionDataFromDB.amount, originalDbTxCurrency, 'subtract');
    await modifyAccountBalance(accountId, amount, transactionCurrency, 'add');

    // Update localStorage transaction list
    const storedTransactions = await _getTransactionsFromLocalStorage(accountId);
    const transactionIndex = storedTransactions.findIndex(t => t.id === id);
    if (transactionIndex !== -1) {
      // Preserve original createdAt from localStorage if it exists and is a string, otherwise use what's in updatedTransaction
      const originalStoredCreatedAt = storedTransactions[transactionIndex].createdAt;
      storedTransactions[transactionIndex] = {
          ...updatedTransaction, // Apply all updates
          createdAt: updatedTransaction.createdAt || originalStoredCreatedAt || new Date().toISOString(), // Ensure createdAt is set
          updatedAt: new Date().toISOString(), // For localStorage, use ISO string
      };
      await _saveTransactionsToLocalStorage(accountId, storedTransactions);
    } else {
        console.warn(`Transaction ${id} updated in DB but not found in localStorage cache for account ${accountId}. Adding it.`);
        storedTransactions.push({
            ...updatedTransaction,
            createdAt: updatedTransaction.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        await _saveTransactionsToLocalStorage(accountId, storedTransactions);
    }

    return updatedTransaction;
  } catch (error) {
    console.error("Error updating transaction in Firebase:", error);
    throw error;
  }
}

export async function deleteTransaction(transactionId: string, accountId: string): Promise<void> {
  const currentUser = auth.currentUser;
  const transactionRefPath = getSingleTransactionRefPath(currentUser, accountId, transactionId);
  const transactionRef = ref(database, transactionRefPath);

  const snapshot = await get(transactionRef); // Get from DB for balance adjustment
  if (!snapshot.exists()) {
    console.warn(`Transaction ${transactionId} not found for deletion.`);
    return;
  }
  const transactionToDelete = snapshot.val() as Omit<Transaction, 'id'>;
  const allAppAccounts = await getAllAccounts();
  const txCurrency = transactionToDelete.transactionCurrency || allAppAccounts.find(a => a.id === accountId)?.currency || 'USD';

  console.log("Deleting transaction from Firebase RTDB:", transactionRefPath);
  try {
    await remove(transactionRef); // Remove from DB
    // Use the currency from the transaction being deleted for accurate balance reversal
    await modifyAccountBalance(accountId, transactionToDelete.amount, txCurrency, 'subtract');

    // Update localStorage transaction list
    let storedTransactions = await _getTransactionsFromLocalStorage(accountId);
    storedTransactions = storedTransactions.filter(t => t.id !== transactionId);
    await _saveTransactionsToLocalStorage(accountId, storedTransactions);

  } catch (error) {
    console.error("Error deleting transaction from Firebase:", error);
    throw error;
  }
}

export async function clearAllSessionTransactions(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    console.warn("User not authenticated, cannot clear data.");
    return;
  }

  console.warn("Attempting to clear ALL user data for user:", currentUser.uid);
  try {
    // Get paths for all data types
    const userFirebaseTransactionsBasePath = `users/${currentUser.uid}/transactions`;
    const categoriesPath = getCategoriesRefPath(currentUser);
    const tagsPath = getTagsRefPath(currentUser);
    const groupsPath = getGroupsRefPath(currentUser);
    const subscriptionsPath = getSubscriptionsRefPath(currentUser);
    const accountsPath = `users/${currentUser.uid}/accounts`; // Directly use path

    // Clear from Firebase DB
    await Promise.all([
        remove(ref(database, userFirebaseTransactionsBasePath)),
        remove(ref(database, categoriesPath)),
        remove(ref(database, tagsPath)),
        remove(ref(database, groupsPath)),
        remove(ref(database, subscriptionsPath)),
        remove(ref(database, accountsPath)) // Clear accounts from DB
    ]);

    // Clear from localStorage
    const accounts = await getAllAccounts(); // This will now be empty if DB clear was first, or from old cache
    for (const acc of accounts) { // If accounts were cleared from DB first, this loop might not run for transactions
      const storageKey = `transactions-${acc.id}-${currentUser.uid}`;
      localStorage.removeItem(storageKey);
    }
    // Clear other localStorage items
    localStorage.removeItem(`userAccounts-${currentUser.uid}`);
    localStorage.removeItem(`userCategories-${currentUser.uid}`);
    localStorage.removeItem(`userTags-${currentUser.uid}`);
    localStorage.removeItem(`userGroups-${currentUser.uid}`);
    localStorage.removeItem(`userSubscriptions-${currentUser.uid}`);
    localStorage.removeItem(`userPreferences-${currentUser.uid}`); // Also clear preferences


    console.log("All user data cleared from Firebase and localStorage for user:", currentUser.uid);
  } catch (error) {
    console.error("Error clearing all user data:", error);
    throw error;
  }
}
