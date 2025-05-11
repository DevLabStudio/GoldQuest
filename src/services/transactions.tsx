import type { Account } from './account-sync'; // Assuming Account interface is here
import React from 'react'; // Import React for JSX
import { getAccounts, updateAccount as updateAccountService } from './account-sync';

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

const sessionTransactions: { [accountId: string]: Transaction[] } = {};


export async function getTransactions(
    accountId: string,
    options?: { limit?: number }
): Promise<Transaction[]> {
  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100)); 

  const transactionsForAccount = sessionTransactions[accountId] || [];
  const sortedTransactions = [...transactionsForAccount].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

   if (options?.limit && options.limit > 0) {
       return sortedTransactions.slice(0, options.limit);
   }
   return sortedTransactions;
}

/**
 * Adds a new transaction.
 * Balance updates are now more carefully managed:
 * - 'Opening Balance' category transactions DO NOT directly update the balance here;
 *   it's assumed the account's initial balance was set during account creation/update from such CSV rows.
 * - Other transactions (expense, income, transfer legs) WILL update the balance of the specified account.
 *
 * @param transactionData Data for the new transaction (excluding ID).
 * @returns A promise resolving to the newly created Transaction object with an ID.
 */
export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction> {
    console.log("Attempting to add transaction:", transactionData);
    await new Promise(resolve => setTimeout(resolve, 50));

    const transactionAmount = transactionData.amount;
    const categoryName = transactionData.category?.trim() || 'Uncategorized'; // Keep original casing for checks
    const categoryNameLower = categoryName.toLowerCase();


    // Balance Update Logic:
    // Skip balance update if it's an "Opening Balance" category from import,
    // as this balance is set directly on the account during the import's account creation/update phase.
    if (categoryNameLower !== 'opening balance') {
        try {
            const accounts = await getAccounts();
            const accountIndex = accounts.findIndex(acc => acc.id === transactionData.accountId);
            if (accountIndex !== -1) {
                const accountToUpdate = accounts[accountIndex];
                const originalBalance = accountToUpdate.balance;

                // The transactionAmount IS the change.
                const updatedBalance = originalBalance + transactionAmount;

                console.log(`Account ${accountToUpdate.name} (ID: ${accountToUpdate.id}) balance update for transaction: Original=${originalBalance}, TxAmount=${transactionAmount}, New=${updatedBalance}. Category: ${categoryName}`);
                await updateAccountService({ ...accountToUpdate, balance: updatedBalance, lastActivity: new Date().toISOString() });
            } else {
                console.warn(`Account ID ${transactionData.accountId} not found for balance update. Tx: ${transactionData.description}`);
            }
        } catch (error) {
            console.error(`Error updating account balance for new transaction (Account ID: ${transactionData.accountId}, Description: ${transactionData.description}):`, error);
            // Depending on desired strictness, you might throw an error here to halt the process.
            // throw new Error(`Failed to update balance for account ${transactionData.accountId}. Transaction not added.`);
        }
    } else {
        console.log(`Skipping balance update for 'Opening Balance' category transaction (Account ID: ${transactionData.accountId}). Balance set during import account creation.`);
    }

    const newTransaction: Transaction = {
        ...transactionData,
        id: `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        amount: transactionAmount, // Amount is already correctly signed or valued
        category: categoryName, // Store with original casing
        tags: transactionData.tags || [],
    };

    if (!sessionTransactions[newTransaction.accountId]) {
        sessionTransactions[newTransaction.accountId] = [];
    }
    sessionTransactions[newTransaction.accountId].unshift(newTransaction);
    console.log("Transaction added to session memory:", newTransaction);
    return newTransaction;
}


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

     const originalTransaction = accountTransactions[index];
     const amountDifference = updatedTransaction.amount - originalTransaction.amount;

     if (amountDifference !== 0) {
         try {
             const accounts = await getAccounts();
             const accountIndex = accounts.findIndex(acc => acc.id === updatedTransaction.accountId);
             if (accountIndex !== -1) {
                 const accountToUpdate = accounts[accountIndex];
                 const originalBalance = accountToUpdate.balance;
                 const updatedBalance = originalBalance + amountDifference;
                 await updateAccountService({ ...accountToUpdate, balance: updatedBalance, lastActivity: new Date().toISOString() });
             }
         } catch (error) {
             console.error(`Error updating account balance for transaction update ${updatedTransaction.id}:`, error);
         }
     }
     
     accountTransactions[index] = {
         ...updatedTransaction,
         category: updatedTransaction.category?.trim() || 'Uncategorized',
         tags: updatedTransaction.tags || [],
     };
     return accountTransactions[index];
}

export async function deleteTransaction(transactionId: string, accountId: string): Promise<void> {
    console.log(`Attempting to delete transaction: ${transactionId} from account: ${accountId}`);
    await new Promise(resolve => setTimeout(resolve, 50));

    const accountTransactions = sessionTransactions[accountId];
     if (!accountTransactions) {
         return;
     }

     const transactionIndex = accountTransactions.findIndex(tx => tx.id === transactionId);
     if (transactionIndex === -1) {
         return;
     }

     const transactionToDelete = accountTransactions[transactionIndex];
     const amountToDelete = transactionToDelete.amount;

     try {
         const accounts = await getAccounts();
         const accountIndex = accounts.findIndex(acc => acc.id === accountId);
         if (accountIndex !== -1) {
             const accountToUpdate = accounts[accountIndex];
             const originalBalance = accountToUpdate.balance;
             const updatedBalance = originalBalance - amountToDelete;
             await updateAccountService({ ...accountToUpdate, balance: updatedBalance, lastActivity: new Date().toISOString() });
         }
     } catch (error) {
         console.error(`Error updating account balance for transaction deletion ${transactionId}:`, error);
     }
     
     sessionTransactions[accountId].splice(transactionIndex, 1);
}

export function clearAllSessionTransactions(): void {
    console.log("Clearing all transactions from session memory...");
    for (const accountId in sessionTransactions) {
        delete sessionTransactions[accountId];
    }
     if (typeof window !== 'undefined') {
        // Only clear userCategories and userTags if a full data wipe is intended alongside transactions.
        // localStorage.removeItem('userCategories'); 
        // localStorage.removeItem('userTags');
        // Account data and preferences should generally persist unless explicitly cleared by another function.
     }
    console.log("Session transactions cleared.");
}

