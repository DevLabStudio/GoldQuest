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
}

function getTransactionsRefPath(currentUser: User | null, accountId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access transactions.");
  return `users/${currentUser.uid}/transactions/${accountId}`;
}

function getSingleTransactionRefPath(currentUser: User | null, accountId: string, transactionId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access transaction.");
  return `users/${currentUser.uid}/transactions/${accountId}/${transactionId}`;
}

async function modifyAccountBalance(accountId: string, amountChange: number, transactionCurrency: string, operation: 'add' | 'subtract') {
    const accounts = await getAccounts(); // This will fetch from Firebase
    const accountToUpdate = accounts.find(acc => acc.id === accountId);

    if (accountToUpdate) {
        let amountInAccountCurrency = amountChange;
        if (transactionCurrency.toUpperCase() !== accountToUpdate.currency.toUpperCase()) {
            amountInAccountCurrency = convertCurrency(
                amountChange,
                transactionCurrency,
                accountToUpdate.currency
            );
        }

        const balanceChange = operation === 'add' ? amountInAccountCurrency : -amountInAccountCurrency;
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
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date descending

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

export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction> {
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
  };

  console.log("Adding transaction to Firebase RTDB:", newTransaction);
  try {
    // Save transaction without its own ID in the RTDB object value
    const dataToSave = { ...newTransaction };
    delete (dataToSave as any).id; // Firebase key is the ID

    await set(newTransactionRef, dataToSave);
    // Update account balance
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

  // Get original transaction to calculate balance difference
  const originalSnapshot = await get(transactionRef);
  if (!originalSnapshot.exists()) {
    throw new Error(`Transaction with ID ${id} not found for update.`);
  }
  const originalTransaction = originalSnapshot.val() as Omit<Transaction, 'id'>;

  const dataToUpdate = {
    ...updatedTransaction,
    category: updatedTransaction.category?.trim() || 'Uncategorized',
    tags: updatedTransaction.tags || [],
    updatedAt: serverTimestamp(),
  };
  delete (dataToUpdate as any).id; // Firebase key is the ID
  delete (dataToUpdate as any).createdAt; // Don't overwrite createdAt

  console.log("Updating transaction in Firebase RTDB:", id, dataToUpdate);
  try {
    await update(transactionRef, dataToUpdate);

    // Calculate balance adjustment
    // 1. Revert old transaction amount
    await modifyAccountBalance(accountId, originalTransaction.amount, originalTransaction.transactionCurrency, 'subtract');
    // 2. Apply new transaction amount
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

  // Get transaction to revert its balance effect
  const snapshot = await get(transactionRef);
  if (!snapshot.exists()) {
    console.warn(`Transaction ${transactionId} not found for deletion.`);
    return;
  }
  const transactionToDelete = snapshot.val() as Omit<Transaction, 'id'>;

  console.log("Deleting transaction from Firebase RTDB:", transactionRefPath);
  try {
    await remove(transactionRef);
    // Revert account balance
    await modifyAccountBalance(accountId, transactionToDelete.amount, transactionToDelete.transactionCurrency, 'subtract');
  } catch (error) {
    console.error("Error deleting transaction from Firebase:", error);
    throw error;
  }
}

// This was for localStorage, not directly applicable for Firebase RTDB
export async function clearAllSessionTransactions(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    console.warn("User not authenticated, cannot clear transactions.");
    return;
  }
  // WARNING: This will delete ALL transactions for the user. Use with extreme caution.
  // For safety, this function might be better implemented with more specific controls
  // or by deleting account by account if that's the intent.
  // For now, let's assume we want to clear all transactions for all accounts of the user.
  const userTransactionsRefPath = `users/${currentUser.uid}/transactions`;
  const userTransactionsRef = ref(database, userTransactionsRefPath);
  console.warn("Attempting to clear ALL transactions for user:", currentUser.uid);
  try {
    await remove(userTransactionsRef);
    // Also, consider resetting account balances or prompting user to do so.
    const accounts = await getAccounts();
    for (const acc of accounts) {
        await updateAccountInDb({ ...acc, balance: 0, lastActivity: new Date().toISOString(), balanceDifference: 0 });
    }
    console.log("All transactions cleared from Firebase for user:", currentUser.uid);
  } catch (error) {
    console.error("Error clearing all transactions from Firebase:", error);
  }
}