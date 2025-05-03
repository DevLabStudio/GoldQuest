
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

// --- Mock Data Store ---
// In a real app, this would be fetched from a database or API.
// Store transactions keyed by accountId for easier retrieval.
const mockTransactions: { [accountId: string]: Transaction[] } = {
  // Add some initial mock data if needed, or leave empty
  'manual-123': [ // Example using a possible default ID from account-sync
    { id: 'tx-1', date: '2024-07-15', amount: -55.40, description: 'Supermarket Mart', category: 'Groceries', accountId: 'manual-123' }, // Use names matching default categories
    { id: 'tx-2', date: '2024-07-10', amount: -1200.00, description: 'Rent Payment July', category: 'Rent', accountId: 'manual-123' },
    { id: 'tx-3', date: '2024-07-05', amount: 2500.00, description: 'Salary Deposit', category: 'Salary', accountId: 'manual-123' },
    { id: 'tx-4', date: '2024-07-18', amount: -30.00, description: 'Coffee Shop', category: 'Food', accountId: 'manual-123' },
    { id: 'tx-5', date: '2024-07-20', amount: -75.80, description: 'Electricity Bill', category: 'Utilities', accountId: 'manual-123' },
     { id: 'tx-6', date: '2024-07-22', amount: -15.00, description: 'Bus Fare', category: 'Transportation', accountId: 'manual-123' },
     { id: 'tx-uncat', date: '2024-07-23', amount: -10.00, description: 'Unknown Vendor', category: 'Uncategorized', accountId: 'manual-123' },
  ],
  'manual-crypto-abc': [
     { id: 'tx-crypto-1', date: '2024-07-12', amount: -150.00, description: 'ETH Purchase', category: 'Investment', accountId: 'manual-crypto-abc' },
     { id: 'tx-crypto-2', date: '2024-07-21', amount: 12.50, description: 'Staking Reward', category: 'Income', accountId: 'manual-crypto-abc' },
  ]
  // Add more account IDs and their transactions as accounts are created
};


// --- Mock API Functions ---

/**
 * Asynchronously retrieves a list of financial transactions for a given account.
 * Simulates fetching from our mock data store.
 *
 * @param accountId The ID of the account for which to retrieve transactions.
 * @returns A promise that resolves to an array of Transaction objects.
 */
export async function getTransactions(accountId: string): Promise<Transaction[]> {
  console.log(`Simulating fetching transactions for account: ${accountId}`);
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300)); // Simulate network delay

  const transactionsForAccount = mockTransactions[accountId] || [];

  // Return a copy sorted by date descending (newest first)
  return [...transactionsForAccount].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Simulates adding a new transaction to the mock data store.
 * In a real app, this would send a request to your backend API.
 *
 * @param transactionData Data for the new transaction (excluding ID). Category name should exist.
 * @returns A promise that resolves to the newly created Transaction object with an ID.
 */
export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction> {
    console.log("Simulating adding transaction:", transactionData);
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate delay

    const newTransaction: Transaction = {
        ...transactionData,
        id: `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`, // Simple unique ID generation
        // Ensure category is set, default to 'Uncategorized' if missing or empty
        category: transactionData.category?.trim() || 'Uncategorized',
    };

    // Initialize array if account has no transactions yet
    if (!mockTransactions[newTransaction.accountId]) {
        mockTransactions[newTransaction.accountId] = [];
    }

    mockTransactions[newTransaction.accountId].push(newTransaction);

    console.log("Transaction added (simulated):", newTransaction);
    // Note: In a real app using localStorage for persistence (like accounts),
    // you'd save the updated mockTransactions object here.
    // localStorage.setItem('userTransactions', JSON.stringify(mockTransactions));

    return newTransaction;
}

// --- Potentially Add More Mock Functions (Update, Delete) ---

/**
 * Simulates updating an existing transaction.
 * @param updatedTransaction The transaction object with updated details.
 * @returns A promise resolving to the updated transaction.
 */
export async function updateTransaction(updatedTransaction: Transaction): Promise<Transaction> {
     console.log(`Simulating updating transaction: ${updatedTransaction.id}`);
     await new Promise(resolve => setTimeout(resolve, 150));

     const accountTransactions = mockTransactions[updatedTransaction.accountId];
     if (!accountTransactions) {
         throw new Error(`No transactions found for account ${updatedTransaction.accountId}`);
     }

     const index = accountTransactions.findIndex(tx => tx.id === updatedTransaction.id);
     if (index === -1) {
         throw new Error(`Transaction with ID ${updatedTransaction.id} not found in account ${updatedTransaction.accountId}`);
     }

     // Ensure category exists, default to 'Uncategorized' if missing
     accountTransactions[index] = {
         ...updatedTransaction,
         category: updatedTransaction.category?.trim() || 'Uncategorized'
     };
     // Persist changes if using localStorage
     // localStorage.setItem('userTransactions', JSON.stringify(mockTransactions));

     console.log("Transaction updated (simulated):", accountTransactions[index]);
     return accountTransactions[index];
}

/**
 * Simulates deleting a transaction by ID.
 * @param transactionId The ID of the transaction to delete.
 * @param accountId The ID of the account the transaction belongs to.
 * @returns A promise resolving when the deletion is complete.
 */
export async function deleteTransaction(transactionId: string, accountId: string): Promise<void> {
    console.log(`Simulating deleting transaction: ${transactionId} from account: ${accountId}`);
    await new Promise(resolve => setTimeout(resolve, 150));

    const accountTransactions = mockTransactions[accountId];
     if (!accountTransactions) {
         console.warn(`No transactions found for account ${accountId} during deletion attempt.`);
         return; // Or throw error? Depends on desired behavior.
     }

     const initialLength = accountTransactions.length;
     mockTransactions[accountId] = accountTransactions.filter(tx => tx.id !== transactionId);

     if (mockTransactions[accountId].length === initialLength) {
          console.warn(`Transaction with ID ${transactionId} not found for deletion.`);
     } else {
        // Persist changes if using localStorage
        // localStorage.setItem('userTransactions', JSON.stringify(mockTransactions));
        console.log("Transaction deleted (simulated)");
     }
}

// Optional: Function to load transactions from localStorage on app start
// (Only useful if you decide to persist the mock data)
/*
export function loadTransactionsFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
        const stored = localStorage.getItem('userTransactions');
        if (stored) {
            const parsed = JSON.parse(stored);
            // Basic validation could go here
            Object.assign(mockTransactions, parsed); // Overwrite in-memory store
             console.log("Loaded transactions from localStorage");
        }
    } catch (e) {
        console.error("Failed to load transactions from localStorage", e);
    }
}
// Call loadTransactionsFromStorage() once when your app initializes client-side.
*/
