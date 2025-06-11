
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
  subscriptionId?: string | null; // Link to a subscription
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
    subscriptionId?: string | null;
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
        if (!accountToUpdate.primaryCurrency || !Array.isArray(accountToUpdate.balances)) {
            console.error(`Account ${accountId} is missing primaryCurrency or has invalid balances array for balance modification.`);
            return; // Cannot proceed safely
        }

        const primaryBalanceIndex = accountToUpdate.balances.findIndex(b => b.currency === accountToUpdate.primaryCurrency);

        if (primaryBalanceIndex === -1) {
            console.warn(`Account ${accountId} does not have a balance entry for its primary currency ${accountToUpdate.primaryCurrency}. Creating one.`);
            // If primary currency balance entry doesn't exist, create it. This assumes it starts at 0.
            // A more robust solution might depend on application logic if this state is unexpected.
            accountToUpdate.balances.push({ currency: accountToUpdate.primaryCurrency, amount: 0 });
            // Re-find the index, it will be the last one.
            // This recursive call is potentially problematic, better to handle explicitly:
             const newPrimaryBalanceIndex = accountToUpdate.balances.findIndex(b => b.currency === accountToUpdate.primaryCurrency);
             if(newPrimaryBalanceIndex === -1) {
                console.error(`Failed to create or find primary balance entry for ${accountToUpdate.primaryCurrency} in account ${accountId}.`);
                return;
             }
             // Continue with newPrimaryBalanceIndex below
        }
        
        // Use the found (or newly created) index.
        const targetBalanceIndex = accountToUpdate.balances.findIndex(b => b.currency === accountToUpdate.primaryCurrency);
        if (targetBalanceIndex === -1) { // Should not happen if the above logic is correct
            console.error(`Critical error: Primary balance for ${accountToUpdate.primaryCurrency} still not found in account ${accountId}.`);
            return;
        }


        let amountInPrimaryCurrency = amountInTransactionCurrency;
        if (transactionCurrency && accountToUpdate.primaryCurrency && transactionCurrency.toUpperCase() !== accountToUpdate.primaryCurrency.toUpperCase()) {
            amountInPrimaryCurrency = convertCurrency(
                amountInTransactionCurrency,
                transactionCurrency,
                accountToUpdate.primaryCurrency
            );
        }

        const balanceChange = operation === 'add' ? amountInPrimaryCurrency : -amountInPrimaryCurrency;
        
        const updatedBalances = [...accountToUpdate.balances];
        updatedBalances[targetBalanceIndex] = {
            ...updatedBalances[targetBalanceIndex],
            amount: parseFloat((updatedBalances[targetBalanceIndex].amount + balanceChange).toFixed(2))
        };

        await updateAccountInDb({
            ...accountToUpdate,
            balances: updatedBalances, // Pass the updated balances array
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
                transactionCurrency: txData.transactionCurrency || allAppAccounts.find(a => a.id === txData.accountId)?.primaryCurrency || 'USD',
                subscriptionId: txData.subscriptionId === undefined ? null : txData.subscriptionId,
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
    subscriptionId: transactionData.subscriptionId === undefined ? null : transactionData.subscriptionId,
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
  const allAppAccounts = await getAllAccounts(); // Fetch accounts to determine currency if not present
  const originalDbTxCurrency = originalTransactionDataFromDB.transactionCurrency || allAppAccounts.find(a => a.id === accountId)?.primaryCurrency || 'USD';

  const dataToUpdateFirebase = {
    ...updatedTransaction,
    subscriptionId: updatedTransaction.subscriptionId === undefined ? null : updatedTransaction.subscriptionId,
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
        // Revert old transaction amount from balance
        await modifyAccountBalance(accountId, originalTransactionDataFromDB.amount, originalDbTxCurrency, 'subtract');
        // Apply new transaction amount to balance
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
  const allAppAccounts = await getAllAccounts(); // Fetch accounts to determine currency if not present
  const txCurrency = transactionToDelete.transactionCurrency || allAppAccounts.find(a => a.id === accountId)?.primaryCurrency || 'USD';

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
    
