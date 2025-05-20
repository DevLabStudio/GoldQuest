
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
        const parsed = parseISO(dateInput);
        return isValid(parsed) ? formatDateFns(parsed, "yyyy-MM-dd'T'HH:mm:ssXXX") : dateInput;
    }
    // Assuming serverTimestamp object will be a number (timestamp) when fetched,
    // but Firebase often returns it as an object initially. If it's already a string, use it.
    // For actual numeric timestamps from Firebase, you'd convert new Date(timestamp)
    // This simplistic approach assumes it's either a parsable string or we return a placeholder.
    // A more robust solution would handle Firebase serverTimestamps correctly after they resolve.
    if (typeof dateInput === 'object') {
        // Placeholder for unresolved serverTimestamp. Real value needs server-side conversion or client-side handling post-fetch.
        return new Date().toISOString(); // Fallback for unresolved server timestamps
    }
    return String(dateInput); // Fallback for other types
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
  let combinedCsvString = "";
  const sectionSeparator = "\n\n"; // Add a couple of newlines between sections

  try {
    const appendToCombinedCsv = (header: string, data: any[]) => {
        if (data && data.length > 0) {
            combinedCsvString += `### ${header} ###\n`;
            combinedCsvString += Papa.unparse(data);
            combinedCsvString += sectionSeparator;
            console.log(`Appended ${header} to CSV export.`);
        } else {
            combinedCsvString += `### ${header} ###\n(No data)\n`;
            combinedCsvString += sectionSeparator;
            console.log(`No data to append for ${header}.`);
        }
    };

    // 1. User Preferences
    console.log("Exporting: Fetching User Preferences...");
    const preferences = await getUserPreferences();
    if (preferences) { // Ensure preferences is not null/undefined
        appendToCombinedCsv("USER PREFERENCES", [preferences]);
    } else {
        appendToCombinedCsv("USER PREFERENCES", []);
    }

    // 2. Categories
    console.log("Exporting: Fetching Categories...");
    const categories = await getCategories();
    appendToCombinedCsv("CATEGORIES", categories);

    // 3. Tags
    console.log("Exporting: Fetching Tags...");
    const tags = await getTags();
    appendToCombinedCsv("TAGS", tags);

    // 4. Groups
    console.log("Exporting: Fetching Groups...");
    const groups = await getGroups();
    const exportableGroups: ExportableGroup[] = groups.map(g => ({
        ...g,
        categoryIds: g.categoryIds ? g.categoryIds.join('|') : '',
    }));
    appendToCombinedCsv("GROUPS", exportableGroups);

    // 5. Accounts
    console.log("Exporting: Fetching Accounts...");
    const accounts = await getAccounts();
    appendToCombinedCsv("ACCOUNTS", accounts);

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
            appendToCombinedCsv("TRANSACTIONS", exportableTransactions);
        } else {
             appendToCombinedCsv("TRANSACTIONS", []);
        }
    } else {
        appendToCombinedCsv("TRANSACTIONS", []);
    }


    // 7. Subscriptions
    console.log("Exporting: Fetching Subscriptions...");
    const subscriptions = await getSubscriptions();
    const exportableSubscriptions: ExportableSubscription[] = subscriptions.map(sub => ({
        ...sub,
        tags: sub.tags ? sub.tags.join('|') : '',
        createdAt: formatDateForExport(sub.createdAt),
        updatedAt: formatDateForExport(sub.updatedAt),
    }));
    appendToCombinedCsv("SUBSCRIPTIONS", exportableSubscriptions);

    // 8. Loans
    console.log("Exporting: Fetching Loans...");
    const loans = await getLoans();
    const exportableLoans = loans.map(loan => ({
        ...loan,
        createdAt: formatDateForExport(loan.createdAt),
        updatedAt: formatDateForExport(loan.updatedAt),
    }));
    appendToCombinedCsv("LOANS", exportableLoans);

    // 9. Credit Cards
    console.log("Exporting: Fetching Credit Cards...");
    const creditCards = await getCreditCards();
    const exportableCreditCards = creditCards.map(card => ({
        ...card,
        createdAt: formatDateForExport(card.createdAt),
        updatedAt: formatDateForExport(card.updatedAt),
    }));
    appendToCombinedCsv("CREDIT CARDS", exportableCreditCards);

    // 10. Budgets
    console.log("Exporting: Fetching Budgets...");
    const budgets = await getBudgets();
    const exportableBudgets: ExportableBudget[] = budgets.map(b => ({
        ...b,
        selectedIds: b.selectedIds ? b.selectedIds.join('|') : '',
        createdAt: formatDateForExport(b.createdAt),
        updatedAt: formatDateForExport(b.updatedAt),
    }));
    appendToCombinedCsv("BUDGETS", exportableBudgets);

    // Download the combined CSV
    if (combinedCsvString.trim() !== "") {
        downloadCsv(combinedCsvString, 'goldquest_full_backup.csv');
        console.log('Combined CSV data prepared for download.');
    } else {
        console.log('No data found to export.');
    }

  } catch (error) {
    console.error("Error exporting all user data:", error);
    throw error;
  }
}
