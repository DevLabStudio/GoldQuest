'use client';

import { useState, useEffect, useMemo } from 'react';
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
    'tags', 'initialBalance', 'notes', 'transaction_type', 'destination_name'
] as const;
type AppField = typeof APP_FIELDS_VALUES[number];

type MappedTransaction = {
  csvAccountNameKey?: string; // Lowercase CSV account name key for primary account (income/expense)
  csvSourceAccountNameKey?: string; // For transfers
  csvDestAccountNameKey?: string; // For transfers
  date: string;
  amount: number;
  description: string;
  category: string;
  tags?: string[];
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
         initialMappings.destination_name = findColumnName(detectedHeaders, 'Destination name'); // Firefly uses "Destination name" for payee
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

        const requiredBaseFields: AppField[] = ['date']; 
        const missingBaseMappings = requiredBaseFields.filter(field => !confirmedMappings[field]);
        let missingFieldLabels = missingBaseMappings.map(f => APP_FIELDS_VALUES.find(val => val === f) || f); 

        if (!amountRequirementMet) {
            missingFieldLabels.push("Amount (Signed +/-) *OR* both Income Amount + Expense Amount");
        }

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
        const amountCol = confirmedMappings.amount; 
        const incomeCol = confirmedMappings.amount_income; 
        const expenseCol = confirmedMappings.amount_expense; 
        const descCol = confirmedMappings.description;
        const accountCol = confirmedMappings.account; 
        const sourceAccountCol = confirmedMappings.source_account; 
        const destAccountCol = confirmedMappings.destination_account; 
        const destNameCol = confirmedMappings.destination_name; // For payee from Firefly
        const catCol = confirmedMappings.category;
        const accountCurrencyCol = confirmedMappings.accountCurrency;
        const tagsCol = confirmedMappings.tags;
        const initialBalanceCol = confirmedMappings.initialBalance;
        const notesCol = confirmedMappings.notes;
        const typeCol = confirmedMappings.transaction_type; 

        const { preview } = await previewAccountChanges(rawData, confirmedMappings, accounts);
        setAccountPreviewData(preview);
        console.log("Account preview generated:", preview);

        const { map: tempAccountMap } = await createOrUpdateAccountsAndGetMap(rawData, confirmedMappings, accounts, true);
        console.log("Generated temporary account map for transaction linking:", tempAccountMap);


        const mapped: MappedTransaction[] = rawData.map((record, index) => {
          try {
              const rowNumber = index + 2; 

              const dateValue = record[dateCol];
              let descriptionValue = descCol ? record[descCol] : undefined;
              const destinationNameValue = destNameCol ? record[destNameCol] : undefined; // Payee from Firefly
              const categoryValue = catCol ? record[catCol] : undefined;
              const accountNameValue = accountCol ? record[accountCol] : undefined; 
              const sourceAccountNameValue = sourceAccountCol ? record[sourceAccountCol] : undefined;
              const destAccountNameValue = destAccountCol ? record[destAccountCol] : undefined;
              const tagsValue = tagsCol ? record[tagsCol] : undefined;
              const notesValue = notesCol ? record[notesCol] : undefined;
              const typeValue = typeCol ? record[typeCol]?.trim().toLowerCase() : undefined; 
              const descriptionLower = descriptionValue?.toLowerCase();

              // If description is empty but destination_name is present (common in Firefly), use destination_name
              if (!descriptionValue && destinationNameValue) {
                  descriptionValue = destinationNameValue;
              }


              let parsedAmount: number = NaN; 
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
                       parsedAmount = income; 
                       console.log(`Row ${rowNumber}: Parsed amount from income column ('${incomeCol}')='${incomeAmountValue}' as ${parsedAmount}`);
                   } else if (!isNaN(expense) && expense > 0 && (isNaN(income) || income === 0)) {
                       parsedAmount = -expense; 
                       console.log(`Row ${rowNumber}: Parsed amount from expense column ('${expenseCol}')='${expenseAmountValue}' as ${parsedAmount}`);
                   } else if (!isNaN(income) && income === 0 && !isNaN(expense) && expense === 0) {
                       parsedAmount = 0; 
                       console.log(`Row ${rowNumber}: Parsed amount as 0 from income/expense columns.`);
                   } else if (!isNaN(income) && income > 0 && !isNaN(expense) && expense > 0) {
                       console.warn(`Row ${rowNumber}: Both income (${income}) and expense (${expense}) have values. Transfer logic will attempt to resolve.`);
                       parsedAmount = NaN; 
                   } else {
                       throw new Error(`Could not determine amount from Income ('${incomeAmountValue}') and Expense ('${expenseAmountValue}') columns.`);
                   }
              }

              if (isNaN(parsedAmount)) {
                   const initialBalanceMatch = descriptionLower?.match(/^saldo inicial para:\s*(.+)$/); 
                    if (initialBalanceMatch) {
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
                    } else if (typeValue === 'opening balance') { 
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
                       console.error(`Row ${rowNumber}: Amount could not be determined. Signed='${signedAmountValue}', Income='${incomeAmountValue}', Expense='${expenseAmountValue}'.`);
                       throw new Error(`Could not determine a valid amount.`);
                    }
              }


              if (!dateValue) throw new Error(`Row ${rowNumber}: Missing mapped 'Date' data.`);

              let description = descriptionValue?.trim() || 'Imported Transaction';
              let category = categoryValue?.trim() || 'Uncategorized';
              const parsedTags = tagsValue?.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) || [];
               if (notesValue) { 
                   description += ` (Notes: ${notesValue.trim()})`; 
               }

              let transactionTypeInternal: 'income' | 'expense' | 'transfer' | 'skip' = 'skip';
              let csvAccountNameKey: string | undefined = undefined;
              let csvSourceAccountNameKey: string | undefined = undefined;
              let csvDestAccountNameKey: string | undefined = undefined;
              let isOpeningBalance = false;


               const initialBalanceDescMatch = descriptionLower?.match(/^saldo inicial para:\s*(.+)$/);
               if (initialBalanceDescMatch) {
                   const accountNameFromDesc = initialBalanceDescMatch[1].trim();
                   csvAccountNameKey = accountNameFromDesc.toLowerCase();
                   if (!tempAccountMap[csvAccountNameKey]) {
                       console.warn(`Row ${rowNumber}: Initial balance for account "${accountNameFromDesc}" (from desc), but not in temp map. Placeholder will be used.`);
                       tempAccountMap[csvAccountNameKey] = `preview_create_${csvAccountNameKey}`;
                   }
                   if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Invalid amount for 'Saldo inicial para'.`);
                   isOpeningBalance = true;
                   transactionTypeInternal = 'skip'; 
                   description = descriptionValue || `Saldo inicial para: ${accountNameFromDesc}`; 
                   category = 'Opening Balance'; 
                   console.log(`Row ${rowNumber}: Identified 'Saldo inicial para:' for account ${accountNameFromDesc}. Amount: ${parsedAmount}. This will set initial account balance.`);
               } else if (typeValue === 'opening balance') {
                    const accountNameForOpening = accountCol ? record[accountCol]?.trim() : undefined;
                     if (accountNameForOpening) {
                         csvAccountNameKey = accountNameForOpening.toLowerCase();
                         if (!tempAccountMap[csvAccountNameKey]) throw new Error(`Row ${rowNumber}: Opening balance type, but Account '${accountNameForOpening}' not in temp map.`);
                         if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Invalid amount for 'opening balance'.`);
                         isOpeningBalance = true;
                         transactionTypeInternal = 'skip'; 
                         description = descriptionValue || `Opening Balance for ${accountNameForOpening}`;
                         category = 'Opening Balance';
                         console.log(`Row ${rowNumber}: Identified 'opening balance' type for account ${accountNameForOpening}. Amount: ${parsedAmount}. This will set initial account balance.`);
                    } else {
                         throw new Error(`Row ${rowNumber}: 'opening balance' type detected, but 'Account Name' column is not mapped or empty.`);
                    }
               } else if (sourceAccountNameValue && destAccountNameValue) { // Transfer
                   csvSourceAccountNameKey = sourceAccountNameValue.trim().toLowerCase();
                   csvDestAccountNameKey = destAccountNameValue.trim().toLowerCase();
                   if (!tempAccountMap[csvSourceAccountNameKey]) throw new Error(`Row ${rowNumber}: Transfer, Source account ('${sourceAccountNameValue}') not in temp map.`);
                   if (!tempAccountMap[csvDestAccountNameKey]) throw new Error(`Row ${rowNumber}: Transfer, Destination account ('${destAccountNameValue}') not in temp map.`);
                   if (csvSourceAccountNameKey === csvDestAccountNameKey) throw new Error(`Row ${rowNumber}: Transfer source and destination accounts are the same ('${sourceAccountNameValue}').`);

                   if (isNaN(parsedAmount) && !isNaN(parseAmount(incomeAmountValue)) && !isNaN(parseAmount(expenseAmountValue))) {
                       parsedAmount = Math.abs(parseAmount(incomeAmountValue) || parseAmount(expenseAmountValue) || 0); 
                       if (parsedAmount === 0) throw new Error(`Row ${rowNumber}: Transfer amount resolved to zero from income/expense columns.`);
                       console.log(`Row ${rowNumber}: Resolved transfer amount to ${parsedAmount} from income/expense.`);
                   } else if (isNaN(parsedAmount)) {
                       const signedAmount = parseAmount(signedAmountValue);
                       if (!isNaN(signedAmount)) {
                           parsedAmount = Math.abs(signedAmount);
                           console.log(`Row ${rowNumber}: Using absolute signed amount ${parsedAmount} for transfer.`);
                       } else {
                          throw new Error(`Row ${rowNumber}: Could not determine transfer amount.`);
                       }
                   } else {
                       parsedAmount = Math.abs(parsedAmount); 
                   }
                   transactionTypeInternal = 'transfer';
                   category = 'Transfer'; 
                   description = description || `Transfer from ${sourceAccountNameValue} to ${destAccountNameValue}`;

               } else if (accountNameValue) { // Regular income/expense
                   csvAccountNameKey = accountNameValue.trim().toLowerCase();
                   if (!tempAccountMap[csvAccountNameKey]) throw new Error(`Row ${rowNumber}: Account '${accountNameValue}' not in temp map.`);

                   if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Invalid or missing amount value ('${signedAmountValue || incomeAmountValue || expenseAmountValue || 'N/A'}').`);

                   if (typeValue === 'deposit' || (typeValue === 'transfer' && parsedAmount > 0)) { 
                       parsedAmount = Math.abs(parsedAmount); 
                       transactionTypeInternal = 'income';
                       if (typeValue === 'transfer') category = 'Transfer'; 
                   } else if (typeValue === 'withdrawal' || (typeValue === 'transfer' && parsedAmount < 0)) {
                       parsedAmount = -Math.abs(parsedAmount); 
                       transactionTypeInternal = 'expense';
                        if (typeValue === 'transfer') category = 'Transfer';
                   } else {
                       transactionTypeInternal = parsedAmount >= 0 ? 'income' : 'expense';
                   }
               } else {
                   const singleAccountName = (sourceAccountNameValue || destAccountNameValue)?.trim();
                   if (singleAccountName) {
                      csvAccountNameKey = singleAccountName.toLowerCase();
                      if (!tempAccountMap[csvAccountNameKey]) throw new Error(`Row ${rowNumber}: Account '${singleAccountName}' from source/destination column not found in temp map.`);
                      if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Invalid or missing amount value.`);
                      transactionTypeInternal = parsedAmount >= 0 ? 'income' : 'expense';
                   } else {
                      throw new Error(`Row ${rowNumber}: Missing required account information.`);
                   }
               }


               if (transactionTypeInternal !== 'skip' && isNaN(parsedAmount)) {
                    throw new Error(`Row ${rowNumber}: Failed to determine a valid transaction amount.`);
               }


               if (transactionTypeInternal === 'skip') {
                    return {
                        csvAccountNameKey: csvAccountNameKey, 
                        date: parseDate(dateValue),
                        amount: parsedAmount || 0, 
                        description: description,
                        category: category, 
                        tags: parsedTags,
                        originalRecord: record,
                        importStatus: 'skipped',
                        errorMessage: isOpeningBalance ? 'Opening Balance (sets initial account value)' : 'Skipped (e.g., non-opening initial balance).',
                    };
               } else {
                   return {
                       csvAccountNameKey: csvAccountNameKey,
                       csvSourceAccountNameKey: csvSourceAccountNameKey,
                       csvDestAccountNameKey: csvDestAccountNameKey,
                       date: parseDate(dateValue),
                       amount: parsedAmount, 
                       description: description,
                       category: category,
                       tags: parsedTags,
                       originalRecord: record,
                       importStatus: 'pending', 
                   };
               }

            } catch (rowError: any) {
                console.error(`Error processing row ${index + 2} with mappings:`, confirmedMappings, `and record:`, record, `Error:`, rowError);
                 return {
                    // accountId: `error_row_${index}`,
                    date: parseDate(record[dateCol]), 
                    amount: 0, 
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


    // Preview account changes based on CSV and mappings
    const previewAccountChanges = async (
        csvData: CsvRecord[],
        mappings: ColumnMapping, 
        existingAccountsParam: Account[] 
    ): Promise<{ preview: AccountPreview[] }> => {
        const preview: AccountPreview[] = [];
        const processedAccountNames = new Set<string>(); 

        const accountUpdates = await buildAccountUpdateMap(csvData, mappings, existingAccountsParam); 

        accountUpdates.forEach((accDetails, normalizedName) => {
            const existingAccount = existingAccountsParam.find(acc => acc.name.toLowerCase() === normalizedName);
            let action: AccountPreview['action'] = 'no change';
            let initialBalance: number | undefined = undefined;

            if (existingAccount) {
                let needsUpdate = false;
                if (accDetails.currency !== existingAccount.currency) needsUpdate = true;
                if (accDetails.type && accDetails.type !== existingAccount.type) needsUpdate = true;
                if (accDetails.initialBalance !== undefined && accDetails.initialBalance !== existingAccount.balance) {
                    needsUpdate = true;
                    initialBalance = accDetails.initialBalance; 
                } else {
                    initialBalance = existingAccount.balance; 
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
                initialBalance = accDetails.initialBalance ?? 0; 
                preview.push({
                    name: accDetails.name,
                    currency: accDetails.currency,
                    initialBalance: initialBalance,
                    action: 'create',
                });
            }
             processedAccountNames.add(normalizedName);
        });

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
        mappings: ColumnMapping, 
        existingAccountsParam: Account[] 
    ): Promise<Map<string, { name: string; currency: string; type?: string; initialBalance?: number; category: 'asset' | 'crypto' }>> => {
        const accountUpdates = new Map<string, { name: string; currency: string; type?: string; initialBalance?: number; category: 'asset' | 'crypto' }>();

        const accountNameCol = mappings.account;
        const sourceAccountCol = mappings.source_account;
        const destAccountCol = mappings.destination_account;
        const accountCurrencyCol = mappings.accountCurrency;
        const initialBalanceCol = mappings.initialBalance; 
        const typeCol = mappings.transaction_type; 
        const amountCol = mappings.amount; 
        const descCol = mappings.description; 

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

                 if (!details) {
                     const existingAcc = existingAccountsParam.find(acc => acc.name.toLowerCase() === normalizedName);
                     const initialCategory = existingAcc?.category || ((normalizedName.includes('crypto') || normalizedName.includes('wallet') || normalizedName.includes('binance') || normalizedName.includes('coinbase') || normalizedName.includes('kraken') || normalizedName.includes('ledger') || normalizedName.includes('metamask')) ? 'crypto' : 'asset');
                     details = {
                         name: accountNameForBalance, 
                         currency: existingAcc?.currency || 'BRL', 
                         type: existingAcc?.type,
                         initialBalance: existingAcc?.balance, 
                         category: initialCategory
                     };
                     if (!details.type) { 
                         if (details.category === 'crypto') details.type = 'wallet';
                         else details.type = 'checking';
                     }
                 }

                 let rowCurrency = details.currency; 
                 if (accountCurrencyCol && record[accountCurrencyCol]) {
                     const potentialCurrency = record[accountCurrencyCol]!.trim().toUpperCase();
                     if (supportedCurrencies.includes(potentialCurrency)) {
                         rowCurrency = potentialCurrency;
                     }
                 }
                 details.currency = rowCurrency;

                 const amountValue = amountCol ? record[amountCol] : undefined;
                 if (amountValue !== undefined && amountValue !== '') {
                     const balance = parseAmount(amountValue);
                     if (!isNaN(balance)) {
                         details.initialBalance = balance; 
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

        csvData.forEach((record, index) => {
             const typeValue = typeCol ? record[typeCol]?.trim().toLowerCase() : undefined;
             const descValue = descCol ? record[descCol]?.trim() : undefined;
             const descLower = descValue?.toLowerCase();
             const isOpeningEntry = typeValue === 'opening balance' || descLower?.startsWith('saldo inicial para:');

             if (isOpeningEntry) return; 

             let potentialAccountNames: string[] = [];
             if (typeValue === 'transfer' || (sourceAccountCol && record[sourceAccountCol] && destAccountCol && record[destAccountCol])) {
                 potentialAccountNames = [
                     sourceAccountCol ? record[sourceAccountCol]?.trim() : undefined,
                     destAccountCol ? record[destAccountCol]?.trim() : undefined
                 ].filter(Boolean) as string[];
             } else {
                  potentialAccountNames = [
                      accountNameCol ? record[accountNameCol]?.trim() : undefined
                  ].filter(Boolean) as string[];
             }

             potentialAccountNames.forEach(name => {
                 if (name) {
                     const normalizedName = name.toLowerCase();
                     let details = accountUpdates.get(normalizedName);

                     if (!details) {
                         const existingAcc = existingAccountsParam.find(acc => acc.name.toLowerCase() === normalizedName);
                         const initialCategory = existingAcc?.category || ((normalizedName.includes('crypto') || normalizedName.includes('wallet') || normalizedName.includes('binance') || normalizedName.includes('coinbase') || normalizedName.includes('kraken') || normalizedName.includes('ledger') || normalizedName.includes('metamask')) ? 'crypto' : 'asset');
                          details = {
                              name: name, 
                              currency: existingAcc?.currency || 'BRL',
                              type: existingAcc?.type,
                              category: initialCategory
                          };
                          if (!details.type) {
                             if (details.category === 'crypto') details.type = 'wallet'; 
                             else details.type = 'checking'; 
                          }
                         accountUpdates.set(normalizedName, details); 
                     }

                     let finalCurrency = details.currency;
                      if (accountCurrencyCol && record[accountCurrencyCol]) {
                          const potentialCurrency = record[accountCurrencyCol]!.trim().toUpperCase();
                          if (supportedCurrencies.includes(potentialCurrency)) {
                              finalCurrency = potentialCurrency;
                          }
                      }
                      details.currency = finalCurrency;

                     if (details.initialBalance === undefined && initialBalanceCol && record[initialBalanceCol] !== undefined && record[initialBalanceCol] !== '') {
                         const balance = parseAmount(record[initialBalanceCol]);
                         if (!isNaN(balance)) {
                             details.initialBalance = balance;
                             console.log(`Row ${index + 2}: Set initial balance for account "${name}" from '${initialBalanceCol}' column: ${balance} (as fallback).`);
                         } else {
                             console.warn(`Row ${index + 2}: Could not parse initial balance "${record[initialBalanceCol]}" for account "${name}" from balance column.`);
                         }
                     }

                      accountUpdates.set(normalizedName, details); 
                 }
             });
        });

         return accountUpdates;
    }

    // Create or update accounts in localStorage based on the map, get final ID map
    const createOrUpdateAccountsAndGetMap = async (
        csvData: CsvRecord[],
        mappings: ColumnMapping, 
        existingAccountsParam: Account[], 
        isPreviewOnly: boolean = false 
    ): Promise<{ success: boolean; map: { [key: string]: string } }> => {
        let success = true;
        const workingMap = existingAccountsParam.reduce((map, acc) => {
             map[acc.name.toLowerCase().trim()] = acc.id;
             return map;
        }, {} as { [key: string]: string });

        const accountUpdates = await buildAccountUpdateMap(csvData, mappings, existingAccountsParam);

        if (accountUpdates.size === 0 && !isPreviewOnly) {
            console.log("No account updates needed.");
            return { success: true, map: workingMap }; 
        }

        console.log(`Found ${accountUpdates.size} unique accounts in CSV to potentially create or update...`);
        let accountsProcessedCount = 0;

        for (const [normalizedName, accDetails] of accountUpdates.entries()) {
            const existingAccount = existingAccountsParam.find(acc => acc.name.toLowerCase() === normalizedName);
            try {
                if (isPreviewOnly) {
                    if (existingAccount) {
                        workingMap[normalizedName] = existingAccount.id;
                    } else {
                        workingMap[normalizedName] = `preview_create_${normalizedName}`;
                    }
                    continue; 
                }

                if (existingAccount) {
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

                    if (accDetails.initialBalance !== undefined && accDetails.initialBalance !== existingAccount.balance) {
                        console.log(`Updating balance for existing account "${accDetails.name}" from ${existingAccount.balance} to ${accDetails.initialBalance} based on CSV (Opening Entry / Initial Column).`);
                        updatedAccountData.balance = accDetails.initialBalance; 
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        if(updatedAccountData.balance !== existingAccount.balance) { 
                           updatedAccountData.lastActivity = new Date().toISOString();
                        }
                        await updateAccount(updatedAccountData); 
                        accountsProcessedCount++;
                        console.log(`Successfully updated account: ${updatedAccountData.name} (ID: ${updatedAccountData.id})`);
                    } else {
                        console.log(`Account "${accDetails.name}" already exists and is up-to-date.`);
                    }
                    workingMap[normalizedName] = existingAccount.id; 

                } else {
                    const balanceToSet = accDetails.initialBalance ?? 0;
                    console.log(`Attempting to create account "${accDetails.name}" with currency ${accDetails.currency}, type ${accDetails.type}, category ${accDetails.category}, initial balance ${balanceToSet}...`);
                    const newAccountData: NewAccountData = {
                        name: accDetails.name, 
                        type: accDetails.type!, 
                        balance: balanceToSet, 
                        currency: accDetails.currency,
                        providerName: 'Imported', 
                        category: accDetails.category, 
                        isActive: true,
                        lastActivity: new Date().toISOString(), 
                        balanceDifference: 0, 
                    };
                    const createdAccount = await addAccount(newAccountData); 
                    workingMap[normalizedName] = createdAccount.id; 
                    accountsProcessedCount++;
                    console.log(`Successfully created account: ${createdAccount.name} (ID: ${createdAccount.id}) with initial balance ${balanceToSet}`);
                }
            } catch (err: any) {
                console.error(`Failed to process account "${accDetails.name}":`, err);
                toast({ title: "Account Processing Error", description: `Could not process account "${accDetails.name}". Error: ${err.message}`, variant: "destructive", duration: 7000 });
                success = false; 
            }
        }


        if (accountsProcessedCount > 0 && !isPreviewOnly) {
            toast({ title: "Accounts Processed", description: `Created or updated ${accountsProcessedCount} accounts based on CSV data.` });
            try {
                 const latestAccounts = await getAccounts();
                 setAccounts(latestAccounts); 
                 const finalMap = latestAccounts.reduce((map, acc) => {
                     map[acc.name.toLowerCase().trim()] = acc.id;
                     return map;
                 }, {} as { [key: string]: string });
                 console.log("Final account map after creation/updates:", finalMap);
                 return { success, map: finalMap };
            } catch (fetchError) {
                 console.error("Failed to refetch accounts after updates:", fetchError);
                 success = false; 
                 return { success, map: workingMap }; 
            }

        }

        return { success, map: workingMap }; 
    };


   // Adds categories from CSV that don't exist yet
   const addMissingCategories = async (transactions: MappedTransaction[]): Promise<boolean> => {
      const currentCategories = await getCategories(); 
      const existingCategoryNames = new Set(currentCategories.map(cat => cat.name.toLowerCase()));
      const categoriesToAdd = new Set<string>();
      let success = true;

      transactions.forEach(tx => {
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
                  await addCategory(catName); 
                  categoriesAddedCount++;
              } catch (err: any) {
                  if (!err.message?.includes('already exists')) { 
                      console.error(`Failed to add category "${catName}":`, err);
                      toast({ title: "Category Add Error", description: `Could not add category "${catName}". Error: ${err.message}`, variant: "destructive" });
                      success = false; 
                  } else {
                      console.log(`Category "${catName}" likely created concurrently or already existed.`);
                  }
              }
          });

          await Promise.all(addPromises);

          if (categoriesAddedCount > 0) {
            toast({ title: "Categories Added", description: `Added ${categoriesAddedCount} new categories found in CSV.` });
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

    // Adds tags from CSV that don't exist yet
    const addMissingTags = async (transactions: MappedTransaction[]): Promise<boolean> => {
        const currentTags = await getTags(); 
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
                    await addTag(tagName); 
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
      setError(null); 
      let overallError = false;
      let latestAccountsState: Account[] = [...accounts]; 
      let localFinalAccountMap: { [key: string]: string } = {}; 


        console.log("Finalizing account creation/updates before import...");
        try {
            const { success: finalAccountMapSuccess, map: finalMapFromAccountCreation } = await createOrUpdateAccountsAndGetMap(
                rawData, 
                columnMappings, 
                latestAccountsState, 
                false 
            );

            if (!finalAccountMapSuccess) {
                setError("Error finalizing account mapping before import. Check console.");
                setIsLoading(false);
                return;
            }
            localFinalAccountMap = finalMapFromAccountCreation; 
            setFinalAccountMapForImport(finalMapFromAccountCreation); 
            console.log("Using local FINAL account map for import execution:", localFinalAccountMap);

            latestAccountsState = await getAccounts(); 
            setAccounts(latestAccountsState); 

      } catch (finalAccountMapError) {
          console.error("Error during account preparation phase:", finalAccountMapError);
            setError("Critical error during account preparation. Import aborted.");
          toast({
              title: "Import Failed",
              description: "Could not prepare accounts for import.",
              variant: "destructive",
          });
          setIsLoading(false);
          return; 
      }

      console.log("Adding missing categories...");
      const categoriesSuccess = await addMissingCategories(recordsToImport);
      console.log("Adding missing tags...");
      const tagsSuccess = await addMissingTags(recordsToImport);

      if (!categoriesSuccess || !tagsSuccess) {
         setError("Error adding categories or tags. Import halted. Check console.");
         setIsLoading(false);
         return; 
      }

      console.log("Fetching latest categories and tags before import...");
      let currentCategoriesList = await getCategories(); 
      let currentTagsList = await getTags(); 

      const totalToImport = recordsToImport.length;
      let importedCount = 0;
      let errorCount = 0;
      const updatedData = [...parsedData]; 

      console.log(`Starting import of ${totalToImport} pending transactions...`);

      for (let i = 0; i < updatedData.length; i++) {
          const item = updatedData[i];
          const rowNumber = i + 2; 

          if (item.importStatus !== 'pending') {
              if(item.importStatus === 'error') errorCount++;
              continue; 
          }

           if (item.category === 'Opening Balance') {
               console.log(`Row ${rowNumber}: Skipping transaction import for opening balance (already handled).`);
               updatedData[i] = { ...item, importStatus: 'skipped', errorMessage: 'Opening Balance (handled via account balance)' };
               setParsedData([...updatedData]); 
               continue;
           }


          try {
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
                   return foundTag ? foundTag.name : trimmedTagName; 
               }).filter(Boolean) || [];


                if (item.category === 'Transfer' && item.csvSourceAccountNameKey && item.csvDestAccountNameKey) {
                     const sourceId = localFinalAccountMap[item.csvSourceAccountNameKey]; 
                     const destId = localFinalAccountMap[item.csvDestAccountNameKey]; 

                     if (!sourceId) throw new Error(`Transfer Import Error - Row ${rowNumber}: Could not find final source account ID for "${item.csvSourceAccountNameKey}". Map: ${JSON.stringify(localFinalAccountMap)}`);
                     if (!destId) throw new Error(`Transfer Import Error - Row ${rowNumber}: Could not find final destination account ID for "${item.csvDestAccountNameKey}". Map: ${JSON.stringify(localFinalAccountMap)}`);
                     if (sourceId === destId) throw new Error(`Transfer Import Error - Row ${rowNumber}: Source and destination accounts are the same ("${item.csvSourceAccountNameKey}").`);


                     const transferAmount = Math.abs(item.amount); 
                     if (isNaN(transferAmount) || transferAmount <= 0) {
                         throw new Error(`Transfer Import Error - Row ${rowNumber}: Invalid or zero transfer amount (${item.amount}).`);
                     }

                     const transferDate = item.date; 
                     const transferDesc = item.description || `Transfer from ${item.csvSourceAccountNameKey} to ${item.csvDestAccountNameKey}`;
                     const transferTags = finalTags;

                     await addTransaction({
                         accountId: sourceId,
                         date: transferDate,
                         amount: -transferAmount, 
                         description: transferDesc,
                         category: 'Transfer', 
                         tags: transferTags,
                     });
                     await addTransaction({
                         accountId: destId,
                         date: transferDate,
                         amount: transferAmount, 
                         description: transferDesc,
                         category: 'Transfer',
                         tags: transferTags,
                     });
                     console.log(`Row ${rowNumber}: Successfully imported transfer: ${transferDesc}, Amount: ${transferAmount}`);

                 } else if (item.csvAccountNameKey) { // Standard income/expense
                     const accountIdForImport = localFinalAccountMap[item.csvAccountNameKey]; 

                     if (!accountIdForImport) {
                          throw new Error(`Row ${rowNumber}: Could not find final account ID for account name "${item.csvAccountNameKey}". Map: ${JSON.stringify(localFinalAccountMap)}`);
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
                 } else {
                    throw new Error(`Row ${rowNumber}: Transaction is not a transfer and has no primary account key (csvAccountNameKey).`);
                 }


              updatedData[i] = { ...item, importStatus: 'success', errorMessage: undefined };
              importedCount++;
          } catch (err: any) {
              console.error(`Failed to import record (Row ${rowNumber}): "${item.description || 'N/A'}"`, err);
              updatedData[i] = { ...item, importStatus: 'error', errorMessage: err.message || 'Unknown import error' };
              errorCount++;
              overallError = true;
               setImportProgress(calculateProgress(importedCount + errorCount, totalToImport));
          }

          setImportProgress(calculateProgress(importedCount + errorCount, totalToImport));
           setParsedData([...updatedData]);

      }

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
         setError(null); 
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
            localStorage.removeItem('userAccounts');
            localStorage.removeItem('userCategories');
            localStorage.removeItem('userTags');
            clearAllSessionTransactions();

            setAccounts([]);
            setCategories([]);
            setTags([]);
            setParsedData([]);
            setAccountPreviewData([]); 
            setError(null);
            setRawData([]);
            setFile(null); 
            setColumnMappings({});
            setImportProgress(0);
            setFinalAccountMapForImport({}); 

            const fileInput = document.getElementById('csv-file') as HTMLInputElement;
            if (fileInput) fileInput.value = '';


            toast({ title: "Data Cleared", description: "All accounts, categories, tags, and imported transactions have been removed." });
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
        field: 'description' | 'category' | 'tags' | 'amount' | 'date', 
        value: string
    ) => {
        setParsedData(prevData => {
            const newData = [...prevData];
            let transactionToUpdate = { ...newData[index] };

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
                    transactionToUpdate.tags = value.split(',').map(tag => tag.trim()).filter(Boolean);
                    break;
                case 'amount':
                    const parsedAmount = parseFloat(value); 
                    if (!isNaN(parsedAmount)) {
                        transactionToUpdate.amount = parsedAmount;
                    } else {
                        toast({ title: "Invalid Amount", description: "Amount not updated. Please enter a valid number.", variant: "destructive" });
                        return prevData; 
                    }
                    break;
                case 'date':
                     if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) { 
                        transactionToUpdate.date = value;
                    } else if (value) { 
                        try {
                            const d = new Date(value); 
                            if (!isNaN(d.getTime())) {
                                transactionToUpdate.date = format(d, 'yyyy-MM-dd'); 
                            } else {
                                throw new Error("Invalid date object");
                            }
                        } catch {
                            toast({ title: "Invalid Date", description: "Date not updated. Please use YYYY-MM-DD format or select a valid date.", variant: "destructive" });
                            return prevData; 
                        }
                    }
                    else { 
                        toast({ title: "Invalid Date", description: "Date not updated. Please select a valid date.", variant: "destructive" });
                        return prevData;
                    }
                    break;
                default:
                    return prevData; 
            }
            newData[index] = transactionToUpdate;
            return newData;
        });
    };

  const groupedTransactionsForPreview = useMemo(() => {
    if (!parsedData || parsedData.length === 0) return {};
    const grouped: { [accountDisplayName: string]: MappedTransaction[] } = {};

    parsedData.forEach(item => {
        let accountDisplayName = "Unknown / Skipped / Error";
        let accountKeyForGrouping = item.csvAccountNameKey || item.csvSourceAccountNameKey || `error-${item.errorMessage?.substring(0,10)}`;


        if (item.importStatus === 'error' || item.importStatus === 'skipped') {
             accountDisplayName = item.errorMessage?.includes("Opening Balance") 
                ? `Account Creation: ${item.description.split(':').pop()?.trim() || item.csvAccountNameKey || 'N/A'}` 
                : `Errors / Skipped Transactions`;
             accountKeyForGrouping = `system-${item.importStatus}`;
        } else if (item.category === 'Transfer' && item.csvSourceAccountNameKey && item.csvDestAccountNameKey) {
            // For transfers, group them under a generic "Transfers" category for preview,
            // or use a combined key if specific pairing is needed in preview.
            // Here, using the source account for grouping for simplicity in preview.
            const sourceAcc = accounts.find(a => a.name.toLowerCase() === item.csvSourceAccountNameKey) || accountPreviewData.find(ap => ap.name.toLowerCase() === item.csvSourceAccountNameKey);
            accountDisplayName = `Transfer from: ${sourceAcc?.name || item.csvSourceAccountNameKey}`;
            accountKeyForGrouping = item.csvSourceAccountNameKey;

        } else if (item.csvAccountNameKey) {
            const accPreview = accountPreviewData.find(ap => ap.name.toLowerCase() === item.csvAccountNameKey);
            const existingAcc = accounts.find(a => a.name.toLowerCase() === item.csvAccountNameKey);
            accountDisplayName = accPreview?.name || existingAcc?.name || item.csvAccountNameKey;
            accountKeyForGrouping = item.csvAccountNameKey;
        }
        
        const key = accountKeyForGrouping || 'unknown_account_group';
        if (!grouped[key]) {
            grouped[key] = [];
        }
        // Add a temporary display name to the item for the header
        (item as any)._accountDisplayNameForGroup = accountDisplayName;
        grouped[key].push(item);
    });
    return grouped;
  }, [parsedData, finalAccountMapForImport, accountPreviewData, accounts]);


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
                    onSubmit={processAndMapData} 
                    onCancel={() => {
                        setIsMappingDialogOpen(false);
                    }}
                />
            </DialogContent>
        </Dialog>


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


      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Review &amp; Import ({parsedData.filter(i => i.importStatus === 'pending').length} Pending Rows)</CardTitle>
            <CardDescription>Review the mapped transactions. Rows marked 'Error' or 'Skipped' (like Opening Balances) will not be imported. Adjust mappings if needed by clicking "Parse &amp; Map Columns" again with the same file. Click "Import Transactions" above when ready.</CardDescription>
          </CardHeader>
          <CardContent>
           {Object.entries(groupedTransactionsForPreview).map(([accountGroupKey, transactionsInGroup]) => {
                const firstTransactionInGroup = transactionsInGroup[0];
                // Use the temporary display name stored on the item, or derive from key
                const accountDisplayName = (firstTransactionInGroup as any)._accountDisplayNameForGroup || accountGroupKey;
                const isErrorSkippedGroup = accountGroupKey.startsWith('system-');

                return (
                    <div key={accountGroupKey} className="mb-6">
                         <h3 className="text-lg font-semibold mb-2 sticky top-0 bg-background py-1 z-10">
                            {isErrorSkippedGroup ? accountDisplayName : `Account: ${accountDisplayName}`}
                         </h3>
                        <div className="max-h-[400px] overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    {!isErrorSkippedGroup && columnMappings.destination_account && <TableHead>Dest Acc (CSV)</TableHead>}
                                    {!isErrorSkippedGroup && columnMappings.transaction_type && <TableHead>Type (CSV)</TableHead>}
                                    <TableHead>Description</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Tags</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="min-w-[150px]">Message / Info</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {transactionsInGroup.map((item, index) => {
                                    let displayCurrency = '???';
                                    let accountForDisplay;

                                    if (item.csvAccountNameKey) {
                                        accountForDisplay = accounts.find(acc => acc.name.toLowerCase() === item.csvAccountNameKey) || accountPreviewData.find(ap => ap.name.toLowerCase() === item.csvAccountNameKey);
                                    } else if (item.csvSourceAccountNameKey) { // For transfers, use source account currency
                                        accountForDisplay = accounts.find(acc => acc.name.toLowerCase() === item.csvSourceAccountNameKey) || accountPreviewData.find(ap => ap.name.toLowerCase() === item.csvSourceAccountNameKey);
                                    }
                                    
                                    if (accountForDisplay) {
                                        displayCurrency = accountForDisplay.currency;
                                    } else if (columnMappings.accountCurrency && item.originalRecord[columnMappings.accountCurrency!]) {
                                        const potentialCurrency = item.originalRecord[columnMappings.accountCurrency!]!.trim().toUpperCase();
                                        if (supportedCurrencies.includes(potentialCurrency)) {
                                            displayCurrency = potentialCurrency;
                                        }
                                    }

                                    return (
                                        <TableRow key={`${accountGroupKey}-${index}`} className={cn(
                                            "text-xs",
                                            item.importStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
                                            item.importStatus === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                                            item.importStatus === 'skipped' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                                        )}>
                                            <TableCell className="whitespace-nowrap max-w-[120px]">
                                                <Input type="date" value={item.date} onChange={(e) => handleTransactionFieldChange(index, 'date', e.target.value)} className="h-8 text-xs p-1" />
                                            </TableCell>
                                            {!isErrorSkippedGroup && columnMappings.destination_account && <TableCell className="max-w-[150px] truncate" title={item.originalRecord[columnMappings.destination_account!]}>{item.originalRecord[columnMappings.destination_account!]}</TableCell>}
                                            {!isErrorSkippedGroup && columnMappings.transaction_type && <TableCell className="capitalize max-w-[100px] truncate" title={item.originalRecord[columnMappings.transaction_type!]}>{item.originalRecord[columnMappings.transaction_type!]}</TableCell>}
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
                    </div>
                );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

