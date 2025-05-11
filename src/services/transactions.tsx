
import type { Account } from './account-sync'; // Assuming Account interface is here
import React from 'react'; // Import React for JSX
import { getAccounts, updateAccount as updateAccountService } from './account-sync';
import { convertCurrency } from '@/lib/currency'; // Import convertCurrency

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
   * The amount of the transaction, in the transactionCurrency. Positive for income, negative for expenses.
   */
  amount: number;
  /**
   * The currency of the transaction.amount.
   */
  transactionCurrency: string;
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

export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction> {
    console.log("Attempting to add transaction:", transactionData);
    await new Promise(resolve => setTimeout(resolve, 50));

    const categoryName = transactionData.category?.trim() || 'Uncategorized';
    const categoryNameLower = categoryName.toLowerCase();

    if (categoryNameLower !== 'opening balance') {
        try {
            const accounts = await getAccounts();
            const accountIndex = accounts.findIndex(acc => acc.id === transactionData.accountId);
            if (accountIndex !== -1) {
                const accountToUpdate = accounts[accountIndex];
                const originalBalance = accountToUpdate.balance;

                let amountInAccountCurrency = transactionData.amount;
                if (transactionData.transactionCurrency.toUpperCase() !== accountToUpdate.currency.toUpperCase()) {
                    amountInAccountCurrency = convertCurrency(
                        transactionData.amount,
                        transactionData.transactionCurrency,
                        accountToUpdate.currency
                    );
                    console.log(`Converted transaction amount for ${accountToUpdate.name} (ID: ${accountToUpdate.id}): ${transactionData.amount} ${transactionData.transactionCurrency} -> ${amountInAccountCurrency} ${accountToUpdate.currency}`);
                } else {
                    console.log(`Transaction amount for ${accountToUpdate.name} (ID: ${accountToUpdate.id}) is already in account currency: ${amountInAccountCurrency} ${accountToUpdate.currency}`);
                }

                const updatedBalance = originalBalance + amountInAccountCurrency;

                console.log(`Account ${accountToUpdate.name} (ID: ${accountToUpdate.id}) balance update for transaction: Original=${originalBalance}, TxAmountInAccountCurrency=${amountInAccountCurrency}, New=${updatedBalance}. Category: ${categoryName}`);
                await updateAccountService({ ...accountToUpdate, balance: updatedBalance, lastActivity: new Date().toISOString() });
            } else {
                console.warn(`Account ID ${transactionData.accountId} not found for balance update. Tx: ${transactionData.description}`);
            }
        } catch (error) {
            console.error(`Error updating account balance for new transaction (Account ID: ${transactionData.accountId}, Description: ${transactionData.description}):`, error);
        }
    } else {
        console.log(`Skipping balance update for 'Opening Balance' category transaction (Account ID: ${transactionData.accountId}). Balance set during import account creation.`);
    }

    const newTransaction: Transaction = {
        ...transactionData, // This now includes transactionCurrency
        id: `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        // amount is already transactionData.amount
        category: categoryName,
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
     
     try {
         const accounts = await getAccounts();
         const accountIndex = accounts.findIndex(acc => acc.id === updatedTransaction.accountId);
         if (accountIndex !== -1) {
             const accountToUpdate = accounts[accountIndex];
             let originalBalance = accountToUpdate.balance;

             // Revert old transaction effect
             let oldAmountInAccountCurrency = originalTransaction.amount;
             if (originalTransaction.transactionCurrency.toUpperCase() !== accountToUpdate.currency.toUpperCase()) {
                 oldAmountInAccountCurrency = convertCurrency(
                     originalTransaction.amount,
                     originalTransaction.transactionCurrency,
                     accountToUpdate.currency
                 );
             }
             originalBalance -= oldAmountInAccountCurrency; // Reverted state

             // Apply new transaction effect
             let newAmountInAccountCurrency = updatedTransaction.amount;
             if (updatedTransaction.transactionCurrency.toUpperCase() !== accountToUpdate.currency.toUpperCase()) {
                 newAmountInAccountCurrency = convertCurrency(
                     updatedTransaction.amount,
                     updatedTransaction.transactionCurrency,
                     accountToUpdate.currency
                 );
             }
             const finalBalance = originalBalance + newAmountInAccountCurrency;
             await updateAccountService({ ...accountToUpdate, balance: finalBalance, lastActivity: new Date().toISOString() });
         }
     } catch (error) {
         console.error(`Error updating account balance for transaction update ${updatedTransaction.id}:`, error);
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
     
     try {
         const accounts = await getAccounts();
         const accountIndexAc = accounts.findIndex(acc => acc.id === accountId);
         if (accountIndexAc !== -1) {
             const accountToUpdate = accounts[accountIndexAc];
             const originalBalance = accountToUpdate.balance;

             let amountToRevertInAccountCurrency = transactionToDelete.amount;
             if (transactionToDelete.transactionCurrency.toUpperCase() !== accountToUpdate.currency.toUpperCase()) {
                 amountToRevertInAccountCurrency = convertCurrency(
                     transactionToDelete.amount,
                     transactionToDelete.transactionCurrency,
                     accountToUpdate.currency
                 );
             }
             const updatedBalance = originalBalance - amountToRevertInAccountCurrency; // Subtract its effect
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
        // localStorage.removeItem('userCategories');
        // localStorage.removeItem('userTags');
     }
    console.log("Session transactions cleared.");
}
