

import type { Account } from './account-sync'; // Assuming Account interface is here
import React from 'react'; // Import React for JSX
import { getAccounts, updateAccount as updateAccountService } from './account-sync'; // Import account service functions

/**
 * Represents a financial transaction.
 */
export interface Transaction {
  /**
   * The ID of the transaction.
   */
  id: string;
  /**
   * The date of the transaction (ISO string format recommended: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ).
   */
  date: string;
  /**
   * The amount of the transaction. Positive for income, negative for expenses.
   */
  amount: number;
  /**
   * The description of the transaction.
   */
  description: string;
  /**
   * The category name of the transaction (e.g., groceries, rent, utilities, salary).
   * Should match the `name` field of a Category object.
   */
  category: string;
  /**
   * The account ID that the transaction belongs to.
   */
  accountId: string;
  /**
   * Optional tags associated with the transaction.
   */
  tags?: string[];
}

// --- Mock Data Store (In-Memory) ---
// Transactions will be stored here for the duration of the session.
// They will be cleared when the browser page is refreshed.
const sessionTransactions: { [accountId: string]: Transaction[] } = {};


// --- Mock API Functions ---

/**
 * Asynchronously retrieves a list of financial transactions for a given account
 * from the in-memory store, optionally limiting the results.
 *
 * @param accountId The ID of the account for which to retrieve transactions.
 * @param options Optional parameters, including a limit for the number of transactions.
 * @param options.limit Optional maximum number of transactions to return.
 * @returns A promise that resolves to an array of Transaction objects.
 */
export async function getTransactions(
    accountId: string,
    options?: { limit?: number }
): Promise<Transaction[]> {
  console.log(`Simulating fetching transactions for account: ${accountId} from memory ${options?.limit ? `(limit: ${options.limit})` : ''}`);
  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100)); // Simulate shorter delay

  const transactionsForAccount = sessionTransactions[accountId] || [];

  // Return a sorted copy
  const sortedTransactions = [...transactionsForAccount].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Apply limit if provided
   if (options?.limit && options.limit > 0) {
       return sortedTransactions.slice(0, options.limit);
   }

   return sortedTransactions; // Return all if no limit
}

/**
 * Simulates adding a new transaction to the in-memory mock data store and updates the account balance.
 * Checks if the balance update might have already occurred (e.g., during import) before applying it again.
 * Skips balance update if the category is 'Opening Balance'.
 *
 * @param transactionData Data for the new transaction (excluding ID). Category name should exist.
 * @returns A promise that resolves to the newly created Transaction object with an ID.
 */
export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction> {
    console.log("Attempting to add transaction:", transactionData);
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate short delay

    const transactionAmount = transactionData.amount; // Use the amount as provided (can be +/-)
    const categoryName = transactionData.category?.trim().toLowerCase() || 'uncategorized';

    // --- Fetch Account and Check/Update Balance ---
    // Skip balance update if it's an opening balance transaction, as the balance was set during account creation
    if (categoryName !== 'opening balance') {
        try {
            const accounts = await getAccounts(); // Get current accounts
            const accountIndex = accounts.findIndex(acc => acc.id === transactionData.accountId);
            if (accountIndex !== -1) {
                const accountToUpdate = accounts[accountIndex];
                const originalBalance = accountToUpdate.balance;
                const updatedBalance = originalBalance + transactionAmount;
                console.log(`Account ${accountToUpdate.name} balance update: Original=${originalBalance}, Adding=${transactionAmount}, New=${updatedBalance}`);
                await updateAccountService({ ...accountToUpdate, balance: updatedBalance, lastActivity: new Date().toISOString() });
                console.log(`Account ${accountToUpdate.name} balance successfully updated to: ${updatedBalance}`);
            } else {
                console.warn(`Account with ID ${transactionData.accountId} not found when trying to update balance. Transaction will be added without balance update.`);
            }
        } catch (error) {
            console.error(`Error updating account balance for new transaction (Account ID: ${transactionData.accountId}):`, error);
            // If balance update fails, should we proceed? For now, we will, but log the error.
            // Consider throwing error to prevent adding transaction if balance update fails
            // throw new Error(`Failed to update balance for account ${transactionData.accountId}. Transaction not added.`);
        }
    } else {
        console.log(`Skipping balance update for 'Opening Balance' transaction (Account ID: ${transactionData.accountId}).`);
    }
    // -------------------------------------------

    // --- Add Transaction to Session Memory ---
    // This happens *after* attempting the balance update
    const newTransaction: Transaction = {
        ...transactionData,
        id: `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        amount: transactionAmount,
        category: transactionData.category?.trim() || 'Uncategorized', // Use original casing for storage
        tags: transactionData.tags || [], // Ensure tags is an array
    };

    // Initialize array if account has no transactions yet in this session
    if (!sessionTransactions[newTransaction.accountId]) {
        sessionTransactions[newTransaction.accountId] = [];
    }

    sessionTransactions[newTransaction.accountId].unshift(newTransaction); // Add to beginning for default sort
    console.log("Transaction added to session memory:", newTransaction);
    // --------------------------------------

    return newTransaction;
}

/**
 * Simulates updating an existing transaction in the in-memory store and adjusts the account balance.
 * @param updatedTransaction The transaction object with updated details.
 * @returns A promise resolving to the updated transaction.
 */
export async function updateTransaction(updatedTransaction: Transaction): Promise<Transaction> {
     console.log(`Attempting to update transaction: ${updatedTransaction.id}`);
     await new Promise(resolve => setTimeout(resolve, 50));

     const accountTransactions = sessionTransactions[updatedTransaction.accountId];
     if (!accountTransactions) {
         throw new Error(`No transactions found in memory for account ${updatedTransaction.accountId}`);
     }

     const index = accountTransactions.findIndex(tx => tx.id === updatedTransaction.id);
     if (index === -1) {
         throw new Error(`Transaction with ID ${updatedTransaction.id} not found in memory for account ${updatedTransaction.accountId}`);
     }

     const originalTransaction = accountTransactions[index]; // Get the original transaction before updating
     const amountDifference = updatedTransaction.amount - originalTransaction.amount; // Calculate the change in amount

     // --- Update Account Balance FIRST (if amount changed) ---
     if (amountDifference !== 0) {
         try {
             const accounts = await getAccounts();
             const accountIndex = accounts.findIndex(acc => acc.id === updatedTransaction.accountId);
             if (accountIndex !== -1) {
                 const accountToUpdate = accounts[accountIndex];
                 const originalBalance = accountToUpdate.balance;
                 const updatedBalance = originalBalance + amountDifference; // Adjust by the difference
                  console.log(`Account ${accountToUpdate.name} balance adjustment: Original=${originalBalance}, Diff=${amountDifference}, New=${updatedBalance}`);
                 await updateAccountService({ ...accountToUpdate, balance: updatedBalance, lastActivity: new Date().toISOString() });
                 console.log(`Account ${accountToUpdate.name} balance successfully adjusted to: ${updatedBalance}`);
             } else {
                 console.warn(`Account with ID ${updatedTransaction.accountId} not found when trying to update balance during transaction update. Balance not adjusted.`);
             }
         } catch (error) {
             console.error(`Error updating account balance for transaction update ${updatedTransaction.id}:`, error);
             // If balance update fails, should we revert the transaction update?
             // For now, log the error and proceed with updating the transaction in memory.
             // Consider throwing error to ensure consistency.
             // throw new Error(`Failed to update balance for account ${updatedTransaction.accountId}. Transaction update failed.`);
         }
     }
     // -------------------------------------------

     // --- Update the transaction in the session store ---
     accountTransactions[index] = {
         ...updatedTransaction,
         category: updatedTransaction.category?.trim() || 'Uncategorized',
         tags: updatedTransaction.tags || [], // Ensure tags is an array
     };
     console.log("Transaction updated in session memory:", accountTransactions[index]);
     // -------------------------------------------

     return accountTransactions[index];
}

/**
 * Simulates deleting a transaction by ID from the in-memory store and updates the account balance.
 * @param transactionId The ID of the transaction to delete.
 * @param accountId The ID of the account the transaction belongs to.
 * @returns A promise resolving when the deletion is complete.
 */
export async function deleteTransaction(transactionId: string, accountId: string): Promise<void> {
    console.log(`Attempting to delete transaction: ${transactionId} from account: ${accountId}`);
    await new Promise(resolve => setTimeout(resolve, 50));

    const accountTransactions = sessionTransactions[accountId];
     if (!accountTransactions) {
         console.warn(`No transactions found in memory for account ${accountId} during deletion attempt.`);
         return; // Or throw error?
     }

     const transactionIndex = accountTransactions.findIndex(tx => tx.id === transactionId);
     if (transactionIndex === -1) {
         console.warn(`Transaction with ID ${transactionId} not found for deletion in memory.`);
         return; // Or throw error?
     }

     const transactionToDelete = accountTransactions[transactionIndex];
     const amountToDelete = transactionToDelete.amount; // The amount to reverse from balance

     // --- Update Account Balance FIRST ---
     try {
         const accounts = await getAccounts();
         const accountIndex = accounts.findIndex(acc => acc.id === accountId);
         if (accountIndex !== -1) {
             const accountToUpdate = accounts[accountIndex];
             const originalBalance = accountToUpdate.balance;
             const updatedBalance = originalBalance - amountToDelete; // Subtract the deleted amount
             console.log(`Account ${accountToUpdate.name} balance reversal: Original=${originalBalance}, Reversing=${amountToDelete}, New=${updatedBalance}`);
             await updateAccountService({ ...accountToUpdate, balance: updatedBalance, lastActivity: new Date().toISOString() });
              console.log(`Account ${accountToUpdate.name} balance successfully updated after deletion to: ${updatedBalance}`);
         } else {
             console.warn(`Account with ID ${accountId} not found when trying to update balance during transaction deletion. Balance not adjusted.`);
         }
     } catch (error) {
         console.error(`Error updating account balance for transaction deletion ${transactionId}:`, error);
         // If balance update fails, should we still delete the transaction from memory?
         // For now, log error and proceed. Consider throwing error.
         // throw new Error(`Failed to update balance for account ${accountId}. Transaction deletion failed.`);
     }
     // -------------------------------------------

     // --- Filter out the transaction from session memory ---
     sessionTransactions[accountId].splice(transactionIndex, 1);
     console.log("Transaction removed from session memory.");
     // -------------------------------------------
}

// Function to clear all transactions from the in-memory store (for testing/reset)
export function clearAllSessionTransactions(): void {
    console.log("Clearing all transactions from session memory...");
    for (const accountId in sessionTransactions) {
        delete sessionTransactions[accountId];
    }
    // Also clear associated balances in localStorage for a full reset
     if (typeof window !== 'undefined') {
        // Don't clear accounts here anymore, only transactions
        // localStorage.removeItem('userAccounts'); // Keep accounts
        localStorage.removeItem('userCategories'); // Clear these if needed for reset
        localStorage.removeItem('userTags'); // Clear these if needed for reset
        // Don't clear preferences
     }

    console.log("Session transactions cleared.");
}

// NOTE: No loading from localStorage is needed for transactions now.
// The store starts empty each session.
