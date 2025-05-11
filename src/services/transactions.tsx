import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove, update, serverTimestamp } from 'firebase/database';
import type { User } from 'firebase/auth';
import { getAccounts, updateAccount as updateAccountInDb, type Account } from './account-sync';
import { convertCurrency } from '@/lib/currency';

export interface Transaction {
  id: string;
  date: string; // ISO string: YYYY-MM-DD
  amount: number; // Positive for income, negative for expenses
  transactionCurrency: string; // Currency of the amount field
  description: string;
  category: string;
  accountId: string;
  tags?: string[];
  createdAt?: object; // For server timestamp
  updatedAt?: object; // For server timestamp
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
    const accounts = await getAccounts();
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
        const balanceChange = operation === 'add' ? amountInAccountCurrency : -amountInTransactionCurrency;
        const newBalance = accountToUpdate.balance + balanceChange;

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

export async function getTransactions(
    accountId: string,
    options?: { limit?: number }
): Promise<Transaction[]> {
  const currentUser = auth.currentUser;
  const transactionsRefPath = getTransactionsRefPath(currentUser, accountId);
  const accountTransactionsRef = ref(database, transactionsRefPath);

  console.log("Fetching transactions for account:", accountId, "from Firebase RTDB:", transactionsRefPath);
  try {
    const snapshot = await get(accountTransactionsRef);
    if (snapshot.exists()) {
      const transactionsData = snapshot.val();
      const transactionsArray = Object.entries(transactionsData).map(([id, data]) => ({
        id,
        ...(data as Omit<Transaction, 'id'>),
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (options?.limit && options.limit > 0) {
        return transactionsArray.slice(0, options.limit);
      }
      return transactionsArray;
    }
    return [];
  } catch (error) {
    console.error("Error fetching transactions from Firebase:", error);
    throw error;
  }
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
    originalImportData: { // Ensure this structure exists
        foreignAmount: transactionData.originalImportData?.foreignAmount ?? null,
        foreignCurrency: transactionData.originalImportData?.foreignCurrency ?? null,
    }
  };

  console.log("Adding transaction to Firebase RTDB:", newTransaction);
  try {
    const dataToSave = { ...newTransaction } as any; 
    delete dataToSave.id;
    
    // Ensure originalImportData structure is correctly saved, with nulls for missing fields
    // This assignment is now redundant if newTransaction already has it structured.
    // dataToSave.originalImportData = {
    //     foreignAmount: newTransaction.originalImportData?.foreignAmount ?? null,
    //     foreignCurrency: newTransaction.originalImportData?.foreignCurrency ?? null,
    // };


    await set(newTransactionRef, dataToSave);
    if (category?.toLowerCase() !== 'opening balance') {
        await modifyAccountBalance(accountId, amount, transactionCurrency, 'add');
    }
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

  const originalSnapshot = await get(transactionRef);
  if (!originalSnapshot.exists()) {
    throw new Error(`Transaction with ID ${id} not found for update.`);
  }
  const originalTransaction = originalSnapshot.val() as Omit<Transaction, 'id'> & { transactionCurrency: string};

  const dataToUpdate = {
    ...updatedTransaction,
    category: updatedTransaction.category?.trim() || 'Uncategorized',
    tags: updatedTransaction.tags || [],
    updatedAt: serverTimestamp(),
    originalImportData: { // Ensure this structure exists
        foreignAmount: updatedTransaction.originalImportData?.foreignAmount ?? null,
        foreignCurrency: updatedTransaction.originalImportData?.foreignCurrency ?? null,
    }
  } as any; 
  delete dataToUpdate.id;
  delete dataToUpdate.createdAt;


  console.log("Updating transaction in Firebase RTDB:", id, dataToUpdate);
  try {
    await update(transactionRef, dataToUpdate);

    await modifyAccountBalance(accountId, originalTransaction.amount, originalTransaction.transactionCurrency, 'subtract');
    await modifyAccountBalance(accountId, amount, transactionCurrency, 'add');

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

  const snapshot = await get(transactionRef);
  if (!snapshot.exists()) {
    console.warn(`Transaction ${transactionId} not found for deletion.`);
    return;
  }
  const transactionToDelete = snapshot.val() as Omit<Transaction, 'id'> & {transactionCurrency: string};

  console.log("Deleting transaction from Firebase RTDB:", transactionRefPath);
  try {
    await remove(transactionRef);
    await modifyAccountBalance(accountId, transactionToDelete.amount, transactionToDelete.transactionCurrency, 'subtract');
  } catch (error) {
    console.error("Error deleting transaction from Firebase:", error);
    throw error;
  }
}

export async function clearAllSessionTransactions(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    console.warn("User not authenticated, cannot clear transactions.");
    return;
  }

  const userTransactionsRefPath = `users/${currentUser.uid}/transactions`;
  const userTransactionsRef = ref(database, userTransactionsRefPath);
  console.warn("Attempting to clear ALL transactions for user:", currentUser.uid);
  try {
    await remove(userTransactionsRef);
    const accounts = await getAccounts();
    for (const acc of accounts) {
        await updateAccountInDb({ ...acc, balance: 0, lastActivity: new Date().toISOString(), balanceDifference: 0 });
    }
    console.log("All transactions cleared from Firebase for user:", currentUser.uid);
  } catch (error) {
    console.error("Error clearing all transactions from Firebase:", error);
  }
}
