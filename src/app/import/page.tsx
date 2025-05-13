
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
import { addTransaction, type Transaction, clearAllSessionTransactions } from '@/services/transactions';
import { getAccounts, addAccount, type Account, type NewAccountData, updateAccount } from '@/services/account-sync';
import { getCategories, addCategory, type Category } from '@/services/categories';
import { getTags, addTag, type Tag } from '@/services/tags';
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
    'tags', 'notes', 'transaction_type', 'initialBalance'
] as const;

type AppField = typeof APP_FIELDS_VALUES[number];

type MappedTransaction = {
  csvRawSourceName?: string | null;
  csvRawDestinationName?: string | null;
  csvTransactionType?: string | null;

  date: string;
  amount: number; 
  description: string;
  category: string;
  currency: string; 
  foreignAmount?: number | null; 
  foreignCurrency?: string | null; 
  tags?: string[];
  originalRecord: Record<string, string | null>;
  importStatus: 'pending' | 'success' | 'error' | 'skipped';
  errorMessage?: string | null;

  appSourceAccountId?: string | null; 
  appDestinationAccountId?: string | null; 
  originalImportData?: { // To store values as they are from CSV for addTransaction
    foreignAmount?: number | null;
    foreignCurrency?: string | null;
  }
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

    if (hasComma && hasPeriod) {
        if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            cleaned = cleaned.replace(/,/g, '');
        }
    } else if (hasComma) {
        cleaned = cleaned.replace(',', '.');
    }

    if (cleaned.match(/\./g) && cleaned.match(/\./g)!.length > 1 && !cleaned.substring(cleaned.lastIndexOf('.') + 1).match(/\d{3}/)) {
        const parts = cleaned.split('.');
        if (parts.length > 1 && parts[parts.length-1].length < 3) {
             cleaned = parts.slice(0,-1).join('') + '.' + parts[parts.length-1];
        } else {
             cleaned = cleaned.replace(/\./g, '');
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
        let parsedDate = parseISO(dateStr);
        if (isValid(parsedDate)) {
            return format(parsedDate, 'yyyy-MM-dd');
        }

        const commonFormats = [
            'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd',
            'dd.MM.yyyy', 'MM.dd.yyyy',
            'dd-MM-yyyy', 'MM-dd-yyyy',
            'yyyy/MM/dd', 'yyyy/dd/MM',
            "yyyy-MM-dd'T'HH:mm:ssXXX", "yyyy-MM-dd HH:mm:ss",
            "dd/MM/yyyy HH:mm:ss", "MM/dd/yyyy HH:mm:ss",
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss",
        ];

        for (const fmt of commonFormats) {
            try {
                const dateOnlyFmt = fmt.split(' ')[0];
                parsedDate = parseDateFns(dateStr, fmt, new Date());
                if (isValid(parsedDate)) return format(parsedDate, 'yyyy-MM-dd');

                if (fmt !== dateOnlyFmt) {
                    parsedDate = parseDateFns(dateStr.split('T')[0].split(' ')[0], dateOnlyFmt, new Date());
                    if (isValid(parsedDate)) return format(parsedDate, 'yyyy-MM-dd');
                }
            } catch { /* ignore parse error for this format, try next */ }
        }

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

const parseNameFromDescriptiveString = (text: string | undefined): string | undefined => {
    if (!text) return undefined;
    const match = text.match(/(?:Initial balance for |Saldo inicial para(?: (?:a|d[aeo] conta))?)\s*["']?([^"':]+)["']?/i);
    return match ? match[1]?.trim() : undefined;
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

         initialMappings.date = findColumnName(detectedHeaders, 'date');
         initialMappings.amount = findColumnName(detectedHeaders, 'amount');
         initialMappings.description = findColumnName(detectedHeaders, 'description');
         initialMappings.source_name = findColumnName(detectedHeaders, 'source_name');
         initialMappings.destination_name = findColumnName(detectedHeaders, 'destination_name');
         initialMappings.currency_code = findColumnName(detectedHeaders, 'currency_code') || findColumnName(detectedHeaders, 'currency');
         initialMappings.category = findColumnName(detectedHeaders, 'category');
         initialMappings.tags = findColumnName(detectedHeaders, 'tags');
         initialMappings.transaction_type = findColumnName(detectedHeaders, 'type');
         initialMappings.notes = findColumnName(detectedHeaders, 'notes');
         initialMappings.foreign_amount = findColumnName(detectedHeaders, 'foreign_amount');
         initialMappings.foreign_currency_code = findColumnName(detectedHeaders, 'foreign_currency_code');
         initialMappings.source_type = findColumnName(detectedHeaders, 'source_type');
         initialMappings.destination_type = findColumnName(detectedHeaders, 'destination_type');
         initialMappings.initialBalance = findColumnName(detectedHeaders, 'initial_balance') || findColumnName(detectedHeaders, 'opening_balance');


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


        const coreRequiredFields: AppField[] = ['date', 'amount', 'currency_code', 'transaction_type'];
        let missingFieldLabels = coreRequiredFields
            .filter(field => !confirmedMappings[field])
            .map(field => APP_FIELDS_VALUES.find(val => val === field) || field);


        if (confirmedMappings.transaction_type) {
            // For Firefly, source_name and destination_name are always present.
            if (!confirmedMappings.source_name) missingFieldLabels.push('source_name (e.g., Firefly \'source_name\')');
            if (!confirmedMappings.destination_name) missingFieldLabels.push('destination_name (e.g., Firefly \'destination_name\')');
        } else {
            missingFieldLabels.push('transaction_type (e.g., Firefly \'type\')');
        }

        missingFieldLabels = [...new Set(missingFieldLabels)];

        if (missingFieldLabels.length > 0) {
            setError(`Missing required column mappings for import: ${missingFieldLabels.join(', ')}. Please map these fields.`);
            setIsLoading(false);
            setIsMappingDialogOpen(true);
            return;
        }


        const currentAccounts = await getAccounts();
        setAccounts(currentAccounts);


        const { preview } = await previewAccountChanges(rawData, confirmedMappings, currentAccounts);
        setAccountPreviewData(preview);


        const mapped: MappedTransaction[] = rawData.map((record, index) => {
          const rowNumber = index + 2; // CSV row number (1-based for headers, so data starts at 2)

          const dateCol = confirmedMappings.date!;
          const amountCol = confirmedMappings.amount!;
          const currencyCol = confirmedMappings.currency_code!;
          const descCol = confirmedMappings.description;
          const categoryCol = confirmedMappings.category;
          const tagsCol = confirmedMappings.tags;
          const notesCol = confirmedMappings.notes;
          const typeCol = confirmedMappings.transaction_type!; // e.g., Firefly 'type'
          const sourceNameCol = confirmedMappings.source_name!;
          const destNameCol = confirmedMappings.destination_name!;
          const foreignAmountCol = confirmedMappings.foreign_amount;
          const foreignCurrencyCol = confirmedMappings.foreign_currency_code;
          // source_type and destination_type can be used to refine account category (asset/crypto)
          const sourceTypeCol = confirmedMappings.source_type;
          const destTypeCol = confirmedMappings.destination_type;


          const sanitizedRecord: Record<string, string | null> = {};
            for (const key in record) {
                if (Object.prototype.hasOwnProperty.call(record, key)) {
                     sanitizedRecord[key] = record[key] === undefined ? null : record[key]!;
                }
            }


          try {
              const csvTypeRaw = record[typeCol];
              const csvType = csvTypeRaw?.trim().toLowerCase();

              const dateValue = record[dateCol];
              let amountValue = record[amountCol]; // This is the signed amount from Firefly
              const currencyValue = record[currencyCol];
              const foreignAmountValue = foreignAmountCol ? record[foreignAmountCol] : undefined;
              const foreignCurrencyValue = foreignCurrencyCol ? record[foreignCurrencyCol] : undefined;

              const descriptionValue = descCol ? record[descCol] || '' : '';
              const categoryValue = categoryCol ? record[categoryCol] || 'Uncategorized' : 'Uncategorized';
              const tagsValue = tagsCol ? record[tagsCol] || '' : '';
              const notesValue = notesCol ? record[notesCol] || '' : '';

              let rawSourceName = record[sourceNameCol]?.trim();
              let rawDestName = record[destNameCol]?.trim();


              if (!dateValue) throw new Error(`Row ${rowNumber}: Missing mapped 'Date' data.`);
              if (amountValue === undefined || amountValue.trim() === '') throw new Error(`Row ${rowNumber}: Missing or empty 'Amount' data.`);
              if (!currencyValue || currencyValue.trim() === '') throw new Error(`Row ${rowNumber}: Missing or empty 'Currency Code' data.`);
              if (!csvType) throw new Error(`Row ${rowNumber}: Missing or empty 'Transaction Type' (Firefly 'type') data.`);


              if (csvType === 'withdrawal' || csvType === 'transfer') {
                if (!rawSourceName) throw new Error(`Row ${rowNumber}: Missing 'Source Name' for type '${csvType}'. Source name column mapped to: '${sourceNameCol}', value: '${record[sourceNameCol!]}'.`);
              }
              if (csvType === 'deposit' || csvType === 'transfer') {
                 if (!rawDestName) throw new Error(`Row ${rowNumber}: Missing 'Destination Name' for type '${csvType}'. Destination name column mapped to: '${destNameCol}', value: '${record[destNameCol!]}'.`);
              }
              if (csvType === 'transfer' && rawSourceName && rawDestName && rawSourceName.toLowerCase() === rawDestName.toLowerCase()) {
                   // For Firefly CSVs, transfers are often split into two rows (one withdrawal, one deposit) that make up a single conceptual transfer.
                   // Here, we are processing a single row that *Firefly* itself labels as 'transfer'.
                   // If the source and destination asset accounts are the same on this single 'transfer' row, it's problematic.
                   // However, Firefly usually does this with an "expense" or "revenue" account on one side if it's a single row.
                   // This check needs to be robust for true asset-to-asset same-account transfers, which aren't typical on a single row.
                   console.warn(`Row ${rowNumber}: Firefly 'transfer' type row with same source and destination name ('${rawSourceName}'). This might be one leg of a two-row transfer, or an internal adjustment. Review carefully.`);
                   // We might need to skip these or handle them as internal adjustments rather than true transfers if they refer to the same *asset* account.
                   // For now, proceed but be aware. If the source/dest *types* indicate one is an expense/revenue account, this is fine.
              }


              const parsedAmount = parseAmount(amountValue); // Amount from CSV is signed
              if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Could not parse amount "${amountValue}".`);

              let tempParsedForeignAmount: number | null = null;
              if (foreignAmountValue !== undefined && foreignAmountValue.trim() !== "") {
                  const tempAmount = parseAmount(foreignAmountValue);
                  if (!Number.isNaN(tempAmount)) {
                      tempParsedForeignAmount = tempAmount; // Foreign amount from CSV is also signed
                  } else if (foreignAmountValue.trim() !== '') { 
                      console.warn(`Row ${rowNumber}: Could not parse foreign amount "${foreignAmountValue}". It will be ignored.`);
                  }
              }
              const finalParsedForeignAmount = tempParsedForeignAmount;

              let finalParsedForeignCurrency: string | null = null;
              if (foreignCurrencyCol && record[foreignCurrencyCol] && record[foreignCurrencyCol]!.trim() !== '') {
                  finalParsedForeignCurrency = record[foreignCurrencyCol]!.trim().toUpperCase() || null;
              }
              if (finalParsedForeignCurrency === "") finalParsedForeignCurrency = null;


              const parsedDate = parseDate(dateValue);
              const parsedTags = tagsValue.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);


              let finalDescription = descriptionValue.trim();
              if (notesValue.trim()) {
                  finalDescription = finalDescription ? `${finalDescription} (Notes: ${notesValue.trim()})` : `Notes: ${notesValue.trim()}`;
              }

              if (!finalDescription && csvType === 'withdrawal' && rawDestName) finalDescription = `To: ${rawDestName}`;
              if (!finalDescription && csvType === 'deposit' && rawSourceName) finalDescription = `From: ${rawSourceName}`;
              if (!finalDescription && csvType === 'transfer') finalDescription = `Transfer: ${rawSourceName} to ${rawDestName}`;
              if (!finalDescription) finalDescription = 'Imported Transaction';


              if (csvType === 'opening balance') {
                   let actualAccountNameForOB: string | undefined;
                   const parsedFromNameInDest = parseNameFromDescriptiveString(rawDestName);
                   const parsedFromNameInSource = parseNameFromDescriptiveString(rawSourceName);

                   if (parsedFromNameInDest) { 
                       actualAccountNameForOB = parsedFromNameInDest;
                   } else if (parsedFromNameInSource) { 
                       actualAccountNameForOB = parsedFromNameInSource;
                   } else { 
                       // If Firefly export, for 'opening balance' the asset account is typically the destination_name if source_type is 'Initial balance account'
                       // or source_name if destination_type is 'Initial balance account'.
                       // Let's try to infer: If one name starts with "Initial balance for" or "Saldo inicial para", the other is the account name.
                       const sourceIsDescriptive = rawSourceName?.toLowerCase().includes("initial balance for") || rawSourceName?.toLowerCase().includes("saldo inicial para");
                       const destIsDescriptive = rawDestName?.toLowerCase().includes("initial balance for") || rawDestName?.toLowerCase().includes("saldo inicial para");

                       if (sourceIsDescriptive && rawDestName) actualAccountNameForOB = rawDestName;
                       else if (destIsDescriptive && rawSourceName) actualAccountNameForOB = rawSourceName;
                       else actualAccountNameForOB = rawDestName || rawSourceName; // Fallback, might be less accurate for generic CSVs
                   }

                   if (!actualAccountNameForOB) {
                       throw new Error(`Row ${rowNumber}: Could not determine account name for 'opening balance'. Source: ${rawSourceName}, Dest: ${rawDestName}`);
                   }

                   return {
                       csvRawSourceName: rawSourceName ?? null,
                       csvRawDestinationName: actualAccountNameForOB ?? null, // This is the *actual* account name.
                       csvTransactionType: csvType,
                       date: parsedDate,
                       amount: parsedAmount, // Already signed
                       currency: currencyValue.trim().toUpperCase(),
                       foreignAmount: finalParsedForeignAmount,
                       foreignCurrency: finalParsedForeignCurrency,
                       description: `Opening Balance: ${actualAccountNameForOB}`,
                       category: 'Opening Balance',
                       tags: [],
                       originalRecord: sanitizedRecord,
                       importStatus: 'skipped', // Will be handled as initial balance
                       errorMessage: `Opening Balance for ${actualAccountNameForOB} (${formatCurrency(parsedAmount, currencyValue.trim().toUpperCase(), undefined, false)}) - Will be set as initial balance during account creation/update.`,
                       appSourceAccountId: null,
                       appDestinationAccountId: null,
                       originalImportData: { foreignAmount: finalParsedForeignAmount, foreignCurrency: finalParsedForeignCurrency },
                   };
              }

              // For regular transactions (withdrawal, deposit, transfer from Firefly CSV)
              return {
                  csvRawSourceName: rawSourceName ?? null,
                  csvRawDestinationName: rawDestName ?? null,
                  csvTransactionType: csvType ?? null,
                  date: parsedDate,
                  amount: parsedAmount, // Already signed from CSV
                  currency: currencyValue.trim().toUpperCase(),
                  foreignAmount: finalParsedForeignAmount, // Signed from CSV
                  foreignCurrency: finalParsedForeignCurrency,
                  description: finalDescription,
                  category: categoryValue.trim(),
                  tags: parsedTags,
                  originalRecord: sanitizedRecord,
                  importStatus: 'pending',
                  errorMessage: null,
                  appSourceAccountId: null,
                  appDestinationAccountId: null,
                  originalImportData: { foreignAmount: finalParsedForeignAmount, foreignCurrency: finalParsedForeignCurrency },
              };

            } catch (rowError: any) {
                console.error(`Error processing row ${index + 2} with mappings:`, confirmedMappings, `and record:`, record, `Error:`, rowError);
                const errorSanitizedRecord: Record<string, string | null> = {};
                for (const key in record) {
                    if (Object.prototype.hasOwnProperty.call(record, key)) {
                        errorSanitizedRecord[key] = record[key] === undefined ? null : record[key]!;
                    }
                }
                 return {
                    date: parseDate(record[dateCol]), 
                    amount: 0,
                    currency: record[currencyCol!]?.trim().toUpperCase() || 'N/A', 
                    description: `Error Processing Row ${index + 2}`,
                    category: 'Uncategorized',
                    tags: [],
                    originalRecord: errorSanitizedRecord,
                    importStatus: 'error',
                    errorMessage: rowError.message || 'Failed to process row.',
                    csvRawSourceName: (sourceNameCol && record[sourceNameCol] ? record[sourceNameCol]?.trim() : undefined) ?? null,
                    csvRawDestinationName: (destNameCol && record[destNameCol] ? record[destNameCol]?.trim() : undefined) ?? null,
                    csvTransactionType: (typeCol && record[typeCol] ? record[typeCol]?.trim().toLowerCase() : undefined) ?? null,
                    foreignAmount: null,
                    foreignCurrency: null,
                    appSourceAccountId: null,
                    appDestinationAccountId: null,
                    originalImportData: { foreignAmount: null, foreignCurrency: null },
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
        toast({ title: "Mapping Applied", description: `Previewing ${mapped.filter(m => m.importStatus === 'pending' || m.csvTransactionType === 'opening balance').length} data points and account changes. Review before importing.` });
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
            let finalBalance = details.initialBalance !== undefined ? details.initialBalance : (existingAccount?.balance ?? 0);

            if (existingAccount) {
                 // Only mark as 'update' if currency changes OR if a new initial balance is provided from CSV (and it's different)
                if (details.currency !== existingAccount.currency || (details.initialBalance !== undefined && details.initialBalance !== existingAccount.balance)) {
                    action = 'update';
                }
                preview.push({
                    name: details.name, 
                    currency: details.currency,
                    initialBalance: finalBalance,
                    action: action,
                    existingId: existingAccount.id,
                    category: existingAccount.category, 
                });
            } else {
                preview.push({
                    name: details.name, 
                    currency: details.currency,
                    initialBalance: finalBalance, 
                    action: 'create',
                    category: details.category || 'asset',
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
        mappingsArg: ColumnMapping,
        existingAccountsParam: Account[]
    ): Promise<Map<string, { name: string; currency: string; initialBalance?: number; category: 'asset' | 'crypto' }>> => {
        const accountMap = new Map<string, { name: string; currency: string; initialBalance?: number; category: 'asset' | 'crypto' }>();


        const typeCol = mappingsArg.transaction_type!;
        const sourceNameCol = mappingsArg.source_name!;
        const destNameCol = mappingsArg.destination_name!;
        const amountCol = mappingsArg.amount!;
        const currencyCol = mappingsArg.currency_code!;
        const sourceTypeCol = mappingsArg.source_type;
        const destTypeCol = mappingsArg.destination_type;


        for (const record of csvData) {
            const csvType = record[typeCol]?.trim().toLowerCase();
            const recordAmount = parseAmount(record[amountCol]); // This is signed
            const recordCurrency = record[currencyCol!]?.trim().toUpperCase();

            if (csvType === 'opening balance') {
                let actualAccountName: string | undefined;
                const rawSourceName = record[sourceNameCol]?.trim();
                const rawDestName = record[destNameCol]?.trim();

                const parsedDestName = parseNameFromDescriptiveString(rawDestName);
                const parsedSourceName = parseNameFromDescriptiveString(rawSourceName);

                if (parsedDestName) { 
                    actualAccountName = parsedDestName;
                } else if (parsedSourceName) { 
                    actualAccountName = parsedSourceName;
                } else {
                       const sourceIsDescriptive = rawSourceName?.toLowerCase().includes("initial balance for") || rawSourceName?.toLowerCase().includes("saldo inicial para");
                       const destIsDescriptive = rawDestName?.toLowerCase().includes("initial balance for") || rawDestName?.toLowerCase().includes("saldo inicial para");
                       if (sourceIsDescriptive && rawDestName) actualAccountName = rawDestName;
                       else if (destIsDescriptive && rawSourceName) actualAccountName = rawSourceName;
                       else actualAccountName = rawDestName || rawSourceName;
                }
                
                if (!actualAccountName) {
                     console.warn(`Could not determine account name for 'opening balance'. Row:`, record);
                     continue; 
                }

                if (recordCurrency && !isNaN(recordAmount)) {
                    const normalizedName = actualAccountName.toLowerCase();
                    const existingDetailsInMap = accountMap.get(normalizedName);
                    let accountCategory: 'asset' | 'crypto' = 'asset'; // Default
                    
                    // Firefly specific logic for account type from source_type or destination_type
                    const csvSourceType = sourceTypeCol ? record[sourceTypeCol]?.trim().toLowerCase() : null;
                    const csvDestType = destTypeCol ? record[destTypeCol]?.trim().toLowerCase() : null;

                    // If "Initial balance account" is the source_type, destination_name is the asset account.
                    // If "Initial balance account" is the destination_type, source_name is the asset account.
                    // This logic is now implicitly handled by `parseNameFromDescriptiveString` or the subsequent fallbacks for `actualAccountName`.
                    // We need to determine if `actualAccountName` is crypto or asset.

                    // Check if account name or type hints at crypto
                    if (actualAccountName.toLowerCase().includes('crypto') || actualAccountName.toLowerCase().includes('wallet')) {
                         accountCategory = 'crypto';
                    } else if (csvSourceType === "asset account" && sourceIsDescriptive && csvDestType?.includes('crypto')) {
                         accountCategory = 'crypto'; // If descriptive source, look at dest type
                    } else if (csvDestType === "asset account" && destIsDescriptive && csvSourceType?.includes('crypto')) {
                         accountCategory = 'crypto'; // If descriptive dest, look at source type
                    } else if (csvSourceType?.includes('crypto') || csvDestType?.includes('crypto')) {
                        accountCategory = 'crypto';
                    }


                    accountMap.set(normalizedName, {
                        name: actualAccountName, 
                        currency: recordCurrency,
                        initialBalance: recordAmount, // Set initial balance from the opening balance row (amount is signed, but balance should be absolute for OB)
                        category: existingDetailsInMap?.category || accountCategory,
                    });
                } else {
                     console.warn(`Could not process 'opening balance' row for "${actualAccountName}" due to missing/invalid currency or amount. Row:`, record, `Parsed Amount: ${recordAmount}`, `Currency: ${recordCurrency}`);
                }
            } else if (csvType === 'withdrawal' || csvType === 'deposit' || csvType === 'transfer') {
                const sourceName = record[sourceNameCol]?.trim();
                const destName = record[destNameCol]?.trim();
                const sourceType = sourceTypeCol ? record[sourceTypeCol]?.trim().toLowerCase() : undefined;
                const destType = destTypeCol ? record[destTypeCol]?.trim().toLowerCase() : undefined;

                const accountsToConsiderRaw: {name: string, type?: string}[] = [];

                // Firefly specific: for withdrawals/transfers, source_name is usually the asset account.
                // For deposits/transfers, destination_name is usually the asset account.
                // source_type / destination_type being "Asset account" or "Default asset account" confirms this.
                if (sourceName && (sourceType === 'asset account' || sourceType === 'default asset account')) {
                     accountsToConsiderRaw.push({name: sourceName, type: sourceType});
                }
                if (destName && (destType === 'asset account' || destType === 'default asset account')) {
                     accountsToConsiderRaw.push({name: destName, type: destType});
                }
                
                const uniqueAccountNames = [...new Set(accountsToConsiderRaw.map(a => a.name))];


                for (const accNameToConsider of uniqueAccountNames) {
                     if (accNameToConsider && recordCurrency) { 
                        const normalizedName = accNameToConsider.toLowerCase();
                        const accDetailsFromCsv = accountsToConsiderRaw.find(a => a.name === accNameToConsider);
                        let category: 'asset' | 'crypto' = 'asset';
                        if (accNameToConsider.toLowerCase().includes('crypto') || accNameToConsider.toLowerCase().includes('wallet') || accDetailsFromCsv?.type?.includes('crypto')) {
                            category = 'crypto';
                        }


                        if (!accountMap.has(normalizedName)) {
                             const existingAppAccount = existingAccountsParam.find(a => a.name.toLowerCase() === normalizedName);
                             accountMap.set(normalizedName, {
                                name: accNameToConsider,
                                currency: existingAppAccount?.currency || recordCurrency, 
                                initialBalance: existingAppAccount?.balance, // Don't set initial balance from non-OB rows
                                category: existingAppAccount?.category || category,
                            });
                        } else { 
                            const currentDetails = accountMap.get(normalizedName)!;
                            if (!currentDetails.currency && recordCurrency) currentDetails.currency = recordCurrency;
                            // If category was asset but now csv hints crypto, update
                            if (currentDetails.category === 'asset' && category === 'crypto') {
                                currentDetails.category = 'crypto';
                            }
                        }
                    }
                }
            }
        }
        return accountMap;
    };


    const createOrUpdateAccountsAndGetMap = async (
        isPreviewOnly: boolean = false
    ): Promise<{ success: boolean; map: { [key: string]: string }, updatedAccountsList: Account[] }> => {
        let success = true;
        let currentAppAccounts = [...accounts]; // Use a copy of the current state

        // Build a working map from the current application accounts
        const workingMap = currentAppAccounts.reduce((map, acc) => {
             map[acc.name.toLowerCase().trim()] = acc.id;
             return map;
        }, {} as { [key: string]: string });


        if (accountPreviewData.length === 0 && !isPreviewOnly) {
            // No accounts to create/update from preview, return current state
            return { success: true, map: workingMap, updatedAccountsList: currentAppAccounts };
        }

        let accountsProcessedCount = 0;

        for (const accPreview of accountPreviewData) {
            const normalizedName = accPreview.name.toLowerCase().trim();
            try {
                if (isPreviewOnly) {
                    if (accPreview.existingId) {
                        workingMap[normalizedName] = accPreview.existingId;
                    } else if (accPreview.action === 'create') {
                        // For preview, use a temporary placeholder ID if no existingId
                        workingMap[normalizedName] = `preview_create_${normalizedName.replace(/\s+/g, '_')}`;
                    }
                    continue; // Skip actual DB operations in preview mode
                }

                // --- Actual DB Operations (Not previewOnly) ---
                if (accPreview.action === 'create') {
                    const newAccountData: NewAccountData = {
                        name: accPreview.name,
                        type: (accPreview.category === 'crypto' ? 'wallet' : 'checking'), // Default type
                        balance: accPreview.initialBalance, // Use balance from preview (derived from OB or 0)
                        currency: accPreview.currency,
                        providerName: 'Imported - ' + accPreview.name, // Generic provider name
                        category: accPreview.category, // Set category from preview
                        isActive: true,
                        lastActivity: new Date().toISOString(),
                        balanceDifference: 0,
                    };
                    const createdAccount = await addAccount(newAccountData);
                    workingMap[normalizedName] = createdAccount.id; // Store new ID
                    currentAppAccounts.push(createdAccount); // Add to our working list
                    accountsProcessedCount++;
                } else if (accPreview.action === 'update' && accPreview.existingId) {
                    const existingAccountForUpdate = currentAppAccounts.find(a => a.id === accPreview.existingId);
                    if (existingAccountForUpdate) {
                        const updatedAccountData: Account = {
                            ...existingAccountForUpdate,
                            // Only update balance if it was explicitly set by an 'opening balance' row
                            // otherwise, balance updates happen via transaction processing.
                            balance: accPreview.initialBalance, // Use balance from preview
                            currency: accPreview.currency, // Update currency if changed
                            lastActivity: new Date().toISOString(), // Update activity
                            category: accPreview.category, // Update category if changed
                        };
                        const savedUpdatedAccount = await updateAccount(updatedAccountData);
                        accountsProcessedCount++;
                        // Update the account in our working list
                        const idx = currentAppAccounts.findIndex(a => a.id === savedUpdatedAccount.id);
                        if (idx !== -1) currentAppAccounts[idx] = savedUpdatedAccount;
                        else currentAppAccounts.push(savedUpdatedAccount); // Should not happen if existingId is correct

                        workingMap[normalizedName] = savedUpdatedAccount.id;
                    }
                } else if (accPreview.existingId) {
                     // No change, but ensure map is populated
                     workingMap[normalizedName] = accPreview.existingId;
                }

            } catch (err: any) {
                console.error(`Failed to process account "${accPreview.name}":`, err);
                toast({ title: "Account Processing Error", description: `Could not process account "${accPreview.name}". Error: ${err.message}`, variant: "destructive", duration: 7000 });
                success = false; // Mark failure but continue processing others
            }
        }

        if (accountsProcessedCount > 0 && !isPreviewOnly) {
            toast({ title: "Accounts Processed", description: `Created or updated ${accountsProcessedCount} accounts based on CSV data.` });
        }

        // If not in previewOnly and actual changes were made, refetch all accounts to ensure `currentAppAccounts` and the final map are fully up-to-date
        if (!isPreviewOnly && accountsProcessedCount > 0) {
             const finalFetchedAccounts = await getAccounts();
             setAccounts(finalFetchedAccounts); // Update global state if this component manages it
             // Rebuild the final map based on the absolute latest from DB
             const finalMap = finalFetchedAccounts.reduce((map, acc) => {
                 map[acc.name.toLowerCase().trim()] = acc.id;
                 return map;
             }, {} as { [key: string]: string });
             return { success, map: finalMap, updatedAccountsList: finalFetchedAccounts };
        }

        // If previewOnly or no accounts were processed, return the map built from `workingMap` and `currentAppAccounts`
        return { success, map: workingMap, updatedAccountsList: currentAppAccounts };
    };


   const addMissingCategoriesAndTags = async (transactionsToProcess: MappedTransaction[]): Promise<boolean> => {
      const currentCategoriesList = await getCategories();
      const existingCategoryNames = new Set(currentCategoriesList.map(cat => cat.name.toLowerCase()));
      const categoriesToAdd = new Set<string>();

      const currentTagsList = await getTags();
      const existingTagNames = new Set(currentTagsList.map(tag => tag.name.toLowerCase()));
      const tagsToAdd = new Set<string>();

      let success = true;

      transactionsToProcess.forEach(tx => {
          if (tx.importStatus === 'pending') { // Only consider pending transactions
              if (tx.category && !['Uncategorized', 'Initial Balance', 'Transfer', 'Skipped', 'Opening Balance'].includes(tx.category)) {
                  const categoryName = tx.category.trim();
                  if (categoryName && !existingCategoryNames.has(categoryName.toLowerCase())) {
                      categoriesToAdd.add(categoryName);
                  }
              }

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
                  await addCategory(catName);
                  categoriesAddedCount++;
              } catch (err: any) {
                  if (!err.message?.includes('already exists')) { // Avoid error toast if it's just a race condition
                      console.error(`Failed to add category "${catName}":`, err);
                      toast({ title: "Category Add Error", description: `Could not add category "${catName}". Error: ${err.message}`, variant: "destructive" });
                      success = false;
                  }
              }
          });
          await Promise.all(addCatPromises);
          if (categoriesAddedCount > 0) {
            toast({ title: "Categories Added", description: `Added ${categoriesAddedCount} new categories.` });
             try { setCategories(await getCategories()); } catch { console.error("Failed to refetch categories after add."); }
          }
      }

      if (tagsToAdd.size > 0) {
            let tagsAddedCount = 0;
            const addTagPromises = Array.from(tagsToAdd).map(async (tagName) => {
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
            await Promise.all(addTagPromises);
             if (tagsAddedCount > 0) {
                toast({ title: "Tags Added", description: `Added ${tagsAddedCount} new tags.` });
                 try { setTags(await getTags()); } catch { console.error("Failed to refetch tags after add."); }
            }
        }
      return success;
   };


   const handleImport = async () => {
      if (!user) {
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


      let finalMapForTxImport: { [key: string]: string };
      let latestAccountsList: Account[];
      try {
        // This creates/updates accounts based on accountPreviewData and returns the final map and list
        const accountMapResult = await createOrUpdateAccountsAndGetMap(false); 
        if (!accountMapResult.success) {
            // Even if success is false, some accounts might have been processed.
            // The map and list returned would reflect the state after attempted processing.
            setError("Error processing some accounts during import. Some accounts might not have been created/updated correctly. Review account preview and transaction statuses.");
            // Continue with import if map is available, errors will be per-transaction
        }
        finalMapForTxImport = accountMapResult.map;
        latestAccountsList = accountMapResult.updatedAccountsList; // Use the most up-to-date list
        setAccounts(latestAccountsList); // Update local state for UI consistency
        setFinalAccountMapForImport(finalMapForTxImport); // Store for display/debugging
      } catch (finalAccountMapError) {
          console.error("Critical error during account finalization before import.", finalAccountMapError);
          toast({ title: "Account Sync Error", description: "Could not synchronize accounts with the database before starting transaction import. Please try again.", variant: "destructive"});
          setIsLoading(false);
          return;
      }


      const metadataSuccess = await addMissingCategoriesAndTags(recordsToImport);
      if (!metadataSuccess) {
         setError("Error adding new categories or tags from CSV. Some transactions might use 'Uncategorized' or miss tags. Import halted to ensure data integrity.");
         setIsLoading(false);
         return;
      }

      const currentCategoriesList = await getCategories(); // Refetch latest
      const currentTagsList = await getTags(); // Refetch latest


      const totalToImport = recordsToImport.length;
      let importedCount = 0;
      let errorCount = 0;
      const updatedDataForDisplay = [...parsedData]; 


      const transactionPayloads: (Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { originalMappedTx: MappedTransaction })[] = [];


      for (const item of recordsToImport) {
          const rowNumber = rawData.indexOf(item.originalRecord) + 2; 
          const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === item.originalRecord && d.description === item.description && d.amount === item.amount && d.date === item.date);


          if (item.csvTransactionType === 'opening balance') {
              if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'skipped', errorMessage: 'Opening Balance (handled via account balance creation/update)' };
              continue; 
          }

          const transactionCategory = currentCategoriesList.find(c => c.name.toLowerCase() === item.category.toLowerCase())?.name || 'Uncategorized';
          const transactionTags = item.tags?.map(tName => currentTagsList.find(t => t.name.toLowerCase() === tName.toLowerCase())?.name || tName).filter(Boolean) || [];


            if (item.csvTransactionType === 'transfer') {
                const csvAmount = item.amount; // This is signed
                const csvCurrency = item.currency;
                const csvSourceName = item.csvRawSourceName;
                const csvDestName = item.csvRawDestinationName;
                
                if (!csvSourceName || !csvDestName) {
                    if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Firefly 'transfer' type row missing source or destination name in CSV.` };
                    errorCount++; overallError = true; continue;
                }

                const fromAccountId = finalMapForTxImport[csvSourceName.toLowerCase().trim()];
                const toAccountId = finalMapForTxImport[csvDestName.toLowerCase().trim()];

                if (!fromAccountId || fromAccountId.startsWith('preview_') || fromAccountId.startsWith('error_') || fromAccountId.startsWith('skipped_')) {
                    if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Invalid source account ID for transfer leg account "${csvSourceName}". Mapped ID: ${fromAccountId}.` };
                    errorCount++; overallError = true; continue;
                }
                 if (!toAccountId || toAccountId.startsWith('preview_') || toAccountId.startsWith('error_') || toAccountId.startsWith('skipped_')) {
                    if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Invalid destination account ID for transfer leg account "${csvDestName}". Mapped ID: ${toAccountId}.` };
                    errorCount++; overallError = true; continue;
                }
                
                // Firefly CSV represents transfer as two rows (one withdrawal, one deposit) or one 'transfer' row.
                // Our app models it as two separate transactions linked by description/amount/date.
                // When importing a Firefly 'transfer' row, we create two transactions in our system.
                // The amount in Firefly's 'transfer' row is typically the positive amount transferred.
                
                const transferDesc = item.description || `Transfer from ${csvSourceName} to ${csvDestName}`;
                const absoluteAmount = Math.abs(csvAmount); // Ensure positive for our two-leg system

                transactionPayloads.push({ // Expense from source
                    accountId: fromAccountId,
                    date: item.date,
                    amount: -absoluteAmount, 
                    transactionCurrency: csvCurrency, 
                    description: transferDesc,
                    category: 'Transfer', 
                    tags: transactionTags,
                    originalMappedTx: item,
                    originalImportData: item.originalImportData,
                });
                transactionPayloads.push({ // Income to destination
                    accountId: toAccountId,
                    date: item.date,
                    amount: absoluteAmount, 
                    transactionCurrency: csvCurrency, 
                    description: transferDesc,
                    category: 'Transfer', 
                    tags: transactionTags,
                    originalMappedTx: item, // Link to same original CSV row for tracking
                    originalImportData: item.originalImportData,
                });


            } else if (item.csvTransactionType === 'withdrawal' || item.csvTransactionType === 'deposit') {
                let accountNameForTx: string | undefined | null;
                if (item.csvTransactionType === 'withdrawal') {
                    accountNameForTx = item.csvRawSourceName;
                } else { // deposit
                    accountNameForTx = item.csvRawDestinationName;
                }

                if (!accountNameForTx) {
                    if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Could not determine asset account for ${item.csvTransactionType}. Source: ${item.csvRawSourceName}, Dest: ${item.csvRawDestinationName}` };
                    errorCount++; overallError = true; continue;
                }

                const accountIdForTx = finalMapForTxImport[accountNameForTx.toLowerCase().trim()];
                if (!accountIdForTx || accountIdForTx.startsWith('preview_') || accountIdForTx.startsWith('error_') || accountIdForTx.startsWith('skipped_')) {
                    if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Could not find valid account ID for "${accountNameForTx}". Mapped ID: ${accountIdForTx}. Was the account created/updated correctly?` };
                    errorCount++; overallError = true; continue;
                }

                if (isNaN(item.amount)) {
                    if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Invalid amount for import.` };
                    errorCount++; overallError = true; continue;
                }

                let payloadAmount = item.amount; // Already signed from CSV
                let payloadCurrency = item.currency;
                
                const targetAccount = latestAccountsList.find(a => a.id === accountIdForTx);
                if (targetAccount && item.foreignCurrency && item.foreignAmount != null && !isNaN(item.foreignAmount) &&
                    targetAccount.currency.toUpperCase() === item.foreignCurrency.toUpperCase()
                ) {
                    payloadAmount = item.foreignAmount; // foreignAmount is already signed in Firefly CSV
                    payloadCurrency = item.foreignCurrency;
                } else {
                    // Amount is already signed from item.amount as per Firefly CSV spec.
                }
                
                transactionPayloads.push({
                    accountId: accountIdForTx,
                    date: item.date,
                    amount: payloadAmount,
                    transactionCurrency: payloadCurrency,
                    description: item.description,
                    category: transactionCategory,
                    tags: transactionTags,
                    originalMappedTx: item,
                    originalImportData: item.originalImportData,
                });
          } else {
               if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Unknown Firefly transaction type "${item.csvTransactionType}". Supported: withdrawal, deposit, transfer, opening balance.` };
               errorCount++; overallError = true;
          }
      }


      // Sort by date to ensure account balances are updated chronologically
      transactionPayloads.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (const payload of transactionPayloads) {
          const itemIndexInDisplay = updatedDataForDisplay.findIndex(d =>
              d.originalRecord === payload.originalMappedTx.originalRecord &&
              d.description === payload.originalMappedTx.description &&
              d.amount === payload.originalMappedTx.amount && // Use the original CSV amount for matching
              d.date === payload.originalMappedTx.date &&
              d.importStatus !== 'success' 
          );
          try {
              // Pass originalImportData to addTransaction
              await addTransaction({
                  accountId: payload.accountId,
                  date: payload.date,
                  amount: payload.amount,
                  transactionCurrency: payload.transactionCurrency,
                  description: payload.description,
                  category: payload.category,
                  tags: payload.tags,
                  originalImportData: payload.originalImportData,
              });
              if(itemIndexInDisplay !== -1) {
                // If it's a transfer, the original item might be processed for two transactions.
                // Mark success if this is the *first* time it's processed successfully
                // or if it's the second leg of a transfer and the item isn't already fully 'success'.
                // This logic might need refinement if a single CSV 'transfer' row should only update *one* MappedTransaction in the display.
                // For now, assume that if any leg succeeds, we can mark the display item as success.
                updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'success', errorMessage: undefined };
              }
              importedCount++;
          } catch (err: any) {
              console.error(`Failed to import transaction for original row:`, payload.originalMappedTx.originalRecord, err);
               if(itemIndexInDisplay !== -1 && updatedDataForDisplay[itemIndexInDisplay].importStatus !== 'success') { // Only mark error if not already success
                  updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: err.message || 'Unknown import error' };
               }
              errorCount++;
              overallError = true;
          }
          setImportProgress(calculateProgress(importedCount + errorCount, transactionPayloads.length * (transactionPayloads.find(p => p.category === 'Transfer' && p.originalMappedTx === payload.originalMappedTx) ? 0.5 : 1)  )); // Adjust total for transfers
          setParsedData([...updatedDataForDisplay]); // Update UI incrementally
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
         setError(null); // Clear previous errors if all successful now
         window.dispatchEvent(new Event('storage')); // Trigger a global state update
      }

      // Refetch accounts to update balances displayed on other pages
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
            await clearAllSessionTransactions();


            // Reset local state
            setAccounts([]);
            setCategories([]);
            setTags([]);
            // setGroups([]); // If groups were managed here
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

            toast({ title: "Data Cleared", description: "All user data (accounts, categories, tags, groups, subscriptions, transactions) has been removed." });
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

            // Apply changes based on the field
            switch (field) {
                case 'description':
                    transactionToUpdate.description = value;
                    break;
                case 'category':
                    transactionToUpdate.category = value;
                    break;
                case 'tags':
                    // Assuming tags are comma-separated
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
                     if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) { // YYYY-MM-DD
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
                    return prevData; // Should not happen
            }
            newData[originalIndexInData] = transactionToUpdate;
            return newData;
        });
    };


  const groupedTransactionsForPreview = useMemo(() => {
    if (!parsedData || parsedData.length === 0) return {};
    const grouped: { [accountDisplayName: string]: MappedTransaction[] } = {};


    const getDisplayableAccountName = (csvName?: string | null): string => {
        if (!csvName) return "Unknown Account";
        const lowerCsvName = csvName.toLowerCase().trim();

        const accountId = finalAccountMapForImport[lowerCsvName];
        if (accountId) {
            const appAccount = accounts.find(acc => acc.id === accountId);
            if (appAccount) return appAccount.name; 
        }
        const previewAccount = accountPreviewData.find(ap => ap.name.toLowerCase().trim() === lowerCsvName);
        if (previewAccount) return previewAccount.name; 

        return csvName;
    };


    parsedData.forEach(item => {
        let accountKeyForGrouping = "Unknown / Skipped / Error";
        let accountDisplayName = "Unknown / Skipped / Error";

        if (item.importStatus === 'error' || item.importStatus === 'skipped') {
             accountDisplayName = item.errorMessage?.includes("Opening Balance")
                ? `Account Balance Update: ${getDisplayableAccountName(item.csvRawDestinationName || item.csvRawSourceName)}`
                : `Errors / Skipped Transactions`;
             accountKeyForGrouping = `system-${item.importStatus}-${item.errorMessage?.substring(0,20) || 'general'}`;
        } else if (item.csvTransactionType === 'transfer') {
            // For 'transfer' type from Firefly CSV, it's usually a single row representing one leg.
            // Our system will create two transactions. Group by the *intended* movement.
            const sourceName = getDisplayableAccountName(item.csvRawSourceName);
            const destName = getDisplayableAccountName(item.csvRawDestinationName);
            accountDisplayName = `Transfer: ${sourceName} -> ${destName}`;
            accountKeyForGrouping = `transfer-${sourceName}-${destName}`;

        } else if (item.csvTransactionType === 'withdrawal') {
            accountDisplayName = getDisplayableAccountName(item.csvRawSourceName);
            accountKeyForGrouping = `account-${accountDisplayName}-withdrawal`;
        } else if (item.csvTransactionType === 'deposit') {
            accountDisplayName = getDisplayableAccountName(item.csvRawDestinationName);
            accountKeyForGrouping = `account-${accountDisplayName}-deposit`;
        }


        if (!grouped[accountKeyForGrouping]) {
            grouped[accountKeyForGrouping] = [];
        }
        (item as any)._accountDisplayNameForGroupHeader = accountDisplayName;
        grouped[accountKeyForGrouping].push(item);
    });


    return Object.entries(grouped)
      .sort(([keyA], [keyB]) => {
          const nameA = (grouped[keyA][0] as any)._accountDisplayNameForGroupHeader || keyA;
          const nameB = (grouped[keyB][0] as any)._accountDisplayNameForGroupHeader || keyB;
          if (nameA.startsWith("Errors") || nameA.startsWith("Account Balance Update")) return 1; 
          if (nameB.startsWith("Errors") || nameB.startsWith("Account Balance Update")) return -1; 
          return nameA.localeCompare(nameB); 
      })
      .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
      }, {} as typeof grouped);
  }, [parsedData, accountPreviewData, finalAccountMapForImport, accounts]);



  if (isLoadingAuth) {
      return <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 text-center"><p>Loading authentication...</p></div>;
  }
  if (!user && !isLoadingAuth) {
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
                           {isClearing ? "Clearing..." : "Clear All User Data (DB)"}
                       </Button>
                   </AlertDialogTrigger>
                   <AlertDialogContent>
                       <AlertDialogHeader>
                           <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                           <AlertDialogDescription>
                               This action cannot be undone. This will permanently delete ALL your accounts, categories, tags, groups, subscriptions and transactions from the database. This is intended for testing or resetting your data.
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
            <CardTitle>Review & Import ({parsedData.filter(i => i.importStatus === 'pending').length} Pending Rows)</CardTitle>
            <CardDescription>Review transactions. Rows marked 'Error' or 'Skipped' (like Opening Balances) won't be imported as transactions. Edit fields if needed. Click "Import Transactions" above when ready.</CardDescription>
          </CardHeader>
          <CardContent>
           {Object.entries(groupedTransactionsForPreview).map(([accountGroupKey, transactionsInGroup]) => {
                const firstTransactionInGroup = transactionsInGroup[0];
                const accountDisplayName = (firstTransactionInGroup as any)._accountDisplayNameForGroupHeader || accountGroupKey;

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
                                    <TableHead className="text-right">Foreign Amt.</TableHead>
                                    <TableHead>Foreign Curr.</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="min-w-[150px]">Message / Info</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {transactionsInGroup.map((item, index) => {
                                    const originalIndex = parsedData.findIndex(pItem => pItem.originalRecord === item.originalRecord && pItem.date === item.date && pItem.description === item.description && pItem.amount === item.amount);

                                    return (
                                        <TableRow key={`${accountGroupKey}-${index}-${item.originalRecord?.Date || index}-${item.amount}`} className={cn(
                                            "text-xs",
                                            item.importStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
                                            item.importStatus === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                                            item.importStatus === 'skipped' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                                        )}>
                                            <TableCell className="whitespace-nowrap max-w-[120px]">
                                                <Input type="date" value={item.date} onChange={(e) => handleTransactionFieldChange(originalIndex, 'date', e.target.value)} className="h-8 text-xs p-1" />
                                            </TableCell>
                                            <TableCell className="max-w-[100px] truncate" title={item.csvTransactionType ?? undefined}>{item.csvTransactionType}</TableCell>
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
                                            <TableCell className="text-right whitespace-nowrap">
                                                {item.foreignAmount != null ? formatCurrency(item.foreignAmount, item.foreignCurrency || '', item.foreignCurrency || '', false) : '-'}
                                            </TableCell>
                                            <TableCell className="max-w-[80px]">{item.foreignCurrency || '-'}</TableCell>
                                            <TableCell className="font-medium capitalize">{item.importStatus}</TableCell>
                                            <TableCell className="text-muted-foreground max-w-[200px] truncate" title={item.errorMessage ?? undefined}>{item.errorMessage}</TableCell>
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

