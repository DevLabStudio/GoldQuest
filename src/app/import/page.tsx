
'use client';

import { useState, useEffect } from 'react';
import Papa, { ParseResult } from 'papaparse';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge"; // Import Badge for tags
import { addTransaction, type Transaction, clearAllSessionTransactions, updateTransaction as updateTxService } from '@/services/transactions.tsx'; // Added clearAllSessionTransactions and updateTxService
import { getAccounts, addAccount, type Account, type NewAccountData, updateAccount } from '@/services/account-sync';
import { getCategories, addCategory, type Category } from '@/services/categories.tsx';
import { getTags, addTag, type Tag, getTagStyle } from '@/services/tags.tsx'; // Import tag services with .tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"; // Import AlertDialog
import { format } from 'date-fns';
import { getCurrencySymbol, supportedCurrencies } from '@/lib/currency'; // Import supportedCurrencies
import CsvMappingForm, { type ColumnMapping } from '@/components/import/csv-mapping-form';
import { AlertCircle, Trash2 } from 'lucide-react'; // Added Trash2 for clear button
import { cn } from '@/lib/utils';

// Define a flexible type for parsed CSV rows
type CsvRecord = {
  [key: string]: string | undefined;
};

// Define the essential *application* fields we need mapped
const APP_FIELDS = ['date', 'amount', 'description', 'account', 'category', 'accountCurrency', 'tags', 'initialBalance'] as const; // Added initialBalance
type AppField = typeof APP_FIELDS[number];

type MappedTransaction = Omit<Transaction, 'id'> & {
  originalRecord: CsvRecord;
  importStatus: 'pending' | 'success' | 'error' | 'skipped';
  errorMessage?: string;
  // Tags are already optional in Transaction interface
};

// Helper to find a column name case-insensitively (remains useful)
const findColumnName = (headers: string[], targetName: string): string | undefined => {
    return headers.find(header => header?.trim().toLowerCase() === targetName.toLowerCase());
};

// Helper to parse amount string - more robust
const parseAmount = (amountStr: string | undefined): number => {
    if (typeof amountStr !== 'string' || amountStr.trim() === '') return NaN; // Return NaN if invalid input
    let cleaned = amountStr.replace(/[^\d.,-]/g, '').trim();
    const lastCommaIndex = cleaned.lastIndexOf(',');
    const lastPeriodIndex = cleaned.lastIndexOf('.');
    if (lastCommaIndex > lastPeriodIndex) {
        // European format (comma as decimal separator)
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (lastPeriodIndex > lastCommaIndex) {
        // US format (period as decimal separator) - assumes commas are thousand separators
        cleaned = cleaned.replace(/,/g, '');
    } else {
        // No separators or only one type
         cleaned = cleaned.replace(/,/g, ''); // Treat comma as thousand separator if no period found later
    }
    const parsed = parseFloat(cleaned);
    return parsed; // Return potentially NaN value
};


// Helper to parse date string - more robust
const parseDate = (dateStr: string | undefined): string => {
    if (!dateStr) return format(new Date(), 'yyyy-MM-dd');
    try {
        let parsedDate: Date | null = null;

         // 1. Try ISO format directly (YYYY-MM-DD or with time)
         if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            parsedDate = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00Z');
         }

        // 2. Try common formats with separators like / - .
        if (!parsedDate || isNaN(parsedDate.getTime())) {
             const parts = dateStr.split(/[\/\-\.]/);
             if (parts.length === 3) {
                 const [p1, p2, p3] = parts.map(Number);
                 // Basic year handling: Assume 2-digit years > 50 are 19xx, otherwise 20xx. Adjust cutoff year if needed.
                 let year = p3;
                 if (year < 100) {
                     year = year > 50 ? 1900 + year : 2000 + year;
                 }

                  // Try DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
                  if (p1 > 0 && p1 <= 31 && p2 > 0 && p2 <= 12 && year >= 1900 && year < 2100) {
                      const dateAttempt = new Date(Date.UTC(year, p2 - 1, p1)); // Use UTC to avoid timezone issues
                      if (!isNaN(dateAttempt.getTime())) parsedDate = dateAttempt;
                  }
                 // Try MM/DD/YYYY or MM.DD.YYYY or MM-DD-YYYY (if not already parsed)
                 if ((!parsedDate || isNaN(parsedDate.getTime())) && p1 > 0 && p1 <= 12 && p2 > 0 && p2 <= 31 && year >= 1900 && year < 2100) {
                      const dateAttempt = new Date(Date.UTC(year, p1 - 1, p2));
                      if (!isNaN(dateAttempt.getTime())) parsedDate = dateAttempt;
                 }
             }
        }

         // 3. If parsing succeeded, format it
         if (parsedDate && !isNaN(parsedDate.getTime())) {
            return format(parsedDate, 'yyyy-MM-dd');
         }

    } catch (e) {
        console.error("Error parsing date:", dateStr, e);
    }
    console.warn(`Could not parse date "${dateStr}", defaulting to today.`);
    return format(new Date(), 'yyyy-MM-dd');
};

export default function ImportDataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<CsvRecord[]>([]);
  const [parsedData, setParsedData] = useState<MappedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]); // Add state for tags
  // No need for accountNameIdMap in state anymore for the import process itself
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping>({});
  const [isClearing, setIsClearing] = useState(false); // State for clearing confirmation
  const { toast } = useToast();

  // Fetch accounts, categories, and tags on mount
  const fetchData = async () => {
        if (typeof window === 'undefined') return;
        setIsLoading(true);
        setError(null);
        try {
            const [fetchedAccounts, fetchedCategories, fetchedTags] = await Promise.all([
                getAccounts(),
                getCategories(),
                getTags()
            ]);

            setAccounts(fetchedAccounts);
            setCategories(fetchedCategories);
            setTags(fetchedTags);

        } catch (err) {
            console.error("Failed to fetch initial data for import:", err);
            setError("Could not load accounts, categories, or tags.");
            toast({ title: "Initialization Error", description: "Failed to load data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
   };

  useEffect(() => {
    fetchData();

     // Add listener for storage changes
     const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && (event.key === 'userAccounts' || event.key === 'userCategories' || event.key === 'userTags')) {
            console.log("Storage changed, refetching initial data for import...");
            fetchData(); // Refetch accounts, categories, tags
        }
     };
     if (typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorageChange);
     }
     return () => {
       if (typeof window !== 'undefined') {
         window.removeEventListener('storage', handleStorageChange);
       }
     };
  }, [toast]); // Include toast in dependencies

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setError(null);
      setParsedData([]);
      setRawData([]);
      setCsvHeaders([]);
      setImportProgress(0);
      setColumnMappings({});
    }
  };

  const handleParseAndMap = () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setParsedData([]);
    setRawData([]);
    setCsvHeaders([]);

    Papa.parse<CsvRecord>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<CsvRecord>) => {
         if (results.errors.length > 0 && !results.data.length) {
             const criticalError = results.errors[0];
             setError(`CSV Parsing Error: ${criticalError.message}. Code: ${criticalError.code}. Ensure headers are correct.`);
             setIsLoading(false);
             return;
         }

         if (!results.data || results.data.length === 0) {
            setError("CSV file is empty or doesn't contain valid data rows.");
            setIsLoading(false);
            return;
         }

         const headers = results.meta.fields;
         if (!headers || headers.length === 0) {
             setError("Could not read CSV headers. Ensure the first row contains column names.");
             setIsLoading(false);
             return;
         }

         setCsvHeaders(headers.filter(h => h != null) as string[]);
         setRawData(results.data);

         const detectedHeaders = headers.filter(h => h != null) as string[];
         const initialMappings: ColumnMapping = {};
         // Basic mapping attempts
         initialMappings.date = findColumnName(detectedHeaders, 'Date') || findColumnName(detectedHeaders, 'date');
         initialMappings.amount = findColumnName(detectedHeaders, 'Amount') || findColumnName(detectedHeaders, 'amount');
         initialMappings.description = findColumnName(detectedHeaders, 'Description') || findColumnName(detectedHeaders, 'description');
         // Try Firefly III's specific or general 'Account'
         initialMappings.account = findColumnName(detectedHeaders, 'Source account (name)') || findColumnName(detectedHeaders, 'Destination account (name)') || findColumnName(detectedHeaders, 'Account') || findColumnName(detectedHeaders, 'account');
         initialMappings.category = findColumnName(detectedHeaders, 'Category') || findColumnName(detectedHeaders, 'category');
         initialMappings.accountCurrency = findColumnName(detectedHeaders, 'Currency code') || findColumnName(detectedHeaders, 'currency') || findColumnName(detectedHeaders, 'Amount currency') || findColumnName(detectedHeaders, 'Source currency') || findColumnName(detectedHeaders, 'Destination currency');
         initialMappings.tags = findColumnName(detectedHeaders, 'Tags') || findColumnName(detectedHeaders, 'tags');
         // Try to map initial balance
         initialMappings.initialBalance = findColumnName(detectedHeaders, 'Initial balance') || findColumnName(detectedHeaders, 'Starting balance') || findColumnName(detectedHeaders, 'Balance');

         if (!initialMappings.amount) {
            const incomeCol = findColumnName(detectedHeaders, 'Income') || findColumnName(detectedHeaders, 'Deposit');
            const expenseCol = findColumnName(detectedHeaders, 'Expense') || findColumnName(detectedHeaders, 'Withdrawal');
            if (incomeCol || expenseCol) {
                 console.warn("Found Income/Expense columns but no 'Amount' column. Using 'Amount' mapping is preferred.");
            }
         }

         setColumnMappings(initialMappings);

         setIsMappingDialogOpen(true);
         setIsLoading(false);
      },
      error: (err: Error) => {
         setError(`Failed to read or parse CSV file: ${err.message}.`);
        setIsLoading(false);
      }
    });
  };

   const processAndMapData = async (confirmedMappings: ColumnMapping) => {
        setIsLoading(true);
        setError(null);
        setParsedData([]);
        setColumnMappings(confirmedMappings); // Store the confirmed mappings

        const essentialAppFields: AppField[] = ['date', 'amount', 'account'];
        const missingMappings = essentialAppFields.filter(field => !confirmedMappings[field]);
        if (missingMappings.length > 0) {
            setError(`Missing required column mappings: ${missingMappings.map(f => f).join(', ')}. Please map these fields.`);
            setIsLoading(false);
            setIsMappingDialogOpen(true);
            return;
        }

        const dateCol = confirmedMappings.date!;
        const amountCol = confirmedMappings.amount!;
        const descCol = confirmedMappings.description;
        const accountCol = confirmedMappings.account!;
        const catCol = confirmedMappings.category;
        const accountCurrencyCol = confirmedMappings.accountCurrency;
        const tagsCol = confirmedMappings.tags;
        const initialBalanceCol = confirmedMappings.initialBalance; // Get initial balance mapping

        // --- Create Missing Accounts & Get Updated Map ---
        // Pass the current map state and updater function
        const { success: accountCreationSuccess, map: finalAccountMap } = await createMissingAccountsAndGetMap(
             rawData,
             accountCol,
             accountCurrencyCol,
             initialBalanceCol // Pass initial balance column name
         );

         if (!accountCreationSuccess) {
              setError("Failed during account creation or update. Please check console and try again.");
              setIsLoading(false);
              setIsMappingDialogOpen(true); // Re-open mapping dialog if account creation failed
              return;
          }
          // Update the main accounts state in the UI after successful creation/update
          try {
              setAccounts(await getAccounts());
          } catch {
              console.error("Failed to refetch accounts after import preparation.");
          }


        // --- Map Transaction Data using the FINAL map ---
        console.log("Using final account map for transaction linking:", finalAccountMap);


        const mapped: MappedTransaction[] = rawData.map((record, index) => {
          try {
              const dateValue = record[dateCol];
              const amountValue = record[amountCol];
              const descriptionValue = descCol ? record[descCol] : undefined;
              const categoryValue = catCol ? record[catCol] : undefined;
              const accountNameValue = record[accountCol];
              const tagsValue = tagsCol ? record[tagsCol] : undefined;

              if (!dateValue) throw new Error(`Row ${index + 2}: Missing mapped 'Date' data.`);
              if (amountValue === undefined || amountValue === null) throw new Error(`Row ${index + 2}: Missing mapped 'Amount' data.`);
              if (!accountNameValue) throw new Error(`Row ${index + 2}: Missing mapped 'Account' data.`);

              let amount: number = parseAmount(amountValue);
              if (isNaN(amount)) { // Explicit check for NaN
                    const incomeColHeader = findColumnName(Object.keys(record), 'Income') || findColumnName(Object.keys(record), 'Deposit');
                    const expenseColHeader = findColumnName(Object.keys(record), 'Expense') || findColumnName(Object.keys(record), 'Withdrawal');

                    const incomeVal = incomeColHeader ? parseAmount(record[incomeColHeader]) : NaN; // Use NaN
                    const expenseVal = expenseColHeader ? parseAmount(record[expenseColHeader]) : NaN;

                    if (!isNaN(incomeVal) && incomeVal > 0 && isNaN(expenseVal)) {
                        console.warn(`Row ${index + 2}: Using 'Income' column value ${incomeVal} as amount.`);
                        amount = incomeVal;
                    } else if (!isNaN(expenseVal) && expenseVal > 0 && isNaN(incomeVal)) {
                        console.warn(`Row ${index + 2}: Using 'Expense' column value ${-expenseVal} as amount.`);
                        amount = -expenseVal;
                    } else if (isNaN(amount)) { // If still NaN after checking income/expense
                        // If it's potentially an initial balance record, don't throw error yet
                        if (descriptionValue?.toLowerCase().includes('initial balance') || descriptionValue?.toLowerCase().includes('starting balance')) {
                           console.warn(`Row ${index + 2}: Skipping amount parsing for potential initial balance record.`);
                           amount = 0; // Treat as 0 amount for transaction, balance is handled elsewhere
                        } else {
                           throw new Error(`Row ${index + 2}: Could not parse 'amount' value "${amountValue}" and couldn't derive from Income/Expense columns.`);
                        }
                    }
              }


              const description = descriptionValue?.trim() || 'Imported Transaction';
              let category = categoryValue?.trim() || 'Uncategorized';
              const accountName = accountNameValue.trim();
              const normalizedAccountName = accountName.toLowerCase();

              const parsedTags = tagsValue?.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) || [];

              // *** Use the FINAL account map returned by createMissingAccountsAndGetMap ***
              const accountId = finalAccountMap[normalizedAccountName]; // Use the map returned from the function

              if (!accountId) {
                 console.error(`Row ${index + 2}: Account "${accountName}" (normalized: "${normalizedAccountName}") not found in final map AFTER creation attempt. Current map keys: [${Object.keys(finalAccountMap).join(', ')}]. Skipping transaction.`);
                  return {
                     accountId: 'skipped_account_not_found',
                     date: parseDate(dateValue),
                     amount: amount,
                     description: description,
                     category: category,
                     tags: parsedTags,
                     originalRecord: record,
                     importStatus: 'error',
                     errorMessage: `Account "${accountName}" not found or couldn't be created.`,
                 };
              }

              // Skip transaction if it looks like an initial balance entry based on description
              if (description.toLowerCase().includes('initial balance') || description.toLowerCase().includes('starting balance')) {
                  console.log(`Row ${index + 2}: Skipping transaction creation for initial balance entry: "${description}"`);
                   return {
                        accountId: accountId,
                        date: parseDate(dateValue),
                        amount: 0, // Treat as zero amount transaction
                        description: description,
                        category: 'Initial Balance', // Special category
                        tags: parsedTags,
                        originalRecord: record,
                        importStatus: 'skipped', // Mark as skipped
                        errorMessage: 'Skipped initial balance transaction.',
                    };
              }

              return {
                accountId: accountId,
                date: parseDate(dateValue),
                amount: amount,
                description: description,
                category: category,
                tags: parsedTags,
                originalRecord: record,
                importStatus: 'pending',
              };
            } catch (rowError: any) {
                console.error(`Error processing row ${index + 2} with mappings:`, rowError);
                 return {
                    accountId: 'error_processing_row',
                    date: parseDate(record[dateCol]),
                    amount: 0,
                    description: `Error Processing Row`,
                    category: 'Uncategorized',
                    tags: [],
                    originalRecord: record,
                    importStatus: 'error',
                    errorMessage: rowError.message || 'Failed to process row.',
                 };
            }
        });

        const errorMappedData = mapped.filter(item => item.importStatus === 'error');
        const skippedMappedData = mapped.filter(item => item.importStatus === 'skipped');
        const errorMessages: string[] = [];
        if (errorMappedData.length > 0) {
             errorMessages.push(`${errorMappedData.length} row(s) had processing errors (e.g., missing account).`);
        }
        if (skippedMappedData.length > 0) {
             errorMessages.push(`${skippedMappedData.length} row(s) were skipped (e.g., initial balance).`);
        }
        if (errorMessages.length > 0) {
            setError(`Import Preview Issues: ${errorMessages.join(' ')} Review the table below.`);
        } else {
            setError(null);
        }

        setParsedData(mapped);
        setIsLoading(false);
        setIsMappingDialogOpen(false);
        toast({ title: "Mapping Applied", description: "Review the transactions below before importing." });
   }


    /**
     * Creates missing accounts or updates existing ones with initial balance found in CSV data.
     * Returns the final account map and a success status.
     */
    const createMissingAccountsAndGetMap = async (
        csvData: CsvRecord[],
        accountNameCol: string,
        accountCurrencyCol?: string,
        initialBalanceCol?: string // Optional column for initial balance
    ): Promise<{ success: boolean; map: { [key: string]: string } }> => {
        let success = true;
        const existingAccounts = await getAccounts(); // Fetch current accounts
        const workingMap = existingAccounts.reduce((map, acc) => {
             map[acc.name.toLowerCase().trim()] = acc.id;
             return map;
        }, {} as { [key: string]: string });

        const accountUpdates = new Map<string, { name: string; currency: string; type?: string; initialBalance?: number }>();

        csvData.forEach(record => {
            const name = record[accountNameCol]?.trim();
            if (name) {
                const normalizedName = name.toLowerCase();
                let details = accountUpdates.get(normalizedName);

                if (!details) {
                    // Try to find existing account first
                     const existingAcc = existingAccounts.find(acc => acc.name.toLowerCase() === normalizedName);
                     details = {
                        name: name,
                        currency: existingAcc?.currency || 'BRL', // Use existing or default
                        type: existingAcc?.type || 'checking', // Use existing or default
                        // Initialize balance from existing if available, otherwise undefined
                        initialBalance: existingAcc?.balance,
                     };

                     // Only set default currency if no currency column mapped or no value for this row
                     if (!accountCurrencyCol || !record[accountCurrencyCol]) {
                          details.currency = existingAcc?.currency || 'BRL';
                     } else {
                          const potentialCurrency = record[accountCurrencyCol]!.trim().toUpperCase();
                          if (supportedCurrencies.includes(potentialCurrency)) {
                              details.currency = potentialCurrency;
                          } else {
                              console.warn(`Ignoring invalid currency "${potentialCurrency}" for account "${name}", using default ${details.currency}.`);
                          }
                     }

                     // Infer type if not existing
                     if (!existingAcc) {
                         if (name.toLowerCase().includes('credit') || name.toLowerCase().includes('card')) details.type = 'credit card';
                         else if (name.toLowerCase().includes('saving')) details.type = 'savings';
                         else if (name.toLowerCase().includes('invest')) details.type = 'investment';
                         else if (name.toLowerCase().includes('wallet') || name.toLowerCase().includes('crypto')) details.type = 'wallet';
                     }
                }

                 // Capture initial balance if mapped and present, prioritize over previous finds
                 if (initialBalanceCol && record[initialBalanceCol]) {
                    const balance = parseAmount(record[initialBalanceCol]);
                    if (!isNaN(balance)) {
                         // Update the balance in the details, overwriting previous value
                        details.initialBalance = balance;
                        console.log(`Found initial balance ${balance} for account "${name}" from CSV.`);
                    } else {
                        console.warn(`Could not parse initial balance "${record[initialBalanceCol]}" for account "${name}".`);
                    }
                 }

                accountUpdates.set(normalizedName, details);
            }
        });


        if (accountUpdates.size === 0) {
            console.log("No account updates needed.");
            return { success: true, map: workingMap }; // Return current map
        }

        console.log(`Found ${accountUpdates.size} accounts to potentially create or update...`);
        let accountsProcessedCount = 0;

        await Promise.all(Array.from(accountUpdates.entries()).map(async ([normalizedName, accDetails]) => {
            const existingAccount = existingAccounts.find(acc => acc.name.toLowerCase() === normalizedName);
            try {
                if (existingAccount) {
                    // Update existing account (especially initial balance if provided from CSV)
                    // Check if CSV provided a balance AND it's different from the current balance
                    if (accDetails.initialBalance !== undefined && accDetails.initialBalance !== existingAccount.balance) {
                        console.log(`Updating balance for existing account "${accDetails.name}" from ${existingAccount.balance} to ${accDetails.initialBalance}...`);
                        const updatedAccountData: Account = {
                            ...existingAccount,
                            balance: accDetails.initialBalance, // Update balance from CSV data
                            lastActivity: new Date().toISOString(),
                        };
                        await updateAccount(updatedAccountData);
                        accountsProcessedCount++;
                    } else {
                        console.log(`Account "${accDetails.name}" already exists, no balance update needed or provided.`);
                    }
                    workingMap[normalizedName] = existingAccount.id;
                } else {
                    // Create new account with the balance found (or 0 if none found)
                    const balanceToSet = accDetails.initialBalance ?? 0;
                    console.log(`Attempting to create account "${accDetails.name}" with currency ${accDetails.currency}, type ${accDetails.type}, balance ${balanceToSet}...`);
                    const newAccountData: NewAccountData = {
                        name: accDetails.name,
                        type: accDetails.type || 'checking',
                        balance: balanceToSet, // Use parsed initial balance or 0
                        currency: accDetails.currency,
                        providerName: 'Imported',
                        category: (accDetails.type === 'wallet' || accDetails.type === 'exchange' || accDetails.type === 'staking') ? 'crypto' : 'asset',
                        isActive: true,
                        lastActivity: new Date().toISOString(),
                        balanceDifference: 0,
                    };
                    const createdAccount = await addAccount(newAccountData);
                    workingMap[normalizedName] = createdAccount.id;
                    accountsProcessedCount++;
                    console.log(`Successfully created account: ${createdAccount.name} (ID: ${createdAccount.id}) with balance ${balanceToSet}`);
                }
            } catch (err: any) {
                console.error(`Failed to process account "${accDetails.name}":`, err);
                toast({ title: "Account Processing Error", description: `Could not process account "${accDetails.name}". Error: ${err.message}`, variant: "destructive", duration: 7000 });
                success = false;
            }
        }));

        if (accountsProcessedCount > 0) {
            toast({ title: "Accounts Processed", description: `Created or updated ${accountsProcessedCount} accounts.` });
        }

        return { success, map: workingMap }; // Return success status and the final map
    };


   const addMissingCategories = async (transactions: MappedTransaction[]): Promise<boolean> => {
      const existingCategoryNames = new Set(categories.map(cat => cat.name.toLowerCase()));
      const categoriesToAdd = new Set<string>();
      let success = true;

      transactions.forEach(tx => {
          if (tx.importStatus === 'pending' && tx.category) {
              const categoryName = tx.category.trim();
              if (categoryName && categoryName.toLowerCase() !== 'uncategorized' && !existingCategoryNames.has(categoryName.toLowerCase())) {
                  categoriesToAdd.add(categoryName);
              }
          }
      });

      if (categoriesToAdd.size > 0) {
          console.log(`Found ${categoriesToAdd.size} new categories to add:`, Array.from(categoriesToAdd));
          let categoriesAddedCount = 0;
          const addPromises = Array.from(categoriesToAdd).map(async (catName) => {
              try {
                  await addCategory(catName);
                  categoriesAddedCount++;
              } catch (err: any) {
                  console.error(`Failed to add category "${catName}":`, err);
                  toast({ title: "Category Add Error", description: `Could not add category "${catName}". Error: ${err.message}`, variant: "destructive" });
                  success = false;
              }
          });

          await Promise.all(addPromises);

          if (categoriesAddedCount > 0) {
            toast({ title: "Categories Processed", description: `Processed ${categoriesToAdd.size} categories found in CSV.` });
             try {
                const updatedCategoriesList = await getCategories();
                setCategories(updatedCategoriesList); // Update state
             } catch { /* ignore error */ }
          }
      } else {
          console.log("No new categories found in pending transactions.");
      }
      return success;
   };

    const addMissingTags = async (transactions: MappedTransaction[]): Promise<boolean> => {
        const existingTagNames = new Set(tags.map(tag => tag.name.toLowerCase()));
        const tagsToAdd = new Set<string>();
        let success = true;

        transactions.forEach(tx => {
            if (tx.importStatus === 'pending' && tx.tags) {
                tx.tags.forEach(tagName => {
                    const trimmedTag = tagName.trim();
                    if (trimmedTag && !existingTagNames.has(trimmedTag.toLowerCase())) {
                        tagsToAdd.add(trimmedTag);
                    }
                });
            }
        });

        if (tagsToAdd.size > 0) {
            console.log(`Found ${tagsToAdd.size} new tags to add:`, Array.from(tagsToAdd));
            let tagsAddedCount = 0;
            const addPromises = Array.from(tagsToAdd).map(async (tagName) => {
                try {
                    await addTag(tagName);
                    tagsAddedCount++;
                } catch (err: any) {
                    console.error(`Failed to add tag "${tagName}":`, err);
                    toast({ title: "Tag Add Error", description: `Could not add tag "${tagName}". Error: ${err.message}`, variant: "destructive" });
                    success = false;
                }
            });

            await Promise.all(addPromises);

             if (tagsAddedCount > 0) {
                toast({ title: "Tags Processed", description: `Processed ${tagsToAdd.size} tags found in CSV.` });
                 try {
                    const updatedTagsList = await getTags();
                    setTags(updatedTagsList); // Update state
                 } catch { /* ignore error */ }
            }
        } else {
            console.log("No new tags found in pending transactions.");
        }
        return success;
    };


   const handleImport = async () => {
      const recordsToImport = parsedData.filter(item => item.importStatus === 'pending');
      if (recordsToImport.length === 0) {
          setError(parsedData.some(d => d.importStatus === 'error' || d.importStatus === 'skipped') ? "No pending records to import. Check rows marked as 'Error' or 'Skipped'." : "No data parsed or mapped correctly for import.");
          toast({ title: "Import Info", description: "No pending transactions to import.", variant: "default" });
          return;
      }

      setIsLoading(true);
      setImportProgress(0);
      let overallError = false;

      // Create accounts again to get the FINAL map just before import, in case state updates were slow
      const { success: accountMapSuccess, map: finalAccountMap } = await createMissingAccountsAndGetMap(
          rawData,
          columnMappings.account!,
          columnMappings.accountCurrency,
          columnMappings.initialBalance
      );
       if (!accountMapSuccess) {
          setError("Error finalizing account mapping before import. Check console.");
          setIsLoading(false);
          return;
      }
       // Update UI accounts state
       try {
          setAccounts(await getAccounts());
       } catch {}


      const categoriesSuccess = await addMissingCategories(recordsToImport);
      const tagsSuccess = await addMissingTags(recordsToImport);

      if (!categoriesSuccess || !tagsSuccess) {
         setError("An error occurred while adding new categories or tags. Import halted. Check console for details.");
         setIsLoading(false);
         return;
      }

      // Fetch current categories and tags *after* potential additions
      let currentCategories = await getCategories();
      let currentTags = await getTags();
      console.log("Using FINAL account map for import execution:", finalAccountMap);


      const totalToImport = recordsToImport.length;
      let importedCount = 0;
      let errorCount = 0;
      const updatedData = [...parsedData];

      for (let i = 0; i < updatedData.length; i++) {
          const item = updatedData[i];

          if (item.importStatus !== 'pending') {
              if(item.importStatus === 'error' || item.importStatus === 'skipped') {
                 errorCount++;
              }
              continue;
          }

          try {
               const categoryName = item.category?.trim() || 'Uncategorized';
               // Use the fetched currentCategories list
               const foundCategory = currentCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
               const finalCategoryName = foundCategory ? foundCategory.name : 'Uncategorized';

               // Use the fetched currentTags list
               const finalTags = item.tags?.map(importedTagName => {
                   const foundTag = currentTags.find(t => t.name.toLowerCase() === importedTagName.toLowerCase());
                   return foundTag ? foundTag.name : importedTagName; // Keep original if not found (should have been added)
               }).filter(Boolean) || [];


                // Check account ID again before import using the FINAL map state
                const accountNameFromRecord = item.originalRecord[columnMappings.account!]?.trim().toLowerCase();
                const accountIdForImport = finalAccountMap[accountNameFromRecord || ''];

               if (!accountIdForImport || accountIdForImport.startsWith('skipped_') || accountIdForImport.startsWith('error_')) {
                    console.error(`Import Error Row ${i + 2}: Invalid or missing account ID for account name "${accountNameFromRecord}" using map:`, finalAccountMap);
                    throw new Error(`Invalid or missing account ID for "${item.originalRecord[columnMappings.account!] || 'N/A'}"`);
               } else {
                   console.log(`Row ${i + 2}: Found account ID ${accountIdForImport} for account name "${accountNameFromRecord}"`);
               }

              const transactionPayload: Omit<Transaction, 'id'> = {
                  accountId: accountIdForImport,
                  date: item.date,
                  amount: item.amount,
                  description: item.description,
                  category: finalCategoryName,
                  tags: finalTags,
              };
              await addTransaction(transactionPayload);
              updatedData[i] = { ...item, importStatus: 'success', errorMessage: undefined };
              importedCount++;
          } catch (err: any) {
              console.error(`Failed to import record (Original Row ${i + 2}): "${item.description}"`, err);
              updatedData[i] = { ...item, importStatus: 'error', errorMessage: err.message || 'Unknown import error' };
              errorCount++;
              overallError = true;
          }

          setParsedData([...updatedData]);
          setImportProgress(calculateProgress(importedCount + errorCount, totalToImport));
      }

      setIsLoading(false);
      const finalMessage = `Imported: ${importedCount}. Failed/Skipped: ${errorCount}.`;
      toast({
        title: overallError ? "Import Complete with Errors" : "Import Complete",
        description: finalMessage,
        variant: overallError ? "destructive" : "default",
        duration: 7000,
      });
      if (overallError) {
         setError(`Import finished with ${errorCount} errors/skipped rows. Please review the table.`);
      } else {
         setError(null);
         window.dispatchEvent(new Event('storage')); // Trigger storage event to update other pages
      }
    };


  const calculateProgress = (processed: number, total: number): number => {
      if (total === 0) return 0;
      return Math.round((processed / total) * 100);
  }

    const handleClearAccounts = async () => {
        setIsClearing(true);
        try {
            // Clear Local Storage
            localStorage.removeItem('userAccounts');
            localStorage.removeItem('userCategories');
            localStorage.removeItem('userTags');

            // Clear Session Storage (if transactions were there)
            // Instead, use the dedicated clear function
            clearAllSessionTransactions();

            // Reset Component State
            setAccounts([]);
            setCategories([]);
            setTags([]);
            setParsedData([]);
            setError(null);
            setRawData([]);
            setFile(null);
            setColumnMappings({});
            setImportProgress(0);

            // Reset File Input visually
            const fileInput = document.getElementById('csv-file') as HTMLInputElement;
            if (fileInput) fileInput.value = '';


            toast({ title: "Data Cleared", description: "All accounts, categories, tags, and imported transactions have been removed." });
            window.dispatchEvent(new Event('storage')); // Notify other components
        } catch (err) {
            console.error("Failed to clear data:", err);
            toast({ title: "Error", description: "Could not clear stored data.", variant: "destructive" });
        } finally {
            setIsClearing(false);
        }
    };


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Import Data</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Step 1: Upload CSV File</CardTitle>
          <CardDescription>
            Select the CSV file containing your transactions. Ensure it has a header row. Common formats like Firefly III export are supported.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={isLoading}/>
          </div>

          {error && (
             <Alert variant={error.includes("Issues") || error.includes("Error") || error.includes("Failed") || error.includes("Missing") ? "destructive" : "default"}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{error.includes("Issues") || error.includes("Error") || error.includes("Failed") || error.includes("Missing") ? "Import Problem" : "Info"}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
             </Alert>
          )}


          <div className="flex flex-wrap gap-4">
             <Button onClick={handleParseAndMap} disabled={!file || isLoading}>
                {isLoading && !isMappingDialogOpen ? "Parsing..." : "Parse & Map Columns"}
             </Button>
             <Button onClick={handleImport} disabled={isLoading || parsedData.length === 0 || parsedData.every(d => d.importStatus !== 'pending')}>
               {isLoading && importProgress > 0 ? `Importing... (${importProgress}%)` : "Import Transactions"}
             </Button>

               <AlertDialog>
                   <AlertDialogTrigger asChild>
                       <Button variant="destructive" disabled={isLoading || isClearing}>
                           <Trash2 className="mr-2 h-4 w-4" />
                           {isClearing ? "Clearing..." : "Clear All Data (Testing)"}
                       </Button>
                   </AlertDialogTrigger>
                   <AlertDialogContent>
                       <AlertDialogHeader>
                           <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                           <AlertDialogDescription>
                               This action cannot be undone. This will permanently delete ALL accounts, categories, tags, and imported transactions stored in your browser. This is intended for testing purposes.
                           </AlertDialogDescription>
                       </AlertDialogHeader>
                       <AlertDialogFooter>
                           <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
                           <AlertDialogAction onClick={handleClearAccounts} disabled={isClearing} className="bg-destructive hover:bg-destructive/90">
                               {isClearing ? "Clearing..." : "Yes, Clear All Data"}
                           </AlertDialogAction>
                       </AlertDialogFooter>
                   </AlertDialogContent>
               </AlertDialog>
          </div>

           {isLoading && importProgress > 0 && (
               <Progress value={importProgress} className="w-full mt-4" />
           )}
        </CardContent>
      </Card>

        <Dialog open={isMappingDialogOpen} onOpenChange={setIsMappingDialogOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Step 2: Map CSV Columns</DialogTitle>
                    <DialogDescription>
                        Match columns from your CSV (left) to application fields (right).
                        Essential fields: Date, Amount, Account Name. We've tried to guess based on common headers. Map 'Initial Balance' if available.
                    </DialogDescription>
                </DialogHeader>
                <CsvMappingForm
                    csvHeaders={csvHeaders}
                    initialMappings={columnMappings}
                    onSubmit={processAndMapData}
                    onCancel={() => {
                        setIsMappingDialogOpen(false);
                    }}
                />
            </DialogContent>
        </Dialog>


      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Review & Import ({parsedData.length} Rows Found)</CardTitle>
            <CardDescription>Review the mapped transactions. Rows marked 'Error' or 'Skipped' will not be imported. Adjust mappings if needed by re-uploading. Click "Import Transactions" above when ready.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Dynamically show headers based on what's mapped */}
                    {columnMappings.date && <TableHead>Date</TableHead>}
                    {columnMappings.account && <TableHead>Account (CSV)</TableHead>}
                    {columnMappings.description && <TableHead>Description</TableHead>}
                    {columnMappings.category && <TableHead>Category</TableHead>}
                    {columnMappings.tags && <TableHead>Tags</TableHead>}
                    {columnMappings.amount && <TableHead className="text-right">Amount</TableHead>}
                     <TableHead>Status</TableHead>
                     <TableHead className="min-w-[150px]">Message / Info</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((item, index) => {
                       // Find account using the component's current `accounts` state
                       const account = accounts.find(acc => acc.id === item.accountId); // Use item.accountId which should be correct now
                       const accountName = item.originalRecord[columnMappings.account || ''] || item.accountId;
                       const accountCurrency = account?.currency || (columnMappings.accountCurrency && item.originalRecord[columnMappings.accountCurrency!]?.trim().toUpperCase()) || '?';
                       const currencySymbol = getCurrencySymbol(accountCurrency);


                      return (
                          <TableRow key={index} className={cn(
                              "text-xs", // Smaller text for dense table
                              item.importStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
                              item.importStatus === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                              item.importStatus === 'skipped' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                          )}>
                            {columnMappings.date && <TableCell className="whitespace-nowrap">{item.date}</TableCell>}
                            {columnMappings.account && <TableCell className="max-w-[150px] truncate" title={accountName}>{accountName}</TableCell>}
                            {columnMappings.description && <TableCell className="max-w-[200px] truncate" title={item.description}>{item.description}</TableCell>}
                            {columnMappings.category && <TableCell className="capitalize max-w-[100px] truncate" title={item.category}>{item.category}</TableCell>}
                            {columnMappings.tags && (
                                <TableCell className="max-w-[150px]">
                                    <div className="flex flex-wrap gap-1">
                                        {item.tags?.map(tag => {
                                            const { color: tagColor } = getTagStyle(tag);
                                            return (
                                                <Badge key={tag} variant="outline" className={`text-xs px-1.5 py-0.5 ${tagColor}`}>
                                                    {tag}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                </TableCell>
                            )}
                            {columnMappings.amount && (
                                <TableCell className={cn(
                                    "text-right whitespace-nowrap font-medium",
                                    // Handle potential NaN for amount safely
                                    !isNaN(item.amount) && item.amount >= 0 ? 'text-green-700 dark:text-green-400' :
                                    !isNaN(item.amount) && item.amount < 0 ? 'text-red-700 dark:text-red-400' :
                                    'text-muted-foreground' // Style for NaN or 0
                                )}>
                                    {/* Display amount with symbol, ensure it's a number */}
                                    {currencySymbol}{!isNaN(item.amount) ? item.amount.toFixed(2) : (item.importStatus === 'skipped' ? 'N/A' : 'ERR')}
                                </TableCell>
                            )}
                            <TableCell className="font-medium capitalize">{item.importStatus}</TableCell>
                            <TableCell className="text-muted-foreground max-w-[200px] truncate" title={item.errorMessage}>{item.errorMessage}</TableCell>
                          </TableRow>
                      );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
