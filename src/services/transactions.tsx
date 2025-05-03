
import type { Account } from './account-sync'; // Assuming Account interface is here
import React from 'react'; // Import React for JSX

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
}

// --- Mock Data Store (In-Memory) ---
// Transactions will be stored here for the duration of the session.
// They will be cleared when the browser page is refreshed.
const sessionTransactions: { [accountId: string]: Transaction[] } = {};


// --- Mock API Functions ---

/**
 * Asynchronously retrieves a list of financial transactions for a given account
 * from the in-memory store.
 *
 * @param accountId The ID of the account for which to retrieve transactions.
 * @returns A promise that resolves to an array of Transaction objects.
 */
export async function getTransactions(accountId: string): Promise<Transaction[]> {
  console.log(`Simulating fetching transactions for account: ${accountId} from memory`);
  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100)); // Simulate shorter delay

  const transactionsForAccount = sessionTransactions[accountId] || [];

  // Return a copy sorted by date descending (newest first)
  return [...transactionsForAccount].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Simulates adding a new transaction to the in-memory mock data store.
 *
 * @param transactionData Data for the new transaction (excluding ID). Category name should exist.
 * @returns A promise that resolves to the newly created Transaction object with an ID.
 */
export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction> {
    console.log("Simulating adding transaction to memory:", transactionData);
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate short delay

    const newTransaction: Transaction = {
        ...transactionData,
        id: `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        category: transactionData.category?.trim() || 'Uncategorized',
    };

    // Initialize array if account has no transactions yet in this session
    if (!sessionTransactions[newTransaction.accountId]) {
        sessionTransactions[newTransaction.accountId] = [];
    }

    sessionTransactions[newTransaction.accountId].push(newTransaction);

    console.log("Transaction added to memory (simulated):", newTransaction);
    // No localStorage persistence needed here anymore

    return newTransaction;
}

/**
 * Simulates updating an existing transaction in the in-memory store.
 * @param updatedTransaction The transaction object with updated details.
 * @returns A promise resolving to the updated transaction.
 */
export async function updateTransaction(updatedTransaction: Transaction): Promise<Transaction> {
     console.log(`Simulating updating transaction in memory: ${updatedTransaction.id}`);
     await new Promise(resolve => setTimeout(resolve, 50));

     const accountTransactions = sessionTransactions[updatedTransaction.accountId];
     if (!accountTransactions) {
         throw new Error(`No transactions found in memory for account ${updatedTransaction.accountId}`);
     }

     const index = accountTransactions.findIndex(tx => tx.id === updatedTransaction.id);
     if (index === -1) {
         throw new Error(`Transaction with ID ${updatedTransaction.id} not found in memory for account ${updatedTransaction.accountId}`);
     }

     accountTransactions[index] = {
         ...updatedTransaction,
         category: updatedTransaction.category?.trim() || 'Uncategorized'
     };

     console.log("Transaction updated in memory (simulated):", accountTransactions[index]);
     return accountTransactions[index];
}

/**
 * Simulates deleting a transaction by ID from the in-memory store.
 * @param transactionId The ID of the transaction to delete.
 * @param accountId The ID of the account the transaction belongs to.
 * @returns A promise resolving when the deletion is complete.
 */
export async function deleteTransaction(transactionId: string, accountId: string): Promise<void> {
    console.log(`Simulating deleting transaction from memory: ${transactionId} from account: ${accountId}`);
    await new Promise(resolve => setTimeout(resolve, 50));

    const accountTransactions = sessionTransactions[accountId];
     if (!accountTransactions) {
         console.warn(`No transactions found in memory for account ${accountId} during deletion attempt.`);
         return;
     }

     const initialLength = accountTransactions.length;
     sessionTransactions[accountId] = accountTransactions.filter(tx => tx.id !== transactionId);

     if (sessionTransactions[accountId].length === initialLength) {
          console.warn(`Transaction with ID ${transactionId} not found for deletion in memory.`);
     } else {
        console.log("Transaction deleted from memory (simulated)");
     }
}

// Function to clear all transactions from the in-memory store (for testing/reset)
export function clearAllSessionTransactions(): void {
    console.log("Clearing all transactions from session memory...");
    for (const accountId in sessionTransactions) {
        delete sessionTransactions[accountId];
    }
    console.log("Session transactions cleared.");
}

// NOTE: No loading from localStorage is needed for transactions now.
// The store starts empty each session.
