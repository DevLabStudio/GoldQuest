
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
import { getCurrencySymbol, supportedCurrencies, formatCurrency } from '@/lib/currency'; // Import supportedCurrencies and formatCurrency
import CsvMappingForm, { type ColumnMapping } from '@/components/import/csv-mapping-form';
import { AlertCircle, Trash2 } from 'lucide-react'; // Added Trash2 for clear button
import { cn } from '@/lib/utils';

// Define a flexible type for parsed CSV rows
type CsvRecord = {
  [key: string]: string | undefined;
};

// Define the essential *application* fields we need mapped from CsvMappingForm
// Added 'transaction_type'
const APP_FIELDS_VALUES = [
    'date', 'amount', 'amount_income', 'amount_expense', 'description', 'account',
    'source_account', 'destination_account', 'category', 'accountCurrency',
    'tags', 'initialBalance', 'notes', 'transaction_type' // Added transaction_type
] as const;
type AppField = typeof APP_FIELDS_VALUES[number];

type MappedTransaction = Omit<Transaction, 'id'> & {
  originalRecord: CsvRecord;
  importStatus: 'pending' | 'success' | 'error' | 'skipped';
  errorMessage?: string;
  // Tags are already optional in Transaction interface
};

// Define interface for account preview data
interface AccountPreview {
    name: string;
    currency: string;
    initialBalance?: number; // Balance that will be set/updated
    action: 'create' | 'update' | 'no change'; // What will happen to this account
    existingId?: string; // ID if it's an update/no change
}


// Helper to find a column name case-insensitively (remains useful)
const findColumnName = (headers: string[], targetName: string): string | undefined => {
    return headers.find(header => header?.trim().toLowerCase() === targetName.toLowerCase());
};

// Helper to parse amount string - more robust
const parseAmount = (amountStr: string | undefined): number => {
    if (typeof amountStr !== 'string' || amountStr.trim() === '') return NaN; // Return NaN if invalid input
    let cleaned = amountStr.replace(/[^\d.,-]/g, '').trim(); // Remove non-digit chars except separators and sign

    // Handle potential european format with multiple dots for thousands and comma for decimal
    const numPeriods = (cleaned.match(/\./g) || []).length;
    const numCommas = (cleaned.match(/,/g) || []).length;

    if (numCommas === 1 && numPeriods > 0 && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        // Assume European format: remove dots, replace comma with dot
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (numPeriods === 1 && numCommas > 0 && cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
        // Assume US format: remove commas
        cleaned = cleaned.replace(/,/g, '');
    } else if (numCommas === 1 && numPeriods === 0) {
         // Only commas present, assume it's the decimal separator
         cleaned = cleaned.replace(',', '.');
    } else if (numPeriods === 1 && numCommas === 0) {
         // Only periods present, assume it's the decimal separator
         // parseFloat handles this correctly
    } else if (numPeriods > 1) {
         // Multiple periods, no commas or comma is before last period -> assume US/UK thousand separators
         cleaned = cleaned.replace(/,/g, '');
    } else if (numCommas > 1) {
         // Multiple commas, no periods or period is before last comma -> assume EU thousand separators
          cleaned = cleaned.replace(/\./g, '').replace(/,/g, ''); // Treat all commas as thousand separators initially, decimal logic handled below? No, this is wrong.
          // Let's retry: if multiple commas and last char is comma, assume it's decimal after removing others
          const lastChar = cleaned[cleaned.length - 1];
          const secondLastChar = cleaned[cleaned.length - 2];
          if (lastChar === ',' && !isNaN(parseInt(secondLastChar))) {
              // If like 1,234,56 - remove all but last comma
              const lastCommaIndex = cleaned.lastIndexOf(',');
              cleaned = cleaned.substring(0, lastCommaIndex).replace(/,/g, '') + '.' + cleaned.substring(lastCommaIndex + 1);
          } else {
               cleaned = cleaned.replace(/,/g, ''); // Fallback: treat all as thousand separators
          }
    }
     // If after cleaning, it ends with a separator, assume it's a decimal point missing a zero (e.g. "10.")
    if (cleaned.endsWith('.') || cleaned.endsWith(',')) {
        cleaned += '0';
    }

    // Final check for leading/trailing separators if cleaning was imperfect
    cleaned = cleaned.replace(/^[,.]+|[,.]+$/g, '');

    const parsed = parseFloat(cleaned);

    // console.log(`parseAmount: Input='${amountStr}', Cleaned='${cleaned}', Parsed=${parsed}`); // Reduced logging
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
  const [accountPreviewData, setAccountPreviewData] = useState<AccountPreview[]>([]); // State for account preview
  // Store the final map used for import (after creation/update)
  const [finalAccountMapForImport, setFinalAccountMapForImport] = useState<{ [key: string]: string }>({});
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
      setAccountPreviewData([]); // Reset account preview on new file
      setRawData([]);
      setCsvHeaders([]);
      setImportProgress(0);
      setColumnMappings({});
      setFinalAccountMapForImport({}); // Reset final map
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
    setAccountPreviewData([]); // Reset account preview
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
         initialMappings.amount_income = findColumnName(detectedHeaders, 'Amount income');
         initialMappings.amount_expense = findColumnName(detectedHeaders, 'Amount expense');
         initialMappings.description = findColumnName(detectedHeaders, 'Description') || findColumnName(detectedHeaders, 'description');
         // Try Firefly III's specific or general 'Account'
         initialMappings.account = findColumnName(detectedHeaders, 'Asset account (name)') || findColumnName(detectedHeaders, 'Account') || findColumnName(detectedHeaders, 'account'); // Changed preference for Firefly III
         initialMappings.source_account = findColumnName(detectedHeaders, 'Source account (name)');
         initialMappings.destination_account = findColumnName(detectedHeaders, 'Destination account (name)');
         initialMappings.category = findColumnName(detectedHeaders, 'Category') || findColumnName(detectedHeaders, 'category');
         initialMappings.accountCurrency = findColumnName(detectedHeaders, 'Currency code') || findColumnName(detectedHeaders, 'currency') || findColumnName(detectedHeaders, 'Amount currency') || findColumnName(detectedHeaders, 'Source currency') || findColumnName(detectedHeaders, 'Destination currency');
         initialMappings.tags = findColumnName(detectedHeaders, 'Tags') || findColumnName(detectedHeaders, 'tags');
         // Try to map initial balance
         initialMappings.initialBalance = findColumnName(detectedHeaders, 'Initial balance') || findColumnName(detectedHeaders, 'Starting balance') || findColumnName(detectedHeaders, 'Balance') || findColumnName(detectedHeaders, 'Account balance'); // Added more generic balance terms
         initialMappings.notes = findColumnName(detectedHeaders, 'Notes') || findColumnName(detectedHeaders, 'Memo'); // Map notes
         // Map Transaction Type (from Firefly export)
         initialMappings.transaction_type = findColumnName(detectedHeaders, 'Type') || findColumnName(detectedHeaders, 'Transaction type');


         // Refined Amount Logic: Prefer 'Amount', then Income/Expense pairs, then specific currency amounts
         if (!initialMappings.amount && initialMappings.amount_income && initialMappings.amount_expense) {
             console.log("No 'Amount' column found, using 'Amount income' and 'Amount expense'.");
         } else if (!initialMappings.amount && !initialMappings.amount_income && !initialMappings.amount_expense) {
            // If primary, and income/expense pairs are missing, check for 'Amount in XXX'
            const specificAmountCol = detectedHeaders.find(h => h.toLowerCase().startsWith('amount in '));
            if(specificAmountCol) {
                console.log(`Using specific amount column: ${specificAmountCol}`);
                initialMappings.amount = specificAmountCol; // Map this to the main amount field
                 // Try to infer currency from that column header if currency isn't mapped yet
                if (!initialMappings.accountCurrency) {
                    const currencyMatch = specificAmountCol.match(/Amount in (\w+)/i);
                    if (currencyMatch && currencyMatch[1]) {
                        const inferredCurrency = currencyMatch[1].toUpperCase();
                        if (supportedCurrencies.includes(inferredCurrency)) {
                             console.log(`Inferred currency ${inferredCurrency} from amount column header.`);
                             // Attempt to find a currency column, if not, this becomes tricky
                             // For now, we still rely on a dedicated currency column or default
                        }
                    }
                }
            } else {
                 console.warn("Could not automatically map an amount column ('Amount', 'Amount income'/'Amount expense', or 'Amount in XXX'). Please map manually.");
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
        setAccountPreviewData([]); // Clear previous preview
        setColumnMappings(confirmedMappings); // Store the confirmed mappings
        setFinalAccountMapForImport({}); // Reset final map for this new mapping

        // Validate required mappings
        const hasSignedAmount = !!confirmedMappings.amount;
        const hasIncomeExpense = !!confirmedMappings.amount_income && !!confirmedMappings.amount_expense;
        const amountRequirementMet = hasSignedAmount || hasIncomeExpense;

        const requiredBaseFields: AppField[] = ['date']; // Account mapping is more complex, handled below
        const missingBaseMappings = requiredBaseFields.filter(field => !confirmedMappings[field]);
        let missingFieldLabels = missingBaseMappings.map(f => APP_FIELDS_VALUES.find(val => val === f) || f); // Get label

        // Amount validation
        if (!amountRequirementMet) {
            missingFieldLabels.push("Amount (Signed +/-) *OR* both Income Amount + Expense Amount");
        }

        // Account Validation - need at least ONE of account, source, or destination
        const hasPrimaryAccount = !!confirmedMappings.account;
        const hasTransferAccounts = !!confirmedMappings.source_account && !!confirmedMappings.destination_account;
        if (!hasPrimaryAccount && !hasTransferAccounts) {
            missingFieldLabels.push("Account Name *OR* both Source Account + Destination Account");
        }


        if (missingFieldLabels.length > 0) {
            setError(`Missing required column mappings: ${missingFieldLabels.join(', ')}. Please map these fields.`);
            setIsLoading(false);
            setIsMappingDialogOpen(true);
            return;
        }

        const dateCol = confirmedMappings.date!;
        // Amount related columns
        const amountCol = confirmedMappings.amount; // Signed amount
        const incomeCol = confirmedMappings.amount_income; // Positive income
        const expenseCol = confirmedMappings.amount_expense; // Positive expense
        // Other columns
        const descCol = confirmedMappings.description;
        const accountCol = confirmedMappings.account; // Primary account name
        const sourceAccountCol = confirmedMappings.source_account; // For transfers
        const destAccountCol = confirmedMappings.destination_account; // For transfers
        const catCol = confirmedMappings.category;
        const accountCurrencyCol = confirmedMappings.accountCurrency;
        const tagsCol = confirmedMappings.tags;
        const initialBalanceCol = confirmedMappings.initialBalance;
        const notesCol = confirmedMappings.notes;
        const typeCol = confirmedMappings.transaction_type; // Transaction type column

        // Determine which account column(s) to use for initial account creation pass
        // Prioritize 'account', then 'source', then 'destination'
        const primaryAccountNameSourceCol = accountCol || sourceAccountCol || destAccountCol;
        if (!primaryAccountNameSourceCol) {
             setError("Could not determine a primary column for account names. Please map 'Account Name', 'Source Account', or 'Destination Account'.");
             setIsLoading(false);
             setIsMappingDialogOpen(true);
             return;
        }


        // --- Preview Account Changes (No creation yet) ---
         const { preview } = await previewAccountChanges(
             rawData,
             confirmedMappings, // Pass all mappings
             accounts // Pass current accounts state
         );
         setAccountPreviewData(preview);
         console.log("Account preview generated:", preview);


        // --- Generate a TEMPORARY Account Map for Transaction Linking (No creation yet) ---
        // This step gets the IDs of existing accounts and placeholders for new ones
        const { map: tempAccountMap } = await createOrUpdateAccountsAndGetMap(
             rawData,
             confirmedMappings, // Pass all mappings
             accounts, // Pass current accounts state
             true // Indicate it's a preview/map generation only
        );
        console.log("Generated temporary account map for transaction linking:", tempAccountMap);
        // Don't save this temp map to state, it's only for the mapping step


        // --- Map Transaction Data using the TEMP map ---
        const mapped: MappedTransaction[] = rawData.map((record, index) => {
          try {
              const rowNumber = index + 2; // CSV row number (assuming header is row 1)

              // --- Core Data Extraction ---
              const dateValue = record[dateCol];
              const descriptionValue = descCol ? record[descCol] : undefined;
              const categoryValue = catCol ? record[catCol] : undefined;
              const accountNameValue = accountCol ? record[accountCol] : undefined; // Primary account
              const sourceAccountNameValue = sourceAccountCol ? record[sourceAccountCol] : undefined;
              const destAccountNameValue = destAccountCol ? record[destAccountCol] : undefined;
              const tagsValue = tagsCol ? record[tagsCol] : undefined;
              const notesValue = notesCol ? record[notesCol] : undefined;
              const typeValue = typeCol ? record[typeCol]?.trim().toLowerCase() : undefined;


              // --- Amount Parsing Logic ---
              let parsedAmount: number = NaN; // Changed variable name for clarity
              const signedAmountValue = amountCol ? record[amountCol] : undefined;
              const incomeAmountValue = incomeCol ? record[incomeCol] : undefined;
              const expenseAmountValue = expenseCol ? record[expenseCol] : undefined;

              if (amountCol && signedAmountValue !== undefined && signedAmountValue.trim() !== '') {
                  parsedAmount = parseAmount(signedAmountValue);
                   console.log(`Row ${rowNumber}: Parsed amount from signed column ('${amountCol}')='${signedAmountValue}' as ${parsedAmount}`);
              } else if (incomeCol && expenseCol && (incomeAmountValue !== undefined || expenseAmountValue !== undefined)) {
                  const income = parseAmount(incomeAmountValue);
                  const expense = parseAmount(expenseAmountValue);
                   if (!isNaN(income) && income > 0 && (isNaN(expense) || expense === 0)) {
                       parsedAmount = income; // It's income
                       console.log(`Row ${rowNumber}: Parsed amount from income column ('${incomeCol}')='${incomeAmountValue}' as ${parsedAmount}`);
                   } else if (!isNaN(expense) && expense > 0 && (isNaN(income) || income === 0)) {
                       parsedAmount = -expense; // It's an expense (make it negative)
                       console.log(`Row ${rowNumber}: Parsed amount from expense column ('${expenseCol}')='${expenseAmountValue}' as ${parsedAmount}`);
                   } else if (!isNaN(income) && income === 0 && !isNaN(expense) && expense === 0) {
                       parsedAmount = 0; // Zero amount transaction
                       console.log(`Row ${rowNumber}: Parsed amount as 0 from income/expense columns.`);
                   } else if (!isNaN(income) && income > 0 && !isNaN(expense) && expense > 0) {
                      // Ambiguous case (Firefly transfer?) - will resolve based on accounts or error
                       console.warn(`Row ${rowNumber}: Both income (${income}) and expense (${expense}) have values. Transfer logic will attempt to resolve.`);
                       // We'll assign based on transfer context later, or throw if not a transfer
                       parsedAmount = NaN; // Mark as NaN initially
                   } else {
                        // Throw error if parsing failed or logic is unclear
                       throw new Error(`Could not determine amount from Income ('${incomeAmountValue}') and Expense ('${expenseAmountValue}') columns.`);
                   }
              }

               // Additional check if parsedAmount is still NaN
              if (isNaN(parsedAmount)) {
                  // If type is 'opening balance', try to use the amount from the main amount column
                  if (typeValue === 'opening balance' && amountCol && signedAmountValue !== undefined && signedAmountValue.trim() !== '') {
                     parsedAmount = parseAmount(signedAmountValue);
                     if (isNaN(parsedAmount)) {
                         console.error(`Row ${rowNumber}: Could not parse amount for 'opening balance'. Signed='${signedAmountValue}'.`);
                         throw new Error(`Could not parse amount for 'opening balance'.`);
                     } else {
                         console.log(`Row ${rowNumber}: Used amount column for 'opening balance': ${parsedAmount}`);
                     }
                  } else {
                     console.error(`Row ${rowNumber}: Amount could not be determined. Signed='${signedAmountValue}', Income='${incomeAmountValue}', Expense='${expenseAmountValue}'.`);
                     throw new Error(`Could not determine a valid amount.`);
                  }
              }


              // --- Validation ---
              if (!dateValue) throw new Error(`Row ${rowNumber}: Missing mapped 'Date' data.`);
              // Amount validation happens later
              // Account validation happens later during ID lookup

              // --- Basic Data Preparation ---
              let description = descriptionValue?.trim() || 'Imported Transaction';
              let category = categoryValue?.trim() || 'Uncategorized';
              const parsedTags = tagsValue?.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) || [];
               if (notesValue) {
                   description += ` (Notes: ${notesValue.trim()})`; // Append notes to description if present
               }

              // --- Determine Transaction Type and Involved Accounts ---
              let transactionTypeInternal: 'income' | 'expense' | 'transfer' | 'skip' = 'skip';
              let primaryAccountId: string | undefined = undefined; // This will hold the TEMP account ID for linking
              let isTransfer = false;

              // Explicit Transfer Check (using Firefly source/destination columns)
              if (sourceAccountNameValue && destAccountNameValue) {
                   isTransfer = true;
                   const sourceNameLower = sourceAccountNameValue.trim().toLowerCase();
                   const destNameLower = destAccountNameValue.trim().toLowerCase();
                   const sourceId = tempAccountMap[sourceNameLower]; // Use the temp map
                   const destId = tempAccountMap[destNameLower]; // Use the temp map

                   if (!sourceId) throw new Error(`Row ${rowNumber}: Transfer detected, but Source account ('${sourceAccountNameValue}') not found in temp map.`);
                   if (!destId) throw new Error(`Row ${rowNumber}: Transfer detected, but Destination account ('${destAccountNameValue}') not found in temp map.`);
                   if (sourceId === destId) throw new Error(`Row ${rowNumber}: Transfer source and destination accounts are the same ('${sourceAccountNameValue}').`);

                   // Resolve amount for transfers when both income/expense present
                   if (isNaN(parsedAmount) && !isNaN(parseAmount(incomeAmountValue)) && !isNaN(parseAmount(expenseAmountValue))) {
                       parsedAmount = Math.abs(parseAmount(incomeAmountValue) || parseAmount(expenseAmountValue) || 0); // Take the non-zero value as absolute amount
                       if (parsedAmount === 0) throw new Error(`Row ${rowNumber}: Transfer amount resolved to zero from income/expense columns.`);
                       console.log(`Row ${rowNumber}: Resolved transfer amount to ${parsedAmount} from income/expense.`);
                   } else if (isNaN(parsedAmount)) {
                       // If signed amount is present for transfer, use it (absolute)
                       const signedAmount = parseAmount(signedAmountValue);
                       if (!isNaN(signedAmount)) {
                           parsedAmount = Math.abs(signedAmount);
                           console.log(`Row ${rowNumber}: Using absolute signed amount ${parsedAmount} for transfer.`);
                       } else {
                          throw new Error(`Row ${rowNumber}: Could not determine transfer amount.`);
                       }
                   } else {
                       parsedAmount = Math.abs(parsedAmount); // Ensure transfer amount is positive
                   }

                   // For preview, use source ID for the representative transaction
                   primaryAccountId = sourceId;
                   transactionTypeInternal = 'transfer';
                   category = 'Transfer'; // Standardize category
                   description = description || `Transfer from ${sourceAccountNameValue} to ${destAccountNameValue}`;

               } else if (accountNameValue) {
                   // Standard Expense/Income/Opening Balance using 'account' column
                   const accountNameLower = accountNameValue.trim().toLowerCase();
                   primaryAccountId = tempAccountMap[accountNameLower]; // Use temp map
                   if (!primaryAccountId) throw new Error(`Row ${rowNumber}: Account '${accountNameValue}' not found in temp map.`);

                   if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Invalid or missing amount value ('${signedAmountValue || incomeAmountValue || expenseAmountValue || 'N/A'}').`);

                   // Determine type based on sign OR typeCol if available
                   if (typeValue === 'deposit' || typeValue === 'transfer') { // Treat 'Transfer' type (without source/dest) as deposit
                       parsedAmount = Math.abs(parsedAmount); // Ensure positive for deposit/transfer
                       transactionTypeInternal = 'income';
                       if (typeValue === 'transfer') category = 'Transfer'; // Mark as transfer category
                   } else if (typeValue === 'withdrawal') {
                       parsedAmount = -Math.abs(parsedAmount); // Ensure negative for withdrawal
                       transactionTypeInternal = 'expense';
                   } else if (typeValue === 'opening balance') {
                        // This type is primarily used to SET the initial balance during account creation/update.
                        // We skip creating a *transaction* for it, but the balance is handled elsewhere.
                        console.log(`Row ${rowNumber}: Identified 'opening balance' type for account ${accountNameValue}. Amount: ${parsedAmount}. This will set initial account balance.`);
                        transactionTypeInternal = 'skip'; // Skip creating a transaction row for this
                        description = description + " (Opening Balance Entry)";
                   } else {
                       // Fallback to amount sign if type column is missing or unhelpful
                       transactionTypeInternal = parsedAmount >= 0 ? 'income' : 'expense';
                   }

               } else {
                   // We should have source/dest OR account by now due to initial validation
                   // This case handles scenarios where only source OR dest is mapped (not standard transfer)
                   const singleAccountName = (sourceAccountNameValue || destAccountNameValue)?.trim();
                   if (singleAccountName) {
                      const accountNameLower = singleAccountName.toLowerCase();
                      primaryAccountId = tempAccountMap[accountNameLower];
                      if (!primaryAccountId) throw new Error(`Row ${rowNumber}: Account '${singleAccountName}' from source/destination column not found in temp map.`);

                      if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Invalid or missing amount value.`);

                      // Determine type based on sign (if only one account involved)
                      transactionTypeInternal = parsedAmount >= 0 ? 'income' : 'expense';

                   } else {
                      // Should not happen if validation is correct
                      throw new Error(`Row ${rowNumber}: Missing required account information.`);
                   }
               }


               // Final check for amount validity after all processing
               if (transactionTypeInternal !== 'skip' && isNaN(parsedAmount)) {
                    throw new Error(`Row ${rowNumber}: Failed to determine a valid transaction amount.`);
               }


              // --- Construct Mapped Transaction ---
               if (transactionTypeInternal === 'skip') {
                    return {
                        accountId: 'skipped', // Special ID for skipped
                        date: parseDate(dateValue),
                        amount: parsedAmount || 0, // Keep amount if available, otherwise 0
                        description: description,
                        category: typeValue === 'opening balance' ? 'Opening Balance' : 'Skipped',
                        tags: parsedTags,
                        originalRecord: record,
                        importStatus: 'skipped',
                        errorMessage: typeValue === 'opening balance' ? 'Opening Balance (sets initial account value)' : 'Skipped (e.g., non-opening initial balance).',
                    };
               } else {
                   // Regular transaction (income, expense, transfer)
                   return {
                       // Use the determined temporary account ID (could be source, dest, or primary)
                       accountId: primaryAccountId!, // Validated above
                       date: parseDate(dateValue),
                       amount: parsedAmount, // Amount has correct sign or is positive for transfer
                       description: description,
                       category: category,
                       tags: parsedTags,
                       originalRecord: record,
                       importStatus: 'pending', // Default status
                   };
               }

            } catch (rowError: any) {
                console.error(`Error processing row ${index + 2} with mappings:`, rowError);
                 return {
                    // Use a placeholder/error ID, maybe based on row index
                    accountId: `error_row_${index}`,
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
             errorMessages.push(`${skippedMappedData.length} row(s) were skipped (e.g., opening balance entries or other skipped types).`);
        }
        if (errorMessages.length > 0) {
            setError(`Import Preview Issues: ${errorMessages.join(' ')} Review the tables below.`);
        } else {
            setError(null);
        }

        setParsedData(mapped);
        setIsLoading(false);
        setIsMappingDialogOpen(false);
        toast({ title: "Mapping Applied", description: `Previewing ${mapped.filter(m => m.importStatus === 'pending').length} transactions and account changes. Review before importing.` });
   }


    /**
     * Previews account changes based on CSV data without actually modifying anything.
     * @returns A promise resolving to an object containing the preview data.
     */
    const previewAccountChanges = async (
        csvData: CsvRecord[],
        mappings: ColumnMapping, // Pass full mappings
        existingAccounts: Account[] // Pass existing accounts
    ): Promise<{ preview: AccountPreview[] }> => {
        const preview: AccountPreview[] = [];
        const processedAccountNames = new Set<string>(); // Track processed names

        // Map to store details for accounts found in the CSV (normalizedName -> details)
        const accountUpdates = await buildAccountUpdateMap(csvData, mappings, existingAccounts); // Pass mappings

        accountUpdates.forEach((accDetails, normalizedName) => {
            const existingAccount = existingAccounts.find(acc => acc.name.toLowerCase() === normalizedName);
            let action: AccountPreview['action'] = 'no change';
            let initialBalance: number | undefined = undefined;

            if (existingAccount) {
                // Check if update is needed (currency, type, or balance)
                let needsUpdate = false;
                if (accDetails.currency !== existingAccount.currency) needsUpdate = true;
                if (accDetails.type && accDetails.type !== existingAccount.type) needsUpdate = true;
                // Balance update check: if CSV provides a balance AND it's different
                if (accDetails.initialBalance !== undefined && accDetails.initialBalance !== existingAccount.balance) {
                    needsUpdate = true;
                    initialBalance = accDetails.initialBalance; // Balance that will be set
                } else {
                    initialBalance = existingAccount.balance; // Existing balance if no change
                }

                if (needsUpdate) {
                    action = 'update';
                }
                 preview.push({
                    name: accDetails.name,
                    currency: accDetails.currency,
                    initialBalance: initialBalance,
                    action: action,
                    existingId: existingAccount.id
                });
            } else {
                // New account to be created
                initialBalance = accDetails.initialBalance ?? 0; // Balance to be set (or 0)
                preview.push({
                    name: accDetails.name,
                    currency: accDetails.currency,
                    initialBalance: initialBalance,
                    action: 'create',
                });
            }
             processedAccountNames.add(normalizedName);
        });

        // Optionally add existing accounts that weren't mentioned in the CSV
        existingAccounts.forEach(acc => {
            if (!processedAccountNames.has(acc.name.toLowerCase())) {
                preview.push({
                    name: acc.name,
                    currency: acc.currency,
                    initialBalance: acc.balance,
                    action: 'no change',
                    existingId: acc.id,
                });
            }
        });

        return { preview };
    };


    /**
     * Builds a map of account details from CSV data, considering existing accounts.
     * This function is used by both preview and final creation.
     * It prioritizes rows with type 'opening balance' for setting the initial balance.
     */
    const buildAccountUpdateMap = async (
        csvData: CsvRecord[],
        mappings: ColumnMapping, // Pass full mappings
        existingAccounts: Account[] // Pass existing accounts to avoid re-fetching
    ): Promise<Map<string, { name: string; currency: string; type?: string; initialBalance?: number; category: 'asset' | 'crypto' }>> => {
        const accountUpdates = new Map<string, { name: string; currency: string; type?: string; initialBalance?: number; category: 'asset' | 'crypto' }>();

        const accountNameCol = mappings.account;
        const sourceAccountCol = mappings.source_account;
        const destAccountCol = mappings.destination_account;
        const accountCurrencyCol = mappings.accountCurrency;
        const initialBalanceCol = mappings.initialBalance; // Direct initial balance column
        const typeCol = mappings.transaction_type; // Type column ('opening balance')
        const amountCol = mappings.amount; // Amount column (used by 'opening balance' type)

        // Separate pass to prioritize 'opening balance' rows for initial balance setting
        csvData.forEach((record, index) => {
            const typeValue = typeCol ? record[typeCol]?.trim().toLowerCase() : undefined;
            if (typeValue === 'opening balance') {
                const name = accountNameCol ? record[accountNameCol]?.trim() : undefined;
                if (name) {
                    const normalizedName = name.toLowerCase();
                    let details = accountUpdates.get(normalizedName);

                    // Initialize details if needed (first time seeing this account)
                    if (!details) {
                        const existingAcc = existingAccounts.find(acc => acc.name.toLowerCase() === normalizedName);
                        const initialCategory = existingAcc?.category || ((normalizedName.includes('crypto') || normalizedName.includes('wallet') || normalizedName.includes('binance') || normalizedName.includes('coinbase') || normalizedName.includes('kraken') || normalizedName.includes('ledger') || normalizedName.includes('metamask')) ? 'crypto' : 'asset');
                         details = {
                             name: name,
                             currency: existingAcc?.currency || 'BRL',
                             type: existingAcc?.type,
                             initialBalance: existingAcc?.balance, // Start with existing balance
                             category: initialCategory
                         };
                         // Infer type if needed
                         if (!details.type) {
                             if (details.category === 'crypto') details.type = 'wallet'; // Default
                             else details.type = 'checking'; // Default
                         }
                    }

                    // Extract currency for this account from the row
                    let rowCurrency = details.currency; // Default to existing/previous
                     if (accountCurrencyCol && record[accountCurrencyCol]) {
                         const potentialCurrency = record[accountCurrencyCol]!.trim().toUpperCase();
                         if (supportedCurrencies.includes(potentialCurrency)) {
                             rowCurrency = potentialCurrency;
                         }
                     }
                     details.currency = rowCurrency;

                    // Extract opening balance amount from the 'amount' column
                    const amountValue = amountCol ? record[amountCol] : undefined;
                    if (amountValue !== undefined && amountValue !== '') {
                        const balance = parseAmount(amountValue);
                        if (!isNaN(balance)) {
                            details.initialBalance = balance; // Set initialBalance from 'amount'
                             console.log(`Row ${index + 2}: Prioritized 'opening balance' type for account "${name}". Set initial balance to: ${balance}`);
                        } else {
                             console.warn(`Row ${index + 2}: Could not parse amount "${amountValue}" for 'Opening Balance' type for account "${name}".`);
                        }
                    } else {
                         console.warn(`Row ${index + 2}: 'Opening Balance' type found for account "${name}", but 'Amount' column is missing or empty.`);
                    }

                    accountUpdates.set(normalizedName, details);
                } else {
                     console.warn(`Row ${index + 2}: 'Opening Balance' type found, but could not determine account name.`);
                }
            }
        });


        // Second pass for other rows, adding details but NOT overwriting initialBalance if set by 'opening balance'
        csvData.forEach((record, index) => {
             const typeValue = typeCol ? record[typeCol]?.trim().toLowerCase() : undefined;
             // Skip 'opening balance' rows as they were handled first
             if (typeValue === 'opening balance') return;

            // Consider account, source_account, destination_account
             const potentialAccountNames = [
                 accountNameCol ? record[accountNameCol]?.trim() : undefined,
                 sourceAccountCol ? record[sourceAccountCol]?.trim() : undefined,
                 destAccountCol ? record[destAccountCol]?.trim() : undefined
             ].filter(Boolean) as string[];

             potentialAccountNames.forEach(name => {
                 if (name) {
                     const normalizedName = name.toLowerCase();
                     let details = accountUpdates.get(normalizedName);

                     // Initialize if not seen before (even in opening balance pass)
                     if (!details) {
                         const existingAcc = existingAccounts.find(acc => acc.name.toLowerCase() === normalizedName);
                         const initialCategory = existingAcc?.category || ((normalizedName.includes('crypto') || normalizedName.includes('wallet') || normalizedName.includes('binance') || normalizedName.includes('coinbase') || normalizedName.includes('kraken') || normalizedName.includes('ledger') || normalizedName.includes('metamask')) ? 'crypto' : 'asset');
                          details = {
                              name: name,
                              currency: existingAcc?.currency || 'BRL',
                              type: existingAcc?.type,
                              initialBalance: existingAcc?.balance, // Default to existing balance
                              category: initialCategory
                          };
                          // Infer type if needed
                          if (!details.type) {
                             if (details.category === 'crypto') details.type = 'wallet'; // Default
                             else details.type = 'checking'; // Default
                          }
                         accountUpdates.set(normalizedName, details); // Add to map if new
                     }

                     // Update currency if specified in this row and better than current
                     let finalCurrency = details.currency;
                      if (accountCurrencyCol && record[accountCurrencyCol]) {
                          const potentialCurrency = record[accountCurrencyCol]!.trim().toUpperCase();
                          if (supportedCurrencies.includes(potentialCurrency)) {
                              finalCurrency = potentialCurrency;
                          }
                      }
                      details.currency = finalCurrency;

                     // Check for direct 'initialBalance' column ONLY if initialBalance hasn't been set by 'opening balance' type yet
                     if (details.initialBalance === undefined && initialBalanceCol && record[initialBalanceCol] !== undefined && record[initialBalanceCol] !== '') {
                         const balance = parseAmount(record[initialBalanceCol]);
                         if (!isNaN(balance)) {
                             details.initialBalance = balance;
                             console.log(`Row ${index + 2}: Set initial balance for account "${name}" from '${initialBalanceCol}' column: ${balance}`);
                         } else {
                             console.warn(`Row ${index + 2}: Could not parse initial balance "${record[initialBalanceCol]}" for account "${name}" from balance column.`);
                         }
                     }
                     // No 'else' needed - we don't overwrite if already set by 'opening balance'

                      accountUpdates.set(normalizedName, details); // Update map with potentially refined details
                 }
             });
        });

         return accountUpdates;
    }

    /**
     * Creates missing accounts or updates existing ones based on CSV data.
     * Returns the final account map (mapping lowercase account name to account ID) and a success status.
     */
    const createOrUpdateAccountsAndGetMap = async (
        csvData: CsvRecord[],
        mappings: ColumnMapping, // Pass all mappings
        existingAccounts: Account[], // Pass current accounts
        isPreviewOnly: boolean = false // Flag to prevent actual creation/update if true
    ): Promise<{ success: boolean; map: { [key: string]: string } }> => {
        let success = true;
        // Initialize the working map with existing accounts
        const workingMap = existingAccounts.reduce((map, acc) => {
             map[acc.name.toLowerCase().trim()] = acc.id;
             return map;
        }, {} as { [key: string]: string });

        // Build the map of required account changes based on the CSV
        const accountUpdates = await buildAccountUpdateMap(csvData, mappings, existingAccounts);

        if (accountUpdates.size === 0 && !isPreviewOnly) {
            console.log("No account updates needed.");
            return { success: true, map: workingMap }; // Return current map
        }

        console.log(`Found ${accountUpdates.size} unique accounts in CSV to potentially create or update...`);
        let accountsProcessedCount = 0;

        // Process account creations/updates
        for (const [normalizedName, accDetails] of accountUpdates.entries()) {
            const existingAccount = existingAccounts.find(acc => acc.name.toLowerCase() === normalizedName);
            try {
                if (isPreviewOnly) {
                    // For preview, just populate the map based on what *would* happen
                    if (existingAccount) {
                        workingMap[normalizedName] = existingAccount.id;
                    } else {
                        // Assign a placeholder ID for preview purposes if it doesn't exist
                        workingMap[normalizedName] = `preview_create_${normalizedName}`;
                    }
                    continue; // Skip actual creation/update in preview mode
                }

                // Actual Creation/Update Logic
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
                    // This balance comes from 'opening balance' rows or 'initialBalance' column
                    if (accDetails.initialBalance !== undefined && accDetails.initialBalance !== existingAccount.balance) {
                        console.log(`Updating balance for existing account "${accDetails.name}" from ${existingAccount.balance} to ${accDetails.initialBalance} based on CSV (Opening Balance/Initial Column).`);
                        updatedAccountData.balance = accDetails.initialBalance; // Update balance from CSV data
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        // Set last activity only if balance actually changed
                        if(updatedAccountData.balance !== existingAccount.balance) {
                           updatedAccountData.lastActivity = new Date().toISOString();
                        }
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
                    console.log(`Attempting to create account "${accDetails.name}" with currency ${accDetails.currency}, type ${accDetails.type}, category ${accDetails.category}, initial balance ${balanceToSet}...`);
                    const newAccountData: NewAccountData = {
                        name: accDetails.name,
                        type: accDetails.type!, // Type should be inferred by now
                        balance: balanceToSet, // Use parsed initial balance or 0
                        currency: accDetails.currency,
                        providerName: 'Imported', // Maybe extract provider if available?
                        category: accDetails.category, // Set category
                        // Set defaults explicitly during creation
                        isActive: true,
                        lastActivity: new Date().toISOString(),
                        balanceDifference: 0,
                    };
                    const createdAccount = await addAccount(newAccountData);
                    workingMap[normalizedName] = createdAccount.id; // Add new account to the map
                    accountsProcessedCount++;
                    console.log(`Successfully created account: ${createdAccount.name} (ID: ${createdAccount.id}) with initial balance ${balanceToSet}`);
                }
            } catch (err: any) {
                console.error(`Failed to process account "${accDetails.name}":`, err);
                toast({ title: "Account Processing Error", description: `Could not process account "${accDetails.name}". Error: ${err.message}`, variant: "destructive", duration: 7000 });
                success = false; // Mark overall process as failed if any account fails
            }
        }


        if (accountsProcessedCount > 0 && !isPreviewOnly) {
            toast({ title: "Accounts Processed", description: `Created or updated ${accountsProcessedCount} accounts based on CSV data.` });
            // Refetch accounts *after* all updates are done to ensure consistency
            try {
                 const latestAccounts = await getAccounts();
                 setAccounts(latestAccounts); // Update state for UI consistency
                 // Rebuild the final map based on the absolute latest data
                 const finalMap = latestAccounts.reduce((map, acc) => {
                     map[acc.name.toLowerCase().trim()] = acc.id;
                     return map;
                 }, {} as { [key: string]: string });
                 console.log("Final account map after creation/updates:", finalMap);
                 return { success, map: finalMap };
            } catch (fetchError) {
                 console.error("Failed to refetch accounts after updates:", fetchError);
                 success = false; // Mark as failure if refetch fails
                 return { success, map: workingMap }; // Return the map as it was before refetch failed
            }

        }

        return { success, map: workingMap }; // Return success status and the final map
    };


   const addMissingCategories = async (transactions: MappedTransaction[]): Promise<boolean> => {
      const currentCategories = await getCategories(); // Get fresh list
      const existingCategoryNames = new Set(currentCategories.map(cat => cat.name.toLowerCase()));
      const categoriesToAdd = new Set<string>();
      let success = true;

      transactions.forEach(tx => {
          // Process only pending transactions with a valid category name that isn't special
          if (tx.importStatus === 'pending' && tx.category && !['Uncategorized', 'Initial Balance', 'Transfer', 'Skipped', 'Opening Balance'].includes(tx.category)) {
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

       // --- Crucial Step: Create/Update Accounts and get FINAL map ---
        console.log("Finalizing account creation/updates before import...");
        let latestAccounts = await getAccounts(); // Fetch current accounts
        const { success: finalAccountMapSuccess, map: finalMap } = await createOrUpdateAccountsAndGetMap(
            rawData, // Pass ALL raw data to ensure all accounts (even those with only opening balances) are processed
            columnMappings, // Pass confirmed mappings
            latestAccounts, // Pass current accounts
            false // Set to false to actually perform creation/update
        );

        if (!finalAccountMapSuccess) {
            setError("Error finalizing account mapping before import. Check console.");
            setIsLoading(false);
            return;
        }
        setFinalAccountMapForImport(finalMap); // Save the final map to state for use in transaction loop
        console.log("Using FINAL account map for import execution:", finalMap);

        // Refresh accounts state in UI *after* creation/update step
        latestAccounts = await getAccounts();
        setAccounts(latestAccounts);
       // -------------------------------------------------------------


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

          // Skip rows that were marked as 'opening balance' during mapping, as their balance contribution
          // was handled during the account creation/update phase.
           if (item.category === 'Opening Balance') { // Check the category set during mapping
               console.log(`Row ${rowNumber}: Skipping transaction import for opening balance (already handled).`);
               updatedData[i] = { ...item, importStatus: 'skipped', errorMessage: 'Opening Balance (handled via account balance)' };
               // Don't increment errorCount here, it's expected to be skipped
               // Only update progress based on rows attempted for import below
               setParsedData([...updatedData]);
               continue;
           }


          try {
               const categoryName = item.category?.trim() || 'Uncategorized';
               // Use the fetched currentCategories list
               const foundCategory = currentCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
               // If category wasn't found after attempting to add, default to Uncategorized
               const finalCategoryName = foundCategory ? foundCategory.name : 'Uncategorized';
               if (categoryName !== 'Uncategorized' && !foundCategory && categoryName !== 'Transfer' && categoryName !== 'Initial Balance') {
                   console.warn(`Row ${rowNumber}: Category "${categoryName}" specified but not found after add attempt. Defaulting to 'Uncategorized'.`);
               }

               // Use the fetched currentTags list
               const finalTags = item.tags?.map(importedTagName => {
                   const trimmedTagName = importedTagName.trim();
                   const foundTag = currentTags.find(t => t.name.toLowerCase() === trimmedTagName.toLowerCase());
                   // If tag wasn't found after adding, keep original (should have been added) - or discard? For now, keep.
                    if (!foundTag && trimmedTagName) console.warn(`Row ${rowNumber}: Tag "${trimmedTagName}" not found after add attempt.`);
                   return foundTag ? foundTag.name : trimmedTagName;
               }).filter(Boolean) || [];


                // --- Handle Transfers ---
                const sourceCol = columnMappings.source_account;
                const destCol = columnMappings.destination_account;
                const sourceName = sourceCol ? item.originalRecord[sourceCol]?.trim() : undefined;
                const destName = destCol ? item.originalRecord[destCol]?.trim() : undefined;

                if (sourceName && destName) { // Explicit transfer based on Firefly columns
                     const sourceNameLower = sourceName.toLowerCase();
                     const destNameLower = destName.toLowerCase();
                     const sourceId = finalMap[sourceNameLower]; // Use the FINAL map
                     const destId = finalMap[destNameLower]; // Use the FINAL map

                     if (!sourceId) throw new Error(`Transfer Import Error - Could not find final source account ID for "${sourceName}". Map: ${JSON.stringify(finalMap)}`);
                     if (!destId) throw new Error(`Transfer Import Error - Could not find final destination account ID for "${destName}". Map: ${JSON.stringify(finalMap)}`);
                     if (sourceId === destId) throw new Error(`Transfer Import Error - Source and destination accounts are the same ("${sourceName}").`);


                     // Amount for transfers should be positive
                     const transferAmount = Math.abs(item.amount);
                     if (isNaN(transferAmount) || transferAmount <= 0) {
                         throw new Error(`Transfer Import Error - Invalid or zero transfer amount (${item.amount}).`);
                     }

                     const transferDate = item.date; // Already parsed yyyy-mm-dd
                     const transferDesc = item.description || `Transfer from ${sourceName} to ${destName}`;
                     const transferTags = finalTags;

                     // Add TWO transactions for a transfer
                     // NOTE: addTransaction handles balance updates internally now.
                     // 1. Add outgoing transaction (negative)
                     await addTransaction({
                         accountId: sourceId,
                         date: transferDate,
                         amount: -transferAmount,
                         description: transferDesc,
                         category: 'Transfer', // Use standard 'Transfer' category
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
                     // Get the account name from the original record based on the mapping
                     const accountNameMapped = columnMappings.account ? item.originalRecord[columnMappings.account]?.trim() : undefined;
                     const sourceNameMapped = columnMappings.source_account ? item.originalRecord[columnMappings.source_account]?.trim() : undefined;
                     const destNameMapped = columnMappings.destination_account ? item.originalRecord[columnMappings.destination_account]?.trim() : undefined;

                     // Determine the correct account name for this transaction row
                     const accountNameForTx = accountNameMapped || sourceNameMapped || destNameMapped;
                     if (!accountNameForTx) {
                         throw new Error(`Row ${rowNumber}: Could not determine account name for transaction.`);
                     }

                     const accountIdForImport = finalMap[accountNameForTx.toLowerCase()]; // Use the FINAL map

                     if (!accountIdForImport) {
                          throw new Error(`Row ${rowNumber}: Could not find final account ID for account name "${accountNameForTx}". Map: ${JSON.stringify(finalMap)}`);
                     }
                     if (accountIdForImport.startsWith('skipped_') || accountIdForImport.startsWith('error_') || accountIdForImport.startsWith('preview_')) {
                         throw new Error(`Invalid account ID reference ('${accountIdForImport}') for import.`);
                     }
                     if (isNaN(item.amount)) {
                          throw new Error(`Invalid amount for import.`);
                     }

                     const transactionPayload: Omit<Transaction, 'id'> = {
                        accountId: accountIdForImport,
                        date: item.date, // Already parsed yyyy-mm-dd
                        amount: item.amount, // Amount should already have the correct sign
                        description: item.description,
                        category: finalCategoryName,
                        tags: finalTags,
                     };
                    // `addTransaction` now handles balance updates internally
                    await addTransaction(transactionPayload);
                    console.log(`Row ${rowNumber}: Successfully imported ${item.amount >= 0 ? 'income' : 'expense'}: ${item.description}, Amount: ${item.amount} into Account ID: ${accountIdForImport}`);
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
           // Use the total count of originally pending records for progress calculation
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
         // Trigger storage event to update other pages
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
            setAccountPreviewData([]); // Clear account preview
            setError(null);
            setRawData([]);
            setFile(null);
            setColumnMappings({});
            setImportProgress(0);
            setFinalAccountMapForImport({}); // Reset the final map

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
             <Alert variant={error.includes("Issues") || error.includes("Error") || error.includes("Failed") || error.includes("Missing") || error.includes("Critical") ? "destructive" : "default"}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{error.includes("Issues") || error.includes("Error") || error.includes("Failed") || error.includes("Missing") || error.includes("Critical") ? "Import Problem" : "Info"}</AlertTitle>
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
            {/* Increase max width for the mapping dialog */}
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Step 2: Map CSV Columns</DialogTitle>
                    <DialogDescription>
                        Match columns from your CSV (right) to application fields (left).
                        Essential fields: Date, Account Name (or Source/Destination), and Amount (either signed or income/expense pair).
                        We've tried to guess based on common headers. Map 'Initial Balance' if available. Map 'Transaction Type' if your CSV has it (helps with accuracy).
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


      {/* Account Preview Section */}
       {accountPreviewData.length > 0 && !isLoading && (
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Step 2.5: Account Changes Preview</CardTitle>
                    <CardDescription>Review the accounts that will be created or updated based on the CSV data and mappings. Initial balances are derived from 'Opening Balance' type rows, 'Initial Balance' columns, or existing data.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-h-[300px] overflow-y-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Account Name</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Currency</TableHead>
                                    <TableHead className="text-right">Initial/Updated Balance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {accountPreviewData.map((acc, index) => (
                                    <TableRow key={index} className={cn(
                                         acc.action === 'create' ? 'bg-green-50 dark:bg-green-900/20' :
                                         acc.action === 'update' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                                    )}>
                                        <TableCell className="font-medium">{acc.name}</TableCell>
                                        <TableCell className="capitalize">{acc.action}</TableCell>
                                        <TableCell>{acc.currency}</TableCell>
                                        <TableCell className="text-right">
                                            {acc.initialBalance !== undefined ? formatCurrency(acc.initialBalance, acc.currency, undefined, false) : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        )}


      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Review &amp; Import ({parsedData.filter(i => i.importStatus === 'pending').length} Pending Rows)</CardTitle>
            <CardDescription>Review the mapped transactions. Rows marked 'Error' or 'Skipped' (like Opening Balances) will not be imported. Adjust mappings if needed by clicking "Parse &amp; Map Columns" again with the same file. Click "Import Transactions" above when ready.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Dynamically show headers based on what's mapped and relevant */}
                    {columnMappings.date && <TableHead>Date</TableHead>}
                    {/* Account Info - show relevant mapped columns */}
                    {columnMappings.account && <TableHead>Account (CSV)</TableHead>}
                    {columnMappings.source_account && <TableHead>Source Acc (CSV)</TableHead>}
                    {columnMappings.destination_account && <TableHead>Dest Acc (CSV)</TableHead>}
                     {columnMappings.transaction_type && <TableHead>Type (CSV)</TableHead>} {/* Show Type if mapped */}
                    {/* Other details */}
                    {columnMappings.description && <TableHead>Description</TableHead>}
                    {columnMappings.category && <TableHead>Category</TableHead>}
                    {columnMappings.tags && <TableHead>Tags</TableHead>}
                    {/* Amount - show relevant mapped columns */}
                    {columnMappings.amount && <TableHead className="text-right">Amount (Parsed)</TableHead>}
                    {columnMappings.amount_income && <TableHead className="text-right">Income Amt (CSV)</TableHead>}
                    {columnMappings.amount_expense && <TableHead className="text-right">Expense Amt (CSV)</TableHead>}
                     <TableHead>Status</TableHead>
                     <TableHead className="min-w-[150px]">Message / Info</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((item, index) => {
                       // Find account using the component's current `accounts` state based on the FINAL map ID if available
                       // Check if accountId is a placeholder like 'preview_create_...' or an actual ID
                       let finalAccountId = item.accountId;
                       if (finalAccountId && !finalAccountId.startsWith('error_') && !finalAccountId.startsWith('skipped_')) {
                            // If it's a preview ID, try to resolve it using the final map based on the name embedded in the preview ID
                            if (finalAccountId.startsWith('preview_create_')) {
                                const accountName = finalAccountId.replace('preview_create_', '');
                                finalAccountId = finalAccountMapForImport[accountName] || finalAccountId; // Use final map if available
                            } else {
                                // If it's potentially an existing account name used as ID during preview, resolve it
                                finalAccountId = finalAccountMapForImport[finalAccountId.toLowerCase()] || finalAccountId;
                            }
                       }

                       const account = accounts.find(acc => acc.id === finalAccountId);

                       // Get the account name from the original record based on mappings for display
                       const accountNameFromRecord =
                           item.originalRecord[columnMappings.account || ''] ||
                           item.originalRecord[columnMappings.source_account || ''] ||
                           item.originalRecord[columnMappings.destination_account || ''] ||
                           (item.accountId && item.accountId.startsWith('preview_create_') ? item.accountId.replace('preview_create_', '') : item.accountId) || // Show name for preview-created accounts
                           'N/A'; // Fallback

                       // Determine currency - prioritize actual account currency if found, else guess from record
                       let displayCurrency = '???';
                       if (account) {
                           displayCurrency = account.currency;
                       } else if (columnMappings.accountCurrency && item.originalRecord[columnMappings.accountCurrency!]) {
                           const potentialCurrency = item.originalRecord[columnMappings.accountCurrency!]!.trim().toUpperCase();
                           if (supportedCurrencies.includes(potentialCurrency)) {
                               displayCurrency = potentialCurrency;
                           }
                       }

                       const currencySymbol = getCurrencySymbol(displayCurrency);


                      return (
                          <TableRow key={index} className={cn(
                              "text-xs", // Smaller text for dense table
                              item.importStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
                              item.importStatus === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                              item.importStatus === 'skipped' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                          )}>
                            {/* Display relevant columns based on mapping */}
                            {columnMappings.date && <TableCell className="whitespace-nowrap">{item.date}</TableCell>}
                            {/* CSV Account Names */}
                            {columnMappings.account && <TableCell className="max-w-[150px] truncate" title={item.originalRecord[columnMappings.account!]}>{item.originalRecord[columnMappings.account!]}</TableCell>}
                            {columnMappings.source_account && <TableCell className="max-w-[150px] truncate" title={item.originalRecord[columnMappings.source_account!]}>{item.originalRecord[columnMappings.source_account!]}</TableCell>}
                            {columnMappings.destination_account && <TableCell className="max-w-[150px] truncate" title={item.originalRecord[columnMappings.destination_account!]}>{item.originalRecord[columnMappings.destination_account!]}</TableCell>}
                            {columnMappings.transaction_type && <TableCell className="capitalize max-w-[100px] truncate" title={item.originalRecord[columnMappings.transaction_type!]}>{item.originalRecord[columnMappings.transaction_type!]}</TableCell>} {/* Show Type */}

                            {/* Parsed Details */}
                            {columnMappings.description && <TableCell className="max-w-[200px] truncate" title={item.description}>{item.description}</TableCell>}
                            {columnMappings.category && <TableCell className="capitalize max-w-[100px] truncate" title={item.category}>{item.category}</TableCell>}
                            {columnMappings.tags && (
                                <TableCell className="max-w-[150px]">
                                    <div className="flex flex-wrap gap-1">
                                        {item.tags?.map(tag => {
                                            const { color: tagColor } = getTagStyle(tag);
                                            return (
                                                <Badge key={tag} variant="outline" className={`text-[10px] px-1 py-0 ${tagColor}`}>
                                                    {tag}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                </TableCell>
                            )}
                            {/* Amount Columns */}
                             {columnMappings.amount && (
                                <TableCell className={cn(
                                    "text-right whitespace-nowrap font-medium",
                                    !isNaN(item.amount) && item.amount >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                                )}>
                                    {/* Use formatCurrency for consistency, pass convertToPreferred=false */}
                                     {item.importStatus !== 'skipped' ? formatCurrency(item.amount, displayCurrency, undefined, false) : 'N/A'}
                                </TableCell>
                            )}
                            {columnMappings.amount_income && <TableCell className="text-right whitespace-nowrap">{item.originalRecord[columnMappings.amount_income!]}</TableCell>}
                            {columnMappings.amount_expense && <TableCell className="text-right whitespace-nowrap">{item.originalRecord[columnMappings.amount_expense!]}</TableCell>}

                            {/* Status and Message */}
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

