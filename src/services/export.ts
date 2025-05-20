
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
    // Fallback for browsers that don't support the download attribute
    // This might open the blob in a new tab depending on the browser and blob type
    // For a zip file, it usually still triggers a download or prompts the user.
    const newWindow = window.open(URL.createObjectURL(blob), '_blank');
    if (!newWindow) {
        alert('File download is not fully supported by your browser or was blocked. Please check your pop-up blocker settings.');
    }
  }
}

const formatDateForExport = (dateInput: object | string | undefined | null): string => {
    if (!dateInput) return '';
    if (typeof dateInput === 'string') {
        // Attempt to parse if it looks like an ISO string already, otherwise return as is
        const parsed = parseISO(dateInput);
        return isValid(parsed) ? formatDateFns(parsed, "yyyy-MM-dd'T'HH:mm:ssXXX") : dateInput;
    }
    // Check for Firebase ServerTimestamp placeholder object which is an object with no direct date properties.
    // A common way to check is if it's an object and doesn't have typical Date methods.
    // For robust handling, if you expect specific Firebase Timestamp objects, you might check for `toDate` method.
    if (typeof dateInput === 'object' && dateInput !== null) {
        if ('toDate' in dateInput && typeof (dateInput as any).toDate === 'function') {
             return formatDateFns((dateInput as any).toDate(), "yyyy-MM-dd'T'HH:mm:ssXXX");
        }
        // For Firebase serverTimestamp placeholder object, or other objects, convert to a placeholder or empty string
        // In a real scenario, this would be handled by ensuring data is read after server resolves it
        // For export, if it's a placeholder, it's better to represent it as such or empty
        return 'SERVER_TIMESTAMP_PLACEHOLDER'; // Or return an empty string or a specific string indicating it's a server value
    }
    if (typeof dateInput === 'number') { // Assuming it's a Unix timestamp (milliseconds)
        return formatDateFns(new Date(dateInput), "yyyy-MM-dd'T'HH:mm:ssXXX");
    }
    return String(dateInput); // Fallback for other types
};


interface ExportableTransaction extends Omit<Transaction, 'tags' | 'originalImportData' | 'createdAt' | 'updatedAt'> {
    tags?: string; // Pipe-separated
    originalImportData?: string; // JSON string
    createdAt?: string; // ISO Timestamp
    updatedAt?: string; // ISO Timestamp
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


export async function exportAllUserDataToZip(): Promise<void> {
  const zip = new JSZip();
  const timestamp = formatDateFns(new Date(), 'yyyyMMdd_HHmmss');
  const zipFilename = `goldquest_backup_${timestamp}.zip`;

  const manifest = {
    backupVersion: "1.0.0",
    exportedAt: new Date().toISOString(),
    appName: "GoldQuest",
    contains: [] as string[],
  };

  try {
    console.log("Exporting: User Preferences...");
    const preferences = await getUserPreferences();
    if (preferences) {
      zip.file('goldquest_preferences.csv', Papa.unparse([preferences]));
      manifest.contains.push('preferences');
    }

    console.log("Exporting: Categories...");
    const categories = await getCategories();
    if (categories.length > 0) {
        zip.file('goldquest_categories.csv', Papa.unparse(categories));
        manifest.contains.push('categories');
    }

    console.log("Exporting: Tags...");
    const tags = await getTags();
     if (tags.length > 0) {
        zip.file('goldquest_tags.csv', Papa.unparse(tags));
        manifest.contains.push('tags');
    }

    console.log("Exporting: Groups...");
    const groups = await getGroups();
    if (groups.length > 0) {
        const exportableGroups: ExportableGroup[] = groups.map(g => ({
            ...g,
            categoryIds: g.categoryIds ? g.categoryIds.join('|') : '',
        }));
        zip.file('goldquest_groups.csv', Papa.unparse(exportableGroups));
        manifest.contains.push('groups');
    }

    console.log("Exporting: Accounts...");
    const accounts = await getAccounts();
     if (accounts.length > 0) {
        zip.file('goldquest_accounts.csv', Papa.unparse(accounts.map(acc => ({...acc, includeInNetWorth: acc.includeInNetWorth ?? true}))));
        manifest.contains.push('accounts');
    }

    if (accounts.length > 0) {
        console.log("Exporting: Transactions...");
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
            manifest.contains.push('transactions');
        }
    }

    console.log("Exporting: Subscriptions...");
    const subscriptions = await getSubscriptions();
    if (subscriptions.length > 0) {
        const exportableSubscriptions: ExportableSubscription[] = subscriptions.map(sub => ({
            ...sub,
            tags: sub.tags ? sub.tags.join('|') : '',
            createdAt: formatDateForExport(sub.createdAt),
            updatedAt: formatDateForExport(sub.updatedAt),
        }));
        zip.file('goldquest_subscriptions.csv', Papa.unparse(exportableSubscriptions));
        manifest.contains.push('subscriptions');
    }

    console.log("Exporting: Loans...");
    const loans = await getLoans();
    if (loans.length > 0) {
        const exportableLoans = loans.map(loan => ({
            ...loan,
            createdAt: formatDateForExport(loan.createdAt),
            updatedAt: formatDateForExport(loan.updatedAt),
        }));
        zip.file('goldquest_loans.csv', Papa.unparse(exportableLoans));
        manifest.contains.push('loans');
    }

    console.log("Exporting: Credit Cards...");
    const creditCards = await getCreditCards();
    if (creditCards.length > 0) {
        const exportableCreditCards = creditCards.map(card => ({
            ...card,
            createdAt: formatDateForExport(card.createdAt),
            updatedAt: formatDateForExport(card.updatedAt),
        }));
        zip.file('goldquest_credit_cards.csv', Papa.unparse(exportableCreditCards));
        manifest.contains.push('creditCards');
    }

    console.log("Exporting: Budgets...");
    const budgets = await getBudgets();
    if (budgets.length > 0) {
        const exportableBudgets: ExportableBudget[] = budgets.map(b => ({
            ...b,
            selectedIds: b.selectedIds ? b.selectedIds.join('|') : '',
            createdAt: formatDateForExport(b.createdAt),
            updatedAt: formatDateForExport(b.updatedAt),
        }));
        zip.file('goldquest_budgets.csv', Papa.unparse(exportableBudgets));
        manifest.contains.push('budgets');
    }
    
    zip.file('goldquest_manifest.json', JSON.stringify(manifest, null, 2));

    const zipContent = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipContent, zipFilename);

    console.log(`Data export complete. ${zipFilename} prepared for download.`);

  } catch (error) {
    console.error("Error exporting all user data to ZIP:", error);
    throw error;
  }
}
