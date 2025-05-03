
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    let cleaned = amountStr.replace(/[^\d.,-]/g, '').trim(); // Remove non-digit chars except separators and sign

    // Check for negative sign and remove it temporarily
    const isNegative = cleaned.startsWith('-');
    if (isNegative) {
        cleaned = cleaned.substring(1);
    }

    const lastCommaIndex = cleaned.lastIndexOf(',');
    const lastPeriodIndex = cleaned.lastIndexOf('.');

    // Determine decimal separator based on position
    if (lastCommaIndex > lastPeriodIndex) {
        // European format (comma as decimal separator)
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (lastPeriodIndex > lastCommaIndex) {
        // US format (period as decimal separator) - assumes commas are thousand separators
        cleaned = cleaned.replace(/,/g, '');
    } else {
        // Only one type of separator or none
         if (cleaned.includes(',')) { // Assume comma is decimal if it's the only one
             cleaned = cleaned.replace(/,/g, '.');
         }
         // If only periods exist, assume they are thousand separators (handled by parseFloat)
         // If no separators exist, it's a whole number
    }
    const parsed = parseFloat(cleaned);
    // Reapply negative sign if needed
    const finalValue = isNegative ? -parsed : parsed;

    console.log(`parseAmount: Input='${amountStr}', Cleaned='${cleaned}', Parsed=${parsed}, Final=${finalValue}`);
    return finalValue; // Return potentially NaN value
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
                 const [p1_str, p2_str, p3_str] = parts;
                 let p1 = parseInt(p1_str, 10);
                 let p2 = parseInt(p2_str, 10);
                 let year_part = parseInt(p3_str, 10);

                  // Basic year handling: Assume 2-digit years > 50 are 19xx, otherwise 20xx. Adjust cutoff year if needed.
                 let year = year_part;
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

         // 3. Try other potential formats (e.g., YYYYMMDD) - requires more specific logic if needed

         // 4. If parsing succeeded, format it
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
            console.log("Initial data fetched for import:", { numAccounts: fetchedAccounts.length, numCategories: fetchedCategories.length, numTags: fetchedTags.length });

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
  }, []); // Removed toast from dependency array as it's stable

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
         // Basic mapping attempts (Firefly III focused)
         initialMappings.date = findColumnName(detectedHeaders, 'Date') || findColumnName(detectedHeaders, 'date');
         initialMappings.amount = findColumnName(detectedHeaders, 'Amount') || findColumnName(detectedHeaders, 'amount');
         initialMappings.description = findColumnName(detectedHeaders, 'Description') || findColumnName(detectedHeaders, 'description');
         // Try Firefly III's specific or general 'Account'
         initialMappings.account = findColumnName(detectedHeaders, 'Source account (name)') || findColumnName(detectedHeaders, 'Destination account (name)') || findColumnName(detectedHeaders, 'Account') || findColumnName(detectedHeaders, 'account');
         initialMappings.category = findColumnName(detectedHeaders, 'Category') || findColumnName(detectedHeaders, 'category');
         initialMappings.accountCurrency = findColumnName(detectedHeaders, 'Currency code') || findColumnName(detectedHeaders, 'currency') || findColumnName(detectedHeaders, 'Amount currency') || findColumnName(detectedHeaders, 'Source currency') || findColumnName(detectedHeaders, 'Destination currency');
         initialMappings.tags = findColumnName(detectedHeaders, 'Tags') || findColumnName(detectedHeaders, 'tags');
         // Try to map initial balance
         initialMappings.initialBalance = findColumnName(detectedHeaders, 'Initial balance') || findColumnName(detectedHeaders, 'Starting balance') || findColumnName(detectedHeaders, 'Balance') || findColumnName(detectedHeaders, 'Account balance'); // Added more generic balance terms


         if (!initialMappings.amount) {
            // Firefly III also has "Amount in EUR" or similar, check for those if 'Amount' is missing
            const specificAmountCol = detectedHeaders.find(h => h.toLowerCase().startsWith('amount in '));
            if(specificAmountCol) {
                console.log(`Using specific amount column: ${specificAmountCol}`);
                initialMappings.amount = specificAmountCol;
                 // Try to infer currency from that column header if currency isn't mapped yet
                if (!initialMappings.accountCurrency) {
                    const currencyMatch = specificAmountCol.match(/Amount in (\w+)/i);
                    if (currencyMatch && currencyMatch[1]) {
                        const inferredCurrency = currencyMatch[1].toUpperCase();
                        if (supportedCurrencies.includes(inferredCurrency)) {
                             console.log(`Inferred currency ${inferredCurrency} from amount column header.`);
                             initialMappings.accountCurrency = specificAmountCol; // Or map to a generic currency field if exists? For now map to the same.
                        }
                    }
                }
            } else {
                // Check for Income/Expense as fallback
                const incomeCol = findColumnName(detectedHeaders, 'Income') || findColumnName(detectedHeaders, 'Deposit') || findColumnName(detectedHeaders, 'Amount income');
                const expenseCol = findColumnName(detectedHeaders, 'Expense') || findColumnName(detectedHeaders, 'Withdrawal') || findColumnName(detectedHeaders, 'Amount expense');
                if (incomeCol || expenseCol) {
                    console.warn("Found Income/Expense columns but no single 'Amount' column. Mapping 'Amount' is preferred for signed values.");
                }
            }
         }

         // Add more sophisticated mapping suggestions based on headers if needed

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
            setError(`Missing required column mappings: ${missingMappings.map(f => APP_FIELDS.find(af => af.value === f)?.label || f).join(', ')}. Please map these fields.`);
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
              const rowNumber = index + 2; // CSV row number (assuming header is row 1)
              const dateValue = record[dateCol];
              const amountValue = record[amountCol];
              const descriptionValue = descCol ? record[descCol] : undefined;
              const categoryValue = catCol ? record[catCol] : undefined;
              const accountNameValue = record[accountCol];
              const tagsValue = tagsCol ? record[tagsCol] : undefined;

              if (!dateValue) throw new Error(`Row ${rowNumber}: Missing mapped 'Date' data.`);
              if (amountValue === undefined || amountValue === null || amountValue.trim() === '') throw new Error(`Row ${rowNumber}: Missing or empty mapped 'Amount' data.`);
              if (!accountNameValue) throw new Error(`Row ${rowNumber}: Missing mapped 'Account' data.`);

              let amount: number = parseAmount(amountValue);
              // Firefly III specific: Check for income/expense columns if amount is NaN or zero
              const incomeColHeader = findColumnName(Object.keys(record), 'Amount income');
              const expenseColHeader = findColumnName(Object.keys(record), 'Amount expense');
              const incomeValStr = incomeColHeader ? record[incomeColHeader] : undefined;
              const expenseValStr = expenseColHeader ? record[expenseColHeader] : undefined;
              const incomeVal = parseAmount(incomeValStr);
              const expenseVal = parseAmount(expenseValStr);

              const description = descriptionValue?.trim() || 'Imported Transaction';
              let category = categoryValue?.trim() || 'Uncategorized';
              const accountName = accountNameValue.trim();
              const normalizedAccountName = accountName.toLowerCase();

              // Skip transaction if it looks like an initial balance entry based on description or category
               if (initialBalanceCol && record[initialBalanceCol] !== undefined && record[initialBalanceCol] !== '') {
                   const descLower = description.toLowerCase();
                   const catLower = category.toLowerCase();
                   if (descLower.includes('initial balance') || descLower.includes('starting balance') || catLower.includes('initial balance') || catLower.includes('starting balance') || isNaN(amount) || amount === 0) {
                       console.log(`Row ${rowNumber}: Skipping transaction creation for initial balance entry: "${description}"`);
                       return {
                           accountId: 'skipped_initial_balance',
                           date: parseDate(dateValue),
                           amount: 0, // Treat as zero amount transaction
                           description: description + " (Initial Balance)",
                           category: 'Initial Balance', // Special category
                           tags: [],
                           originalRecord: record,
                           importStatus: 'skipped', // Mark as skipped
                           errorMessage: 'Skipped initial balance entry.',
                       };
                   }
               }

              // Amount Processing Logic for single 'Amount' column OR separate Income/Expense columns
              if (isNaN(amount)) { // If primary 'Amount' column parsing failed
                    if (!isNaN(incomeVal) && incomeVal > 0 && isNaN(expenseVal)) {
                        console.warn(`Row ${rowNumber}: Amount NaN, using 'Income' column value ${incomeVal}.`);
                        amount = incomeVal;
                    } else if (!isNaN(expenseVal) && expenseVal > 0 && isNaN(incomeVal)) {
                        console.warn(`Row ${rowNumber}: Amount NaN, using 'Expense' column value ${expenseVal} as negative.`);
                        amount = -expenseVal;
                    } else if (!isNaN(incomeVal) && incomeVal > 0 && (!expenseValStr || isNaN(expenseVal) || expenseVal === 0)) {
                        console.warn(`Row ${rowNumber}: Amount NaN, Expense missing/0, using 'Income' column value ${incomeVal}.`);
                        amount = incomeVal;
                    } else if (!isNaN(expenseVal) && expenseVal > 0 && (!incomeValStr || isNaN(incomeVal) || incomeVal === 0)) {
                        console.warn(`Row ${rowNumber}: Amount NaN, Income missing/0, using 'Expense' column value ${expenseVal} as negative.`);
                        amount = -expenseVal;
                    } else if (incomeValStr && expenseValStr && incomeVal === 0 && expenseVal === 0) {
                        // If both are present and zero, the amount is likely zero (e.g., failed tx)
                        console.warn(`Row ${rowNumber}: Amount NaN, Income and Expense are both 0. Setting amount to 0.`);
                        amount = 0;
                    } else {
                           throw new Error(`Row ${rowNumber}: Could not parse 'amount' value "${amountValue}" and couldn't reliably derive from Income/Expense columns (Income: ${incomeValStr}, Expense: ${expenseValStr}).`);
                    }
              }
              // Note: The `parseAmount` function now handles negative signs directly if present in the `amountValue`.
              // No need for complex checks against income/expense columns if the main amount column parsed correctly.

              // Final check for amount validity after all processing
              if (isNaN(amount)) {
                    throw new Error(`Row ${rowNumber}: Failed to determine a valid transaction amount.`);
              }


              const parsedTags = tagsCol ? record[tagsCol]?.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) || [] : [];

              // *** Use the FINAL account map returned by createMissingAccountsAndGetMap ***
              const accountId = finalAccountMap[normalizedAccountName]; // Use the map returned from the function

              if (!accountId) {
                 console.error(`Row ${rowNumber}: Account "${accountName}" (normalized: "${normalizedAccountName}") not found in final map AFTER creation attempt. Current map keys: [${Object.keys(finalAccountMap).join(', ')}]. Skipping transaction.`);
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

              // Special Handling for Transfers based on Firefly III format
              // If 'Source account (name)' and 'Destination account (name)' columns are mapped
              const sourceAccountCol = findColumnName(Object.keys(record), 'Source account (name)');
              const destAccountCol = findColumnName(Object.keys(record), 'Destination account (name)');

              if (category.toLowerCase() === 'transfer' || (sourceAccountCol && destAccountCol && record[sourceAccountCol] && record[destAccountCol])) {
                  // This looks like a transfer. The single 'amount' row represents EITHER the withdrawal OR the deposit.
                  // We'll create ONE transaction record for the import preview, marked as 'transfer'.
                  // The actual import logic (`handleImport`) will need to create the corresponding second transaction.
                  console.log(`Row ${rowNumber}: Identified as potential transfer part.`);
                  category = 'Transfer'; // Standardize category

                   // Determine if this row is the debit (outgoing) or credit (incoming) part
                   // If amount is negative, it's likely the debit from the source account
                   // If amount is positive, it's likely the credit to the destination account
                  const mappedAccountIsSource = sourceAccountCol && record[sourceAccountCol]?.trim().toLowerCase() === normalizedAccountName;
                  const mappedAccountIsDest = destAccountCol && record[destAccountCol]?.trim().toLowerCase() === normalizedAccountName;

                  if (amount < 0 && !mappedAccountIsSource) {
                      console.warn(`Row ${rowNumber}: Negative amount but mapped account "${accountName}" doesn't match source account "${record[sourceAccountCol]}". Check mappings.`);
                  }
                  if (amount > 0 && !mappedAccountIsDest) {
                       console.warn(`Row ${rowNumber}: Positive amount but mapped account "${accountName}" doesn't match destination account "${record[destAccountCol]}". Check mappings.`);
                  }

                  // For the preview, we just return this single row, correctly mapped.
                  // The sign of 'amount' should already be correct based on the CSV.
              }


              return {
                accountId: accountId,
                date: parseDate(dateValue),
                amount: amount, // Amount should now have the correct sign
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
                    amount: 0, // Default to 0 on error
                    description: `Error Processing Row ${index + 2}`,
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
             errorMessages.push(`${errorMappedData.length} row(s) had processing errors (e.g., missing account, invalid amount).`);
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
        toast({ title: "Mapping Applied", description: `Previewing ${mapped.length} rows. Review before importing.` });
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

        // Map to store details for accounts found in the CSV (normalizedName -> details)
        const accountUpdates = new Map<string, { name: string; currency: string; type?: string; initialBalance?: number; category: 'asset' | 'crypto' }>();

        csvData.forEach((record, index) => {
            const name = record[accountNameCol]?.trim();
            if (name) {
                const normalizedName = name.toLowerCase();
                let details = accountUpdates.get(normalizedName);

                // Initialize details if this account hasn't been seen yet in the CSV
                if (!details) {
                    const existingAcc = existingAccounts.find(acc => acc.name.toLowerCase() === normalizedName);
                    const initialCategory = existingAcc?.category || ((name.toLowerCase().includes('crypto') || name.toLowerCase().includes('wallet') || name.toLowerCase().includes('binance') || name.toLowerCase().includes('coinbase')) ? 'crypto' : 'asset');
                    details = {
                        name: name,
                        currency: existingAcc?.currency || 'BRL', // Default if not found/mappable
                        type: existingAcc?.type, // Use existing type if available
                        initialBalance: existingAcc?.balance, // Use existing balance initially
                        category: initialCategory
                    };

                     // Infer type if not existing
                     if (!existingAcc) {
                         if (details.category === 'crypto') {
                             if (name.toLowerCase().includes('exchange') || name.toLowerCase().includes('binance') || name.toLowerCase().includes('coinbase')) details.type = 'exchange';
                             else if (name.toLowerCase().includes('wallet') || name.toLowerCase().includes('ledger') || name.toLowerCase().includes('metamask')) details.type = 'wallet';
                             else if (name.toLowerCase().includes('staking') || name.toLowerCase().includes('yield')) details.type = 'staking';
                             else details.type = 'wallet'; // Default crypto type
                         } else { // Asset
                             if (name.toLowerCase().includes('credit') || name.toLowerCase().includes('card')) details.type = 'credit card';
                             else if (name.toLowerCase().includes('saving')) details.type = 'savings';
                             else if (name.toLowerCase().includes('invest')) details.type = 'investment';
                             else details.type = 'checking'; // Default asset type
                         }
                     }
                }

                // Determine currency: Prioritize CSV column > Existing Account > Default
                let finalCurrency = details.currency; // Start with existing or default
                 if (accountCurrencyCol && record[accountCurrencyCol]) {
                     const potentialCurrency = record[accountCurrencyCol]!.trim().toUpperCase();
                     if (supportedCurrencies.includes(potentialCurrency)) {
                         finalCurrency = potentialCurrency;
                     } else {
                         console.warn(`Row ${index + 2}: Ignoring invalid currency "${potentialCurrency}" for account "${name}", using default/existing ${finalCurrency}.`);
                     }
                 }
                 details.currency = finalCurrency;

                 // Capture initial balance if mapped and present for *this specific row*
                 // This updates the balance if found later in the file for the same account
                 if (initialBalanceCol && record[initialBalanceCol] !== undefined && record[initialBalanceCol] !== '') {
                    const balance = parseAmount(record[initialBalanceCol]);
                    if (!isNaN(balance)) {
                        details.initialBalance = balance; // Update the balance
                        console.log(`Row ${index + 2}: Found potential initial balance ${balance} for account "${name}" from CSV.`);
                    } else {
                        console.warn(`Row ${index + 2}: Could not parse initial balance "${record[initialBalanceCol]}" for account "${name}".`);
                    }
                 }

                accountUpdates.set(normalizedName, details);
            }
        });


        if (accountUpdates.size === 0) {
            console.log("No account updates needed.");
            return { success: true, map: workingMap }; // Return current map
        }

        console.log(`Found ${accountUpdates.size} unique accounts in CSV to potentially create or update...`);
        let accountsProcessedCount = 0;

        // Use Promise.all to process account creations/updates concurrently
        await Promise.all(Array.from(accountUpdates.entries()).map(async ([normalizedName, accDetails]) => {
            const existingAccount = existingAccounts.find(acc => acc.name.toLowerCase() === normalizedName);
            try {
                if (existingAccount) {
                    // Update existing account (currency, type, and balance if provided)
                    let needsUpdate = false;
                    const updatedAccountData: Account = { ...existingAccount };

                    // Update currency if different
                    if (accDetails.currency !== existingAccount.currency) {
                        console.log(`Updating currency for existing account "${accDetails.name}" from ${existingAccount.currency} to ${accDetails.currency}...`);
                        updatedAccountData.currency = accDetails.currency;
                        needsUpdate = true;
                    }
                     // Update type if inferred and different
                     if (accDetails.type && accDetails.type !== existingAccount.type) {
                        console.log(`Updating type for existing account "${accDetails.name}" from ${existingAccount.type} to ${accDetails.type}...`);
                        updatedAccountData.type = accDetails.type;
                        needsUpdate = true;
                    }

                    // Update balance ONLY if CSV provided a balance AND it's different
                    if (accDetails.initialBalance !== undefined && accDetails.initialBalance !== existingAccount.balance) {
                        console.log(`Updating balance for existing account "${accDetails.name}" from ${existingAccount.balance} to ${accDetails.initialBalance} based on CSV.`);
                        updatedAccountData.balance = accDetails.initialBalance; // Update balance from CSV data
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        updatedAccountData.lastActivity = new Date().toISOString();
                        await updateAccount(updatedAccountData);
                        accountsProcessedCount++;
                        console.log(`Successfully updated account: ${updatedAccountData.name} (ID: ${updatedAccountData.id})`);
                    } else {
                        console.log(`Account "${accDetails.name}" already exists and is up-to-date.`);
                    }
                    workingMap[normalizedName] = existingAccount.id; // Ensure map has the ID

                } else {
                    // Create new account with the balance found (or 0 if none found/parsed)
                    const balanceToSet = accDetails.initialBalance ?? 0;
                    console.log(`Attempting to create account "${accDetails.name}" with currency ${accDetails.currency}, type ${accDetails.type}, category ${accDetails.category}, balance ${balanceToSet}...`);
                    const newAccountData: NewAccountData = {
                        name: accDetails.name,
                        type: accDetails.type || (accDetails.category === 'crypto' ? 'wallet' : 'checking'), // Default based on category
                        balance: balanceToSet, // Use parsed initial balance or 0
                        currency: accDetails.currency,
                        providerName: 'Imported', // Maybe extract provider if available?
                        category: accDetails.category, // Set category
                        isActive: true,
                        lastActivity: new Date().toISOString(),
                        balanceDifference: 0,
                    };
                    const createdAccount = await addAccount(newAccountData);
                    workingMap[normalizedName] = createdAccount.id; // Add new account to the map
                    accountsProcessedCount++;
                    console.log(`Successfully created account: ${createdAccount.name} (ID: ${createdAccount.id}) with balance ${balanceToSet}`);
                }
            } catch (err: any) {
                console.error(`Failed to process account "${accDetails.name}":`, err);
                toast({ title: "Account Processing Error", description: `Could not process account "${accDetails.name}". Error: ${err.message}`, variant: "destructive", duration: 7000 });
                success = false; // Mark overall process as failed if any account fails
            }
        }));

        if (accountsProcessedCount > 0) {
            toast({ title: "Accounts Processed", description: `Created or updated ${accountsProcessedCount} accounts based on CSV data.` });
        }

        return { success, map: workingMap }; // Return success status and the final map
    };


   const addMissingCategories = async (transactions: MappedTransaction[]): Promise<boolean> => {
      const currentCategories = await getCategories(); // Get fresh list
      const existingCategoryNames = new Set(currentCategories.map(cat => cat.name.toLowerCase()));
      const categoriesToAdd = new Set<string>();
      let success = true;

      transactions.forEach(tx => {
          // Process only pending transactions with a valid category name
          if (tx.importStatus === 'pending' && tx.category && tx.category !== 'Uncategorized' && tx.category !== 'Initial Balance' && tx.category !== 'Transfer') {
              const categoryName = tx.category.trim();
              if (categoryName && !existingCategoryNames.has(categoryName.toLowerCase())) {
                  categoriesToAdd.add(categoryName);
              }
          }
      });

      if (categoriesToAdd.size > 0) {
          console.log(`Found ${categoriesToAdd.size} new categories to add:`, Array.from(categoriesToAdd));
          let categoriesAddedCount = 0;
          const addPromises = Array.from(categoriesToAdd).map(async (catName) => {
              try {
                  await addCategory(catName); // This function already handles duplicates check internally
                  categoriesAddedCount++;
              } catch (err: any) {
                  // Check if the error is because it already exists (addCategory might return existing instead of throwing)
                  if (!err.message?.includes('already exists')) {
                      console.error(`Failed to add category "${catName}":`, err);
                      toast({ title: "Category Add Error", description: `Could not add category "${catName}". Error: ${err.message}`, variant: "destructive" });
                      success = false; // Mark as failed only for unexpected errors
                  } else {
                      console.log(`Category "${catName}" likely created concurrently or already existed.`);
                  }
              }
          });

          await Promise.all(addPromises);

          if (categoriesAddedCount > 0) {
            toast({ title: "Categories Added", description: `Added ${categoriesAddedCount} new categories found in CSV.` });
             // Refetch categories to update the UI state immediately
             try {
                const updatedCategoriesList = await getCategories();
                setCategories(updatedCategoriesList);
             } catch { console.error("Failed to refetch categories after add."); }
          } else if (categoriesToAdd.size > 0) {
              toast({ title: "Categories Processed", description: `Checked ${categoriesToAdd.size} categories found in CSV.` });
          }
      } else {
          console.log("No new categories found in pending transactions.");
      }
      return success;
   };

    const addMissingTags = async (transactions: MappedTransaction[]): Promise<boolean> => {
        const currentTags = await getTags(); // Get fresh list
        const existingTagNames = new Set(currentTags.map(tag => tag.name.toLowerCase()));
        const tagsToAdd = new Set<string>();
        let success = true;

        transactions.forEach(tx => {
            if (tx.importStatus === 'pending' && tx.tags && tx.tags.length > 0) {
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
                    await addTag(tagName); // Handles duplicates check internally
                    tagsAddedCount++;
                } catch (err: any) {
                     if (!err.message?.includes('already exists')) {
                        console.error(`Failed to add tag "${tagName}":`, err);
                        toast({ title: "Tag Add Error", description: `Could not add tag "${tagName}". Error: ${err.message}`, variant: "destructive" });
                        success = false;
                    } else {
                        console.log(`Tag "${tagName}" likely created concurrently or already existed.`);
                    }
                }
            });

            await Promise.all(addPromises);

             if (tagsAddedCount > 0) {
                toast({ title: "Tags Added", description: `Added ${tagsAddedCount} new tags found in CSV.` });
                 // Refetch tags to update the UI state immediately
                 try {
                    const updatedTagsList = await getTags();
                    setTags(updatedTagsList);
                 } catch { console.error("Failed to refetch tags after add."); }
            } else if (tagsToAdd.size > 0) {
                 toast({ title: "Tags Processed", description: `Checked ${tagsToAdd.size} tags found in CSV.` });
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
      setError(null); // Clear previous errors
      let overallError = false;

      // Final check/creation of accounts and get the map just before import
      console.log("Finalizing account mapping before import...");
      const { success: finalAccountMapSuccess, map: finalAccountMap } = await createMissingAccountsAndGetMap(
          rawData.filter((_, index) => parsedData[index]?.importStatus === 'pending'), // Only process relevant raw data
          columnMappings.account!,
          columnMappings.accountCurrency,
          columnMappings.initialBalance
      );
       if (!finalAccountMapSuccess) {
          setError("Error finalizing account mapping before import. Check console.");
          setIsLoading(false);
          return;
      }
       // Update UI accounts state with potentially newly created/updated accounts
       try {
          setAccounts(await getAccounts());
          console.log("Refetched accounts state after final mapping.");
       } catch {
           console.error("Failed to refetch accounts state before import execution.");
       }

      // Create missing categories and tags
      console.log("Adding missing categories...");
      const categoriesSuccess = await addMissingCategories(recordsToImport);
      console.log("Adding missing tags...");
      const tagsSuccess = await addMissingTags(recordsToImport);

      if (!categoriesSuccess || !tagsSuccess) {
         setError("Error adding categories or tags. Import halted. Check console.");
         setIsLoading(false);
         return;
      }

      // Fetch current categories and tags *after* potential additions
      console.log("Fetching latest categories and tags before import...");
      let currentCategories = await getCategories();
      let currentTags = await getTags();
      console.log("Using FINAL account map for import execution:", finalAccountMap);


      const totalToImport = recordsToImport.length;
      let importedCount = 0;
      let errorCount = 0;
      const updatedData = [...parsedData]; // Create a mutable copy to update status

      console.log(`Starting import of ${totalToImport} pending transactions...`);

      // Process transactions sequentially to avoid race conditions with balance updates
      for (let i = 0; i < updatedData.length; i++) {
          const item = updatedData[i];
          const rowNumber = i + 2; // For logging

          if (item.importStatus !== 'pending') {
              // Already processed, skipped, or error during preview
              if(item.importStatus === 'error') errorCount++;
              continue;
          }

          try {
               const categoryName = item.category?.trim() || 'Uncategorized';
               // Use the fetched currentCategories list
               const foundCategory = currentCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
               // If category wasn't found after attempting to add, default to Uncategorized
               const finalCategoryName = foundCategory ? foundCategory.name : 'Uncategorized';
               if (categoryName !== 'Uncategorized' && !foundCategory) {
                   console.warn(`Row ${rowNumber}: Category "${categoryName}" specified but not found after add attempt. Defaulting to 'Uncategorized'.`);
               }

               // Use the fetched currentTags list
               const finalTags = item.tags?.map(importedTagName => {
                   const foundTag = currentTags.find(t => t.name.toLowerCase() === importedTagName.trim().toLowerCase());
                   // If tag wasn't found after adding, keep original (should have been added) - or discard? For now, keep.
                    if (!foundTag) console.warn(`Row ${rowNumber}: Tag "${importedTagName}" not found after add attempt.`);
                   return foundTag ? foundTag.name : importedTagName.trim();
               }).filter(Boolean) || [];


                // Check account ID again before import using the FINAL map
                const accountNameFromRecord = item.originalRecord[columnMappings.account!]?.trim().toLowerCase();
                const accountIdForImport = finalAccountMap[accountNameFromRecord || ''];

               if (!accountIdForImport || accountIdForImport.startsWith('skipped_') || accountIdForImport.startsWith('error_')) {
                    console.error(`Import Error Row ${rowNumber}: Invalid or missing account ID for account name "${accountNameFromRecord}" using map:`, finalAccountMap);
                    throw new Error(`Invalid or missing account ID for "${item.originalRecord[columnMappings.account!] || 'N/A'}"`);
               }

               // --- Handle Transfers ---
                if (item.category === 'Transfer') {
                     const sourceAccountCol = findColumnName(Object.keys(item.originalRecord), 'Source account (name)');
                     const destAccountCol = findColumnName(Object.keys(item.originalRecord), 'Destination account (name)');
                     const sourceName = sourceAccountCol ? item.originalRecord[sourceAccountCol]?.trim() : undefined;
                     const destName = destAccountCol ? item.originalRecord[destAccountCol]?.trim() : undefined;
                     const sourceId = sourceName ? finalAccountMap[sourceName.toLowerCase()] : undefined;
                     const destId = destName ? finalAccountMap[destName.toLowerCase()] : undefined;

                     if (!sourceId || !destId) {
                         throw new Error(`Row ${rowNumber}: Could not find both source ("${sourceName || 'N/A'}") and destination ("${destName || 'N/A'}") accounts for transfer.`);
                     }
                     if (sourceId === destId) {
                         throw new Error(`Row ${rowNumber}: Transfer source and destination accounts are the same ("${sourceName}").`);
                     }

                     // Add TWO transactions for a transfer
                     const transferAmount = Math.abs(item.amount); // Amount should be positive
                     const transferDate = item.date;
                     const transferDesc = item.description || `Transfer from ${sourceName} to ${destName}`;
                     const transferTags = finalTags;

                     // 1. Add outgoing transaction (negative)
                     await addTransaction({
                         accountId: sourceId,
                         date: transferDate,
                         amount: -transferAmount,
                         description: transferDesc,
                         category: 'Transfer',
                         tags: transferTags,
                     });
                     // 2. Add incoming transaction (positive)
                     await addTransaction({
                         accountId: destId,
                         date: transferDate,
                         amount: transferAmount,
                         description: transferDesc,
                         category: 'Transfer',
                         tags: transferTags,
                     });
                     console.log(`Row ${rowNumber}: Successfully imported transfer: ${transferDesc}, Amount: ${transferAmount}`);

                 } else {
                    // --- Handle Regular Expense/Income ---
                     const transactionPayload: Omit<Transaction, 'id'> = {
                        accountId: accountIdForImport,
                        date: item.date,
                        amount: item.amount, // Amount should already have the correct sign
                        description: item.description,
                        category: finalCategoryName,
                        tags: finalTags,
                     };
                    // `addTransaction` already handles balance updates
                    await addTransaction(transactionPayload);
                    console.log(`Row ${rowNumber}: Successfully imported ${item.amount >= 0 ? 'income' : 'expense'}: ${item.description}, Amount: ${item.amount}`);
                 }


              updatedData[i] = { ...item, importStatus: 'success', errorMessage: undefined };
              importedCount++;
          } catch (err: any) {
              console.error(`Failed to import record (Row ${rowNumber}): "${item.description || 'N/A'}"`, err);
              updatedData[i] = { ...item, importStatus: 'error', errorMessage: err.message || 'Unknown import error' };
              errorCount++;
              overallError = true;
               // Update progress even on error
               setImportProgress(calculateProgress(importedCount + errorCount, totalToImport));
               // Do not stop the import on single row error, continue with others
          }

           // Update progress after each attempt (success or fail)
          setImportProgress(calculateProgress(importedCount + errorCount, totalToImport));

           // Update the state triggering a re-render of the table with new statuses
           // Creating a new array reference is crucial for React state updates
           setParsedData([...updatedData]);

           // Optional small delay to allow UI updates between rows for large files
           // await new Promise(resolve => setTimeout(resolve, 5));
      }

      setIsLoading(false);
      const finalMessage = `Import finished. Success: ${importedCount}. Failed/Skipped: ${errorCount}.`;
      toast({
        title: overallError ? "Import Complete with Issues" : "Import Complete",
        description: finalMessage,
        variant: overallError ? "destructive" : "default",
        duration: 7000,
      });
      if (overallError) {
         setError(`Import finished with ${errorCount} errors/skipped rows. Please review the table.`);
      } else {
         setError(null); // Clear error if all successful
         // Trigger storage event to update other pages only on full success? Or always?
          console.log("Dispatching storage event to notify other components of potential updates.");
         window.dispatchEvent(new Event('storage'));
      }
    };


  const calculateProgress = (processed: number, total: number): number => {
      if (total === 0) return 0;
      return Math.round((processed / total) * 100);
  }

    const handleClearAccounts = async () => {
        setIsClearing(true);
        try {
            // Clear Local Storage for accounts, categories, tags
            // Preferences are usually kept
            localStorage.removeItem('userAccounts');
            localStorage.removeItem('userCategories');
            localStorage.removeItem('userTags');

            // Clear Session Storage for transactions
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
            Select the CSV file containing your transactions. Ensure it has a header row. Formats like Firefly III export are best supported.
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

