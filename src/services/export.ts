
'use client';

import Papa from 'papaparse';
import { getAccounts, type Account } from './account-sync';
import { getCategories, type Category } from './categories';
import { getTags, type Tag } from './tags';
import { getGroups, type Group } from './groups';
import { getTransactions, type Transaction } from './transactions';
import { getSubscriptions, type Subscription } from './subscriptions';
import { getLoans, type Loan } from './loans';
import { getCreditCards, type CreditCard } from './credit-cards';
import { getBudgets, type Budget } from './budgets';
import { getUserPreferences, type UserPreferences } from '@/lib/preferences';

function downloadCsv(csvString: string, filename: string) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) { // feature detection
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    // Fallback for browsers that don't support HTML5 download attribute
    alert('CSV download is not supported by your browser. Please try a different browser.');
  }
}

interface ExportableTransaction extends Omit<Transaction, 'tags' | 'originalImportData' | 'createdAt' | 'updatedAt'> {
    tags?: string; // Pipe-separated
    originalImportData?: string; // JSON string
    createdAt?: string;
    updatedAt?: string;
}
interface ExportableSubscription extends Omit<Subscription, 'tags' | 'createdAt' | 'updatedAt'> {
    tags?: string; // Pipe-separated
    createdAt?: string;
    updatedAt?: string;
}

interface ExportableGroup extends Omit<Group, 'categoryIds'> {
    categoryIds?: string; // Pipe-separated
}
interface ExportableBudget extends Omit<Budget, 'selectedIds' | 'createdAt' | 'updatedAt'> {
    selectedIds?: string; // Pipe-separated
    createdAt?: string;
    updatedAt?: string;
}


export async function exportAllUserDataToCsvs(): Promise<void> {
  try {
    // 1. User Preferences
    const preferences = await getUserPreferences();
    if (preferences) {
      const preferencesCsv = Papa.unparse([preferences]);
      downloadCsv(preferencesCsv, 'user_preferences.csv');
    }

    // 2. Categories
    const categories = await getCategories();
    if (categories.length > 0) {
      const categoriesCsv = Papa.unparse(categories);
      downloadCsv(categoriesCsv, 'categories.csv');
    }

    // 3. Tags
    const tags = await getTags();
    if (tags.length > 0) {
      const tagsCsv = Papa.unparse(tags);
      downloadCsv(tagsCsv, 'tags.csv');
    }

    // 4. Groups
    const groups = await getGroups();
    if (groups.length > 0) {
      const exportableGroups: ExportableGroup[] = groups.map(g => ({
        ...g,
        categoryIds: g.categoryIds.join('|'),
      }));
      const groupsCsv = Papa.unparse(exportableGroups);
      downloadCsv(groupsCsv, 'groups.csv');
    }

    // 5. Accounts
    const accounts = await getAccounts();
    if (accounts.length > 0) {
      const accountsCsv = Papa.unparse(accounts);
      downloadCsv(accountsCsv, 'accounts.csv');

      // 6. Transactions (fetch per account, then combine)
      let allTransactions: Transaction[] = [];
      for (const account of accounts) {
        const accountTransactions = await getTransactions(account.id);
        allTransactions = allTransactions.concat(accountTransactions);
      }
      if (allTransactions.length > 0) {
        const exportableTransactions: ExportableTransaction[] = allTransactions.map(tx => ({
          ...tx,
          tags: tx.tags?.join('|') || '',
          originalImportData: tx.originalImportData ? JSON.stringify(tx.originalImportData) : '',
          createdAt: typeof tx.createdAt === 'object' ? new Date().toISOString() : tx.createdAt, // Placeholder for serverTimestamp
          updatedAt: typeof tx.updatedAt === 'object' ? new Date().toISOString() : tx.updatedAt, // Placeholder for serverTimestamp
        }));
        const transactionsCsv = Papa.unparse(exportableTransactions);
        downloadCsv(transactionsCsv, 'transactions.csv');
      }
    }

    // 7. Subscriptions
    const subscriptions = await getSubscriptions();
    if (subscriptions.length > 0) {
      const exportableSubscriptions: ExportableSubscription[] = subscriptions.map(sub => ({
        ...sub,
        tags: sub.tags?.join('|') || '',
        createdAt: typeof sub.createdAt === 'object' ? new Date().toISOString() : sub.createdAt,
        updatedAt: typeof sub.updatedAt === 'object' ? new Date().toISOString() : sub.updatedAt,
      }));
      const subscriptionsCsv = Papa.unparse(exportableSubscriptions);
      downloadCsv(subscriptionsCsv, 'subscriptions.csv');
    }

    // 8. Loans
    const loans = await getLoans();
    if (loans.length > 0) {
       const exportableLoans = loans.map(loan => ({
        ...loan,
        createdAt: typeof loan.createdAt === 'object' ? new Date().toISOString() : loan.createdAt,
        updatedAt: typeof loan.updatedAt === 'object' ? new Date().toISOString() : loan.updatedAt,
      }));
      const loansCsv = Papa.unparse(exportableLoans);
      downloadCsv(loansCsv, 'loans.csv');
    }

    // 9. Credit Cards
    const creditCards = await getCreditCards();
    if (creditCards.length > 0) {
      const exportableCreditCards = creditCards.map(card => ({
        ...card,
        createdAt: typeof card.createdAt === 'object' ? new Date().toISOString() : card.createdAt,
        updatedAt: typeof card.updatedAt === 'object' ? new Date().toISOString() : card.updatedAt,
      }));
      const creditCardsCsv = Papa.unparse(exportableCreditCards);
      downloadCsv(creditCardsCsv, 'credit_cards.csv');
    }

    // 10. Budgets
    const budgets = await getBudgets();
    if (budgets.length > 0) {
      const exportableBudgets: ExportableBudget[] = budgets.map(b => ({
        ...b,
        selectedIds: b.selectedIds.join('|'),
        createdAt: typeof b.createdAt === 'object' ? new Date().toISOString() : b.createdAt,
        updatedAt: typeof b.updatedAt === 'object' ? new Date().toISOString() : b.updatedAt,
      }));
      const budgetsCsv = Papa.unparse(exportableBudgets);
      downloadCsv(budgetsCsv, 'budgets.csv');
    }

    console.log('All user data prepared for download.');
  } catch (error) {
    console.error("Error exporting user data:", error);
    throw error;
  }
}
