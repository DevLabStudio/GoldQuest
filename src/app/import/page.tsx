

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
import { Badge } from "@/components/ui/badge"; 
import { addTransaction, type Transaction, clearAllSessionTransactions, updateTransaction as updateTxService } from '@/services/transactions'; 
import { getAccounts, addAccount, type Account, type NewAccountData, updateAccount } from '@/services/account-sync';
import { getCategories, addCategory, type Category } from '@/services/categories';
import { getTags, addTag, type Tag, getTagStyle } from '@/services/tags'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"; 
import { format } from 'date-fns';
import { getCurrencySymbol, supportedCurrencies, formatCurrency } from '@/lib/currency'; 
import CsvMappingForm, { type ColumnMapping } from '@/components/import/csv-mapping-form';
import { AlertCircle, Trash2 } from 'lucide-react'; 
import { cn } from '@/lib/utils';

type CsvRecord = {
  [key: string]: string | undefined;
};

const APP_FIELDS_VALUES = [
    'date', 'amount', 'amount_income', 'amount_expense', 'description', 'account',
    'source_account', 'destination_account', 'category', 'accountCurrency',
    'tags', 'initialBalance', 'notes', 'transaction_type' 
] as const;
type AppField = typeof APP_FIELDS_VALUES[number];

type MappedTransaction = Omit<Transaction, 'id'> & {
  originalRecord: CsvRecord;
  importStatus: 'pending' | 'success' | 'error' | 'skipped';
  errorMessage?: string;
};

interface AccountPreview {
    name: string;
    currency: string;
    initialBalance?: number; 
    action: 'create' | 'update' | 'no change'; 
    existingId?: string; 
}


const findColumnName = (headers: string[], targetName: string): string | undefined => {
    return headers.find(header => header?.trim().toLowerCase() === targetName.toLowerCase());
};

const parseAmount = (amountStr: string | undefined): number => {
    if (typeof amountStr !== 'string' || amountStr.trim() === '') return NaN; 
    let cleaned = amountStr.replace(/[^\d.,-]/g, '').trim(); 

    const numPeriods = (cleaned.match(/\./g) || []).length;
    const numCommas = (cleaned.match(/,/g) || []).length;

    if (numCommas === 1 && numPeriods > 0 && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (numPeriods === 1 && numCommas > 0 && cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
        cleaned = cleaned.replace(/,/g, '');
    } else if (numCommas === 1 && numPeriods === 0) {
         cleaned = cleaned.replace(',', '.');
    } else if (numPeriods === 1 && numCommas === 0) {
    } else if (numPeriods > 1) {
         cleaned = cleaned.replace(/,/g, ''); // Assuming . as thousands separator
    } else if (numCommas > 1) {
          const lastChar = cleaned[cleaned.length - 1];
          const secondLastChar = cleaned[cleaned.length - 2];
          if (lastChar === ',' && !isNaN(parseInt(secondLastChar))) {
              // Handle cases like "1.234,56" - typical European
              const lastCommaIndex = cleaned.lastIndexOf(',');
              cleaned = cleaned.substring(0, lastCommaIndex).replace(/,/g, '') + '.' + cleaned.substring(lastCommaIndex + 1);
          } else {
               cleaned = cleaned.replace(/,/g, ''); // Assuming , as thousands separator
          }
    }
    // If it ends with a decimal separator, append a zero
    if (cleaned.endsWith('.') || cleaned.endsWith(',')) {
        cleaned += '0';
    }

    // Remove any leading/trailing decimal separators after processing
    cleaned = cleaned.replace(/^[,.]+|[,.]+$/g, '');


    const parsed = parseFloat(cleaned);
    return parsed; // NaN if parsing fails
};


const parseDate = (dateStr: string | undefined): string => {
    if (!dateStr) return format(new Date(), 'yyyy-MM-dd');
    try {
        let parsedDate: Date | null = null;

         // Try ISO format first (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)
         if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            // Ensure UTC interpretation if no time/timezone is specified
            parsedDate = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00Z');
         }

        // If ISO parsing fails or wasn't the format, try common variations
        if (!parsedDate || isNaN(parsedDate.getTime())) {
             // Common formats: DD/MM/YYYY, MM/DD/YYYY, DD.MM.YYYY, MM.DD.YYYY, DD-MM-YYYY, MM-DD-YYYY
             const parts = dateStr.split(/[\/\-\.]/);
             if (parts.length === 3) {
                 const [p1_str, p2_str, p3_str] = parts;
                 let p1 = parseInt(p1_str, 10);
                 let p2 = parseInt(p2_str, 10);
                 let year_part = parseInt(p3_str, 10);

                 // Handle two-digit year (e.g., 23 for 2023)
                 let year = year_part;
                 if (year < 100) {
                     year = year > 50 ? 1900 + year : 2000 + year; // Adjust pivot year as needed
                 }

                 // Try DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
                  if (p1 > 0 && p1 <= 31 && p2 > 0 && p2 <= 12 && year >= 1900 && year < 2100) { // p1 is day, p2 is month
                      const dateAttempt = new Date(Date.UTC(year, p2 - 1, p1)); // Month is 0-indexed
                      if (!isNaN(dateAttempt.getTime())) parsedDate = dateAttempt;
                  }
                 // Try MM/DD/YYYY or MM.DD.YYYY or MM-DD-YYYY
                 if ((!parsedDate || isNaN(parsedDate.getTime())) && p1 > 0 && p1 <= 12 && p2 > 0 && p2 <= 31 && year >= 1900 && year < 2100) { // p1 is month, p2 is day
                      const dateAttempt = new Date(Date.UTC(year, p1 - 1, p2)); // Month is 0-indexed
                      if (!isNaN(dateAttempt.getTime())) parsedDate = dateAttempt;
                 }
             }
        }

        // Add more robust parsing logic if needed (e.g., using date-fns parse if formats are known)

         if (parsedDate && !isNaN(parsedDate.getTime())) {
            return format(parsedDate, 'yyyy-MM-dd'); // Standardize to YYYY-MM-DD
         }

    } catch (e) {
        console.error("Error parsing date:", dateStr, e);
    }
    console.warn(`Could not parse date "${dateStr}", defaulting to today.`);
    return format(new Date(), 'yyyy-MM-dd'); // Fallback
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
  const [tags, setTags] = useState<Tag[]>([]); 
  const [accountPreviewData, setAccountPreviewData] = useState<AccountPreview[]>([]); 
  const [finalAccountMapForImport, setFinalAccountMapForImport] = useState<{ [key: string]: string }>({});
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping>({});
  const [isClearing, setIsClearing] = useState(false); 
  const { toast } = useToast();


  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
        if (typeof window === 'undefined') {
            if (isMounted) setIsLoading(false);
            return;
        }
        if (isMounted) setIsLoading(true);
        if (isMounted) setError(null);
        try {
            const [fetchedAccounts, fetchedCategories, fetchedTags] = await Promise.all([
                getAccounts(),
                getCategories(),
                getTags()
            ]);

            if (isMounted) {
                setAccounts(fetchedAccounts);
                setCategories(fetchedCategories);
                setTags(fetchedTags);
            }
            console.log("Initial data fetched for import:", { numAccounts: fetchedAccounts.length, numCategories: fetchedCategories.length, numTags: fetchedTags.length });

        } catch (err) {
            console.error("Failed to fetch initial data for import:", err);
            if (isMounted) {
                setError("Could not load accounts, categories, or tags.");
                toast({ title: "Initialization Error", description: "Failed to load data.", variant: "destructive" });
            }
        } finally {
            if (isMounted) setIsLoading(false);
        }
    };

    fetchData();

    const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && (event.key === 'userAccounts' || event.key === 'userPreferences' || event.key === 'userCategories' || event.key === 'userTags')) {
            if (isMounted) {
                console.log("Storage changed, refetching initial data for import...");
                fetchData();
            }
        }
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorageChange);
    }

    return () => {
        isMounted = false;
        if (typeof window !== 'undefined') {
            window.removeEventListener('storage', handleStorageChange);
        }
    };
  }, [toast]); 

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setError(null);
      setParsedData([]);
      setAccountPreviewData([]); 
      setRawData([]);
      setCsvHeaders([]);
      setImportProgress(0);
      setColumnMappings({}); // Reset mappings
      setFinalAccountMapForImport({}); 
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
    setAccountPreviewData([]); 
    setRawData([]);
    setCsvHeaders([]);

    Papa.parse<CsvRecord>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<CsvRecord>) => {
         if (results.errors.length > 0 && !results.data.length) { // Critical error if no data and errors exist
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

         setCsvHeaders(headers.filter(h => h != null) as string[]); // Filter out null/undefined headers
         setRawData(results.data);

         // Attempt to auto-detect common Firefly III / general column names
         const detectedHeaders = headers.filter(h => h != null) as string[];
         const initialMappings: ColumnMapping = {};
         // Firefly specific with fallbacks
         initialMappings.date = findColumnName(detectedHeaders, 'Date') || findColumnName(detectedHeaders, 'date');
         initialMappings.amount = findColumnName(detectedHeaders, 'Amount') || findColumnName(detectedHeaders, 'amount');
         initialMappings.amount_income = findColumnName(detectedHeaders, 'Amount income');
         initialMappings.amount_expense = findColumnName(detectedHeaders, 'Amount expense');
         initialMappings.description = findColumnName(detectedHeaders, 'Description') || findColumnName(detectedHeaders, 'description');
         initialMappings.account = findColumnName(detectedHeaders, 'Asset account (name)') || findColumnName(detectedHeaders, 'Account') || findColumnName(detectedHeaders, 'account'); // Primary account
         initialMappings.source_account = findColumnName(detectedHeaders, 'Source account (name)');
         initialMappings.destination_account = findColumnName(detectedHeaders, 'Destination account (name)');
         initialMappings.category = findColumnName(detectedHeaders, 'Category') || findColumnName(detectedHeaders, 'category');
         initialMappings.accountCurrency = findColumnName(detectedHeaders, 'Currency code') || findColumnName(detectedHeaders, 'currency') || findColumnName(detectedHeaders, 'Amount currency') || findColumnName(detectedHeaders, 'Source currency') || findColumnName(detectedHeaders, 'Destination currency');
         initialMappings.tags = findColumnName(detectedHeaders, 'Tags') || findColumnName(detectedHeaders, 'tags');
         initialMappings.initialBalance = findColumnName(detectedHeaders, 'Initial balance') || findColumnName(detectedHeaders, 'Starting balance') || findColumnName(detectedHeaders, 'Account balance'); // For account creation
         initialMappings.notes = findColumnName(detectedHeaders, 'Notes') || findColumnName(detectedHeaders, 'Memo'); // Firefly often uses "Notes"
         initialMappings.transaction_type = findColumnName(detectedHeaders, 'Type') || findColumnName(detectedHeaders, 'Transaction type'); // Firefly 'Type' can be 'withdrawal', 'deposit', 'transfer', 'opening balance'

         // Logic if 'Amount' isn't present but income/expense are
         if (!initialMappings.amount && initialMappings.amount_income && initialMappings.amount_expense) {
             console.log("No 'Amount' column found, using 'Amount income' and 'Amount expense'.");
         } else if (!initialMappings.amount && !initialMappings.amount_income && !initialMappings.amount_expense) {
            // Try to find specific currency amount columns like "Amount in BRL"
            const specificAmountCol = detectedHeaders.find(h => h.toLowerCase().startsWith('amount in '));
            if(specificAmountCol) {
                console.log(`Using specific amount column: ${specificAmountCol}`);
                initialMappings.amount = specificAmountCol; // Map it as the primary amount
                // Try to infer currency from this column if not already mapped
                if (!initialMappings.accountCurrency) {
                    const currencyMatch = specificAmountCol.match(/Amount in (\w+)/i);
                    if (currencyMatch && currencyMatch[1]) {
                        const inferredCurrency = currencyMatch[1].toUpperCase();
                        if (supportedCurrencies.includes(inferredCurrency)) {
                             console.log(`Inferred currency ${inferredCurrency} from amount column header.`);
                            // initialMappings.accountCurrency = inferredCurrency; // Optionally pre-fill
                        }
                    }
                }
            } else {
                 console.warn("Could not automatically map an amount column ('Amount', 'Amount income'/'Amount expense', or 'Amount in XXX'). Please map manually.");
            }
         }


         setColumnMappings(initialMappings);

         setIsMappingDialogOpen(true); // Open mapping dialog
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
        setAccountPreviewData([]); 
        setColumnMappings(confirmedMappings); // Store the confirmed mappings
        setFinalAccountMapForImport({}); // Reset final map

        // Basic validation for required mappings
        const hasSignedAmount = !!confirmedMappings.amount;
        const hasIncomeExpense = !!confirmedMappings.amount_income && !!confirmedMappings.amount_expense;
        const amountRequirementMet = hasSignedAmount || hasIncomeExpense;

        const requiredBaseFields: AppField[] = ['date']; // Only 'date' is absolutely essential at this stage for structure
        const missingBaseMappings = requiredBaseFields.filter(field => !confirmedMappings[field]);
        let missingFieldLabels = missingBaseMappings.map(f => APP_FIELDS_VALUES.find(val => val === f) || f); // Get human-readable label

        if (!amountRequirementMet) {
            missingFieldLabels.push("Amount (Signed +/-) *OR* both Income Amount + Expense Amount");
        }

        // Account requirement: either a primary account OR source+destination for transfers
        const hasPrimaryAccount = !!confirmedMappings.account;
        const hasTransferAccounts = !!confirmedMappings.source_account && !!confirmedMappings.destination_account;
        if (!hasPrimaryAccount && !hasTransferAccounts) {
            missingFieldLabels.push("Account Name *OR* both Source Account + Destination Account");
        }


        if (missingFieldLabels.length > 0) {
            setError(`Missing required column mappings: ${missingFieldLabels.join(', ')}. Please map these fields.`);
            setIsLoading(false);
            setIsMappingDialogOpen(true); // Re-open dialog if critical mappings are missing
            return;
        }

        const dateCol = confirmedMappings.date!; // We checked this
        const amountCol = confirmedMappings.amount; // May be undefined
        const incomeCol = confirmedMappings.amount_income; // May be undefined
        const expenseCol = confirmedMappings.amount_expense; // May be undefined
        const descCol = confirmedMappings.description;
        const accountCol = confirmedMappings.account; // Primary account for std transactions
        const sourceAccountCol = confirmedMappings.source_account; // For transfers
        const destAccountCol = confirmedMappings.destination_account; // For transfers
        const catCol = confirmedMappings.category;
        const accountCurrencyCol = confirmedMappings.accountCurrency;
        const tagsCol = confirmedMappings.tags;
        const initialBalanceCol = confirmedMappings.initialBalance;
        const notesCol = confirmedMappings.notes;
        const typeCol = confirmedMappings.transaction_type; // Firefly 'Type' column

        // Determine the column that is most likely to contain the primary account name for processing
        const primaryAccountNameSourceCol = accountCol || sourceAccountCol || destAccountCol;
        if (!primaryAccountNameSourceCol) {
             // This case should be caught by the earlier check, but as a safeguard:
             setError("Could not determine a primary column for account names. Please map 'Account Name', 'Source Account', or 'Destination Account'.");
             setIsLoading(false);
             setIsMappingDialogOpen(true);
             return;
        }


         // Generate account preview first
         const { preview } = await previewAccountChanges(
             rawData,
             confirmedMappings, // Pass all mappings
             accounts // Pass current accounts
         );
         setAccountPreviewData(preview);
         console.log("Account preview generated:", preview);


        // Generate temporary account map for linking transactions (before actual creation/update)
        const { map: tempAccountMap } = await createOrUpdateAccountsAndGetMap(
             rawData,
             confirmedMappings, // Pass all mappings
             accounts, // Pass current accounts
             true // isPreviewOnly = true, so no actual DB changes
        );
        console.log("Generated temporary account map for transaction linking:", tempAccountMap);


        const mapped: MappedTransaction[] = rawData.map((record, index) => {
          try {
              const rowNumber = index + 2; // For user-friendly error messages (1-based + header)

              const dateValue = record[dateCol];
              const descriptionValue = descCol ? record[descCol] : undefined;
              const categoryValue = catCol ? record[catCol] : undefined;
              const accountNameValue = accountCol ? record[accountCol] : undefined; // From 'Asset account (name)' or 'Account'
              const sourceAccountNameValue = sourceAccountCol ? record[sourceAccountCol] : undefined;
              const destAccountNameValue = destAccountCol ? record[destAccountCol] : undefined;
              const tagsValue = tagsCol ? record[tagsCol] : undefined;
              const notesValue = notesCol ? record[notesCol] : undefined;
              const typeValue = typeCol ? record[typeCol]?.trim().toLowerCase() : undefined; // e.g., 'withdrawal', 'deposit', 'transfer', 'opening balance'
              const descriptionLower = descriptionValue?.toLowerCase();


              let parsedAmount: number = NaN; // Initialize to NaN
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
                       parsedAmount = income; // Positive amount
                       console.log(`Row ${rowNumber}: Parsed amount from income column ('${incomeCol}')='${incomeAmountValue}' as ${parsedAmount}`);
                   } else if (!isNaN(expense) && expense > 0 && (isNaN(income) || income === 0)) {
                       parsedAmount = -expense; // Negative amount for expense
                       console.log(`Row ${rowNumber}: Parsed amount from expense column ('${expenseCol}')='${expenseAmountValue}' as ${parsedAmount}`);
                   } else if (!isNaN(income) && income === 0 && !isNaN(expense) && expense === 0) {
                       parsedAmount = 0; // Both zero, so zero amount
                       console.log(`Row ${rowNumber}: Parsed amount as 0 from income/expense columns.`);
                   } else if (!isNaN(income) && income > 0 && !isNaN(expense) && expense > 0) {
                       // This case is ambiguous if 'type' column isn't used to clarify if it's a transfer.
                       // Firefly 'transfer' type should handle this. If not a transfer, it's an error.
                       console.warn(`Row ${rowNumber}: Both income (${income}) and expense (${expense}) have values. Transfer logic will attempt to resolve.`);
                       parsedAmount = NaN; // Let transfer logic or type column determine
                   } else {
                       throw new Error(`Could not determine amount from Income ('${incomeAmountValue}') and Expense ('${expenseAmountValue}') columns.`);
                   }
              }

              // If amount is still NaN, check for specific opening balance scenarios
              if (isNaN(parsedAmount)) {
                   // Firefly specific: 'opening balance' type with amount in 'Amount' column
                   const initialBalanceMatch = descriptionLower?.match(/^saldo inicial para:\s*(.+)$/); // Regex for "Saldo inicial para: Account Name"
                    if (initialBalanceMatch) {
                        // For "Saldo inicial para:", the amount is usually in the main 'Amount' column
                        if (amountCol && signedAmountValue !== undefined && signedAmountValue.trim() !== '') {
                            parsedAmount = parseAmount(signedAmountValue);
                            if (isNaN(parsedAmount)) {
                                console.error(`Row ${rowNumber}: Could not parse amount for 'Saldo inicial para:'. Signed='${signedAmountValue}'.`);
                                throw new Error(`Could not parse amount for 'Saldo inicial para:'.`);
                            } else {
                                console.log(`Row ${rowNumber}: Used amount column for 'Saldo inicial para:': ${parsedAmount}`);
                            }
                        } else {
                            console.error(`Row ${rowNumber}: 'Saldo inicial para:' detected, but amount column ('${amountCol}') is missing or empty. Signed='${signedAmountValue}'.`);
                            throw new Error(`'Saldo inicial para:' detected, but amount column is missing or empty.`);
                        }
                    } else if (typeValue === 'opening balance') { // Check 'Type' column for "opening balance"
                      if (amountCol && signedAmountValue !== undefined && signedAmountValue.trim() !== '') {
                           parsedAmount = parseAmount(signedAmountValue);
                           if (isNaN(parsedAmount)) {
                               console.error(`Row ${rowNumber}: Could not parse amount for 'opening balance'. Signed='${signedAmountValue}'.`);
                               throw new Error(`Could not parse amount for 'opening balance'.`);
                           } else {
                               console.log(`Row ${rowNumber}: Used amount column for 'opening balance': ${parsedAmount}`);
                           }
                       } else {
                           console.error(`Row ${rowNumber}: 'opening balance' type found, but amount column ('${amountCol}') is missing or empty.`);
                           throw new Error(`'opening balance' type found, but amount column is missing or empty.`);
                       }
                    } else {
                       // If still NaN, then it's a genuine parsing error or missing amount data
                       console.error(`Row ${rowNumber}: Amount could not be determined. Signed='${signedAmountValue}', Income='${incomeAmountValue}', Expense='${expenseAmountValue}'.`);
                       throw new Error(`Could not determine a valid amount.`);
                    }
              }


              if (!dateValue) throw new Error(`Row ${rowNumber}: Missing mapped 'Date' data.`);

              let description = descriptionValue?.trim() || 'Imported Transaction';
              let category = categoryValue?.trim() || 'Uncategorized';
              const parsedTags = tagsValue?.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) || [];
               if (notesValue) { // Append notes to description if present
                   description += ` (Notes: ${notesValue.trim()})`; // Or handle notes separately
               }

              // Determine transaction type and account ID
              let transactionTypeInternal: 'income' | 'expense' | 'transfer' | 'skip' = 'skip';
              let primaryAccountId: string | undefined = undefined; // Account ID for the transaction
              let isTransfer = false;
              let isOpeningBalance = false;

              // Scenario 1: Firefly "opening balance" type
               const initialBalanceDescMatch = descriptionLower?.match(/^saldo inicial para:\s*(.+)$/);
               if (initialBalanceDescMatch) {
                   // Account name might be in description for "Saldo inicial para:"
                   const accountNameFromDesc = initialBalanceDescMatch[1].trim();
                   const accountNameLower = accountNameFromDesc.toLowerCase();
                   primaryAccountId = tempAccountMap[accountNameLower]; // Use temp map
                    if (!primaryAccountId) {
                       // If not found, it means it's a new account that will be created.
                       // The temp map should have a placeholder like `preview_create_accountname`
                       console.warn(`Row ${rowNumber}: Initial balance for account "${accountNameFromDesc}" found in description, but account not in temp map. Using placeholder.`);
                       primaryAccountId = `preview_create_${accountNameLower}`;
                       tempAccountMap[accountNameLower] = primaryAccountId; // Ensure it's in temp map for consistency
                   }
                   if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Invalid amount for 'Saldo inicial para'.`);
                   isOpeningBalance = true;
                   transactionTypeInternal = 'skip'; // Skip transaction creation, balance handled by account creation/update
                   description = descriptionValue || `Saldo inicial para: ${accountNameFromDesc}`; // Keep original or construct
                   category = 'Opening Balance'; // Assign specific category
                   console.log(`Row ${rowNumber}: Identified 'Saldo inicial para:' for account ${accountNameFromDesc}. Amount: ${parsedAmount}. This will set initial account balance.`);
               } else if (typeValue === 'opening balance') {
                    // Account name should be in 'Asset account (name)' or equivalent mapped to 'account'
                    const accountNameForOpening = accountCol ? record[accountCol]?.trim() : undefined;
                     if (accountNameForOpening) {
                         const accountNameLower = accountNameForOpening.toLowerCase();
                         primaryAccountId = tempAccountMap[accountNameLower]; // Use temp map
                         if (!primaryAccountId) throw new Error(`Row ${rowNumber}: Opening balance type detected, but Account '${accountNameForOpening}' not found in temp map.`);
                         if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Invalid amount for 'opening balance'.`);
                         isOpeningBalance = true;
                         transactionTypeInternal = 'skip'; // Skip transaction creation
                         description = descriptionValue || `Opening Balance for ${accountNameForOpening}`;
                         category = 'Opening Balance';
                         console.log(`Row ${rowNumber}: Identified 'opening balance' type for account ${accountNameForOpening}. Amount: ${parsedAmount}. This will set initial account balance.`);
                    } else {
                         throw new Error(`Row ${rowNumber}: 'opening balance' type detected, but 'Account Name' column is not mapped or empty.`);
                    }
               // Scenario 2: Transfer (using source and destination account names)
               } else if (sourceAccountNameValue && destAccountNameValue) {
                   isTransfer = true;
                   const sourceNameLower = sourceAccountNameValue.trim().toLowerCase();
                   const destNameLower = destAccountNameValue.trim().toLowerCase();
                   const sourceId = tempAccountMap[sourceNameLower]; // From temp map
                   const destId = tempAccountMap[destNameLower]; // From temp map

                   if (!sourceId) throw new Error(`Row ${rowNumber}: Transfer detected, but Source account ('${sourceAccountNameValue}') not found in temp map.`);
                   if (!destId) throw new Error(`Row ${rowNumber}: Transfer detected, but Destination account ('${destAccountNameValue}') not found in temp map.`);
                   if (sourceId === destId) throw new Error(`Row ${rowNumber}: Transfer source and destination accounts are the same ('${sourceAccountNameValue}').`);

                   // For transfers, amount is usually positive. We'll create two transactions later.
                   // If parsedAmount was NaN due to both income/expense cols, try to resolve it here.
                   if (isNaN(parsedAmount) && !isNaN(parseAmount(incomeAmountValue)) && !isNaN(parseAmount(expenseAmountValue))) {
                       // This case implies Firefly might use separate income/expense for transfers in some exports
                       parsedAmount = Math.abs(parseAmount(incomeAmountValue) || parseAmount(expenseAmountValue) || 0); // Take the positive value
                       if (parsedAmount === 0) throw new Error(`Row ${rowNumber}: Transfer amount resolved to zero from income/expense columns.`);
                       console.log(`Row ${rowNumber}: Resolved transfer amount to ${parsedAmount} from income/expense.`);
                   } else if (isNaN(parsedAmount)) {
                       // If still NaN, try the signed amount column one last time, taking absolute value
                       const signedAmount = parseAmount(signedAmountValue);
                       if (!isNaN(signedAmount)) {
                           parsedAmount = Math.abs(signedAmount);
                           console.log(`Row ${rowNumber}: Using absolute signed amount ${parsedAmount} for transfer.`);
                       } else {
                          throw new Error(`Row ${rowNumber}: Could not determine transfer amount.`);
                       }
                   } else {
                       parsedAmount = Math.abs(parsedAmount); // Ensure positive for transfer representation
                   }

                   // Setting primaryAccountId is not strictly necessary here as handleImport will use sourceId and destId.
                   // However, ensure it has a value if used elsewhere for this item.
                   primaryAccountId = sourceId; // Conventionally, the "from" account.
                   transactionTypeInternal = 'transfer';
                   category = 'Transfer'; // Standard category for transfers
                   description = description || `Transfer from ${sourceAccountNameValue} to ${destAccountNameValue}`;

               // Scenario 3: Regular expense/income (using primary account name)
               } else if (accountNameValue) {
                   const accountNameLower = accountNameValue.trim().toLowerCase();
                   primaryAccountId = tempAccountMap[accountNameLower]; // From temp map
                   if (!primaryAccountId) throw new Error(`Row ${rowNumber}: Account '${accountNameValue}' not found in temp map.`);

                   if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Invalid or missing amount value ('${signedAmountValue || incomeAmountValue || expenseAmountValue || 'N/A'}').`);

                   // Determine income/expense from Firefly 'Type' column if available, otherwise from amount sign
                   if (typeValue === 'deposit' || typeValue === 'transfer') { // Firefly 'transfer' type sometimes means incoming if dest is this account
                       parsedAmount = Math.abs(parsedAmount); // Ensure positive for income
                       transactionTypeInternal = 'income';
                       if (typeValue === 'transfer') category = 'Transfer'; // Override category if 'transfer' type
                   } else if (typeValue === 'withdrawal') {
                       parsedAmount = -Math.abs(parsedAmount); // Ensure negative for expense
                       transactionTypeInternal = 'expense';
                   } else {
                       // Default: determine by amount sign
                       transactionTypeInternal = parsedAmount >= 0 ? 'income' : 'expense';
                   }

               // Scenario 4: Fallback if only one of source/dest is present (should be rare with good mapping)
               } else {
                   // This might occur if 'Account' column wasn't mapped but 'Source Account' or 'Destination Account' was,
                   // and it's not a clear transfer (other leg is missing). Treat as standard tx.
                   const singleAccountName = (sourceAccountNameValue || destAccountNameValue)?.trim();
                   if (singleAccountName) {
                      const accountNameLower = singleAccountName.toLowerCase();
                      primaryAccountId = tempAccountMap[accountNameLower];
                      if (!primaryAccountId) throw new Error(`Row ${rowNumber}: Account '${singleAccountName}' from source/destination column not found in temp map.`);

                      if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Invalid or missing amount value.`);

                      // Infer type from amount sign as 'Type' column might not be relevant here
                      transactionTypeInternal = parsedAmount >= 0 ? 'income' : 'expense';

                   } else {
                      // If no account information can be derived at all
                      throw new Error(`Row ${rowNumber}: Missing required account information.`);
                   }
               }


               // Final check for amount if not skipped
               if (transactionTypeInternal !== 'skip' && isNaN(parsedAmount)) {
                    throw new Error(`Row ${rowNumber}: Failed to determine a valid transaction amount.`);
               }


               if (transactionTypeInternal === 'skip') {
                    return {
                        accountId: primaryAccountId || 'skipped', // It should have an account ID if opening balance
                        date: parseDate(dateValue),
                        amount: parsedAmount || 0, // Store the balance amount
                        description: description,
                        category: category, // e.g., "Opening Balance"
                        tags: parsedTags,
                        originalRecord: record,
                        importStatus: 'skipped',
                        errorMessage: isOpeningBalance ? 'Opening Balance (sets initial account value)' : 'Skipped (e.g., non-opening initial balance).',
                    };
               } else {
                   return {
                       accountId: primaryAccountId!, // Should be defined by now
                       date: parseDate(dateValue),
                       amount: parsedAmount, // Amount sign should be correct now
                       description: description,
                       category: category,
                       tags: parsedTags,
                       originalRecord: record,
                       importStatus: 'pending', // Ready for import
                   };
               }

            } catch (rowError: any) {
                console.error(`Error processing row ${index + 2} with mappings:`, confirmedMappings, `and record:`, record, `Error:`, rowError);
                 return {
                    accountId: `error_row_${index}`,
                    date: parseDate(record[dateCol]), // Try to parse date even on error
                    amount: 0, // Default amount on error
                    description: `Error Processing Row ${index + 2}`,
                    category: 'Uncategorized',
                    tags: [],
                    originalRecord: record,
                    importStatus: 'error',
                    errorMessage: rowError.message || 'Failed to process row.',
                 };
            }
        });

        // Handle errors and skipped rows display
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
            setError(null); // Clear previous errors if all good now
        }

        setParsedData(mapped);
        setIsLoading(false);
        setIsMappingDialogOpen(false); // Close mapping dialog
        toast({ title: "Mapping Applied", description: `Previewing ${mapped.filter(m => m.importStatus === 'pending').length} transactions and account changes. Review before importing.` });
   }


    // Preview account changes based on CSV and mappings
    const previewAccountChanges = async (
        csvData: CsvRecord[],
        mappings: ColumnMapping, // Pass all mappings
        existingAccountsParam: Account[] // Pass current accounts to compare against
    ): Promise<{ preview: AccountPreview[] }> => {
        const preview: AccountPreview[] = [];
        const processedAccountNames = new Set<string>(); // To avoid duplicate previews for existing accounts

        const accountUpdates = await buildAccountUpdateMap(csvData, mappings, existingAccountsParam); // Re-use the map builder

        // Iterate through the accounts identified in the CSV
        accountUpdates.forEach((accDetails, normalizedName) => {
            const existingAccount = existingAccountsParam.find(acc => acc.name.toLowerCase() === normalizedName);
            let action: AccountPreview['action'] = 'no change';
            let initialBalance: number | undefined = undefined;

            if (existingAccount) {
                // Account exists, check if it needs update
                let needsUpdate = false;
                if (accDetails.currency !== existingAccount.currency) needsUpdate = true;
                if (accDetails.type && accDetails.type !== existingAccount.type) needsUpdate = true;
                // Use the initialBalance from accDetails if it's specifically for an "opening balance" type row,
                // otherwise, it might be a general balance column that shouldn't overwrite.
                if (accDetails.initialBalance !== undefined && accDetails.initialBalance !== existingAccount.balance) {
                    needsUpdate = true;
                    initialBalance = accDetails.initialBalance; // This is the balance from CSV (e.g., opening balance row)
                } else {
                    initialBalance = existingAccount.balance; // Keep existing balance if no opening balance instruction
                }

                if (needsUpdate) {
                    action = 'update';
                }
                 preview.push({
                    name: accDetails.name, // Use original casing for display
                    currency: accDetails.currency,
                    initialBalance: initialBalance,
                    action: action,
                    existingId: existingAccount.id
                });
            } else {
                // Account does not exist, will be created
                initialBalance = accDetails.initialBalance ?? 0; // Default to 0 if not provided
                preview.push({
                    name: accDetails.name,
                    currency: accDetails.currency,
                    initialBalance: initialBalance,
                    action: 'create',
                });
            }
             processedAccountNames.add(normalizedName);
        });

        // Add existing accounts not found in CSV to the preview as "no change"
        existingAccountsParam.forEach(acc => {
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


    // Builds a map of account details from CSV, considering opening balances
    const buildAccountUpdateMap = async (
        csvData: CsvRecord[],
        mappings: ColumnMapping, // Pass all mappings
        existingAccountsParam: Account[] // Current accounts
    ): Promise<Map<string, { name: string; currency: string; type?: string; initialBalance?: number; category: 'asset' | 'crypto' }>> => {
        const accountUpdates = new Map<string, { name: string; currency: string; type?: string; initialBalance?: number; category: 'asset' | 'crypto' }>();

        const accountNameCol = mappings.account;
        const sourceAccountCol = mappings.source_account;
        const destAccountCol = mappings.destination_account;
        const accountCurrencyCol = mappings.accountCurrency;
        const initialBalanceCol = mappings.initialBalance; // A general "balance" column
        const typeCol = mappings.transaction_type; // Firefly specific "Type" column
        const amountCol = mappings.amount; // The primary "Amount" column for transactions
        const descCol = mappings.description; // Description column for "Saldo inicial para:"

        // First pass: Prioritize "opening balance" type rows or "Saldo inicial para:" descriptions for initial balances
        csvData.forEach((record, index) => {
            const typeValue = typeCol ? record[typeCol]?.trim().toLowerCase() : undefined;
            const descValue = descCol ? record[descCol]?.trim() : undefined;
            const descLower = descValue?.toLowerCase();
            const initialBalanceDescMatch = descLower?.match(/^saldo inicial para:\s*(.+)$/);

            let isOpening = false;
            let accountNameForBalance: string | undefined = undefined;

            if (initialBalanceDescMatch) {
                accountNameForBalance = initialBalanceDescMatch[1].trim();
                isOpening = true;
                console.log(`Row ${index + 2}: Found 'Saldo inicial para:' description for account "${accountNameForBalance}".`);
            } else if (typeValue === 'opening balance') {
                // For "opening balance" type, account name must come from the mapped 'Account Name' column
                accountNameForBalance = accountNameCol ? record[accountNameCol]?.trim() : undefined;
                 if (accountNameForBalance) {
                    isOpening = true;
                    console.log(`Row ${index + 2}: Found 'opening balance' type for account "${accountNameForBalance}".`);
                 } else {
                     console.warn(`Row ${index + 2}: 'opening balance' type found, but could not determine account name from the mapped 'Account Name' column.`);
                 }
            }

            if (isOpening && accountNameForBalance) {
                 const normalizedName = accountNameForBalance.toLowerCase();
                 let details = accountUpdates.get(normalizedName);

                 // Initialize details if not already processed (e.g. from another opening balance row for same account, unlikely)
                 if (!details) {
                     const existingAcc = existingAccountsParam.find(acc => acc.name.toLowerCase() === normalizedName);
                     const initialCategory = existingAcc?.category || ((normalizedName.includes('crypto') || normalizedName.includes('wallet') || normalizedName.includes('binance') || normalizedName.includes('coinbase') || normalizedName.includes('kraken') || normalizedName.includes('ledger') || normalizedName.includes('metamask')) ? 'crypto' : 'asset');
                     details = {
                         name: accountNameForBalance, // Store original casing
                         currency: existingAcc?.currency || 'BRL', // Default or from existing
                         type: existingAcc?.type,
                         initialBalance: existingAcc?.balance, // Fallback to existing if no specific opening amount found
                         category: initialCategory
                     };
                     if (!details.type) { // Default type if not existing
                         if (details.category === 'crypto') details.type = 'wallet';
                         else details.type = 'checking';
                     }
                 }

                 // Update currency if specified in this row for the account
                 let rowCurrency = details.currency; // Start with current or default
                 if (accountCurrencyCol && record[accountCurrencyCol]) {
                     const potentialCurrency = record[accountCurrencyCol]!.trim().toUpperCase();
                     if (supportedCurrencies.includes(potentialCurrency)) {
                         rowCurrency = potentialCurrency;
                     }
                 }
                 details.currency = rowCurrency;

                 // The amount for "opening balance" should come from the 'Amount' column
                 const amountValue = amountCol ? record[amountCol] : undefined;
                 if (amountValue !== undefined && amountValue !== '') {
                     const balance = parseAmount(amountValue);
                     if (!isNaN(balance)) {
                         details.initialBalance = balance; // This IS the opening balance
                         console.log(`Row ${index + 2}: Prioritized opening balance entry for account "${accountNameForBalance}". Set initial balance to: ${balance}`);
                     } else {
                         console.warn(`Row ${index + 2}: Could not parse amount "${amountValue}" for opening balance entry for account "${accountNameForBalance}".`);
                     }
                 } else {
                     console.warn(`Row ${index + 2}: Opening balance entry found for account "${accountNameForBalance}", but 'Amount' column ('${amountCol}') is missing or empty.`);
                 }

                 accountUpdates.set(normalizedName, details);
            }
        });

        // Second pass: Process all other rows to ensure all accounts mentioned are captured
        // (for currency, type, etc., but DON'T overwrite initialBalance if set by opening entry)
        csvData.forEach((record, index) => {
             const typeValue = typeCol ? record[typeCol]?.trim().toLowerCase() : undefined;
             const descValue = descCol ? record[descCol]?.trim() : undefined;
             const descLower = descValue?.toLowerCase();
             const isOpeningEntry = typeValue === 'opening balance' || descLower?.startsWith('saldo inicial para:');

             if (isOpeningEntry) return; // Skip, already handled

             let potentialAccountNames: string[] = [];
             // Check if it's a transfer row (has both source and destination)
             if (typeValue === 'transfer' || (sourceAccountCol && record[sourceAccountCol] && destAccountCol && record[destAccountCol])) {
                 potentialAccountNames = [
                     sourceAccountCol ? record[sourceAccountCol]?.trim() : undefined,
                     destAccountCol ? record[destAccountCol]?.trim() : undefined
                 ].filter(Boolean) as string[];
             } else {
                  // Standard transaction, get account from 'Account Name' column
                  potentialAccountNames = [
                      accountNameCol ? record[accountNameCol]?.trim() : undefined
                  ].filter(Boolean) as string[];
             }

             potentialAccountNames.forEach(name => {
                 if (name) {
                     const normalizedName = name.toLowerCase();
                     let details = accountUpdates.get(normalizedName);

                     if (!details) {
                         // Account not yet seen (wasn't an opening balance row for it)
                         const existingAcc = existingAccountsParam.find(acc => acc.name.toLowerCase() === normalizedName);
                         const initialCategory = existingAcc?.category || ((normalizedName.includes('crypto') || normalizedName.includes('wallet') || normalizedName.includes('binance') || normalizedName.includes('coinbase') || normalizedName.includes('kraken') || normalizedName.includes('ledger') || normalizedName.includes('metamask')) ? 'crypto' : 'asset');
                          details = {
                              name: name, // Store original casing
                              currency: existingAcc?.currency || 'BRL',
                              type: existingAcc?.type,
                              category: initialCategory
                              // initialBalance is NOT set here, only from opening balance rows or general initialBalanceCol
                          };
                          if (!details.type) {
                             if (details.category === 'crypto') details.type = 'wallet'; // Default for crypto
                             else details.type = 'checking'; // Default for asset
                          }
                         accountUpdates.set(normalizedName, details); // Add to map
                     }

                     // Update currency if specified and different
                     let finalCurrency = details.currency;
                      if (accountCurrencyCol && record[accountCurrencyCol]) {
                          const potentialCurrency = record[accountCurrencyCol]!.trim().toUpperCase();
                          if (supportedCurrencies.includes(potentialCurrency)) {
                              finalCurrency = potentialCurrency;
                          }
                      }
                      details.currency = finalCurrency;

                     // If initialBalance was NOT set by an "opening balance" row,
                     // check the general "Initial Balance" column as a fallback.
                     if (details.initialBalance === undefined && initialBalanceCol && record[initialBalanceCol] !== undefined && record[initialBalanceCol] !== '') {
                         const balance = parseAmount(record[initialBalanceCol]);
                         if (!isNaN(balance)) {
                             details.initialBalance = balance;
                             console.log(`Row ${index + 2}: Set initial balance for account "${name}" from '${initialBalanceCol}' column: ${balance} (as fallback).`);
                         } else {
                             console.warn(`Row ${index + 2}: Could not parse initial balance "${record[initialBalanceCol]}" for account "${name}" from balance column.`);
                         }
                     }

                      accountUpdates.set(normalizedName, details); // Update the map
                 }
             });
        });

         return accountUpdates;
    }

    // Create or update accounts in localStorage based on the map, get final ID map
    const createOrUpdateAccountsAndGetMap = async (
        csvData: CsvRecord[],
        mappings: ColumnMapping, // Pass all mappings
        existingAccountsParam: Account[], // Pass current accounts
        isPreviewOnly: boolean = false // Flag to prevent actual DB changes during preview
    ): Promise<{ success: boolean; map: { [key: string]: string } }> => {
        let success = true;
        // Start with a map of existing accounts (name_lowercase -> id)
        const workingMap = existingAccountsParam.reduce((map, acc) => {
             map[acc.name.toLowerCase().trim()] = acc.id;
             return map;
        }, {} as { [key: string]: string });

        const accountUpdates = await buildAccountUpdateMap(csvData, mappings, existingAccountsParam);

        if (accountUpdates.size === 0 && !isPreviewOnly) {
            console.log("No account updates needed.");
            return { success: true, map: workingMap }; // Return existing map if no changes
        }

        console.log(`Found ${accountUpdates.size} unique accounts in CSV to potentially create or update...`);
        let accountsProcessedCount = 0;

        for (const [normalizedName, accDetails] of accountUpdates.entries()) {
            const existingAccount = existingAccountsParam.find(acc => acc.name.toLowerCase() === normalizedName);
            try {
                if (isPreviewOnly) {
                    // For preview, just populate the map with existing ID or a placeholder for new
                    if (existingAccount) {
                        workingMap[normalizedName] = existingAccount.id;
                    } else {
                        // Placeholder for accounts that would be created
                        workingMap[normalizedName] = `preview_create_${normalizedName}`;
                    }
                    continue; // Skip actual creation/update in preview mode
                }

                // --- Actual Creation/Update Logic (not preview) ---
                if (existingAccount) {
                    // Account exists, check for updates
                    let needsUpdate = false;
                    const updatedAccountData: Account = { ...existingAccount };

                    if (accDetails.currency !== existingAccount.currency) {
                        console.log(`Updating currency for existing account "${accDetails.name}" from ${existingAccount.currency} to ${accDetails.currency}...`);
                        updatedAccountData.currency = accDetails.currency;
                        needsUpdate = true;
                    }
                     if (accDetails.type && accDetails.type !== existingAccount.type) {
                        console.log(`Updating type for existing account "${accDetails.name}" from ${existingAccount.type} to ${accDetails.type}...`);
                        updatedAccountData.type = accDetails.type;
                        needsUpdate = true;
                    }

                    // IMPORTANT: Update balance ONLY if accDetails.initialBalance was explicitly set
                    // (meaning it came from an "opening balance" row or "Saldo inicial para:")
                    if (accDetails.initialBalance !== undefined && accDetails.initialBalance !== existingAccount.balance) {
                        console.log(`Updating balance for existing account "${accDetails.name}" from ${existingAccount.balance} to ${accDetails.initialBalance} based on CSV (Opening Entry / Initial Column).`);
                        updatedAccountData.balance = accDetails.initialBalance; // This is the direct new balance
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        if(updatedAccountData.balance !== existingAccount.balance) { // If balance changed, update lastActivity
                           updatedAccountData.lastActivity = new Date().toISOString();
                        }
                        await updateAccount(updatedAccountData); // Call service to update
                        accountsProcessedCount++;
                        console.log(`Successfully updated account: ${updatedAccountData.name} (ID: ${updatedAccountData.id})`);
                    } else {
                        console.log(`Account "${accDetails.name}" already exists and is up-to-date.`);
                    }
                    workingMap[normalizedName] = existingAccount.id; // Ensure map has the ID

                } else {
                    // Account does not exist, create it
                    // The balance here is the initialBalance derived from opening rows or initialBalanceCol
                    const balanceToSet = accDetails.initialBalance ?? 0;
                    console.log(`Attempting to create account "${accDetails.name}" with currency ${accDetails.currency}, type ${accDetails.type}, category ${accDetails.category}, initial balance ${balanceToSet}...`);
                    const newAccountData: NewAccountData = {
                        name: accDetails.name, // Use original casing
                        type: accDetails.type!, // Type should be set by buildAccountUpdateMap
                        balance: balanceToSet, // This IS the initial balance
                        currency: accDetails.currency,
                        providerName: 'Imported', // Generic provider for now
                        category: accDetails.category, // Determined by buildAccountUpdateMap
                        isActive: true,
                        lastActivity: new Date().toISOString(), // Set to now
                        balanceDifference: 0, // No difference initially
                    };
                    const createdAccount = await addAccount(newAccountData); // Call service to add
                    workingMap[normalizedName] = createdAccount.id; // Add new account to map
                    accountsProcessedCount++;
                    console.log(`Successfully created account: ${createdAccount.name} (ID: ${createdAccount.id}) with initial balance ${balanceToSet}`);
                }
            } catch (err: any) {
                console.error(`Failed to process account "${accDetails.name}":`, err);
                toast({ title: "Account Processing Error", description: `Could not process account "${accDetails.name}". Error: ${err.message}`, variant: "destructive", duration: 7000 });
                success = false; // Mark overall success as false
            }
        }


        // If accounts were actually processed (not preview), refetch and return the definitive map
        if (accountsProcessedCount > 0 && !isPreviewOnly) {
            toast({ title: "Accounts Processed", description: `Created or updated ${accountsProcessedCount} accounts based on CSV data.` });
            try {
                 // Refetch accounts to ensure the state and local list are up-to-date
                 const latestAccounts = await getAccounts();
                 setAccounts(latestAccounts); // Update component state
                 // Rebuild the map from the source of truth (localStorage after updates)
                 const finalMap = latestAccounts.reduce((map, acc) => {
                     map[acc.name.toLowerCase().trim()] = acc.id;
                     return map;
                 }, {} as { [key: string]: string });
                 console.log("Final account map after creation/updates:", finalMap);
                 return { success, map: finalMap };
            } catch (fetchError) {
                 console.error("Failed to refetch accounts after updates:", fetchError);
                 success = false; // Mark as failed if refetch fails
                 return { success, map: workingMap }; // Return the map we have, though it might be slightly stale
            }

        }

        // For preview or if no accounts processed, return the current workingMap
        return { success, map: workingMap }; 
    };


   // Adds categories from CSV that don't exist yet
   const addMissingCategories = async (transactions: MappedTransaction[]): Promise<boolean> => {
      const currentCategories = await getCategories(); // Get current categories from service
      const existingCategoryNames = new Set(currentCategories.map(cat => cat.name.toLowerCase()));
      const categoriesToAdd = new Set<string>();
      let success = true;

      transactions.forEach(tx => {
          // Only consider pending transactions with a category that's not a system/default one
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
                  await addCategory(catName); // Use category service to add
                  categoriesAddedCount++;
              } catch (err: any) {
                  // Handle cases where category might have been added concurrently or other errors
                  if (!err.message?.includes('already exists')) { // Be more specific if your addCategory throws this
                      console.error(`Failed to add category "${catName}":`, err);
                      toast({ title: "Category Add Error", description: `Could not add category "${catName}". Error: ${err.message}`, variant: "destructive" });
                      success = false; // Mark overall success as false
                  } else {
                      console.log(`Category "${catName}" likely created concurrently or already existed.`);
                  }
              }
          });

          await Promise.all(addPromises);

          if (categoriesAddedCount > 0) {
            toast({ title: "Categories Added", description: `Added ${categoriesAddedCount} new categories found in CSV.` });
             // Refetch categories to update UI/state
             try {
                const updatedCategoriesList = await getCategories();
                setCategories(updatedCategoriesList); // Update component state
             } catch { console.error("Failed to refetch categories after add."); }
          } else if (categoriesToAdd.size > 0) { // If some were attempted but failed (e.g. all existed)
              toast({ title: "Categories Processed", description: `Checked ${categoriesToAdd.size} categories found in CSV.` });
          }
      } else {
          console.log("No new categories found in pending transactions.");
      }
      return success;
   };

    // Adds tags from CSV that don't exist yet
    const addMissingTags = async (transactions: MappedTransaction[]): Promise<boolean> => {
        const currentTags = await getTags(); // Get current tags from service
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
                    await addTag(tagName); // Use tag service to add
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
                 // Refetch tags to update UI/state
                 try {
                    const updatedTagsList = await getTags();
                    setTags(updatedTagsList); // Update component state
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
      setError(null); // Clear previous import errors
      let overallError = false;
      let latestAccountsState: Account[] = [...accounts]; // Use current state
      let localFinalAccountMap: { [key: string]: string } = {}; // Initialize


        // --- Step 1: Finalize Account Creation/Updates & Get Definitive Map ---
        console.log("Finalizing account creation/updates before import...");
        try {
            const { success: finalAccountMapSuccess, map: finalMapFromAccountCreation } = await createOrUpdateAccountsAndGetMap(
                rawData, // Original CSV data
                columnMappings, // Confirmed mappings from dialog
                latestAccountsState, // Current accounts state
                false // isPreviewOnly = false, so actual changes will be made
            );

            if (!finalAccountMapSuccess) {
                setError("Error finalizing account mapping before import. Check console.");
                setIsLoading(false);
                return;
            }
            localFinalAccountMap = finalMapFromAccountCreation; // This is the crucial map of name -> ID
            setFinalAccountMapForImport(finalMapFromAccountCreation); // Store for UI display if needed
            console.log("Using local FINAL account map for import execution:", localFinalAccountMap);

            // Refetch accounts one last time to ensure balance updates are from the true source
            latestAccountsState = await getAccounts(); // Refetch accounts from service
            setAccounts(latestAccountsState); // Update component state

      } catch (finalAccountMapError) {
          console.error("Error during account preparation phase:", finalAccountMapError);
            setError("Critical error during account preparation. Import aborted.");
          toast({
              title: "Import Failed",
              description: "Could not prepare accounts for import.",
              variant: "destructive",
          });
          setIsLoading(false);
          return; // Halt import
      }
        // -------------------------------------------------------------


      // --- Step 2: Add Missing Categories and Tags ---
      console.log("Adding missing categories...");
      const categoriesSuccess = await addMissingCategories(recordsToImport);
      console.log("Adding missing tags...");
      const tagsSuccess = await addMissingTags(recordsToImport);

      if (!categoriesSuccess || !tagsSuccess) {
         setError("Error adding categories or tags. Import halted. Check console.");
         setIsLoading(false);
         return; // Halt if categories/tags failed
      }

      // Refetch categories/tags to use the latest list during transaction import
      console.log("Fetching latest categories and tags before import...");
      let currentCategoriesList = await getCategories(); // Fresh list
      let currentTagsList = await getTags(); // Fresh list
      // --------------------------------------------


      // --- Step 3: Import Transactions ---
      const totalToImport = recordsToImport.length;
      let importedCount = 0;
      let errorCount = 0;
      const updatedData = [...parsedData]; // Create a mutable copy to update importStatus

      console.log(`Starting import of ${totalToImport} pending transactions...`);

      for (let i = 0; i < updatedData.length; i++) {
          const item = updatedData[i];
          const rowNumber = i + 2; // For logging

          if (item.importStatus !== 'pending') {
              if(item.importStatus === 'error') errorCount++;
              continue; // Skip already processed, errored, or skipped rows
          }

           // Explicitly skip "Opening Balance" category transactions as their amounts affect account initial balance, not tx log.
           if (item.category === 'Opening Balance') {
               console.log(`Row ${rowNumber}: Skipping transaction import for opening balance (already handled).`);
               updatedData[i] = { ...item, importStatus: 'skipped', errorMessage: 'Opening Balance (handled via account balance)' };
               setParsedData([...updatedData]); // Update UI
               continue;
           }


          try {
               // Normalize category and tags against the now-updated lists
               const categoryName = item.category?.trim() || 'Uncategorized';
               const foundCategory = currentCategoriesList.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
               const finalCategoryName = foundCategory ? foundCategory.name : 'Uncategorized';
               if (categoryName !== 'Uncategorized' && !foundCategory && categoryName !== 'Transfer' && categoryName !== 'Initial Balance') {
                   console.warn(`Row ${rowNumber}: Category "${categoryName}" specified but not found after add attempt. Defaulting to 'Uncategorized'.`);
               }

               const finalTags = item.tags?.map(importedTagName => {
                   const trimmedTagName = importedTagName.trim();
                   const foundTag = currentTagsList.find(t => t.name.toLowerCase() === trimmedTagName.toLowerCase());
                    if (!foundTag && trimmedTagName) console.warn(`Row ${rowNumber}: Tag "${trimmedTagName}" not found after add attempt.`);
                   return foundTag ? foundTag.name : trimmedTagName; // Use existing cased name or new one
               }).filter(Boolean) || [];


                // Determine if it's a transfer based on the category set during processAndMapData
                // Also ensure source_account and destination_account columns were mapped for transfers
                const sourceCol = columnMappings.source_account;
                const destCol = columnMappings.destination_account;

                if (item.category === 'Transfer' && sourceCol && destCol) {
                    const sourceName = item.originalRecord[sourceCol]?.trim();
                    const destNameValue = item.originalRecord[destCol]?.trim();

                    if (!sourceName || !destNameValue) {
                        throw new Error(`Transfer Import Error - Row ${rowNumber} marked as Transfer, but source or destination account name is missing in CSV from mapped columns.`);
                    }

                     const sourceNameLower = sourceName.toLowerCase();
                     const destNameLower = destNameValue.toLowerCase();
                     const sourceId = localFinalAccountMap[sourceNameLower]; 
                     const destId = localFinalAccountMap[destNameLower]; 

                     if (!sourceId) throw new Error(`Transfer Import Error - Row ${rowNumber}: Could not find final source account ID for "${sourceName}". Map: ${JSON.stringify(localFinalAccountMap)}`);
                     if (!destId) throw new Error(`Transfer Import Error - Row ${rowNumber}: Could not find final destination account ID for "${destNameValue}". Map: ${JSON.stringify(localFinalAccountMap)}`);
                     if (sourceId === destId) throw new Error(`Transfer Import Error - Row ${rowNumber}: Source and destination accounts are the same ("${sourceName}").`);


                     const transferAmount = Math.abs(item.amount); // item.amount should be absolute from processAndMapData for transfers
                     if (isNaN(transferAmount) || transferAmount <= 0) {
                         throw new Error(`Transfer Import Error - Row ${rowNumber}: Invalid or zero transfer amount (${item.amount}).`);
                     }

                     const transferDate = item.date; 
                     const transferDesc = item.description || `Transfer from ${sourceName} to ${destNameValue}`;
                     const transferTags = finalTags;

                     // Create outgoing transaction
                     await addTransaction({
                         accountId: sourceId,
                         date: transferDate,
                         amount: -transferAmount, 
                         description: transferDesc,
                         category: 'Transfer', 
                         tags: transferTags,
                     });
                     // Create incoming transaction
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
                     // Standard income/expense transaction
                     const accountNameForTx = item.originalRecord[columnMappings.account!]?.trim() ||
                                             item.originalRecord[columnMappings.source_account!]?.trim() ||
                                             item.originalRecord[columnMappings.destination_account!]?.trim();

                     if (!accountNameForTx) {
                         throw new Error(`Row ${rowNumber}: Could not determine account name for transaction.`);
                     }

                     const accountIdForImport = localFinalAccountMap[accountNameForTx.toLowerCase()]; 

                     if (!accountIdForImport) {
                          throw new Error(`Row ${rowNumber}: Could not find final account ID for account name "${accountNameForTx}". Map: ${JSON.stringify(finalAccountMapForImport)}`);
                     }
                     if (accountIdForImport.startsWith('skipped_') || accountIdForImport.startsWith('error_') || accountIdForImport.startsWith('preview_')) {
                         throw new Error(`Invalid account ID reference ('${accountIdForImport}') for import.`);
                     }
                     if (isNaN(item.amount)) { 
                          throw new Error(`Invalid amount for import.`);
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
          }

          setImportProgress(calculateProgress(importedCount + errorCount, totalToImport));

           // Update UI with status for each row as it's processed
           setParsedData([...updatedData]);

      }
      // -------------------------------

      setIsLoading(false);
      const finalMessage = `Import finished. Success: ${importedCount}. Failed/Skipped: ${errorCount + parsedData.filter(d => d.importStatus === 'skipped' && d.category !== 'Opening Balance').length}.`;
      toast({
        title: overallError ? "Import Complete with Issues" : "Import Complete",
        description: finalMessage,
        variant: overallError ? "destructive" : "default",
        duration: 7000,
      });
      if (overallError) {
         setError(`Import finished with ${errorCount} errors/skipped rows. Please review the table.`);
      } else {
         setError(null); // Clear error if successful
          // Dispatch a storage event to notify other components (like dashboard) of data changes
          console.log("Dispatching storage event to notify other components of potential updates.");
         window.dispatchEvent(new Event('storage'));
      }

   };


  const calculateProgress = (processed: number, total: number): number => {
      if (total === 0) return 0;
      return Math.round((processed / total) * 100);
  }

    // Clear all app data (for testing/reset)
    const handleClearAccounts = async () => {
        setIsClearing(true);
        try {
            // Clear core data items
            localStorage.removeItem('userAccounts');
            localStorage.removeItem('userCategories');
            localStorage.removeItem('userTags');
            // localStorage.removeItem('userPreferences'); // Keep preferences usually

            // Clear all transactions stored in the session (specific to transactions.ts implementation)
            clearAllSessionTransactions();

            // Reset component state
            setAccounts([]);
            setCategories([]);
            setTags([]);
            setParsedData([]);
            setAccountPreviewData([]); 
            setError(null);
            setRawData([]);
            setFile(null); // Clear the selected file
            setColumnMappings({});
            setImportProgress(0);
            setFinalAccountMapForImport({}); 

            // Reset the file input visually
            const fileInput = document.getElementById('csv-file') as HTMLInputElement;
            if (fileInput) fileInput.value = '';


            toast({ title: "Data Cleared", description: "All accounts, categories, tags, and imported transactions have been removed." });
            // Trigger a storage event so other parts of the app can react (e.g., dashboard refresh)
            window.dispatchEvent(new Event('storage')); 
        } catch (err) {
            console.error("Failed to clear data:", err);
            toast({ title: "Error", description: "Could not clear stored data.", variant: "destructive" });
        } finally {
            setIsClearing(false);
        }
    };

    // Handle inline editing of transactions in the preview table
    const handleTransactionFieldChange = (
        index: number,
        field: 'description' | 'category' | 'tags' | 'amount' | 'date', // Allowed fields for editing
        value: string
    ) => {
        setParsedData(prevData => {
            const newData = [...prevData];
            let transactionToUpdate = { ...newData[index] };

            // Ensure we don't try to edit non-pending transactions or apply invalid changes
            if (transactionToUpdate.importStatus !== 'pending') {
                toast({ title: "Edit Blocked", description: "Cannot edit transactions that are not pending import.", variant: "destructive" });
                return prevData;
            }

            switch (field) {
                case 'description':
                    transactionToUpdate.description = value;
                    break;
                case 'category':
                    transactionToUpdate.category = value;
                    break;
                case 'tags':
                    // Assuming tags are comma-separated in the input
                    transactionToUpdate.tags = value.split(',').map(tag => tag.trim()).filter(Boolean);
                    break;
                case 'amount':
                    const parsedAmount = parseFloat(value); // Try to parse the amount
                    if (!isNaN(parsedAmount)) {
                        transactionToUpdate.amount = parsedAmount;
                    } else {
                        toast({ title: "Invalid Amount", description: "Amount not updated. Please enter a valid number.", variant: "destructive" });
                        return prevData; // Don't update if invalid
                    }
                    break;
                case 'date':
                     // Basic validation for YYYY-MM-DD or attempt to parse other common formats
                     if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) { // Check YYYY-MM-DD directly
                        transactionToUpdate.date = value;
                    } else if (value) { // Attempt to parse other formats if not YYYY-MM-DD
                        try {
                            const d = new Date(value); // This can be lenient
                            if (!isNaN(d.getTime())) {
                                transactionToUpdate.date = format(d, 'yyyy-MM-dd'); // Standardize
                            } else {
                                throw new Error("Invalid date object");
                            }
                        } catch {
                            toast({ title: "Invalid Date", description: "Date not updated. Please use YYYY-MM-DD format or select a valid date.", variant: "destructive" });
                            return prevData; // Don't update if invalid
                        }
                    }
                    else { // Value is empty, should not happen if Input type="date" is used correctly by browser
                        toast({ title: "Invalid Date", description: "Date not updated. Please select a valid date.", variant: "destructive" });
                        return prevData;
                    }
                    break;
                default:
                    return prevData; // No change for unhandled fields
            }
            newData[index] = transactionToUpdate;
            return newData;
        });
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
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Step 2: Map CSV Columns</DialogTitle>
                    <DialogDescription>
                        Match columns from your CSV (right) to application fields (left).
                        Essential fields: Date, Account Name (or Source/Destination), and Amount (either signed or income/expense pair).
                        We've tried to guess based on common headers. Map 'Initial Balance' if available. Map 'Transaction Type' or 'Description' if your CSV uses them to indicate initial balances (e.g., "opening balance", "Saldo inicial para:").
                    </DialogDescription>
                </DialogHeader>
                <CsvMappingForm
                    csvHeaders={csvHeaders}
                    initialMappings={columnMappings}
                    onSubmit={processAndMapData} // This now processes and previews
                    onCancel={() => {
                        setIsMappingDialogOpen(false);
                        // Optionally reset rawData or file if cancel should clear everything
                    }}
                />
            </DialogContent>
        </Dialog>


       {/* Account Changes Preview Table */}
       {accountPreviewData.length > 0 && !isLoading && (
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Step 2.5: Account Changes Preview</CardTitle>
                    <CardDescription>Review the accounts that will be created or updated based on the CSV data and mappings. Initial balances are derived from 'Opening Balance' type rows, 'Saldo inicial para:' descriptions, 'Initial Balance' columns, or existing data.</CardDescription>
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


      {/* Transaction Preview Table */}
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
                    <TableHead>Date</TableHead>
                    <TableHead>Account (CSV)</TableHead>
                    {columnMappings.destination_account && <TableHead>Dest Acc (CSV)</TableHead>}
                    {columnMappings.transaction_type && <TableHead>Type (CSV)</TableHead>}
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="min-w-[150px]">Message / Info</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((item, index) => {
                       // Determine account and currency for display
                       let finalAccountId = item.accountId;
                       // Resolve preview IDs to final IDs if import has run, or keep preview for display
                       if (finalAccountId && !finalAccountId.startsWith('error_') && !finalAccountId.startsWith('skipped_')) {
                            if (finalAccountId.startsWith('preview_create_')) {
                                const accountName = finalAccountId.replace('preview_create_', '');
                                finalAccountId = finalAccountMapForImport[accountName] || finalAccountId;
                            } else {
                                // It might be an existing account ID or a normalized name if map isn't final yet
                                finalAccountId = finalAccountMapForImport[finalAccountId.toLowerCase()] || finalAccountId;
                            }
                       }
                       const account = accounts.find(acc => acc.id === finalAccountId);
                       // Get the account name as it appears in the CSV for display consistency
                       const accountNameFromRecord = item.originalRecord[columnMappings.account || ''] || item.originalRecord[columnMappings.source_account || ''] || item.originalRecord[columnMappings.destination_account || ''] || (item.accountId && item.accountId.startsWith('preview_create_') ? item.accountId.replace('preview_create_', '') : item.accountId) || 'N/A';
                       let displayCurrency = '???';
                       if (account) {
                           displayCurrency = account.currency;
                       } else if (columnMappings.accountCurrency && item.originalRecord[columnMappings.accountCurrency!]) {
                           const potentialCurrency = item.originalRecord[columnMappings.accountCurrency!]!.trim().toUpperCase();
                           if (supportedCurrencies.includes(potentialCurrency)) {
                               displayCurrency = potentialCurrency;
                           }
                       }
                      return (
                          <TableRow key={index} className={cn(
                              "text-xs", // Smaller text for dense table
                              item.importStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
                              item.importStatus === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                              item.importStatus === 'skipped' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                          )}>
                            <TableCell className="whitespace-nowrap max-w-[120px]">
                                <Input type="date" value={item.date} onChange={(e) => handleTransactionFieldChange(index, 'date', e.target.value)} className="h-8 text-xs p-1" />
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate" title={accountNameFromRecord}>{accountNameFromRecord}</TableCell>
                            {columnMappings.destination_account && <TableCell className="max-w-[150px] truncate" title={item.originalRecord[columnMappings.destination_account!]}>{item.originalRecord[columnMappings.destination_account!]}</TableCell>}
                            {columnMappings.transaction_type && <TableCell className="capitalize max-w-[100px] truncate" title={item.originalRecord[columnMappings.transaction_type!]}>{item.originalRecord[columnMappings.transaction_type!]}</TableCell>}
                            <TableCell className="max-w-[200px]">
                                <Input value={item.description || ''} onChange={(e) => handleTransactionFieldChange(index, 'description', e.target.value)} className="h-8 text-xs p-1" />
                            </TableCell>
                            <TableCell className="max-w-[100px]">
                                <Input value={item.category || ''} onChange={(e) => handleTransactionFieldChange(index, 'category', e.target.value)} className="h-8 text-xs p-1" />
                            </TableCell>
                            <TableCell className="max-w-[150px]">
                                <Input value={item.tags?.join(', ') || ''} onChange={(e) => handleTransactionFieldChange(index, 'tags', e.target.value)} placeholder="tag1, tag2" className="h-8 text-xs p-1" />
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                                <Input type="number" step="0.01" value={item.amount?.toString() || ''} onChange={(e) => handleTransactionFieldChange(index, 'amount', e.target.value)} className="h-8 text-xs p-1 text-right" />
                                <span className="ml-1 text-muted-foreground text-[10px]">{displayCurrency}</span>
                            </TableCell>
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


