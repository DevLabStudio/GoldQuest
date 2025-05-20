
'use client';

import Papa from 'papaparse';
import JSZip from 'jszip';
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

function downloadBlob(blob: Blob, filename: string) {
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
    alert('File download is not supported by your browser.');
  }
}

const formatDateForExport = (dateInput: object | string | undefined | null): string => {
    if (!dateInput) return '';
    if (typeof dateInput === 'string') {
        const parsed = parseISO(dateInput);
        return isValid(parsed) ? formatDateFns(parsed, "yyyy-MM-dd'T'HH:mm:ssXXX") : dateInput;
    }
    if (typeof dateInput === 'object' && dateInput !== null) {
        if ('toDate' in dateInput && typeof (dateInput as any).toDate === 'function') {
             return formatDateFns((dateInput as any).toDate(), "yyyy-MM-dd'T'HH:mm:ssXXX");
        }
        // For Firebase serverTimestamp placeholder object, convert to current date as an example
        // In a real scenario, this would be handled by ensuring data is read after server resolves it
        return new Date().toISOString();
    }
    if (typeof dateInput === 'number') {
        return formatDateFns(new Date(dateInput), "yyyy-MM-dd'T'HH:mm:ssXXX");
    }
    return String(dateInput);
};


interface ExportableTransaction extends Omit<Transaction, 'tags' | 'originalImportData' | 'createdAt' | 'updatedAt'> {
    tags?: string;
    originalImportData?: string;
    createdAt?: string;
    updatedAt?: string;
}
interface ExportableSubscription extends Omit<Subscription, 'tags' | 'createdAt' | 'updatedAt'> {
    tags?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface ExportableGroup extends Omit<Group, 'categoryIds'> {
    categoryIds?: string;
}
interface ExportableBudget extends Omit<Budget, 'selectedIds' | 'createdAt' | 'updatedAt'> {
    selectedIds?: string;
    createdAt?: string;
    updatedAt?: string;
}


export async function exportAllUserDataToZip(): Promise<void> {
  const zip = new JSZip();
  const timestamp = formatDateFns(new Date(), 'yyyyMMdd_HHmmss');
  const zipFilename = `goldquest_backup_${timestamp}.zip`;

  try {
    console.log("Exporting: Fetching User Preferences...");
    const preferences = await getUserPreferences();
    if (preferences) {
      zip.file('goldquest_preferences.csv', Papa.unparse([preferences]));
    }

    console.log("Exporting: Fetching Categories...");
    const categories = await getCategories();
    if (categories.length > 0) {
        zip.file('goldquest_categories.csv', Papa.unparse(categories));
    }

    console.log("Exporting: Fetching Tags...");
    const tags = await getTags();
     if (tags.length > 0) {
        zip.file('goldquest_tags.csv', Papa.unparse(tags));
    }

    console.log("Exporting: Fetching Groups...");
    const groups = await getGroups();
    if (groups.length > 0) {
        const exportableGroups: ExportableGroup[] = groups.map(g => ({
            ...g,
            categoryIds: g.categoryIds ? g.categoryIds.join('|') : '',
        }));
        zip.file('goldquest_groups.csv', Papa.unparse(exportableGroups));
    }

    console.log("Exporting: Fetching Accounts...");
    const accounts = await getAccounts();
     if (accounts.length > 0) {
        zip.file('goldquest_accounts.csv', Papa.unparse(accounts));
    }

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
            zip.file('goldquest_transactions.csv', Papa.unparse(exportableTransactions));
        }
    }

    console.log("Exporting: Fetching Subscriptions...");
    const subscriptions = await getSubscriptions();
    if (subscriptions.length > 0) {
        const exportableSubscriptions: ExportableSubscription[] = subscriptions.map(sub => ({
            ...sub,
            tags: sub.tags ? sub.tags.join('|') : '',
            createdAt: formatDateForExport(sub.createdAt),
            updatedAt: formatDateForExport(sub.updatedAt),
        }));
        zip.file('goldquest_subscriptions.csv', Papa.unparse(exportableSubscriptions));
    }

    console.log("Exporting: Fetching Loans...");
    const loans = await getLoans();
    if (loans.length > 0) {
        const exportableLoans = loans.map(loan => ({
            ...loan,
            createdAt: formatDateForExport(loan.createdAt),
            updatedAt: formatDateForExport(loan.updatedAt),
        }));
        zip.file('goldquest_loans.csv', Papa.unparse(exportableLoans));
    }

    console.log("Exporting: Fetching Credit Cards...");
    const creditCards = await getCreditCards();
    if (creditCards.length > 0) {
        const exportableCreditCards = creditCards.map(card => ({
            ...card,
            createdAt: formatDateForExport(card.createdAt),
            updatedAt: formatDateForExport(card.updatedAt),
        }));
        zip.file('goldquest_credit_cards.csv', Papa.unparse(exportableCreditCards));
    }

    console.log("Exporting: Fetching Budgets...");
    const budgets = await getBudgets();
    if (budgets.length > 0) {
        const exportableBudgets: ExportableBudget[] = budgets.map(b => ({
            ...b,
            selectedIds: b.selectedIds ? b.selectedIds.join('|') : '',
            createdAt: formatDateForExport(b.createdAt),
            updatedAt: formatDateForExport(b.updatedAt),
        }));
        zip.file('goldquest_budgets.csv', Papa.unparse(exportableBudgets));
    }

    const zipContent = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipContent, zipFilename);

    console.log(`Data export complete. ${zipFilename} prepared for download.`);

  } catch (error) {
    console.error("Error exporting all user data to ZIP:", error);
    throw error;
  }
}
