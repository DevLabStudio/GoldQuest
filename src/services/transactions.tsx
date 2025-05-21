
'use client';

import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove, update, serverTimestamp, query, orderByChild, limitToLast } from 'firebase/database';
import type { User } from 'firebase/auth';
import { getAccounts as getAllAccounts, updateAccount as updateAccountInDb, type Account } from './account-sync';
import { convertCurrency } from '@/lib/currency';
// Import ref path getters from other services
import { getCategoriesRefPath } from './categories';
import { getTagsRefPath } from './tags';
import { getGroupsRefPath } from './groups';
import { getSubscriptionsRefPath } from './subscriptions';
import { getLoansRefPath } from './loans';
import { getCreditCardsRefPath } from './credit-cards';
import { getBudgetsRefPath } from './budgets';


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
    originalImportData?: {
        foreignAmount?: number | null;
        foreignCurrency?: string | null;
    }
};

interface AddTransactionOptions {
  skipBalanceModification?: boolean;
}


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
        if (transactionCurrency && accountToUpdate.currency && transactionCurrency.toUpperCase() !== accountToUpdate.currency.toUpperCase()) {
            amountInAccountCurrency = convertCurrency(
                amountInTransactionCurrency,
                transactionCurrency,
                accountToUpdate.currency
            );
        }
        const balanceChange = operation === 'add' ? amountInAccountCurrency : -amountInAccountCurrency;
        const newBalance = parseFloat((accountToUpdate.balance + balanceChange).toFixed(2));

        await updateAccountInDb({
            ...accountToUpdate,
            balance: newBalance,
            lastActivity: new Date().toISOString(),
        });
    } else {
        console.warn(`Account ID ${accountId} not found for balance update.`);
    }
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
  const transactionsRefPath = getTransactionsRefPath(currentUser, accountId);
  const accountTransactionsRef = ref(database, transactionsRefPath);

  try {
    const dataQuery = options?.limit && options.limit > 0
        ? query(accountTransactionsRef, orderByChild('date'), limitToLast(options.limit))
        : query(accountTransactionsRef, orderByChild('date'));

    const snapshot = await get(dataQuery);
    if (snapshot.exists()) {
      const transactionsData = snapshot.val();
      const allAppAccounts = await getAllAccounts(); // Needed for fallback currency
      const transactionsArray = Object.entries(transactionsData)
        .map(([id, data]) => {
            const txData = data as Omit<Transaction, 'id'>;
            return {
                id,
                ...txData,
                tags: txData.tags || [],
                category: txData.category || 'Uncategorized',
                transactionCurrency: txData.transactionCurrency || allAppAccounts.find(a => a.id === txData.accountId)?.currency || 'USD',
                // Convert Firebase server timestamps to ISO strings if they exist
                createdAt: txData.createdAt && typeof txData.createdAt === 'object' ? new Date().toISOString() : txData.createdAt as string,
                updatedAt: txData.updatedAt && typeof txData.updatedAt === 'object' ? new Date().toISOString() : txData.updatedAt as string,
            };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort descending by date

      // If a limit was applied by Firebase, it's already handled.
      // If no limit option or limit was larger than actual data, slice here if needed (though Firebase limit is more efficient)
      // This client-side slice is mainly for consistency if options.limit was used but Firebase query didn't support it as expected.
      return options?.limit && options.limit > 0 && transactionsArray.length > options.limit
        ? transactionsArray.slice(0, options.limit)
        : transactionsArray;
    }
    return [];
  } catch (error) {
    console.error("Error fetching transactions from Firebase:", error);
    throw error; // Re-throw other errors
  }
}

export async function addTransaction(
  transactionData: NewTransactionData,
  options?: AddTransactionOptions
): Promise<Transaction> {
  const currentUser = auth.currentUser;
  const { accountId, amount, transactionCurrency, category } = transactionData;
  if (!currentUser?.uid) {
    throw new Error("User not authenticated. Cannot add transaction.");
  }
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
        foreignAmount: transactionData.originalImportData?.foreignAmount === undefined ? null : transactionData.originalImportData.foreignAmount,
        foreignCurrency: transactionData.originalImportData?.foreignCurrency === undefined ? null : transactionData.originalImportData.foreignCurrency,
    }
  };

  const dataToSave = { ...newTransaction } as any;
  delete dataToSave.id; // Firebase key is the ID

  try {
    await set(newTransactionRef, dataToSave);
    if (category?.toLowerCase() !== 'opening balance' && !options?.skipBalanceModification) {
        await modifyAccountBalance(accountId, amount, transactionCurrency, 'add');
    }
    // Return the transaction with a client-side timestamp approximation for immediate UI use
    return { ...newTransaction, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  } catch (error) {
    console.error("Error adding transaction to Firebase:", error);
    throw error;
  }
}

export async function updateTransaction(updatedTransaction: Transaction): Promise<Transaction> {
  const currentUser = auth.currentUser;
  const { id, accountId, amount, transactionCurrency, category } = updatedTransaction;
  if (!currentUser?.uid) {
    throw new Error("User not authenticated. Cannot update transaction.");
  }
  const transactionRefPath = getSingleTransactionRefPath(currentUser, accountId, id);
  const transactionRef = ref(database, transactionRefPath);

  const originalSnapshot = await get(transactionRef);
  if (!originalSnapshot.exists()) {
    throw new Error(`Transaction with ID ${id} not found for update.`);
  }
  const originalTransactionDataFromDB = originalSnapshot.val() as Omit<Transaction, 'id'>;
  const allAppAccounts = await getAllAccounts();
  const originalDbTxCurrency = originalTransactionDataFromDB.transactionCurrency || allAppAccounts.find(a => a.id === accountId)?.currency || 'USD';

  const dataToUpdateFirebase = {
    ...updatedTransaction,
    updatedAt: serverTimestamp(),
    originalImportData: {
        foreignAmount: updatedTransaction.originalImportData?.foreignAmount === undefined ? null : updatedTransaction.originalImportData.foreignAmount,
        foreignCurrency: updatedTransaction.originalImportData?.foreignCurrency === undefined ? null : updatedTransaction.originalImportData.foreignCurrency,
    }
  } as any;
  delete dataToUpdateFirebase.id;
  delete dataToUpdateFirebase.createdAt; // Should not update createdAt

  try {
    await update(transactionRef, dataToUpdateFirebase);

    if (category?.toLowerCase() !== 'opening balance') {
        await modifyAccountBalance(accountId, originalTransactionDataFromDB.amount, originalDbTxCurrency, 'subtract');
        await modifyAccountBalance(accountId, amount, transactionCurrency, 'add');
    }

    return {
        ...updatedTransaction,
        updatedAt: new Date().toISOString(), // Approximate for local state
    };
  } catch (error) {
    console.error("Error updating transaction in Firebase:", error);
    throw error;
  }
}

export async function deleteTransaction(transactionId: string, accountId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error("User not authenticated. Cannot delete transaction.");
  }
  const transactionRefPath = getSingleTransactionRefPath(currentUser, accountId, transactionId);
  const transactionRef = ref(database, transactionRefPath);

  const snapshot = await get(transactionRef);
  if (!snapshot.exists()) {
    console.warn(`Transaction ${transactionId} not found for deletion.`);
    return;
  }
  const transactionToDelete = snapshot.val() as Omit<Transaction, 'id'>;
  const allAppAccounts = await getAllAccounts();
  const txCurrency = transactionToDelete.transactionCurrency || allAppAccounts.find(a => a.id === accountId)?.currency || 'USD';

  try {
    await remove(transactionRef);
    if (transactionToDelete.category?.toLowerCase() !== 'opening balance') {
        await modifyAccountBalance(accountId, transactionToDelete.amount, txCurrency, 'subtract');
    }
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
    const userRootPath = `users/${currentUser.uid}`;
    await remove(ref(database, userRootPath)); // This removes all data under users/{uid}

    // Clear related localStorage items (though Firebase is now primary, good for cleanup)
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
        if (key.startsWith(`transactions-`) && key.endsWith(`-${currentUser.uid}`)) {
            localStorage.removeItem(key);
        }
        if (key.startsWith(`user`) && key.endsWith(`-${currentUser.uid}`)) {
            localStorage.removeItem(key);
        }
         if (key === `userPreferences-${currentUser.uid}`) { // From AuthContext for theme/currency
            localStorage.removeItem(key);
        }
    });
    // Remove other potential user-specific keys if they exist
    localStorage.removeItem(`userAccounts-${currentUser.uid}`);
    localStorage.removeItem(`userCategories-${currentUser.uid}`);
    localStorage.removeItem(`userTags-${currentUser.uid}`);
    localStorage.removeItem(`userGroups-${currentUser.uid}`);
    localStorage.removeItem(`userSubscriptions-${currentUser.uid}`);
    localStorage.removeItem(`userLoans-${currentUser.uid}`);
    localStorage.removeItem(`userCreditCards-${currentUser.uid}`);
    localStorage.removeItem(`userBudgets-${currentUser.uid}`);


    console.log("All user data cleared from Firebase and localStorage for user:", currentUser.uid);
  } catch (error) {
    console.error("Error clearing all user data:", error);
    throw error;
  }
}
    