
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
import { addTransaction, type Transaction, clearAllSessionTransactions } from '@/services/transactions';
import { getAccounts, addAccount, type Account, type NewAccountData, updateAccount } from '@/services/account-sync';
import { getCategories, addCategory, type Category } from '@/services/categories';
import { getTags, addTag, type Tag, getTagStyle } from '@/services/tags';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO, isValid, parse as parseDateFns } from 'date-fns';
import { getCurrencySymbol, supportedCurrencies, formatCurrency } from '@/lib/currency';
import CsvMappingForm, { type ColumnMapping } from '@/components/import/csv-mapping-form';
import { AlertCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/contexts/AuthContext';
import Link from 'next/link';

type CsvRecord = {
  [key: string]: string | undefined;
};

const APP_FIELDS_VALUES = [
    'date', 'amount', 'foreign_amount',
    'description',
    'source_name', 'destination_name', 'source_type', 'destination_type',
    'category', 'currency_code', 'foreign_currency_code',
    'tags', 'notes', 'transaction_type'
] as const;

type AppField = typeof APP_FIELDS_VALUES[number];

type MappedTransaction = {
  csvRawSourceName?: string;
  csvRawDestinationName?: string;
  csvTransactionType?: string;

  date: string;
  amount: number;
  description: string;
  category: string;
  currency: string;
  foreignAmount?: number; // Optional and can be undefined
  foreignCurrency?: string;
  tags?: string[];
  originalRecord: CsvRecord;
  importStatus: 'pending' | 'success' | 'error' | 'skipped';
  errorMessage?: string;

  appSourceAccountId?: string;
  appDestinationAccountId?: string;
};


interface AccountPreview {
    name: string;
    currency: string;
    initialBalance: number;
    action: 'create' | 'update' | 'no change';
    existingId?: string;
    category: 'asset' | 'crypto';
}


const findColumnName = (headers: string[], targetName: string): string | undefined => {
    const normalizedTargetName = targetName.trim().toLowerCase();
    return headers.find(header => header?.trim().toLowerCase() === normalizedTargetName);
};


const parseAmount = (amountStr: string | undefined): number => {
    if (typeof amountStr !== 'string' || amountStr.trim() === '') return NaN;
    let cleaned = amountStr.replace(/[^\d.,-]/g, '').trim();

    const hasPeriod = cleaned.includes('.');
    const hasComma = cleaned.includes(',');

    // Standardize decimal separator to '.'
    if (hasComma && hasPeriod) { // e.g., 1.234,56 (European) or 1,234.56 (US)
        if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
            // European style: 1.234,56 -> 1234.56
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            // US style: 1,234.56 -> 1234.56
            cleaned = cleaned.replace(/,/g, '');
        }
    } else if (hasComma) { // e.g., 1234,56
        cleaned = cleaned.replace(',', '.');
    }
    // If only periods exist, assume it's US style, e.g., 1234.56 - no change needed for parseFloat

    // Handle cases like "1.000" or "1,000" (thousand without decimal)
    if (cleaned.match(/\./g) && cleaned.match(/\./g)!.length > 1 && !cleaned.substring(cleaned.lastIndexOf('.') + 1).match(/\d{3}/)) {
         // If multiple periods and last segment is not 3 digits (likely not a decimal part for thousands like .000)
         // Treat as 1.000 -> 1000
        const parts = cleaned.split('.');
        if (parts.length > 1 && parts[parts.length-1].length < 3) { // like 1.234.56
             cleaned = parts.slice(0,-1).join('') + '.' + parts[parts.length-1];
        } else {
             cleaned = cleaned.replace(/\./g, ''); // Fallback: remove all periods if ambiguous
        }
    }


    if (cleaned.endsWith('.') || cleaned.endsWith(',')) {
        cleaned += '0';
    }
    cleaned = cleaned.replace(/^[,.]+|[,.]+$/g, '');


    const parsed = parseFloat(cleaned);
    return parsed;
};


const parseDate = (dateStr: string | undefined): string => {
    if (!dateStr) return format(new Date(), 'yyyy-MM-dd');
    try {
        // Try direct ISO parsing first
        let parsedDate = parseISO(dateStr);
        if (isValid(parsedDate)) {
            return format(parsedDate, 'yyyy-MM-dd');
        }

        // Attempt common formats like DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD etc.
        const commonFormats = [
            'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd',
            'dd.MM.yyyy', 'MM.dd.yyyy',
            'dd-MM-yyyy', 'MM-dd-yyyy',
            'yyyy/MM/dd', 'yyyy/dd/MM',
            // Add with time if present
            "yyyy-MM-dd'T'HH:mm:ssXXX", "yyyy-MM-dd HH:mm:ss",
            "dd/MM/yyyy HH:mm:ss", "MM/dd/yyyy HH:mm:ss",
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss",
        ];

        for (const fmt of commonFormats) {
            try {
                // For formats with explicit time, but input might not have it, just try date part
                const dateOnlyFmt = fmt.split(' ')[0];
                parsedDate = parseDateFns(dateStr, fmt, new Date());
                if (isValid(parsedDate)) return format(parsedDate, 'yyyy-MM-dd');

                if (fmt !== dateOnlyFmt) { // If format had time, try parsing dateStr as date-only
                    parsedDate = parseDateFns(dateStr.split('T')[0].split(' ')[0], dateOnlyFmt, new Date());
                    if (isValid(parsedDate)) return format(parsedDate, 'yyyy-MM-dd');
                }
            } catch { /* ignore parse error for this format, try next */ }
        }

        // Final fallback to Date constructor (less reliable for ambiguous formats)
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
  const { user, isLoadingAuth } = useAuthContext();
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
    if (isLoadingAuth || !user) return;

    let isMounted = true;
    const fetchData = async () => {
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
                setError("Could not load accounts, categories, or tags from database.");
                toast({ title: "Initialization Error", description: "Failed to load data from database.", variant: "destructive" });
            }
        } finally {
            if (isMounted) setIsLoading(false);
        }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [toast, user, isLoadingAuth]);

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
    if (!user) {
      setError("You must be logged in to import data.");
      toast({ title: "Authentication Required", description: "Please log in to import data.", variant: "destructive"});
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
             const criticalError = results.errors.find(e => e.code !== 'TooManyFields' && e.code !== 'TooFewFields') || results.errors[0];
             setError(`CSV Parsing Error: ${criticalError.message}. Code: ${criticalError.code}. Ensure headers are correct and file encoding is UTF-8.`);
             setIsLoading(false);
             return;
         }
          if (results.errors.length > 0) {
              console.warn("Minor CSV parsing errors encountered:", results.errors);
              toast({ title: "CSV Parsing Warning", description: `Some rows might have issues: ${results.errors.map(e=>e.message).slice(0,2).join('; ')}`, variant:"default", duration: 7000});
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

         // Firefly III specific mappings - primary targets
         initialMappings.date = findColumnName(detectedHeaders, 'date');
         initialMappings.amount = findColumnName(detectedHeaders, 'amount');
         initialMappings.description = findColumnName(detectedHeaders, 'description');
         initialMappings.source_name = findColumnName(detectedHeaders, 'source_name');
         initialMappings.destination_name = findColumnName(detectedHeaders, 'destination_name');
         initialMappings.currency_code = findColumnName(detectedHeaders, 'currency_code') || findColumnName(detectedHeaders, 'currency');
         initialMappings.category = findColumnName(detectedHeaders, 'category');
         initialMappings.tags = findColumnName(detectedHeaders, 'tags');
         initialMappings.transaction_type = findColumnName(detectedHeaders, 'type'); // Firefly 'type'
         initialMappings.notes = findColumnName(detectedHeaders, 'notes');

         // Optional Firefly fields
         initialMappings.foreign_amount = findColumnName(detectedHeaders, 'foreign_amount');
         initialMappings.foreign_currency_code = findColumnName(detectedHeaders, 'foreign_currency_code');
         initialMappings.source_type = findColumnName(detectedHeaders, 'source_type');
         initialMappings.destination_type = findColumnName(detectedHeaders, 'destination_type');

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
        setColumnMappings(confirmedMappings); // Save the confirmed mappings
        setFinalAccountMapForImport({});

        // Core required fields for any basic transaction processing
        const coreRequiredFields: AppField[] = ['date', 'amount', 'currency_code', 'transaction_type'];
        let missingFieldLabels = coreRequiredFields
            .filter(field => !confirmedMappings[field])
            .map(field => APP_FIELDS_VALUES.find(val => val === field) || field);

        // Check for source/destination based on if 'transaction_type' is mapped
        // (actual values like 'transfer' will be checked later per row)
        if (confirmedMappings.transaction_type) {
            if (!confirmedMappings.source_name) missingFieldLabels.push('source_name (for withdrawals/transfers)');
            if (!confirmedMappings.destination_name) missingFieldLabels.push('destination_name (for deposits/transfers)');
        } else {
            // If transaction_type itself is not mapped, it's a critical missing piece
            missingFieldLabels.push('transaction_type (e.g., Firefly \'type\')');
        }
        
        missingFieldLabels = [...new Set(missingFieldLabels)]; // Remove duplicates

        if (missingFieldLabels.length > 0) {
            setError(`Missing required column mappings for import: ${missingFieldLabels.join(', ')}. Please map these fields.`);
            setIsLoading(false);
            setIsMappingDialogOpen(true); // Re-open mapping dialog
            return;
        }
        
        // Fetch current accounts from the database
        const currentAccounts = await getAccounts();
        setAccounts(currentAccounts); // Update local state if needed elsewhere

        // Preview account changes based on the CSV data and mappings
        const { preview } = await previewAccountChanges(rawData, confirmedMappings, currentAccounts);
        setAccountPreviewData(preview);


        const mapped: MappedTransaction[] = rawData.map((record, index) => {
          const rowNumber = index + 2; // CSV row number (PapaParse is 0-indexed for data, +1 for header, +1 for 1-based display)
          
          // Get column names from mappings, ensuring they are defined
          const dateCol = confirmedMappings.date!;
          const amountCol = confirmedMappings.amount!;
          const currencyCol = confirmedMappings.currency_code!;
          const descCol = confirmedMappings.description;
          const categoryCol = confirmedMappings.category;
          const tagsCol = confirmedMappings.tags;
          const notesCol = confirmedMappings.notes;
          const typeCol = confirmedMappings.transaction_type!; // Crucial 'type' column from Firefly
          const sourceNameCol = confirmedMappings.source_name;
          const destNameCol = confirmedMappings.destination_name;
          const foreignAmountCol = confirmedMappings.foreign_amount;
          const foreignCurrencyCol = confirmedMappings.foreign_currency_code;


          try {
              // Get raw values from the record using mapped column names
              const csvTypeRaw = record[typeCol];
              const csvType = csvTypeRaw?.trim().toLowerCase();

              const dateValue = record[dateCol];
              const amountValue = record[amountCol];
              const currencyValue = record[currencyCol];
              const foreignAmountValue = foreignAmountCol ? record[foreignAmountCol] : undefined;
              const foreignCurrencyValue = foreignCurrencyCol ? record[foreignCurrencyCol] : undefined;


              const descriptionValue = descCol ? record[descCol] || '' : '';
              const categoryValue = categoryCol ? record[categoryCol] || 'Uncategorized' : 'Uncategorized';
              const tagsValue = tagsCol ? record[tagsCol] || '' : '';
              const notesValue = notesCol ? record[notesCol] || '' : '';

              const rawSourceName = sourceNameCol ? record[sourceNameCol]?.trim() : undefined;
              const rawDestName = destNameCol ? record[destNameCol]?.trim() : undefined;

              // Basic validation for essential fields
              if (!dateValue) throw new Error(`Row ${rowNumber}: Missing mapped 'Date' data.`);
              if (amountValue === undefined || amountValue.trim() === '') throw new Error(`Row ${rowNumber}: Missing or empty 'Amount' data.`);
              if (!currencyValue || currencyValue.trim() === '') throw new Error(`Row ${rowNumber}: Missing or empty 'Currency Code' data.`);
              if (!csvType) throw new Error(`Row ${rowNumber}: Missing or empty 'Transaction Type' (Firefly 'type') data.`);
              
              // Firefly III specific logic for source/destination based on type
              if (csvType === 'withdrawal' || csvType === 'transfer') {
                if (!rawSourceName) throw new Error(`Row ${rowNumber}: Missing 'Source Name' for type '${csvType}'. Source name column mapped to: '${sourceNameCol}', value: '${record[sourceNameCol!]}'.`);
              }
              if (csvType === 'deposit' || csvType === 'transfer') {
                 if (!rawDestName) throw new Error(`Row ${rowNumber}: Missing 'Destination Name' for type '${csvType}'. Destination name column mapped to: '${destNameCol}', value: '${record[destNameCol!]}'.`);
              }
              if (csvType === 'transfer' && rawSourceName === rawDestName) {
                  throw new Error(`Row ${rowNumber}: Transfer source and destination accounts are the same ('${rawSourceName}'). This is not allowed.`);
              }


              const parsedAmount = parseAmount(amountValue);
              if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Could not parse amount "${amountValue}".`);

              const parsedForeignAmountRaw = foreignAmountValue ? parseAmount(foreignAmountValue) : undefined;
              const parsedForeignAmount = Number.isNaN(parsedForeignAmountRaw) ? undefined : parsedForeignAmountRaw;

              const parsedForeignCurrency = foreignCurrencyValue?.trim().toUpperCase();

              const parsedDate = parseDate(dateValue);
              const parsedTags = tagsValue.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

              // Construct description
              let finalDescription = descriptionValue.trim();
              if (notesValue.trim()) {
                  finalDescription = finalDescription ? `${finalDescription} (Notes: ${notesValue.trim()})` : `Notes: ${notesValue.trim()}`;
              }
              // Firefly specific description logic:
              if (!finalDescription && csvType === 'withdrawal' && rawDestName) finalDescription = rawDestName; // If withdrawal and no desc, use destination name
              if (!finalDescription && csvType === 'deposit' && rawSourceName) finalDescription = rawSourceName;   // If deposit and no desc, use source name
              if (!finalDescription) finalDescription = 'Imported Transaction';


              return {
                  csvRawSourceName: rawSourceName,
                  csvRawDestinationName: rawDestName,
                  csvTransactionType: csvType, // Store the crucial Firefly 'type'
                  date: parsedDate,
                  amount: parsedAmount, // This amount is now signed based on Firefly logic
                  currency: currencyValue.trim().toUpperCase(),
                  foreignAmount: parsedForeignAmount,
                  foreignCurrency: parsedForeignCurrency,
                  description: finalDescription,
                  category: categoryValue.trim(),
                  tags: parsedTags,
                  originalRecord: record, // Keep original for reference if needed
                  importStatus: 'pending',
              };

            } catch (rowError: any) {
                console.error(`Error processing row ${index + 2} with mappings:`, JSON.stringify(confirmedMappings), `and record:`, JSON.stringify(record), `Error:`, rowError);
                 return {
                    // accountId: `error_row_${index}`,
                    date: parseDate(record[dateCol]), // Attempt to parse date even on error
                    amount: 0, // Default amount on error
                    currency: record[currencyCol!]?.trim().toUpperCase() || 'N/A',
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
        if (errorMappedData.length > 0) {
            setError(`${errorMappedData.length} row(s) had processing errors. Review the tables below.`);
        } else {
            setError(null); // Clear previous errors if all good now
        }

        setParsedData(mapped);
        setIsLoading(false);
        setIsMappingDialogOpen(false); // Close mapping dialog after processing
        toast({ title: "Mapping Applied", description: `Previewing ${mapped.filter(m => m.importStatus === 'pending').length} transactions and account changes. Review before importing.` });
   }


    const previewAccountChanges = async (
        csvData: CsvRecord[],
        mappings: ColumnMapping,
        existingAccountsParam: Account[] // Pass current app accounts
    ): Promise<{ preview: AccountPreview[] }> => {
        // This map will store details for accounts found in the CSV
        const accountDetailsMap = await buildAccountUpdateMap(csvData, mappings, existingAccountsParam);
        
        const preview: AccountPreview[] = [];
        const processedAccountNames = new Set<string>(); // To track accounts already added to preview from CSV

        // Iterate over accounts identified from CSV (via accountDetailsMap)
        accountDetailsMap.forEach((details, normalizedName) => {
            const existingAccount = existingAccountsParam.find(acc => acc.name.toLowerCase() === normalizedName);
            let action: AccountPreview['action'] = 'no change';

            if (existingAccount) {
                // Account exists, check if it needs update (e.g., currency change, or initial balance override if CSV implies)
                if (details.currency !== existingAccount.currency || (details.initialBalance !== undefined && details.initialBalance !== existingAccount.balance)) {
                    action = 'update';
                }
                preview.push({
                    name: details.name, // Use the name from CSV details (original casing)
                    currency: details.currency,
                    initialBalance: details.initialBalance !== undefined ? details.initialBalance : existingAccount.balance, // Prefer CSV balance if specified
                    action: action,
                    existingId: existingAccount.id,
                    category: existingAccount.category, // Keep existing category
                });
            } else {
                // Account does not exist, will be created
                preview.push({
                    name: details.name,
                    currency: details.currency,
                    initialBalance: details.initialBalance !== undefined ? details.initialBalance : 0, // Default to 0 if not in CSV
                    action: 'create',
                    category: details.category || 'asset', // Default category for new accounts
                });
            }
            processedAccountNames.add(normalizedName);
        });

        // Add existing accounts from app that were NOT in the CSV account map (to show they are unchanged)
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


    // This function builds a map of account details from the CSV.
    // It prioritizes 'opening balance' rows for initial balances.
    const buildAccountUpdateMap = async (
        csvData: CsvRecord[],
        mappingsArg: ColumnMapping, // Use mappings passed as argument
        existingAccountsParam: Account[]
    ): Promise<Map<string, { name: string; currency: string; initialBalance?: number; category: 'asset' | 'crypto' }>> => {
        const accountMap = new Map<string, { name: string; currency: string; initialBalance?: number; category: 'asset' | 'crypto' }>();

        // Get mapped column names
        const typeCol = mappingsArg.transaction_type!;
        const sourceNameCol = mappingsArg.source_name;
        const destNameCol = mappingsArg.destination_name;
        const amountCol = mappingsArg.amount!;
        const currencyCol = mappingsArg.currency_code!;
        const descCol = mappingsArg.description;
        const sourceTypeCol = mappingsArg.source_type; // e.g., 'Asset account', 'Revenue account'
        const destTypeCol = mappingsArg.destination_type; // e.g., 'Asset account', 'Expense account'


        for (const record of csvData) {
            const csvType = record[typeCol]?.trim().toLowerCase();
            let recordAmount = parseAmount(record[amountCol]); // This is Firefly's signed amount
            const recordCurrency = record[currencyCol!]?.trim().toUpperCase();

            if (csvType === 'opening balance') {
                // Firefly III 'opening balance' often has description like "Initial balance for "Account Name""
                // The 'source_name' might be the account name, or 'destination_name' might hold it.
                // The 'amount' is the opening balance.
                let accountNameForOpening: string | undefined;
                const rawSourceName = sourceNameCol ? record[sourceNameCol]?.trim() : undefined;
                const rawDestName = destNameCol ? record[destNameCol]?.trim() : undefined;
                const rawDescription = descCol ? record[descCol]?.trim() : undefined;

                // Try to extract account name from Firefly's typical "opening balance" patterns
                const parseNameFromDescriptiveString = (text: string | undefined): string | undefined => {
                    if (!text) return undefined;
                    // Regex to capture account name from "Initial balance for 'Account Name'" or "Saldo inicial para "Conta X""
                    const match = text.match(/(?:Initial balance for |Saldo inicial para(?: a)?)\s*["']?([^"':]+)["']?/i);
                    return match ? match[1]?.trim() : undefined;
                };

                // Firefly logic: For 'opening balance', destination_name usually holds the actual account name
                if (rawDestName && !(rawDestName.toLowerCase().startsWith('initial balance for') || rawDestName.toLowerCase().startsWith('saldo inicial para'))) {
                    accountNameForOpening = rawDestName;
                }
                // If destName was like "Initial balance for...", try parsing from it.
                else if (rawDestName) {
                    const parsedFromDest = parseNameFromDescriptiveString(rawDestName);
                    if (parsedFromDest) accountNameForOpening = parsedFromDest;
                }

                // Fallback: try description
                if (!accountNameForOpening && rawDescription) {
                    const parsedFromDesc = parseNameFromDescriptiveString(rawDescription);
                    if (parsedFromDesc) accountNameForOpening = parsedFromDesc;
                }

                // Fallback: try source_name (less common for Firefly opening balances for the *asset* account name)
                if (!accountNameForOpening && rawSourceName) {
                     const parsedFromSource = parseNameFromDescriptiveString(rawSourceName);
                     if (parsedFromSource) {
                        accountNameForOpening = parsedFromSource;
                     } else if (!rawSourceName.toLowerCase().startsWith('initial balance for') && !rawSourceName.toLowerCase().startsWith('saldo inicial para')) {
                        // If source_name doesn't fit pattern, but isn't "Initial balance for...", it *might* be the account name
                        accountNameForOpening = rawSourceName;
                     }
                }


                if (accountNameForOpening && recordCurrency && !isNaN(recordAmount)) {
                    const normalizedName = accountNameForOpening.toLowerCase();
                    const existingDetailsInMap = accountMap.get(normalizedName);
                    // Basic category detection (can be improved)
                    const category = (accountNameForOpening.toLowerCase().includes('crypto') || accountNameForOpening.toLowerCase().includes('wallet')) ? 'crypto' : 'asset';

                    accountMap.set(normalizedName, {
                        name: accountNameForOpening, // Store original casing
                        currency: recordCurrency,
                        initialBalance: recordAmount, // Firefly amount for opening balance is the balance itself
                        category: existingDetailsInMap ? existingDetailsInMap.category : category, // Preserve if already set, else detect
                    });
                } else if (csvType === 'opening balance') {
                     console.warn(`Could not process 'opening balance' row due to missing/invalid name, currency, or amount. Row:`, record, `Parsed Amount: ${recordAmount}`, `Currency: ${recordCurrency}`, `Derived Name Attempts: ${rawSourceName}, ${rawDestName}, ${rawDescription}`);
                }

            } else if (csvType === 'withdrawal' || csvType === 'deposit' || csvType === 'transfer') {
                // For regular transactions, identify involved *asset* accounts.
                // Firefly uses source_type/destination_type like "Asset account", "Revenue account", "Expense account"
                const sourceName = sourceNameCol ? record[sourceNameCol]?.trim() : undefined;
                const destName = destNameCol ? record[destNameCol]?.trim() : undefined;
                const sourceType = sourceTypeCol ? record[sourceTypeCol]?.trim().toLowerCase() : undefined;
                const destType = destTypeCol ? record[destTypeCol]?.trim().toLowerCase() : undefined;


                const accountsToConsider: string[] = [];
                // An 'asset account' is one we manage balance for.
                // Revenue/Expense accounts are external entities in Firefly's model.
                if (sourceName && (sourceType === 'asset account' || sourceType === 'default asset account' || (csvType === 'withdrawal' || csvType === 'transfer'))) {
                     // If source is an asset account, it's one of ours.
                     accountsToConsider.push(sourceName);
                }
                if (destName && (destType === 'asset account' || destType === 'default asset account' || (csvType === 'deposit' || csvType === 'transfer'))) {
                     // If destination is an asset account, it's one of ours.
                     accountsToConsider.push(destName);
                }


                for (const accNameToConsider of [...new Set(accountsToConsider)]) { // Use Set to avoid duplicates if source=dest (though transfers block this)
                     if (accNameToConsider && recordCurrency) { // Ensure name and currency from row are present
                        const normalizedName = accNameToConsider.toLowerCase();
                        if (!accountMap.has(normalizedName)) {
                             // If not already in our map from an 'opening balance' row, add it.
                             // Try to find if it's an existing account in the app to get its true currency.
                             const existingAppAccount = existingAccountsParam.find(a => a.name.toLowerCase() === normalizedName);
                             const category = (accNameToConsider.toLowerCase().includes('crypto') || accNameToConsider.toLowerCase().includes('wallet')) ? 'crypto' : 'asset';
                             accountMap.set(normalizedName, {
                                name: accNameToConsider, // Store original casing
                                currency: existingAppAccount?.currency || recordCurrency, // Prefer existing app account's currency, else from CSV row
                                initialBalance: existingAppAccount?.balance, // If existing, use its balance (opening balance rows should override this later if present)
                                category: existingAppAccount?.category || category, // Prefer existing, else detect
                            });
                        } else {
                            // If already in map (e.g. from opening balance), ensure currency is set if it wasn't.
                            const currentDetails = accountMap.get(normalizedName)!;
                            if (!currentDetails.currency && recordCurrency) currentDetails.currency = recordCurrency;
                            // Don't overwrite initialBalance here if set by 'opening balance'
                        }
                    }
                }
            }
        }
        return accountMap;
    }

    // This function will now use the `accountPreviewData` which is derived from `buildAccountUpdateMap`
    const createOrUpdateAccountsAndGetMap = async (
        isPreviewOnly: boolean = false
    ): Promise<{ success: boolean; map: { [key: string]: string }, updatedAccountsList: Account[] }> => {
        let success = true;
        let currentAppAccounts = [...accounts]; // Start with accounts currently in app state
        // This map will store the final mapping from (lowercase) account names to their app IDs.
        const workingMap = currentAppAccounts.reduce((map, acc) => {
             map[acc.name.toLowerCase().trim()] = acc.id;
             return map;
        }, {} as { [key: string]: string });


        // Use the `accountPreviewData` which has already determined actions (create/update/no change)
        // `accountPreviewData` is generated by `previewAccountChanges` which uses `buildAccountUpdateMap`
        if (accountPreviewData.length === 0 && !isPreviewOnly) { // If no preview data, nothing to do for accounts.
            return { success: true, map: workingMap, updatedAccountsList: currentAppAccounts };
        }

        let accountsProcessedCount = 0;

        for (const accPreview of accountPreviewData) {
            const normalizedName = accPreview.name.toLowerCase();
            try {
                if (isPreviewOnly) { // If only previewing, populate map with existing or placeholder IDs
                    if (accPreview.existingId) {
                        workingMap[normalizedName] = accPreview.existingId;
                    } else if (accPreview.action === 'create') {
                        // For preview, use a temporary ID format if account is to be created
                        workingMap[normalizedName] = `preview_create_${normalizedName.replace(/\s+/g, '_')}`;
                    }
                    continue; // Skip actual DB operations in preview mode
                }

                // --- Actual DB Operations (Not previewOnly) ---
                if (accPreview.action === 'create') {
                    const newAccountData: NewAccountData = {
                        name: accPreview.name, // Use original casing from preview
                        type: (accPreview.category === 'crypto' ? 'wallet' : 'checking'), // Example default type
                        balance: accPreview.initialBalance,
                        currency: accPreview.currency,
                        providerName: 'Imported - ' + accPreview.name,
                        category: accPreview.category,
                        isActive: true,
                        lastActivity: new Date().toISOString(),
                        balanceDifference: 0,
                    };
                    const createdAccount = await addAccount(newAccountData);
                    workingMap[normalizedName] = createdAccount.id; // Map name to newly created ID
                    currentAppAccounts.push(createdAccount); // Add to our working list of app accounts
                    accountsProcessedCount++;
                } else if (accPreview.action === 'update' && accPreview.existingId) {
                    const existingAccountForUpdate = currentAppAccounts.find(a => a.id === accPreview.existingId);
                    if (existingAccountForUpdate) {
                        const updatedAccountData: Account = {
                            ...existingAccountForUpdate,
                            balance: accPreview.initialBalance, // Update balance from preview
                            currency: accPreview.currency,     // Update currency from preview
                            lastActivity: new Date().toISOString(),
                            // other fields like name, type, providerName could be updated if preview logic determines
                        };
                        const savedUpdatedAccount = await updateAccount(updatedAccountData);
                        accountsProcessedCount++;
                        const idx = currentAppAccounts.findIndex(a => a.id === savedUpdatedAccount.id);
                        if (idx !== -1) currentAppAccounts[idx] = savedUpdatedAccount;
                        workingMap[normalizedName] = savedUpdatedAccount.id; // Ensure map has the correct ID
                    }
                } else if (accPreview.existingId) { // 'no change' but ensure it's in the map
                     workingMap[normalizedName] = accPreview.existingId;
                }

            } catch (err: any) {
                console.error(`Failed to process account "${accPreview.name}":`, err);
                toast({ title: "Account Processing Error", description: `Could not process account "${accPreview.name}". Error: ${err.message}`, variant: "destructive", duration: 7000 });
                success = false; // Mark overall success as false if any account fails
            }
        }

        if (accountsProcessedCount > 0 && !isPreviewOnly) {
            toast({ title: "Accounts Processed", description: `Created or updated ${accountsProcessedCount} accounts based on CSV data.` });
             // Refetch all accounts from DB to have the most current list and IDs
             const finalFetchedAccounts = await getAccounts();
             setAccounts(finalFetchedAccounts); // Update main accounts state
             // Rebuild the final map based on the very latest account list from DB
             const finalMap = finalFetchedAccounts.reduce((map, acc) => {
                 map[acc.name.toLowerCase().trim()] = acc.id;
                 return map;
             }, {} as { [key: string]: string });
             return { success, map: finalMap, updatedAccountsList: finalFetchedAccounts };
        }

        // If no accounts were processed (e.g. all 'no change' or only preview)
        return { success, map: workingMap, updatedAccountsList: currentAppAccounts };
    };


   const addMissingCategoriesAndTags = async (transactionsToProcess: MappedTransaction[]): Promise<boolean> => {
      // Fetch the latest lists from DB *before* adding new ones
      const currentCategoriesList = await getCategories();
      const existingCategoryNames = new Set(currentCategoriesList.map(cat => cat.name.toLowerCase()));
      const categoriesToAdd = new Set<string>();

      const currentTagsList = await getTags();
      const existingTagNames = new Set(currentTagsList.map(tag => tag.name.toLowerCase()));
      const tagsToAdd = new Set<string>();

      let success = true;

      transactionsToProcess.forEach(tx => {
          if (tx.importStatus === 'pending') { // Only consider pending transactions
              // Category handling
              if (tx.category && !['Uncategorized', 'Initial Balance', 'Transfer', 'Skipped', 'Opening Balance'].includes(tx.category)) { // Firefly specific: 'Opening Balance' is not a user category
                  const categoryName = tx.category.trim();
                  if (categoryName && !existingCategoryNames.has(categoryName.toLowerCase())) {
                      categoriesToAdd.add(categoryName);
                  }
              }
              // Tags handling
              if (tx.tags && tx.tags.length > 0) {
                tx.tags.forEach(tagName => {
                    const trimmedTag = tagName.trim();
                    if (trimmedTag && !existingTagNames.has(trimmedTag.toLowerCase())) {
                        tagsToAdd.add(trimmedTag);
                    }
                });
              }
          }
      });

      if (categoriesToAdd.size > 0) {
          let categoriesAddedCount = 0;
          const addCatPromises = Array.from(categoriesToAdd).map(async (catName) => {
              try {
                  await addCategory(catName); // This now saves to Firebase
                  categoriesAddedCount++;
              } catch (err: any) {
                  // Check if error is because category already exists (e.g. race condition or slight name variation)
                  if (!err.message?.includes('already exists')) {
                      console.error(`Failed to add category "${catName}":`, err);
                      toast({ title: "Category Add Error", description: `Could not add category "${catName}". Error: ${err.message}`, variant: "destructive" });
                      success = false; // Mark as not fully successful
                  }
              }
          });
          await Promise.all(addCatPromises);
          if (categoriesAddedCount > 0) {
            toast({ title: "Categories Added", description: `Added ${categoriesAddedCount} new categories.` });
             try { setCategories(await getCategories()); } catch { console.error("Failed to refetch categories."); } // Refresh local state
          }
      }

      if (tagsToAdd.size > 0) {
            let tagsAddedCount = 0;
            const addTagPromises = Array.from(tagsToAdd).map(async (tagName) => {
                try {
                    await addTag(tagName); // This now saves to Firebase
                    tagsAddedCount++;
                } catch (err: any) {
                     if (!err.message?.includes('already exists')) {
                        console.error(`Failed to add tag "${tagName}":`, err);
                        toast({ title: "Tag Add Error", description: `Could not add tag "${tagName}". Error: ${err.message}`, variant: "destructive" });
                        success = false;
                    }
                }
            });
            await Promise.all(addTagPromises);
             if (tagsAddedCount > 0) {
                toast({ title: "Tags Added", description: `Added ${tagsAddedCount} new tags.` });
                 try { setTags(await getTags()); } catch { console.error("Failed to refetch tags."); } // Refresh local state
            }
        }
      return success;
   };


   const handleImport = async () => {
      if (!user) { // Ensure user is authenticated
        toast({ title: "Authentication Required", description: "Please log in to import.", variant: "destructive" });
        return;
      }
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

      // Step 1: Finalize accounts (create/update based on preview) and get the definitive name-to-ID map
      let finalMapForTxImport: { [key: string]: string };
      let latestAccountsList: Account[]; // To get the most up-to-date account objects
      try {
        // `createOrUpdateAccountsAndGetMap(false)` will perform actual DB operations
        const accountMapResult = await createOrUpdateAccountsAndGetMap(false);
        if (!accountMapResult.success) {
            // If account processing failed, it's risky to proceed with transactions
            setError("Error finalizing accounts before import. Some accounts might not have been created/updated correctly. Import aborted.");
            setIsLoading(false);
            return;
        }
        finalMapForTxImport = accountMapResult.map;
        latestAccountsList = accountMapResult.updatedAccountsList; // Use this for consistent data
        setAccounts(latestAccountsList); // Update component state if needed elsewhere
        setFinalAccountMapForImport(finalMapForTxImport); // Store for display/retry logic
      } catch (finalAccountMapError) {
          console.error("Critical error during account finalization before import.", finalAccountMapError);
          toast({ title: "Account Sync Error", description: "Could not synchronize accounts with the database before starting transaction import. Please try again.", variant: "destructive"});
          setIsLoading(false);
          return;
      }


      // Step 2: Add any missing categories or tags found in the CSV data
      const metadataSuccess = await addMissingCategoriesAndTags(recordsToImport);
      if (!metadataSuccess) {
         // User already toasted about specific category/tag errors, so just halt.
         setError("Error adding new categories or tags from CSV. Import halted to ensure data integrity.");
         setIsLoading(false);
         return;
      }
      // Refresh local categories/tags state after potential additions
      const currentCategoriesList = await getCategories();
      const currentTagsList = await getTags();

      // Prepare transaction payloads
      const totalToImport = recordsToImport.length;
      let importedCount = 0;
      let errorCount = 0;
      const updatedDataForDisplay = [...parsedData]; // For updating UI status per row

      // Batch transactions for Firebase if possible, or process sequentially
      // For simplicity here, processing sequentially with UI updates
      const transactionPayloads: (Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { originalMappedTx: MappedTransaction })[] = [];


      // ----- Construct Payloads -----
      for (const item of recordsToImport) {
          const rowNumber = rawData.indexOf(item.originalRecord) + 2; // For error messages
          const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === item.originalRecord && d.description === item.description && d.amount === item.amount && d.date === item.date);


          // Skip 'opening balance' rows for transaction creation as they are handled by account balance updates
          if (item.csvTransactionType === 'opening balance') {
              if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'skipped', errorMessage: 'Opening Balance (handled via account balance)' };
              continue; // Move to next item
          }

          // Resolve category and tags against current app data
          const transactionCategory = currentCategoriesList.find(c => c.name.toLowerCase() === item.category.toLowerCase())?.name || 'Uncategorized';
          const transactionTags = item.tags?.map(tName => currentTagsList.find(t => t.name.toLowerCase() === tName.toLowerCase())?.name || tName).filter(Boolean) || [];

          // Handle different Firefly transaction types
          if (item.csvTransactionType === 'transfer') {
              if (!item.csvRawSourceName || !item.csvRawDestinationName) {
                   if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Transfer missing source or destination name.` };
                  errorCount++; overallError = true; continue;
              }
              const sourceAccountId = finalMapForTxImport[item.csvRawSourceName.toLowerCase()];
              const destAccountId = finalMapForTxImport[item.csvRawDestinationName.toLowerCase()];

              if (!sourceAccountId || !destAccountId) {
                   if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Could not find accounts for transfer: ${item.csvRawSourceName} -> ${item.csvRawDestinationName}. Mapped IDs: Source='${sourceAccountId}', Dest='${destAccountId}'. Review account mapping.` };
                  errorCount++; overallError = true; continue;
              }
              if (sourceAccountId === destAccountId) { // Should have been caught earlier, but double check
                   if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Transfer source and destination accounts are the same.` };
                  errorCount++; overallError = true; continue;
              }

              // Get actual account objects to verify currencies if needed for foreign exchange logic
              const sourceAccount = latestAccountsList.find(a => a.id === sourceAccountId);
              const destAccount = latestAccountsList.find(a => a.id === destAccountId);
              if (!sourceAccount || !destAccount) {
                if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Source or Destination account object not found after ID mapping. This is an internal error.` };
                errorCount++; overallError = true; continue;
              }

              // Firefly CSV 'amount' for transfer is positive. Create two legs.
              // The 'transactionCurrency' should be the currency of the transfer itself.
              // If foreign_amount and foreign_currency_code are present, Firefly has already done conversion.
              // We use item.currency (mapped from currency_code) as the primary currency of the transaction amount.

              let sourceLegAmount = -Math.abs(item.amount); // Amount is from CSV, should be positive for transfers
              let sourceLegCurrency = item.currency; // Currency of the transfer
              // If foreign details are present and match source account's currency, use foreign amount for source leg
              if (item.foreignCurrency && item.foreignAmount !== undefined && !isNaN(item.foreignAmount) && sourceAccount.currency.toUpperCase() === item.foreignCurrency.toUpperCase()) {
                  sourceLegAmount = -Math.abs(item.foreignAmount);
                  sourceLegCurrency = item.foreignCurrency;
              }

              let destLegAmount = Math.abs(item.amount);
              let destLegCurrency = item.currency;
              // If foreign details are present and match destination account's currency, use foreign amount for dest leg
              if (item.foreignCurrency && item.foreignAmount !== undefined && !isNaN(item.foreignAmount) && destAccount.currency.toUpperCase() === item.foreignCurrency.toUpperCase()) {
                  destLegAmount = Math.abs(item.foreignAmount);
                  destLegCurrency = item.foreignCurrency;
              }
               // If no foreign details, or they don't match, both legs use the primary transfer amount and currency.
              // The addTransaction service will handle conversion to account's native currency if different.

              transactionPayloads.push({
                  accountId: sourceAccountId, date: item.date, amount: sourceLegAmount,
                  transactionCurrency: sourceLegCurrency, // This is crucial
                  description: item.description, category: 'Transfer', tags: transactionTags,
                  originalMappedTx: item, // Store original item for reference
              });
              transactionPayloads.push({
                  accountId: destAccountId, date: item.date, amount: destLegAmount,
                  transactionCurrency: destLegCurrency, // Crucial
                  description: item.description, category: 'Transfer', tags: transactionTags,
                  originalMappedTx: { ...item, description: `From ${sourceAccount.name}: ${item.description}` }, // Modify desc for clarity
              });

          } else if (item.csvTransactionType === 'withdrawal' || item.csvTransactionType === 'deposit') {
              // Determine the asset account involved
              let accountNameForTx: string | undefined;
              if (item.csvTransactionType === 'withdrawal') {
                  accountNameForTx = item.csvRawSourceName; // For withdrawal, our asset account is the source
              } else { // deposit
                  accountNameForTx = item.csvRawDestinationName; // For deposit, our asset account is the destination
              }

              if (!accountNameForTx) {
                   if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Could not determine asset account for ${item.csvTransactionType}. Source: ${item.csvRawSourceName}, Dest: ${item.csvRawDestinationName}` };
                   errorCount++; overallError = true; continue;
              }

              const accountIdForTx = finalMapForTxImport[accountNameForTx.toLowerCase()];
              if (!accountIdForTx || accountIdForTx.startsWith('preview_') || accountIdForTx.startsWith('error_') || accountIdForTx.startsWith('skipped_')) {
                   if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Could not find valid account ID for "${accountNameForTx}". Mapped ID: ${accountIdForTx}. Was the account created/updated correctly?` };
                   errorCount++; overallError = true; continue;
              }

              if (isNaN(item.amount)) { // Should have been caught by parseAmount, but double check
                    if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Invalid amount for import.` };
                    errorCount++; overallError = true; continue;
              }

              // Firefly amount: negative for withdrawal, positive for deposit.
              let payloadAmount = item.amount;
              let payloadCurrency = item.currency;

              // Check if foreign amount should be used (if it's in the target account's native currency)
              const targetAccount = latestAccountsList.find(a => a.id === accountIdForTx);
              if (targetAccount && item.foreignCurrency && item.foreignAmount !== undefined && !isNaN(item.foreignAmount) &&
                  targetAccount.currency.toUpperCase() === item.foreignCurrency.toUpperCase()) {
                  // If foreign currency matches account currency, use the foreign amount directly.
                  // Sign is already correct from Firefly's 'amount' based on 'type'.
                  payloadAmount = (item.csvTransactionType === 'withdrawal') ? -Math.abs(item.foreignAmount) : Math.abs(item.foreignAmount);
                  payloadCurrency = item.foreignCurrency;
              } else {
                // Ensure correct sign based on type if not using foreign amount
                 if (item.csvTransactionType === 'withdrawal' && payloadAmount > 0) {
                    payloadAmount = -payloadAmount;
                 } else if (item.csvTransactionType === 'deposit' && payloadAmount < 0) {
                    payloadAmount = Math.abs(payloadAmount);
                 }
              }


              transactionPayloads.push({
                  accountId: accountIdForTx, date: item.date, amount: payloadAmount,
                  transactionCurrency: payloadCurrency, // Currency of the amount field
                  description: item.description, category: transactionCategory, tags: transactionTags,
                  originalMappedTx: item,
              });
          } else {
               // Unknown Firefly transaction type
               if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Unknown Firefly transaction type "${item.csvTransactionType}". Supported: withdrawal, deposit, transfer, opening balance.` };
               errorCount++; overallError = true;
          }
      }

      // ----- Add Transactions to DB -----
      // Sort by date to ensure account balances are updated chronologically if relevant (though addTransaction handles individual balance updates)
      transactionPayloads.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (const payload of transactionPayloads) {
          // Find the original item in the display data to update its status
          const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === payload.originalMappedTx.originalRecord && d.description === payload.originalMappedTx.description && d.amount === payload.originalMappedTx.amount);
          try {
              await addTransaction(payload); // This function now handles balance updates.
              if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'success', errorMessage: undefined };
              importedCount++;
          } catch (err: any) {
              console.error(`Failed to import transaction for original row:`, payload.originalMappedTx.originalRecord, err);
               if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: err.message || 'Unknown import error' };
              errorCount++;
              overallError = true; // Mark that at least one error occurred
          }
          setImportProgress(calculateProgress(importedCount + errorCount, transactionPayloads.length)); // transactionPayloads.length might be more than recordsToImport due to transfer legs
          setParsedData([...updatedDataForDisplay]); // Update UI with row status
      }


      setIsLoading(false);
      const finalMessage = `Import finished. Successfully processed transactions: ${importedCount}. Failed/Skipped rows (from preview): ${errorCount + parsedData.filter(d => d.importStatus === 'skipped').length}.`;
      toast({
        title: overallError ? "Import Complete with Issues" : "Import Complete",
        description: finalMessage,
        variant: overallError ? "destructive" : "default",
        duration: 7000,
      });

      if (overallError) {
         setError(`Import finished with ${errorCount} transaction errors. Please review the table for details.`);
      } else {
         setError(null); // Clear error if all good
         // Optionally, clear parsedData or file state if successful and no errors
         // setFile(null); setRawData([]); setParsedData([]); etc.
         window.dispatchEvent(new Event('storage')); // Trigger data refresh in other components
      }
      // Final refresh of accounts state to reflect all balance changes
      setAccounts(await getAccounts());
   };


  const calculateProgress = (processed: number, total: number): number => {
      if (total === 0) return 0;
      return Math.round((processed / total) * 100);
  }

    const handleClearData = async () => {
        if (!user) {
            toast({ title: "Not Authenticated", description: "Please log in to clear data.", variant: "destructive" });
            return;
        }
        setIsClearing(true);
        try {
            await clearAllSessionTransactions(); // This should clear from Firebase for the user

            // Reset local state related to import
            setAccounts([]); // Refetch or clear based on what clearAllSessionTransactions does
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

            // Clear the file input element
            const fileInput = document.getElementById('csv-file') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

            toast({ title: "Data Cleared", description: "All user data (accounts, categories, tags, transactions) has been removed from the database for your account." });
            window.dispatchEvent(new Event('storage')); // Notify other components like dashboard
        } catch (err) {
            console.error("Failed to clear data:", err);
            toast({ title: "Error", description: "Could not clear stored data.", variant: "destructive" });
        } finally {
            setIsClearing(false);
        }
    };

    // Function to handle inline editing of transaction fields in the preview table
    const handleTransactionFieldChange = (
        originalIndexInData: number, // Index in the `parsedData` array
        field: 'description' | 'category' | 'tags' | 'amount' | 'date' | 'currency', // Fields that can be edited
        value: string // New value from the input
    ) => {
        setParsedData(prevData => {
            const newData = [...prevData];
            let transactionToUpdate = { ...newData[originalIndexInData] };

            // Only allow editing for 'pending' transactions
            if (transactionToUpdate.importStatus !== 'pending') {
                toast({ title: "Edit Blocked", description: "Cannot edit transactions that are not pending import.", variant: "destructive" });
                return prevData; // Return previous data without changes
            }

            // Update field based on which one was changed
            switch (field) {
                case 'description':
                    transactionToUpdate.description = value;
                    break;
                case 'category':
                    transactionToUpdate.category = value;
                    break;
                case 'tags':
                    // Assuming tags are comma-separated string in input
                    transactionToUpdate.tags = value.split(',').map(tag => tag.trim()).filter(Boolean);
                    break;
                case 'amount':
                    const parsedAmount = parseFloat(value); // Or use your parseAmount for consistency
                    if (!isNaN(parsedAmount)) {
                        transactionToUpdate.amount = parsedAmount;
                    } else {
                        toast({ title: "Invalid Amount", description: "Amount not updated. Please enter a valid number.", variant: "destructive" });
                        return prevData; // Revert if invalid
                    }
                    break;
                case 'date':
                     // Basic validation for YYYY-MM-DD, can be enhanced
                     if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                        transactionToUpdate.date = value;
                    } else if (value) {
                        try {
                            const d = new Date(value); // Try parsing more complex date strings
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
                    // Validate against supported currencies
                    if (supportedCurrencies.includes(value.toUpperCase())) {
                        transactionToUpdate.currency = value.toUpperCase();
                    } else {
                        toast({ title: "Invalid Currency", description: `Currency ${value} not supported.`, variant: "destructive"});
                        return prevData;
                    }
                    break;
                default:
                    // Should not happen if types are correct
                    return prevData;
            }
            newData[originalIndexInData] = transactionToUpdate;
            return newData;
        });
    };

  // Group transactions by account name for preview display
  const groupedTransactionsForPreview = useMemo(() => {
    if (!parsedData || parsedData.length === 0) return {};
    const grouped: { [accountDisplayName: string]: MappedTransaction[] } = {};

    // Use accountPreviewData to get the "official" display name for accounts
    // and finalAccountMapForImport for already imported/existing account names.
    const getDisplayableAccountName = (csvName?: string): string => {
        if (!csvName) return "Unknown Account";
        const previewAccount = accountPreviewData.find(ap => ap.name.toLowerCase() === csvName.toLowerCase());
        if (previewAccount) return previewAccount.name; // Use name from preview (correct casing)

        // Fallback if not in preview (should be rare if preview is comprehensive)
        const existingAccountId = finalAccountMapForImport[csvName.toLowerCase()];
        const existingAccount = accounts.find(acc => acc.id === existingAccountId);
        return existingAccount?.name || csvName;
    };


    parsedData.forEach(item => {
        let accountKeyForGrouping = "Unknown / Skipped / Error"; // Default group key
        let accountDisplayName = "Unknown / Skipped / Error"; // Default display name for the group header

        if (item.importStatus === 'error' || item.importStatus === 'skipped') {
             // Group errors and skipped items together or by specific type
             accountDisplayName = item.errorMessage?.includes("Opening Balance")
                ? `Account Balance Update: ${getDisplayableAccountName(item.csvRawDestinationName || item.csvRawSourceName)}` // Show which account's balance
                : `Errors / Skipped Transactions`;
             accountKeyForGrouping = `system-${item.importStatus}-${item.errorMessage?.substring(0,20) || 'general'}`;
        } else if (item.csvTransactionType === 'transfer') {
            const sourceName = getDisplayableAccountName(item.csvRawSourceName);
            const destName = getDisplayableAccountName(item.csvRawDestinationName);
            accountDisplayName = `Transfer: ${sourceName} -> ${destName}`;
            accountKeyForGrouping = `transfer-${sourceName}->${destName}`;
        } else if (item.csvTransactionType === 'withdrawal') {
            accountDisplayName = getDisplayableAccountName(item.csvRawSourceName);
            accountKeyForGrouping = `account-withdrawal-${accountDisplayName}`;
        } else if (item.csvTransactionType === 'deposit') {
            accountDisplayName = getDisplayableAccountName(item.csvRawDestinationName);
            accountKeyForGrouping = `account-deposit-${accountDisplayName}`;
        }
        // Add other Firefly types if necessary, or they'll fall into "Unknown"

        if (!grouped[accountKeyForGrouping]) {
            grouped[accountKeyForGrouping] = [];
        }
        (item as any)._accountDisplayNameForGroup = accountDisplayName; // Store for easy access in render
        grouped[accountKeyForGrouping].push(item);
    });

    // Sort groups: System messages last, then alphabetically by display name
    return Object.entries(grouped)
      .sort(([keyA], [keyB]) => {
          const nameA = (grouped[keyA][0] as any)._accountDisplayNameForGroup || keyA;
          const nameB = (grouped[keyB][0] as any)._accountDisplayNameForGroup || keyB;
          if (nameA.startsWith("Errors") || nameA.startsWith("Account Balance Update")) return 1; // Errors/Skipped last
          if (nameB.startsWith("Errors") || nameB.startsWith("Account Balance Update")) return -1;
          return nameA.localeCompare(nameB); // Alphabetical for others
      })
      .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
      }, {} as typeof grouped); // Ensure correct type for the reduced object
  }, [parsedData, accountPreviewData, finalAccountMapForImport, accounts]);


  // --- Auth loading/redirect ---
  if (isLoadingAuth) {
      return <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 text-center"><p>Loading authentication...</p></div>;
  }
  if (!user && !isLoadingAuth) { // Ensure isLoadingAuth is false before redirecting
      return <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 text-center"><p>Please <Link href="/login" className="text-primary underline">login</Link> to import data.</p></div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Import Data</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Step 1: Upload CSV File</CardTitle>
          <CardDescription>
            Select your CSV file. Firefly III export format is best supported. Map columns carefully in the next step. Ensure file is UTF-8 encoded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={isLoading}/>
          </div>

          {error && ( // Display general errors here
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
                           {isClearing ? "Clearing..." : "Clear All User Data (DB)"}
                       </Button>
                   </AlertDialogTrigger>
                   <AlertDialogContent>
                       <AlertDialogHeader>
                           <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                           <AlertDialogDescription>
                               This action cannot be undone. This will permanently delete ALL your accounts, categories, tags, and transactions from the database. This is intended for testing or resetting your data.
                           </AlertDialogDescription>
                       </AlertDialogHeader>
                       <AlertDialogFooter>
                           <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
                           <AlertDialogAction onClick={handleClearData} disabled={isClearing} className="bg-destructive hover:bg-destructive/90">
                               {isClearing ? "Clearing..." : "Yes, Clear All My Data"}
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

        {/* Dialog for CSV Column Mapping */}
        <Dialog open={isMappingDialogOpen} onOpenChange={setIsMappingDialogOpen}>
            <DialogContent className="sm:max-w-3xl"> {/* Wider dialog for mapping */}
                <DialogHeader>
                    <DialogTitle>Step 2: Map CSV Columns</DialogTitle>
                    <DialogDescription>
                        Match CSV columns (right) to application fields (left). For Firefly III CSVs, ensure 'type', 'amount', 'currency_code', 'date', 'source_name', and 'destination_name' are correctly mapped.
                    </DialogDescription>
                </DialogHeader>
                <CsvMappingForm
                    csvHeaders={csvHeaders}
                    initialMappings={columnMappings} // Pass current mappings
                    onSubmit={processAndMapData} // This will re-process with new mappings
                    onCancel={() => setIsMappingDialogOpen(false)}
                />
            </DialogContent>
        </Dialog>


       {/* Account Preview Table */}
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


      {/* Transaction Preview & Edit Table */}
      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Import ({parsedData.filter(i => i.importStatus === 'pending').length} Pending Rows)</CardTitle>
            <CardDescription>Review transactions. Rows marked 'Error' or 'Skipped' (like Opening Balances) won't be imported as transactions. Edit fields if needed. Click "Import Transactions" above when ready.</CardDescription>
          </CardHeader>
          <CardContent>
           {Object.entries(groupedTransactionsForPreview).map(([accountGroupKey, transactionsInGroup]) => {
                const firstTransactionInGroup = transactionsInGroup[0];
                // Use the stored display name for the group
                const accountDisplayName = (firstTransactionInGroup as any)._accountDisplayNameForGroup || accountGroupKey;

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
                                    {/* <TableHead className="text-right">Foreign Amt</TableHead>
                                    <TableHead>Foreign Curr</TableHead> */}
                                    <TableHead>Status</TableHead>
                                    <TableHead className="min-w-[150px]">Message / Info</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {transactionsInGroup.map((item, index) => {
                                    // Find the original index of this item in the `parsedData` array
                                    // This is crucial for updating the correct item in `handleTransactionFieldChange`
                                    const originalIndex = parsedData.findIndex(pItem => pItem.originalRecord === item.originalRecord && pItem.date === item.date && pItem.description === item.description && pItem.amount === item.amount);

                                    return (
                                        <TableRow key={`${accountGroupKey}-${index}-${item.originalRecord?.Date || index}-${item.amount}`} className={cn(
                                            "text-xs", // Smaller text for dense table
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
                                            {/* <TableCell className="text-right">{item.foreignAmount ? formatCurrency(item.foreignAmount, item.foreignCurrency || '', item.foreignCurrency, false) : '-'}</TableCell>
                                            <TableCell>{item.foreignCurrency || '-'}</TableCell> */}
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

