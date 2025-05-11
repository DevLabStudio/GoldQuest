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
import { format, parseISO, isValid } from 'date-fns';
import { getCurrencySymbol, supportedCurrencies, formatCurrency } from '@/lib/currency'; 
import CsvMappingForm, { type ColumnMapping } from '@/components/import/csv-mapping-form';
import { AlertCircle, Trash2 } from 'lucide-react'; 
import { cn } from '@/lib/utils';

type CsvRecord = {
  [key: string]: string | undefined;
};

const APP_FIELDS_VALUES = [
    'date', 'amount', 
    // 'amount_income', 'amount_expense', // Less common in Firefly CSV, 'amount' is signed
    'description', 
    'source_name', 'destination_name', 'source_type', 'destination_type', // Firefly specific
    'category', 'currency_code', // 'currency_code' is primary for Firefly
    // 'foreign_currency_code', 'foreign_amount', // For later enhancement
    'tags', 'notes', 'transaction_type' // 'transaction_type' is critical for Firefly
] as const;

type AppField = typeof APP_FIELDS_VALUES[number];

type MappedTransaction = {
  // Store raw CSV values for account names to be resolved later
  csvRawSourceName?: string; 
  csvRawDestinationName?: string;
  csvTransactionType?: string; // Raw 'type' from CSV (e.g., Withdrawal, Transfer)
  
  date: string; // Parsed and formatted YYYY-MM-DD
  amount: number; // Parsed amount, sign based on CSV 'type' or original 'amount'
  description: string;
  category: string;
  currency: string; // Parsed currency code
  tags?: string[];
  originalRecord: CsvRecord;
  importStatus: 'pending' | 'success' | 'error' | 'skipped';
  errorMessage?: string;

  // These will be resolved to our app's account IDs during/after account creation
  appSourceAccountId?: string; 
  appDestinationAccountId?: string;
};


interface AccountPreview {
    name: string;
    currency: string;
    initialBalance: number; // Firefly opening balances are explicit
    action: 'create' | 'update' | 'no change'; 
    existingId?: string; 
    category: 'asset' | 'crypto'; // Determine based on name or keep 'asset' default
}


const findColumnName = (headers: string[], targetName: string): string | undefined => {
    // Trim and lowercase both header and target for robust matching
    const normalizedTargetName = targetName.trim().toLowerCase();
    return headers.find(header => header?.trim().toLowerCase() === normalizedTargetName);
};


const parseAmount = (amountStr: string | undefined): number => {
    if (typeof amountStr !== 'string' || amountStr.trim() === '') return NaN;
    let cleaned = amountStr.replace(/[^\d.,-]/g, '').trim();

    const hasPeriod = cleaned.includes('.');
    const hasComma = cleaned.includes(',');

    // Scenario 1: "1.234,56" (German/European style) -> 1234.56
    if (hasComma && hasPeriod && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    // Scenario 2: "1,234.56" (US/UK style) -> 1234.56
    else if (hasComma && hasPeriod && cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
        cleaned = cleaned.replace(/,/g, '');
    }
    // Scenario 3: "1234,56" (Only comma as decimal) -> 1234.56
    else if (hasComma && !hasPeriod) {
        cleaned = cleaned.replace(',', '.');
    }
    // Scenario 4: "1234.56" (Only period as decimal) - no change needed if it's the only one
    // Scenario 5: Multiple commas (e.g. "1,234,567") -> 1234567 (treat as thousands separators)
    else if (cleaned.match(/,/g) && cleaned.match(/,/g)!.length > 1 && !hasPeriod) {
        cleaned = cleaned.replace(/,/g, '');
    }
     // Scenario 6: Multiple periods (e.g. "1.234.567") -> 1234567 (treat as thousands separators if no comma)
    else if (cleaned.match(/\./g) && cleaned.match(/\./g)!.length > 1 && !hasComma) {
         cleaned = cleaned.replace(/\./g, '');
    }

    // If it ends with a decimal separator, append a zero
    if (cleaned.endsWith('.') || cleaned.endsWith(',')) {
        cleaned += '0';
    }
    cleaned = cleaned.replace(/^[,.]+|[,.]+$/g, ''); // Remove any leading/trailing decimal separators

    const parsed = parseFloat(cleaned);
    return parsed;
};


const parseDate = (dateStr: string | undefined): string => {
    if (!dateStr) return format(new Date(), 'yyyy-MM-dd'); // Default to today if no date string
    try {
        // Attempt to parse ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ etc.)
        let parsedDate = parseISO(dateStr);
        if (isValid(parsedDate)) {
            return format(parsedDate, 'yyyy-MM-dd');
        }

        // Try common formats DD/MM/YYYY, MM/DD/YYYY, DD.MM.YYYY, etc.
        const parts = dateStr.split(/[\/\-\.]/);
        if (parts.length === 3) {
            const [p1_str, p2_str, p3_str] = parts;
            let day: number, month: number, year: number;

            const p1 = parseInt(p1_str, 10);
            const p2 = parseInt(p2_str, 10);
            const p3 = parseInt(p3_str, 10);

            // Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
            if (p1 > 0 && p1 <= 31 && p2 > 0 && p2 <= 12 && p3 >= 1900 && p3 < 2100) {
                day = p1; month = p2; year = p3;
                parsedDate = new Date(Date.UTC(year, month - 1, day));
                if (isValid(parsedDate)) return format(parsedDate, 'yyyy-MM-dd');
            }
            // Try MM/DD/YYYY or MM-DD-YYYY or MM.DD.YYYY
            if (p1 > 0 && p1 <= 12 && p2 > 0 && p2 <= 31 && p3 >= 1900 && p3 < 2100) {
                 day = p2; month = p1; year = p3;
                 parsedDate = new Date(Date.UTC(year, month - 1, day));
                 if (isValid(parsedDate)) return format(parsedDate, 'yyyy-MM-dd');
            }
             // Try YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD (less common for input but good to check)
            if (p1 >= 1900 && p1 < 2100 && p2 > 0 && p2 <= 12 && p3 > 0 && p3 <= 31) {
                 day = p3; month = p2; year = p1;
                 parsedDate = new Date(Date.UTC(year, month - 1, day));
                 if (isValid(parsedDate)) return format(parsedDate, 'yyyy-MM-dd');
            }
        }
        
        // Fallback to direct Date constructor if specific parsing fails but might be a valid string for it
        parsedDate = new Date(dateStr);
        if (isValid(parsedDate)) {
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
      setColumnMappings({});
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
         
         // Prioritize Firefly III specific column names
         initialMappings.date = findColumnName(detectedHeaders, 'date');
         initialMappings.amount = findColumnName(detectedHeaders, 'amount');
         initialMappings.description = findColumnName(detectedHeaders, 'description');
         initialMappings.source_name = findColumnName(detectedHeaders, 'source_name');
         initialMappings.destination_name = findColumnName(detectedHeaders, 'destination_name');
         initialMappings.source_type = findColumnName(detectedHeaders, 'source_type');
         initialMappings.destination_type = findColumnName(detectedHeaders, 'destination_type');
         initialMappings.category = findColumnName(detectedHeaders, 'category');
         initialMappings.currency_code = findColumnName(detectedHeaders, 'currency_code') || findColumnName(detectedHeaders, 'currency'); // Common fallback
         initialMappings.tags = findColumnName(detectedHeaders, 'tags');
         initialMappings.notes = findColumnName(detectedHeaders, 'notes');
         initialMappings.transaction_type = findColumnName(detectedHeaders, 'type'); // Firefly's 'type' column

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
        setAccountPreviewData([]); 
        setColumnMappings(confirmedMappings);
        setFinalAccountMapForImport({});

        const requiredFields: AppField[] = ['date', 'amount', 'currency_code', 'transaction_type', 'source_name', 'destination_name'];
        const missingFieldLabels = requiredFields
            .filter(field => !confirmedMappings[field])
            .map(field => APP_FIELDS_VALUES.find(val => val === field) || field);

        if (missingFieldLabels.length > 0) {
            setError(`Missing required column mappings for Firefly III import: ${missingFieldLabels.join(', ')}. Please map these fields.`);
            setIsLoading(false);
            setIsMappingDialogOpen(true); 
            return;
        }
        
        const { preview } = await previewAccountChanges(rawData, confirmedMappings, accounts);
        setAccountPreviewData(preview);

        const { map: tempAccountMap } = await createOrUpdateAccountsAndGetMap(rawData, confirmedMappings, accounts, true);

        const mapped: MappedTransaction[] = rawData.map((record, index) => {
          const rowNumber = index + 2;
          try {
              const csvTypeRaw = record[confirmedMappings.transaction_type!];
              const csvType = csvTypeRaw?.trim().toLowerCase();
              
              const dateValue = record[confirmedMappings.date!];
              const amountValue = record[confirmedMappings.amount!];
              const currencyValue = record[confirmedMappings.currency_code!];
              const descriptionValue = record[confirmedMappings.description!] || '';
              const categoryValue = record[confirmedMappings.category!] || 'Uncategorized';
              const tagsValue = record[confirmedMappings.tags!] || '';
              const notesValue = record[confirmedMappings.notes!] || '';

              const rawSourceName = record[confirmedMappings.source_name!]?.trim();
              const rawDestName = record[confirmedMappings.destination_name!]?.trim();

              if (!dateValue) throw new Error(`Row ${rowNumber}: Missing mapped 'Date' data.`);
              if (amountValue === undefined || amountValue.trim() === '') throw new Error(`Row ${rowNumber}: Missing or empty 'Amount' data.`);
              if (!currencyValue || currencyValue.trim() === '') throw new Error(`Row ${rowNumber}: Missing or empty 'Currency Code' data.`);
              if (!csvType) throw new Error(`Row ${rowNumber}: Missing or empty 'Transaction Type' (Firefly 'type') data.`);
              if (!rawSourceName) throw new Error(`Row ${rowNumber}: Missing or empty 'Source Name' (Firefly 'source_name') data.`);
              if (!rawDestName) throw new Error(`Row ${rowNumber}: Missing or empty 'Destination Name' (Firefly 'destination_name') data.`);

              const parsedAmount = parseAmount(amountValue);
              if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Could not parse amount "${amountValue}".`);

              const parsedDate = parseDate(dateValue);
              const parsedTags = tagsValue.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
              
              let finalDescription = descriptionValue.trim();
              if (notesValue.trim()) {
                  finalDescription = finalDescription ? `${finalDescription} (Notes: ${notesValue.trim()})` : `Notes: ${notesValue.trim()}`;
              }
              if (!finalDescription && csvType === 'withdrawal') finalDescription = rawDestName; // Payee
              if (!finalDescription && csvType === 'deposit') finalDescription = rawSourceName; // Payer
              if (!finalDescription) finalDescription = 'Imported Transaction';


              return {
                  csvRawSourceName: rawSourceName,
                  csvRawDestinationName: rawDestName,
                  csvTransactionType: csvType,
                  date: parsedDate,
                  amount: parsedAmount, // Keep original sign from CSV 'amount' for now
                  description: finalDescription,
                  category: categoryValue.trim(),
                  currency: currencyValue.trim().toUpperCase(),
                  tags: parsedTags,
                  originalRecord: record,
                  importStatus: 'pending',
              };

            } catch (rowError: any) {
                console.error(`Error processing row ${rowNumber} with mappings:`, confirmedMappings, `and record:`, record, `Error:`, rowError);
                 return {
                    date: parseDate(record[confirmedMappings.date!]), 
                    amount: 0, 
                    description: `Error Processing Row ${rowNumber}`,
                    category: 'Uncategorized',
                    currency: record[confirmedMappings.currency_code!]?.trim().toUpperCase() || 'N/A',
                    tags: [],
                    originalRecord: record,
                    importStatus: 'error',
                    errorMessage: rowError.message || 'Failed to process row.',
                 };
            }
        });

        const errorMappedData = mapped.filter(item => item.importStatus === 'error');
        if (errorMappedData.length > 0) {
            setError(`${errorMappedData.length} row(s) had processing errors. Review the tables below.`);
        } else {
            setError(null); 
        }

        setParsedData(mapped);
        setIsLoading(false);
        setIsMappingDialogOpen(false); 
        toast({ title: "Mapping Applied", description: `Previewing ${mapped.filter(m => m.importStatus === 'pending').length} transactions and account changes. Review before importing.` });
   }


    const previewAccountChanges = async (
        csvData: CsvRecord[],
        mappings: ColumnMapping, 
        existingAccountsParam: Account[] 
    ): Promise<{ preview: AccountPreview[] }> => {
        const accountDetailsMap = await buildAccountUpdateMap(csvData, mappings, existingAccountsParam);
        const preview: AccountPreview[] = [];
        const processedAccountNames = new Set<string>();

        accountDetailsMap.forEach((details, normalizedName) => {
            const existingAccount = existingAccountsParam.find(acc => acc.name.toLowerCase() === normalizedName);
            let action: AccountPreview['action'] = 'no change';
            
            if (existingAccount) {
                if (details.currency !== existingAccount.currency || (details.initialBalance !== undefined && details.initialBalance !== existingAccount.balance)) {
                    action = 'update';
                }
                preview.push({
                    name: details.name,
                    currency: details.currency,
                    initialBalance: details.initialBalance !== undefined ? details.initialBalance : existingAccount.balance,
                    action: action,
                    existingId: existingAccount.id,
                    category: existingAccount.category,
                });
            } else {
                preview.push({
                    name: details.name,
                    currency: details.currency,
                    initialBalance: details.initialBalance !== undefined ? details.initialBalance : 0,
                    action: 'create',
                    category: details.category || 'asset', // Default to asset if not determined
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
                    category: acc.category,
                });
            }
        });
        return { preview };
    };


    const buildAccountUpdateMap = async (
        csvData: CsvRecord[],
        mappings: ColumnMapping, 
        existingAccountsParam: Account[] 
    ): Promise<Map<string, { name: string; currency: string; initialBalance?: number; category: 'asset' | 'crypto' }>> => {
        const accountMap = new Map<string, { name: string; currency: string; initialBalance?: number; category: 'asset' | 'crypto' }>();

        const typeCol = mappings.transaction_type!;
        const sourceNameCol = mappings.source_name!;
        const destNameCol = mappings.destination_name!;
        const amountCol = mappings.amount!;
        const currencyCol = mappings.currency_code!;
        const descCol = mappings.description; // For parsing opening balance desc

        for (const record of csvData) {
            const csvType = record[typeCol]?.trim().toLowerCase();
            const recordAmount = parseAmount(record[amountCol]);
            const recordCurrency = record[currencyCol]?.trim().toUpperCase();

            if (csvType === 'opening balance') {
                let accountNameForOpening = record[sourceNameCol]?.trim();
                // Sometimes Firefly puts the account name in description for opening balance
                // e.g., "Initial balance for \"My Account\"" or "Saldo inicial para: My Account"
                const descForOpening = record[descCol]?.trim();
                if (descForOpening) {
                    const match = descForOpening.match(/(?:Initial balance for |Saldo inicial para:)\s*["']?([^"']+?)["']?$/i);
                    if (match && match[1]) {
                        accountNameForOpening = match[1].trim();
                    }
                }

                if (accountNameForOpening && recordCurrency && !isNaN(recordAmount)) {
                    const normalizedName = accountNameForOpening.toLowerCase();
                    const existing = accountMap.get(normalizedName);
                    const category = (accountNameForOpening.toLowerCase().includes('crypto') || accountNameForOpening.toLowerCase().includes('wallet')) ? 'crypto' : 'asset';
                    accountMap.set(normalizedName, {
                        name: accountNameForOpening,
                        currency: recordCurrency,
                        initialBalance: recordAmount, // This is the explicit initial balance
                        category: existing ? existing.category : category,
                    });
                }
            } else if (csvType === 'withdrawal' || csvType === 'deposit' || csvType === 'transfer') {
                const sourceName = record[sourceNameCol]?.trim();
                const destName = record[destNameCol]?.trim();
                const sourceType = record[mappings.source_type!]?.trim().toLowerCase();
                const destType = record[mappings.destination_type!]?.trim().toLowerCase();

                let assetAccountName: string | undefined;
                if (csvType === 'withdrawal') assetAccountName = sourceName;
                else if (csvType === 'deposit' && sourceType !== 'asset account' && destType === 'asset account') assetAccountName = destName; // Money coming into our asset account
                else if (csvType === 'deposit' && sourceType === 'asset account') assetAccountName = destName; // Could be a transfer from another of our asset accounts
                // For transfers, both source_name and destination_name are typically asset accounts
                // We handle them separately to ensure both are created if new.
                
                const accountsToConsider: string[] = [];
                if (sourceName && (csvType === 'transfer' || csvType === 'withdrawal' || (csvType === 'deposit' && sourceType === 'asset account'))) {
                    accountsToConsider.push(sourceName);
                }
                if (destName && (csvType === 'transfer' || (csvType === 'deposit' && destType === 'asset account'))) {
                     accountsToConsider.push(destName);
                }


                for (const accNameToConsider of accountsToConsider) {
                     if (accNameToConsider && recordCurrency) {
                        const normalizedName = accNameToConsider.toLowerCase();
                        if (!accountMap.has(normalizedName)) { // Only add if not already set by an opening balance
                             const existingAppAccount = existingAccountsParam.find(a => a.name.toLowerCase() === normalizedName);
                             const category = (accNameToConsider.toLowerCase().includes('crypto') || accNameToConsider.toLowerCase().includes('wallet')) ? 'crypto' : 'asset';
                             accountMap.set(normalizedName, {
                                name: accNameToConsider,
                                currency: existingAppAccount?.currency || recordCurrency, // Prefer existing if updating, else from CSV
                                initialBalance: existingAppAccount?.balance, // Will be undefined if new, filled by opening balance later if exists
                                category: existingAppAccount?.category || category,
                            });
                        } else { // Account already in map (e.g. from another row or opening balance)
                            // Ensure currency is consistent if possible, prioritize opening balance currency
                            const currentDetails = accountMap.get(normalizedName)!;
                            if (!currentDetails.currency && recordCurrency) currentDetails.currency = recordCurrency;
                            // Don't overwrite initialBalance here if it was set by an opening_balance row
                        }
                    }
                }
            }
        }
        return accountMap;
    }

    const createOrUpdateAccountsAndGetMap = async (
        csvData: CsvRecord[],
        mappings: ColumnMapping, 
        existingAccountsParam: Account[], 
        isPreviewOnly: boolean = false 
    ): Promise<{ success: boolean; map: { [key: string]: string }, updatedAccountsList: Account[] }> => {
        let success = true;
        const workingMap = existingAccountsParam.reduce((map, acc) => {
             map[acc.name.toLowerCase().trim()] = acc.id;
             return map;
        }, {} as { [key: string]: string });

        let currentAppAccounts = [...existingAccountsParam];
        const accountDetailsMap = await buildAccountUpdateMap(csvData, mappings, currentAppAccounts);

        if (accountDetailsMap.size === 0 && !isPreviewOnly) {
            return { success: true, map: workingMap, updatedAccountsList: currentAppAccounts }; 
        }

        let accountsProcessedCount = 0;

        for (const [normalizedName, accDetails] of accountDetailsMap.entries()) {
            const existingAccount = currentAppAccounts.find(acc => acc.name.toLowerCase() === normalizedName);
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
                        updatedAccountData.currency = accDetails.currency;
                        needsUpdate = true;
                    }
                    // Crucially, initialBalance from Firefly 'opening balance' rows dictates the starting point.
                    if (accDetails.initialBalance !== undefined && accDetails.initialBalance !== existingAccount.balance) {
                        updatedAccountData.balance = accDetails.initialBalance; 
                        updatedAccountData.lastActivity = new Date().toISOString(); // Reset activity on balance overwrite
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        await updateAccount(updatedAccountData); 
                        accountsProcessedCount++;
                        // Update in our local list for subsequent operations in this import run
                        const idx = currentAppAccounts.findIndex(a => a.id === updatedAccountData.id);
                        if (idx !== -1) currentAppAccounts[idx] = updatedAccountData;
                    }
                    workingMap[normalizedName] = existingAccount.id; 
                } else {
                    const newAccountData: NewAccountData = {
                        name: accDetails.name, 
                        type: (accDetails.category === 'crypto' ? 'wallet' : 'checking'), // Default type
                        balance: accDetails.initialBalance !== undefined ? accDetails.initialBalance : 0, // Use explicit opening balance or 0
                        currency: accDetails.currency,
                        providerName: 'Imported - ' + accDetails.name, 
                        category: accDetails.category || 'asset', 
                        isActive: true,
                        lastActivity: new Date().toISOString(), 
                        balanceDifference: 0, 
                    };
                    const createdAccount = await addAccount(newAccountData); 
                    workingMap[normalizedName] = createdAccount.id; 
                    currentAppAccounts.push(createdAccount);
                    accountsProcessedCount++;
                }
            } catch (err: any) {
                console.error(`Failed to process account "${accDetails.name}":`, err);
                toast({ title: "Account Processing Error", description: `Could not process account "${accDetails.name}". Error: ${err.message}`, variant: "destructive", duration: 7000 });
                success = false; 
            }
        }

        if (accountsProcessedCount > 0 && !isPreviewOnly) {
            toast({ title: "Accounts Processed", description: `Created or updated ${accountsProcessedCount} accounts.` });
             // No need to refetch from localStorage, currentAppAccounts is the latest state
             setAccounts(currentAppAccounts); 
             // Rebuild the map from the *actually* created/updated accounts
             const finalMap = currentAppAccounts.reduce((map, acc) => {
                 map[acc.name.toLowerCase().trim()] = acc.id;
                 return map;
             }, {} as { [key: string]: string });
             return { success, map: finalMap, updatedAccountsList: currentAppAccounts };
        }
        return { success, map: workingMap, updatedAccountsList: currentAppAccounts }; 
    };


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
                  }
              }
          });
          await Promise.all(addPromises);
          if (categoriesAddedCount > 0) {
            toast({ title: "Categories Added", description: `Added ${categoriesAddedCount} new categories.` });
             try { setCategories(await getCategories()); } catch { console.error("Failed to refetch categories."); }
          }
      }
      return success;
   };

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
                    }
                }
            });
            await Promise.all(addPromises);
             if (tagsAddedCount > 0) {
                toast({ title: "Tags Added", description: `Added ${tagsAddedCount} new tags.` });
                 try { setTags(await getTags()); } catch { console.error("Failed to refetch tags."); }
            }
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
      
      // 1. Finalize Account Creation/Updates and get the definitive map
      const { success: finalAccountMapSuccess, map: finalMap, updatedAccountsList } = await createOrUpdateAccountsAndGetMap(
          rawData, columnMappings, accounts, false 
      );
      if (!finalAccountMapSuccess) {
          setError("Error finalizing accounts before import. Some accounts might not have been created/updated correctly. Import aborted.");
          setIsLoading(false);
          return;
      }
      setAccounts(updatedAccountsList); // Update global accounts state with latest
      setFinalAccountMapForImport(finalMap); // This is the critical map for transaction linking

      // 2. Add Missing Categories and Tags
      const categoriesSuccess = await addMissingCategories(recordsToImport);
      const tagsSuccess = await addMissingTags(recordsToImport);
      if (!categoriesSuccess || !tagsSuccess) {
         setError("Error adding categories or tags. Import halted.");
         setIsLoading(false);
         return; 
      }
      let currentCategoriesList = await getCategories(); 
      let currentTagsList = await getTags(); 

      const totalToImport = recordsToImport.length;
      let importedCount = 0;
      let errorCount = 0;
      const updatedDataForDisplay = [...parsedData]; 

      // 3. Process Transactions
      // Create a new array for actual transaction payloads to avoid modifying balances multiple times
      const transactionPayloads: (Omit<Transaction, 'id'> & { originalMappedTx: MappedTransaction })[] = [];

      for (const item of recordsToImport) {
          const rowNumber = rawData.indexOf(item.originalRecord) + 2;
          if (item.csvTransactionType === 'opening balance') {
              const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === item.originalRecord);
              if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...item, importStatus: 'skipped', errorMessage: 'Opening Balance (handled via account balance)' };
              continue; // Skip creating a transaction for opening balances
          }

          const transactionCategory = currentCategoriesList.find(c => c.name.toLowerCase() === item.category.toLowerCase())?.name || 'Uncategorized';
          const transactionTags = item.tags?.map(tName => currentTagsList.find(t => t.name.toLowerCase() === tName.toLowerCase())?.name || tName).filter(Boolean) || [];

          if (item.csvTransactionType === 'transfer') {
              if (!item.csvRawSourceName || !item.csvRawDestinationName) {
                  const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === item.originalRecord);
                  if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...item, importStatus: 'error', errorMessage: `Row ${rowNumber}: Transfer missing source or destination name.` };
                  errorCount++; overallError = true; continue;
              }
              const sourceAccountId = finalMap[item.csvRawSourceName.toLowerCase()];
              const destAccountId = finalMap[item.csvRawDestinationName.toLowerCase()];

              if (!sourceAccountId || !destAccountId) {
                   const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === item.originalRecord);
                   if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...item, importStatus: 'error', errorMessage: `Row ${rowNumber}: Could not find accounts for transfer: ${item.csvRawSourceName} -> ${item.csvRawDestinationName}. Map: ${JSON.stringify(finalMap)}` };
                  errorCount++; overallError = true; continue;
              }
              if (sourceAccountId === destAccountId) {
                  const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === item.originalRecord);
                   if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...item, importStatus: 'error', errorMessage: `Row ${rowNumber}: Transfer source and destination accounts are the same.` };
                  errorCount++; overallError = true; continue;
              }
              
              const transferAmount = Math.abs(item.amount); // Amount is positive for Firefly 'transfer' type
              if (isNaN(transferAmount) || transferAmount <= 0) {
                   const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === item.originalRecord);
                   if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...item, importStatus: 'error', errorMessage: `Row ${rowNumber}: Invalid or zero transfer amount (${item.amount}).` };
                   errorCount++; overallError = true; continue;
              }

              transactionPayloads.push({
                  accountId: sourceAccountId, date: item.date, amount: -transferAmount,
                  description: item.description, category: 'Transfer', tags: transactionTags,
                  originalMappedTx: item,
              });
              transactionPayloads.push({
                  accountId: destAccountId, date: item.date, amount: transferAmount,
                  description: item.description, category: 'Transfer', tags: transactionTags,
                  originalMappedTx: item, // Both legs point to the same original CSV row
              });

          } else if (item.csvTransactionType === 'withdrawal' || item.csvTransactionType === 'deposit') {
              let accountNameForTx: string | undefined;
              if (item.csvTransactionType === 'withdrawal') {
                  accountNameForTx = item.csvRawSourceName;
              } else { // deposit
                  // Firefly: if source_type is 'Revenue Account', then destination_name is our asset account.
                  // Otherwise, if source_type is 'Asset Account', destination_name is also our asset account (internal transfer treated as deposit by some CSVs)
                  const sourceType = item.originalRecord[columnMappings.source_type!]?.trim().toLowerCase();
                  if (sourceType === 'revenue account' || sourceType === 'loan' || sourceType === 'debt' || !sourceType) { // Treat no type or non-asset as external income
                       accountNameForTx = item.csvRawDestinationName;
                  } else if (sourceType === 'asset account') { // Could be a transfer mislabeled as deposit
                       console.warn(`Row ${rowNumber}: 'deposit' type with 'source_type: asset account'. This might be part of a transfer. Importing to: ${item.csvRawDestinationName}. Source: ${item.csvRawSourceName}`);
                       accountNameForTx = item.csvRawDestinationName; // Target for deposit
                  } else {
                       accountNameForTx = item.csvRawDestinationName; // Default to destination for deposit
                  }
              }

              if (!accountNameForTx) {
                   const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === item.originalRecord);
                   if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...item, importStatus: 'error', errorMessage: `Row ${rowNumber}: Could not determine asset account for ${item.csvTransactionType}.` };
                   errorCount++; overallError = true; continue;
              }

              const accountIdForTx = finalMap[accountNameForTx.toLowerCase()];
              if (!accountIdForTx) {
                   const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === item.originalRecord);
                   if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...item, importStatus: 'error', errorMessage: `Row ${rowNumber}: Could not find account ID for "${accountNameForTx}". Map: ${JSON.stringify(finalMap)}` };
                   errorCount++; overallError = true; continue;
              }
              
              // Amount sign should be correct from Firefly CSV for withdrawal/deposit
              if (isNaN(item.amount)) {
                    const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === item.originalRecord);
                    if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...item, importStatus: 'error', errorMessage: `Row ${rowNumber}: Invalid amount for import.` };
                    errorCount++; overallError = true; continue;
              }
              // Ensure withdrawal is negative, deposit is positive
              let finalAmount = item.amount;
              if(item.csvTransactionType === 'withdrawal' && item.amount > 0) finalAmount = -item.amount;
              if(item.csvTransactionType === 'deposit' && item.amount < 0) finalAmount = -item.amount;


              transactionPayloads.push({
                  accountId: accountIdForTx, date: item.date, amount: finalAmount,
                  description: item.description, category: transactionCategory, tags: transactionTags,
                  originalMappedTx: item,
              });
          } else {
               const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === item.originalRecord);
               if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...item, importStatus: 'error', errorMessage: `Row ${rowNumber}: Unknown Firefly transaction type "${item.csvTransactionType}".` };
               errorCount++; overallError = true;
          }
      }

      // 4. Add all transaction payloads (this updates balances in addTransaction)
      for (const payload of transactionPayloads) {
          const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === payload.originalMappedTx.originalRecord);
          try {
              await addTransaction(payload);
              if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'success', errorMessage: undefined };
              importedCount++;
          } catch (err: any) {
              console.error(`Failed to import transaction for original row:`, payload.originalMappedTx.originalRecord, err);
               if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: err.message || 'Unknown import error' };
              errorCount++;
              overallError = true;
          }
          setImportProgress(calculateProgress(importedCount + errorCount, recordsToImport.length)); // Use recordsToImport.length for total
          setParsedData([...updatedDataForDisplay]); // Update UI incrementally
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
         setError(`Import finished with ${errorCount} errors. Please review the table.`);
      } else {
         setError(null); 
         // Trigger a full data refresh for other components if needed
         window.dispatchEvent(new Event('storage')); 
      }
      // Final refetch of accounts to update UI if balances changed
      setAccounts(await getAccounts());
   };


  const calculateProgress = (processed: number, total: number): number => {
      if (total === 0) return 0;
      return Math.round((processed / total) * 100);
  }

    const handleClearAccounts = async () => {
        setIsClearing(true);
        try {
            localStorage.removeItem('userAccounts');
            localStorage.removeItem('userCategories');
            localStorage.removeItem('userTags');
            clearAllSessionTransactions(); // This clears the in-memory store

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

            toast({ title: "Data Cleared", description: "All accounts, categories, tags, and imported transactions have been removed from this session and local storage." });
            window.dispatchEvent(new Event('storage')); 
        } catch (err) {
            console.error("Failed to clear data:", err);
            toast({ title: "Error", description: "Could not clear stored data.", variant: "destructive" });
        } finally {
            setIsClearing(false);
        }
    };

    const handleTransactionFieldChange = (
        originalIndexInData: number, 
        field: 'description' | 'category' | 'tags' | 'amount' | 'date' | 'currency', 
        value: string
    ) => {
        setParsedData(prevData => {
            const newData = [...prevData];
            let transactionToUpdate = { ...newData[originalIndexInData] };

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
                            } else { throw new Error("Invalid date object"); }
                        } catch {
                            toast({ title: "Invalid Date", description: "Date not updated. Please use YYYY-MM-DD format or select a valid date.", variant: "destructive" });
                            return prevData; 
                        }
                    } else { 
                        toast({ title: "Invalid Date", description: "Date not updated. Please select a valid date.", variant: "destructive" });
                        return prevData;
                    }
                    break;
                case 'currency':
                    if (supportedCurrencies.includes(value.toUpperCase())) {
                        transactionToUpdate.currency = value.toUpperCase();
                    } else {
                        toast({ title: "Invalid Currency", description: `Currency ${value} not supported.`, variant: "destructive"});
                        return prevData;
                    }
                    break;
                default:
                    return prevData; 
            }
            newData[originalIndexInData] = transactionToUpdate;
            return newData;
        });
    };

  const groupedTransactionsForPreview = useMemo(() => {
    if (!parsedData || parsedData.length === 0) return {};
    const grouped: { [accountDisplayName: string]: MappedTransaction[] } = {};

    parsedData.forEach(item => {
        let accountKeyForGrouping = "Unknown / Skipped / Error";
        let accountDisplayName = "Unknown / Skipped / Error";

        if (item.importStatus === 'error' || item.importStatus === 'skipped') {
             accountDisplayName = item.errorMessage?.includes("Opening Balance") 
                ? `Account Balance Update: ${item.description.split(':').pop()?.trim() || item.csvRawSourceName || item.csvRawDestinationName || 'N/A'}` 
                : `Errors / Skipped Transactions`;
             accountKeyForGrouping = `system-${item.importStatus}-${item.errorMessage?.substring(0,20) || 'general'}`;
        } else if (item.csvTransactionType === 'transfer') {
            const sourceAccPreview = accountPreviewData.find(ap => ap.name.toLowerCase() === item.csvRawSourceName?.toLowerCase());
            const destAccPreview = accountPreviewData.find(ap => ap.name.toLowerCase() === item.csvRawDestinationName?.toLowerCase());
            const sourceName = sourceAccPreview?.name || item.csvRawSourceName || 'Unknown Source';
            const destName = destAccPreview?.name || item.csvRawDestinationName || 'Unknown Destination';
            accountDisplayName = `Transfer: ${sourceName} -> ${destName}`;
            accountKeyForGrouping = `transfer-${sourceName}->${destName}`;
        } else if (item.csvTransactionType === 'withdrawal') {
            const accPreview = accountPreviewData.find(ap => ap.name.toLowerCase() === item.csvRawSourceName?.toLowerCase());
            accountDisplayName = accPreview?.name || item.csvRawSourceName || 'Unknown Account';
            accountKeyForGrouping = `account-${accountDisplayName}`;
        } else if (item.csvTransactionType === 'deposit') {
             const accPreview = accountPreviewData.find(ap => ap.name.toLowerCase() === item.csvRawDestinationName?.toLowerCase());
            accountDisplayName = accPreview?.name || item.csvRawDestinationName || 'Unknown Account';
            accountKeyForGrouping = `account-${accountDisplayName}`;
        }
        
        if (!grouped[accountKeyForGrouping]) {
            grouped[accountKeyForGrouping] = [];
        }
        (item as any)._accountDisplayNameForGroup = accountDisplayName; // Temporary for header
        grouped[accountKeyForGrouping].push(item);
    });
    return grouped;
  }, [parsedData, accountPreviewData]);


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Import Data</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Step 1: Upload CSV File</CardTitle>
          <CardDescription>
            Select your CSV file. Firefly III export format is best supported. Map columns carefully in the next step.
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
                {isLoading && !isMappingDialogOpen ? "Parsing..." : "Parse &amp; Map Columns"}
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
                        Match CSV columns (right) to application fields (left). For Firefly III CSVs, ensure 'type', 'amount', 'currency_code', 'date', 'source_name', and 'destination_name' are correctly mapped.
                    </DialogDescription>
                </DialogHeader>
                <CsvMappingForm
                    csvHeaders={csvHeaders}
                    initialMappings={columnMappings}
                    onSubmit={processAndMapData} 
                    onCancel={() => setIsMappingDialogOpen(false)}
                />
            </DialogContent>
        </Dialog>


       {accountPreviewData.length > 0 && !isLoading && (
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Account Changes Preview</CardTitle>
                    <CardDescription>Review accounts to be created or updated. Initial balances are primarily from 'Opening Balance' rows in Firefly III CSVs.</CardDescription>
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
                                            {formatCurrency(acc.initialBalance, acc.currency, undefined, false)}
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
            <CardTitle>Review &amp; Import ({parsedData.filter(i => i.importStatus === 'pending').length} Pending Rows)</CardTitle>
            <CardDescription>Review transactions. Rows marked 'Error' or 'Skipped' (like Opening Balances) won't be imported as transactions. Edit fields if needed. Click "Import Transactions" above when ready.</CardDescription>
          </CardHeader>
          <CardContent>
           {Object.entries(groupedTransactionsForPreview).map(([accountGroupKey, transactionsInGroup]) => {
                const firstTransactionInGroup = transactionsInGroup[0];
                const accountDisplayName = (firstTransactionInGroup as any)._accountDisplayNameForGroup || accountGroupKey;
                const isErrorSkippedGroup = accountGroupKey.startsWith('system-');
                
                return (
                    <div key={accountGroupKey} className="mb-6">
                         <h3 className="text-lg font-semibold mb-2 sticky top-0 bg-background py-1 z-10">
                            {accountDisplayName}
                         </h3>
                        <div className="max-h-[400px] overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>CSV Type</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Tags</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Currency</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="min-w-[150px]">Message / Info</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {transactionsInGroup.map((item, index) => {
                                    const originalIndex = parsedData.findIndex(pItem => pItem.originalRecord === item.originalRecord && pItem.date === item.date && pItem.description === item.description);

                                    return (
                                        <TableRow key={`${accountGroupKey}-${index}-${item.originalRecord?.Date || index}`} className={cn(
                                            "text-xs",
                                            item.importStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
                                            item.importStatus === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                                            item.importStatus === 'skipped' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                                        )}>
                                            <TableCell className="whitespace-nowrap max-w-[120px]">
                                                <Input type="date" value={item.date} onChange={(e) => handleTransactionFieldChange(originalIndex, 'date', e.target.value)} className="h-8 text-xs p-1" />
                                            </TableCell>
                                            <TableCell className="max-w-[100px] truncate" title={item.csvTransactionType}>{item.csvTransactionType}</TableCell>
                                            <TableCell className="max-w-[200px]">
                                                <Input value={item.description || ''} onChange={(e) => handleTransactionFieldChange(originalIndex, 'description', e.target.value)} className="h-8 text-xs p-1" />
                                            </TableCell>
                                            <TableCell className="max-w-[100px]">
                                                <Input value={item.category || ''} onChange={(e) => handleTransactionFieldChange(originalIndex, 'category', e.target.value)} className="h-8 text-xs p-1" />
                                            </TableCell>
                                            <TableCell className="max-w-[150px]">
                                                <Input value={item.tags?.join(', ') || ''} onChange={(e) => handleTransactionFieldChange(originalIndex, 'tags', e.target.value)} placeholder="tag1, tag2" className="h-8 text-xs p-1" />
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap">
                                                <Input type="number" step="0.01" value={item.amount?.toString() || ''} onChange={(e) => handleTransactionFieldChange(originalIndex, 'amount', e.target.value)} className="h-8 text-xs p-1 text-right" />
                                            </TableCell>
                                            <TableCell className="max-w-[80px]">
                                                 <Input value={item.currency || ''} onChange={(e) => handleTransactionFieldChange(originalIndex, 'currency', e.target.value)} className="h-8 text-xs p-1" />
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

