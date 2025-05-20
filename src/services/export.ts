
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
import { format as formatDateFns, isValid, parseISO } from 'date-fns';

function downloadCsv(csvString: string, filename: string) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    alert('CSV download is not supported by your browser. Please try a different browser.');
  }
}

const formatDateForExport = (dateInput: object | string | undefined | null): string => {
    if (!dateInput) return '';
    if (typeof dateInput === 'string') {
        // Check if it's already a fully qualified ISO string (e.g., from serverTimestamp or new Date().toISOString())
        // or a simple YYYY-MM-DD date.
        const parsed = parseISO(dateInput); // parseISO is robust
        return isValid(parsed) ? formatDateFns(parsed, "yyyy-MM-dd'T'HH:mm:ssXXX") : dateInput;
    }
    // This case is tricky for Firebase serverTimestamp, which is an object initially.
    // For simplicity, if it's an object here, it means it wasn't resolved to a number/string.
    // A proper solution would handle the Firebase ServerValue.TIMESTAMP object correctly,
    // or ensure data is fetched *after* timestamps are resolved.
    // For now, returning an empty string or a placeholder for unresolved objects.
    if (typeof dateInput === 'object' && dateInput !== null) {
        // If it has a toDate method (like a Firebase Timestamp object *after* conversion client-side)
        if ('toDate' in dateInput && typeof (dateInput as any).toDate === 'function') {
             return formatDateFns((dateInput as any).toDate(), "yyyy-MM-dd'T'HH:mm:ssXXX");
        }
        // Fallback for other objects or unresolved serverTimestamps
        return new Date().toISOString(); // Or consider '' or a placeholder
    }
    if (typeof dateInput === 'number') { // Assuming numeric timestamp
        return formatDateFns(new Date(dateInput), "yyyy-MM-dd'T'HH:mm:ssXXX");
    }
    return String(dateInput);
};


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
    console.log("Exporting: Fetching User Preferences...");
    const preferences = await getUserPreferences();
    if (preferences) {
      downloadCsv(Papa.unparse([preferences]), 'goldquest_preferences.csv');
    } else {
      console.log("No preferences data to export.");
    }

    // 2. Categories
    console.log("Exporting: Fetching Categories...");
    const categories = await getCategories();
    if (categories.length > 0) {
        downloadCsv(Papa.unparse(categories), 'goldquest_categories.csv');
    } else {
        console.log("No categories data to export.");
    }

    // 3. Tags
    console.log("Exporting: Fetching Tags...");
    const tags = await getTags();
     if (tags.length > 0) {
        downloadCsv(Papa.unparse(tags), 'goldquest_tags.csv');
    } else {
        console.log("No tags data to export.");
    }

    // 4. Groups
    console.log("Exporting: Fetching Groups...");
    const groups = await getGroups();
    if (groups.length > 0) {
        const exportableGroups: ExportableGroup[] = groups.map(g => ({
            ...g,
            categoryIds: g.categoryIds ? g.categoryIds.join('|') : '',
        }));
        downloadCsv(Papa.unparse(exportableGroups), 'goldquest_groups.csv');
    } else {
        console.log("No groups data to export.");
    }


    // 5. Accounts
    console.log("Exporting: Fetching Accounts...");
    const accounts = await getAccounts();
     if (accounts.length > 0) {
        downloadCsv(Papa.unparse(accounts), 'goldquest_accounts.csv');
    } else {
        console.log("No accounts data to export.");
    }

    // 6. Transactions (fetch per account, then combine)
    if (accounts.length > 0) {
        console.log("Exporting: Fetching Transactions...");
        let allTransactions: Transaction[] = [];
        for (const account of accounts) {
            try {
                const accountTransactions = await getTransactions(account.id);
                allTransactions = allTransactions.concat(accountTransactions);
            } catch (accTxError) {
                console.error(`Error fetching transactions for account ${account.id}:`, accTxError);
            }
        }
        if (allTransactions.length > 0) {
            const exportableTransactions: ExportableTransaction[] = allTransactions.map(tx => ({
              ...tx,
              tags: tx.tags ? tx.tags.join('|') : '',
              originalImportData: tx.originalImportData ? JSON.stringify(tx.originalImportData) : '',
              createdAt: formatDateForExport(tx.createdAt),
              updatedAt: formatDateForExport(tx.updatedAt),
            }));
            downloadCsv(Papa.unparse(exportableTransactions), 'goldquest_transactions.csv');
        } else {
             console.log("No transactions data to export.");
        }
    } else {
        console.log("No accounts found, skipping transaction export.");
    }


    // 7. Subscriptions
    console.log("Exporting: Fetching Subscriptions...");
    const subscriptions = await getSubscriptions();
    if (subscriptions.length > 0) {
        const exportableSubscriptions: ExportableSubscription[] = subscriptions.map(sub => ({
            ...sub,
            tags: sub.tags ? sub.tags.join('|') : '',
            createdAt: formatDateForExport(sub.createdAt),
            updatedAt: formatDateForExport(sub.updatedAt),
        }));
        downloadCsv(Papa.unparse(exportableSubscriptions), 'goldquest_subscriptions.csv');
    } else {
        console.log("No subscriptions data to export.");
    }


    // 8. Loans
    console.log("Exporting: Fetching Loans...");
    const loans = await getLoans();
    if (loans.length > 0) {
        const exportableLoans = loans.map(loan => ({
            ...loan,
            createdAt: formatDateForExport(loan.createdAt),
            updatedAt: formatDateForExport(loan.updatedAt),
        }));
        downloadCsv(Papa.unparse(exportableLoans), 'goldquest_loans.csv');
    } else {
        console.log("No loans data to export.");
    }

    // 9. Credit Cards
    console.log("Exporting: Fetching Credit Cards...");
    const creditCards = await getCreditCards();
    if (creditCards.length > 0) {
        const exportableCreditCards = creditCards.map(card => ({
            ...card,
            createdAt: formatDateForExport(card.createdAt),
            updatedAt: formatDateForExport(card.updatedAt),
        }));
        downloadCsv(Papa.unparse(exportableCreditCards), 'goldquest_credit_cards.csv');
    } else {
        console.log("No credit cards data to export.");
    }


    // 10. Budgets
    console.log("Exporting: Fetching Budgets...");
    const budgets = await getBudgets();
    if (budgets.length > 0) {
        const exportableBudgets: ExportableBudget[] = budgets.map(b => ({
            ...b,
            selectedIds: b.selectedIds ? b.selectedIds.join('|') : '',
            createdAt: formatDateForExport(b.createdAt),
            updatedAt: formatDateForExport(b.updatedAt),
        }));
        downloadCsv(Papa.unparse(exportableBudgets), 'goldquest_budgets.csv');
    } else {
        console.log("No budgets data to export.");
    }

    console.log('Individual CSV data files prepared for download.');

  } catch (error) {
    console.error("Error exporting all user data:", error);
    throw error;
  }
}
