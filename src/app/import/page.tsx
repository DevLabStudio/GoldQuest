
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
    'tags', 'notes', 'transaction_type', 'initialBalance' // Added initialBalance for clarity if needed
] as const;

type AppField = typeof APP_FIELDS_VALUES[number];

type MappedTransaction = {
  csvRawSourceName?: string | null;
  csvRawDestinationName?: string | null;
  csvTransactionType?: string | null;

  date: string;
  amount: number; // This will be the primary amount from the CSV row
  description: string;
  category: string;
  currency: string; // Primary currency of the CSV row (from currency_code)
  foreignAmount?: number | null; // Amount in foreign currency, if present
  foreignCurrency?: string | null; // Foreign currency code, if present
  tags?: string[];
  originalRecord: Record<string, string | null>;
  importStatus: 'pending' | 'success' | 'error' | 'skipped';
  errorMessage?: string | null;

  appSourceAccountId?: string | null; // Populated after account creation/mapping
  appDestinationAccountId?: string | null; // Populated after account creation/mapping
};


interface AccountPreview {
    name: string;
    currency: string;
    initialBalance: number;
    action: 'create' | 'update' | 'no change';
    existingId?: string;
    category: 'asset' | 'crypto'; // Ensure category is always set for preview
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

// Updated regex to be more robust for "Saldo inicial para (d/da/do/de) conta 'Nome'"
const parseNameFromDescriptiveString = (text: string | undefined): string | undefined => {
    if (!text) return undefined;
    // Handles "Initial balance for 'Account Name'" or "Saldo inicial para (a/da/de/do conta) 'Account Name'"
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
            if (!confirmedMappings.source_name) missingFieldLabels.push('source_name (for withdrawals/transfers)');
            if (!confirmedMappings.destination_name) missingFieldLabels.push('destination_name (for deposits/transfers)');
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
          const rowNumber = index + 2;

          const dateCol = confirmedMappings.date!;
          const amountCol = confirmedMappings.amount!;
          const currencyCol = confirmedMappings.currency_code!;
          const descCol = confirmedMappings.description;
          const categoryCol = confirmedMappings.category;
          const tagsCol = confirmedMappings.tags;
          const notesCol = confirmedMappings.notes;
          const typeCol = confirmedMappings.transaction_type!;
          const sourceNameCol = confirmedMappings.source_name;
          const destNameCol = confirmedMappings.destination_name;
          const foreignAmountCol = confirmedMappings.foreign_amount;
          const foreignCurrencyCol = confirmedMappings.foreign_currency_code;

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
                  throw new Error(`Row ${rowNumber}: Transfer source and destination accounts are the same ('${rawSourceName}'). This is not allowed.`);
              }


              const parsedAmount = parseAmount(amountValue);
              if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Could not parse amount "${amountValue}".`);

              let tempParsedForeignAmount: number | null = null;
              if (foreignAmountValue !== undefined && foreignAmountValue.trim() !== "") {
                  const tempAmount = parseAmount(foreignAmountValue);
                  if (!Number.isNaN(tempAmount)) {
                      tempParsedForeignAmount = tempAmount;
                  } else if (foreignAmountValue.trim() !== '') { // Only throw if not empty and unparsable
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

              if (!finalDescription && csvType === 'withdrawal' && rawDestName) finalDescription = rawDestName;
              if (!finalDescription && csvType === 'deposit' && rawSourceName) finalDescription = rawSourceName;
              if (!finalDescription) finalDescription = 'Imported Transaction';


              if (csvType === 'opening balance') {
                   let actualAccountNameForOB: string | undefined;
                   const parsedFromNameInDest = parseNameFromDescriptiveString(rawDestName);
                   const parsedFromNameInSource = parseNameFromDescriptiveString(rawSourceName);

                   if (parsedFromNameInDest) { // If destination_name is "Initial balance for X", X is the name
                       actualAccountNameForOB = parsedFromNameInDest;
                   } else if (parsedFromNameInSource) { // If source_name is "Initial balance for X", X is the name
                       actualAccountNameForOB = parsedFromNameInSource;
                   } else { // Neither is descriptive, one should be the clean name. Firefly: dest_name is clean.
                       if (rawDestName && !(rawDestName.toLowerCase().startsWith("initial balance for") || rawDestName.toLowerCase().startsWith("saldo inicial para"))) {
                           actualAccountNameForOB = rawDestName;
                       } else if (rawSourceName && !(rawSourceName.toLowerCase().startsWith("initial balance for") || rawSourceName.toLowerCase().startsWith("saldo inicial para"))) {
                           actualAccountNameForOB = rawSourceName;
                       } else { // Fallback if both were descriptive but unparsed, or unexpected format.
                           actualAccountNameForOB = rawDestName || rawSourceName; // Prefer dest
                       }
                   }

                   if (!actualAccountNameForOB) {
                       throw new Error(`Row ${rowNumber}: Could not determine account name for 'opening balance'. Source: ${rawSourceName}, Dest: ${rawDestName}`);
                   }

                   return {
                       csvRawSourceName: rawSourceName ?? null,
                       csvRawDestinationName: actualAccountNameForOB ?? null,
                       csvTransactionType: csvType,
                       date: parsedDate,
                       amount: parsedAmount,
                       currency: currencyValue.trim().toUpperCase(),
                       foreignAmount: finalParsedForeignAmount,
                       foreignCurrency: finalParsedForeignCurrency,
                       description: `Opening Balance: ${actualAccountNameForOB}`,
                       category: 'Opening Balance',
                       tags: [],
                       originalRecord: sanitizedRecord,
                       importStatus: 'skipped',
                       errorMessage: `Opening Balance for ${actualAccountNameForOB} (${formatCurrency(parsedAmount, currencyValue.trim().toUpperCase(), undefined, false)}) - Will be set as initial balance.`,
                       appSourceAccountId: null,
                       appDestinationAccountId: null,
                   };
              }


              return {
                  csvRawSourceName: rawSourceName ?? null,
                  csvRawDestinationName: rawDestName ?? null,
                  csvTransactionType: csvType ?? null,
                  date: parsedDate,
                  amount: parsedAmount,
                  currency: currencyValue.trim().toUpperCase(),
                  foreignAmount: finalParsedForeignAmount,
                  foreignCurrency: finalParsedForeignCurrency,
                  description: finalDescription,
                  category: categoryValue.trim(),
                  tags: parsedTags,
                  originalRecord: sanitizedRecord,
                  importStatus: 'pending',
                  errorMessage: null,
                  appSourceAccountId: null,
                  appDestinationAccountId: null,
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
                    date: parseDate(record[dateCol!]), // Ensure dateCol has a fallback or is always mapped
                    amount: 0,
                    currency: record[currencyCol!]?.trim().toUpperCase() || 'N/A', // Ensure currencyCol has fallback
                    description: `Error Processing Row ${index + 2}`,
                    category: 'Uncategorized',
                    tags: [],
                    originalRecord: errorSanitizedRecord,
                    importStatus: 'error',
                    errorMessage: rowError.message || 'Failed to process row.',
                    csvRawSourceName: (sourceNameCol && record[sourceNameCol!] ? record[sourceNameCol!]?.trim() : undefined) ?? null,
                    csvRawDestinationName: (destNameCol && record[destNameCol!] ? record[destNameCol!]?.trim() : undefined) ?? null,
                    csvTransactionType: (typeCol && record[typeCol!] ? record[typeCol!]?.trim().toLowerCase() : undefined) ?? null,
                    foreignAmount: null,
                    foreignCurrency: null,
                    appSourceAccountId: null,
                    appDestinationAccountId: null,
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

            if (existingAccount) {
                if (details.currency !== existingAccount.currency || (details.initialBalance !== undefined && details.initialBalance !== existingAccount.balance)) {
                    action = 'update';
                }
                preview.push({
                    name: details.name, // This should be the clean name from accountDetailsMap
                    currency: details.currency,
                    initialBalance: details.initialBalance !== undefined ? details.initialBalance : existingAccount.balance,
                    action: action,
                    existingId: existingAccount.id,
                    category: existingAccount.category,
                });
            } else {
                preview.push({
                    name: details.name, // This should be the clean name
                    currency: details.currency,
                    initialBalance: details.initialBalance !== undefined ? details.initialBalance : 0,
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
        const sourceNameCol = mappingsArg.source_name;
        const destNameCol = mappingsArg.destination_name;
        const amountCol = mappingsArg.amount!;
        const currencyCol = mappingsArg.currency_code!;
        const sourceTypeCol = mappingsArg.source_type;
        const destTypeCol = mappingsArg.destination_type;


        for (const record of csvData) {
            const csvType = record[typeCol]?.trim().toLowerCase();
            const recordAmount = parseAmount(record[amountCol]);
            const recordCurrency = record[currencyCol!]?.trim().toUpperCase();

            if (csvType === 'opening balance') {
                let actualAccountName: string | undefined;
                const rawSourceName = sourceNameCol ? record[sourceNameCol]?.trim() : undefined;
                const rawDestName = destNameCol ? record[destNameCol]?.trim() : undefined;

                const parsedDestName = parseNameFromDescriptiveString(rawDestName);
                const parsedSourceName = parseNameFromDescriptiveString(rawSourceName);

                if (parsedDestName) { // If destination_name is "Initial balance for X" or "Saldo inicial para X", X is the name
                    actualAccountName = parsedDestName;
                } else if (parsedSourceName) { // If source_name is "Initial balance for X", X is the name
                    actualAccountName = parsedSourceName;
                } else {
                    // Neither is descriptive, one should be the clean name.
                    // Firefly CSV for "opening balance":
                    //   source_name: "Initial balance for 'Account Name'"
                    //   destination_name: "Account Name"
                    // So, if dest_name is not descriptive, it's likely the actual account name.
                    if (rawDestName && !(rawDestName.toLowerCase().startsWith("initial balance for") || rawDestName.toLowerCase().startsWith("saldo inicial para"))) {
                        actualAccountName = rawDestName;
                    } else if (rawSourceName && !(rawSourceName.toLowerCase().startsWith("initial balance for") || rawSourceName.toLowerCase().startsWith("saldo inicial para"))) {
                        // Less common for Firefly, but handle if source_name is the clean one
                        actualAccountName = rawSourceName;
                    } else {
                        // Fallback if both are descriptive but unparsed (should not happen if regex is good), or some other format.
                        actualAccountName = rawDestName || rawSourceName; // Prefer dest
                    }
                }
                
                if (!actualAccountName) {
                     console.warn(`Could not determine account name for 'opening balance'. Row:`, record);
                     continue; 
                }

                if (recordCurrency && !isNaN(recordAmount)) {
                    const normalizedName = actualAccountName.toLowerCase();
                    const existingDetailsInMap = accountMap.get(normalizedName);
                    const category = (actualAccountName.toLowerCase().includes('crypto') || actualAccountName.toLowerCase().includes('wallet')) ? 'crypto' : 'asset';

                    accountMap.set(normalizedName, {
                        name: actualAccountName, // Use the cleaned/determined account name
                        currency: recordCurrency,
                        initialBalance: recordAmount, // Set initial balance from the opening balance row
                        category: existingDetailsInMap?.category || category,
                    });
                } else {
                     console.warn(`Could not process 'opening balance' row for "${actualAccountName}" due to missing/invalid currency or amount. Row:`, record, `Parsed Amount: ${recordAmount}`, `Currency: ${recordCurrency}`);
                }
            } else if (csvType === 'withdrawal' || csvType === 'deposit' || csvType === 'transfer') {
                const sourceName = sourceNameCol ? record[sourceNameCol]?.trim() : undefined;
                const destName = destNameCol ? record[destNameCol]?.trim() : undefined;
                const sourceType = sourceTypeCol ? record[sourceTypeCol]?.trim().toLowerCase() : undefined;
                const destType = destTypeCol ? record[destTypeCol]?.trim().toLowerCase() : undefined;

                const accountsToConsiderRaw: (string | undefined)[] = [];

                if (sourceName && (sourceType === 'asset account' || sourceType === 'default asset account' || csvType === 'withdrawal' || csvType === 'transfer')) {
                     accountsToConsiderRaw.push(sourceName);
                }
                if (destName && (destType === 'asset account' || destType === 'default asset account' || csvType === 'deposit' || csvType === 'transfer')) {
                     accountsToConsiderRaw.push(destName);
                }
                
                const accountsToConsider = [...new Set(accountsToConsiderRaw.filter(Boolean) as string[])];


                for (const accNameToConsider of accountsToConsider) {
                     if (accNameToConsider && recordCurrency) { 
                        const normalizedName = accNameToConsider.toLowerCase();
                        if (!accountMap.has(normalizedName)) {
                             const existingAppAccount = existingAccountsParam.find(a => a.name.toLowerCase() === normalizedName);
                             const category = (accNameToConsider.toLowerCase().includes('crypto') || accNameToConsider.toLowerCase().includes('wallet')) ? 'crypto' : 'asset';
                             accountMap.set(normalizedName, {
                                name: accNameToConsider,
                                currency: existingAppAccount?.currency || recordCurrency, 
                                initialBalance: existingAppAccount?.balance, 
                                category: existingAppAccount?.category || category,
                            });
                        } else { 
                            const currentDetails = accountMap.get(normalizedName)!;
                            if (!currentDetails.currency && recordCurrency) currentDetails.currency = recordCurrency;
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
        let currentAppAccounts = [...accounts];

        const workingMap = currentAppAccounts.reduce((map, acc) => {
             map[acc.name.toLowerCase().trim()] = acc.id;
             return map;
        }, {} as { [key: string]: string });



        if (accountPreviewData.length === 0 && !isPreviewOnly) {
            return { success: true, map: workingMap, updatedAccountsList: currentAppAccounts };
        }

        let accountsProcessedCount = 0;

        for (const accPreview of accountPreviewData) {
            const normalizedName = accPreview.name.toLowerCase();
            try {
                if (isPreviewOnly) {
                    if (accPreview.existingId) {
                        workingMap[normalizedName] = accPreview.existingId;
                    } else if (accPreview.action === 'create') {
                        workingMap[normalizedName] = `preview_create_${normalizedName.replace(/\s+/g, '_')}`;
                    }
                    continue;
                }


                if (accPreview.action === 'create') {
                    const newAccountData: NewAccountData = {
                        name: accPreview.name,
                        type: (accPreview.category === 'crypto' ? 'wallet' : 'checking'), 
                        balance: accPreview.initialBalance, 
                        currency: accPreview.currency,
                        providerName: 'Imported - ' + accPreview.name,
                        category: accPreview.category,
                        isActive: true,
                        lastActivity: new Date().toISOString(),
                        balanceDifference: 0,
                    };
                    const createdAccount = await addAccount(newAccountData);
                    workingMap[normalizedName] = createdAccount.id;
                    currentAppAccounts.push(createdAccount);
                    accountsProcessedCount++;
                } else if (accPreview.action === 'update' && accPreview.existingId) {
                    const existingAccountForUpdate = currentAppAccounts.find(a => a.id === accPreview.existingId);
                    if (existingAccountForUpdate) {
                        const updatedAccountData: Account = {
                            ...existingAccountForUpdate,
                            balance: accPreview.initialBalance, 
                            currency: accPreview.currency,
                            lastActivity: new Date().toISOString(),
                        };
                        const savedUpdatedAccount = await updateAccount(updatedAccountData);
                        accountsProcessedCount++;
                        const idx = currentAppAccounts.findIndex(a => a.id === savedUpdatedAccount.id);
                        if (idx !== -1) currentAppAccounts[idx] = savedUpdatedAccount;
                        workingMap[normalizedName] = savedUpdatedAccount.id;
                    }
                } else if (accPreview.existingId) {
                     workingMap[normalizedName] = accPreview.existingId;
                }

            } catch (err: any) {
                console.error(`Failed to process account "${accPreview.name}":`, err);
                toast({ title: "Account Processing Error", description: `Could not process account "${accPreview.name}". Error: ${err.message}`, variant: "destructive", duration: 7000 });
                success = false;
            }
        }

        if (accountsProcessedCount > 0 && !isPreviewOnly) {
            toast({ title: "Accounts Processed", description: `Created or updated ${accountsProcessedCount} accounts based on CSV data.` });

             const finalFetchedAccounts = await getAccounts();
             setAccounts(finalFetchedAccounts);

             const finalMap = finalFetchedAccounts.reduce((map, acc) => {
                 map[acc.name.toLowerCase().trim()] = acc.id;
                 return map;
             }, {} as { [key: string]: string });
             return { success, map: finalMap, updatedAccountsList: finalFetchedAccounts };
        }


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
          if (tx.importStatus === 'pending') {
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
                  if (!err.message?.includes('already exists')) {
                      console.error(`Failed to add category "${catName}":`, err);
                      toast({ title: "Category Add Error", description: `Could not add category "${catName}". Error: ${err.message}`, variant: "destructive" });
                      success = false;
                  }
              }
          });
          await Promise.all(addCatPromises);
          if (categoriesAddedCount > 0) {
            toast({ title: "Categories Added", description: `Added ${categoriesAddedCount} new categories.` });
             try { setCategories(await getCategories()); } catch { console.error("Failed to refetch categories."); }
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
                 try { setTags(await getTags()); } catch { console.error("Failed to refetch tags."); }
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
        const accountMapResult = await createOrUpdateAccountsAndGetMap(false); 
        if (!accountMapResult.success) {
            setError("Error finalizing accounts before import. Some accounts might not have been created/updated correctly. Import aborted.");
            setIsLoading(false);
            return;
        }
        finalMapForTxImport = accountMapResult.map;
        latestAccountsList = accountMapResult.updatedAccountsList;
        setAccounts(latestAccountsList);
        setFinalAccountMapForImport(finalMapForTxImport);
      } catch (finalAccountMapError) {
          console.error("Critical error during account finalization before import.", finalAccountMapError);
          toast({ title: "Account Sync Error", description: "Could not synchronize accounts with the database before starting transaction import. Please try again.", variant: "destructive"});
          setIsLoading(false);
          return;
      }



      const metadataSuccess = await addMissingCategoriesAndTags(recordsToImport);
      if (!metadataSuccess) {
         setError("Error adding new categories or tags from CSV. Import halted to ensure data integrity.");
         setIsLoading(false);
         return;
      }

      const currentCategoriesList = await getCategories();
      const currentTagsList = await getTags();


      const totalToImport = recordsToImport.length;
      let importedCount = 0;
      let errorCount = 0;
      const updatedDataForDisplay = [...parsedData];


      const transactionPayloads: (Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { originalMappedTx: MappedTransaction })[] = [];



      for (const item of recordsToImport) {
          const rowNumber = rawData.indexOf(item.originalRecord) + 2;
          const itemIndexInDisplay = updatedDataForDisplay.findIndex(d => d.originalRecord === item.originalRecord && d.description === item.description && d.amount === item.amount && d.date === item.date);


          if (item.csvTransactionType === 'opening balance') {
              if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'skipped', errorMessage: 'Opening Balance (handled via account balance)' };
              continue;
          }


          const transactionCategory = currentCategoriesList.find(c => c.name.toLowerCase() === item.category.toLowerCase())?.name || 'Uncategorized';
          const transactionTags = item.tags?.map(tName => currentTagsList.find(t => t.name.toLowerCase() === tName.toLowerCase())?.name || tName).filter(Boolean) || [];


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
              if (sourceAccountId === destAccountId) {
                   if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Transfer source and destination accounts are the same.` };
                  errorCount++; overallError = true; continue;
              }

              const sourceAccount = latestAccountsList.find(a => a.id === sourceAccountId);
              const destAccount = latestAccountsList.find(a => a.id === destAccountId);
              if (!sourceAccount || !destAccount) {
                if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Source or Destination account object not found after ID mapping. This is an internal error.` };
                errorCount++; overallError = true; continue;
              }


              let sourceLegAmount = -Math.abs(item.amount);
              let sourceLegCurrency = item.currency;

              let destLegAmount = Math.abs(item.amount); 
              let destLegCurrency = item.currency;    

              if (item.foreignAmount != null && item.foreignCurrency && item.foreignCurrency.toUpperCase() !== item.currency.toUpperCase()) {
                  destLegAmount = Math.abs(item.foreignAmount);
                  destLegCurrency = item.foreignCurrency;
              }


              transactionPayloads.push({
                  accountId: sourceAccountId, date: item.date, amount: sourceLegAmount,
                  transactionCurrency: sourceLegCurrency,
                  description: item.description, category: 'Transfer', tags: transactionTags,
                  originalMappedTx: item,
              });
              transactionPayloads.push({
                  accountId: destAccountId, date: item.date, amount: destLegAmount,
                  transactionCurrency: destLegCurrency,
                  description: item.description, category: 'Transfer', tags: transactionTags,
                  originalMappedTx: { ...item, description: `From ${sourceAccount.name}: ${item.description || ''}` },
              });

          } else if (item.csvTransactionType === 'withdrawal' || item.csvTransactionType === 'deposit') {
              let accountNameForTx: string | undefined | null;
              if (item.csvTransactionType === 'withdrawal') {
                  accountNameForTx = item.csvRawSourceName;
              } else {
                  accountNameForTx = item.csvRawDestinationName;
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

              if (isNaN(item.amount)) {
                    if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Invalid amount for import.` };
                    errorCount++; overallError = true; continue;
              }


              let payloadAmount = item.amount;
              let payloadCurrency = item.currency;

              const targetAccount = latestAccountsList.find(a => a.id === accountIdForTx);

              if (targetAccount && item.foreignCurrency && item.foreignAmount != null && !isNaN(item.foreignAmount) &&
                  targetAccount.currency.toUpperCase() === item.foreignCurrency.toUpperCase()) {
                  payloadAmount = item.foreignAmount; 
                  payloadCurrency = item.foreignCurrency;
                  if (item.csvTransactionType === 'withdrawal' && payloadAmount > 0) payloadAmount = -payloadAmount;
                  if (item.csvTransactionType === 'deposit' && payloadAmount < 0) payloadAmount = Math.abs(payloadAmount);

              } else { 
                 if (item.csvTransactionType === 'withdrawal' && payloadAmount > 0) {
                    payloadAmount = -payloadAmount;
                 } else if (item.csvTransactionType === 'deposit' && payloadAmount < 0) {
                    payloadAmount = Math.abs(payloadAmount);
                 }
              }


              transactionPayloads.push({
                  accountId: accountIdForTx, date: item.date, amount: payloadAmount,
                  transactionCurrency: payloadCurrency,
                  description: item.description, category: transactionCategory, tags: transactionTags,
                  originalMappedTx: item,
              });
          } else {
               if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Unknown Firefly transaction type "${item.csvTransactionType}". Supported: withdrawal, deposit, transfer, opening balance.` };
               errorCount++; overallError = true;
          }
      }



      transactionPayloads.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (const payload of transactionPayloads) {
          const itemIndexInDisplay = updatedDataForDisplay.findIndex(d =>
              d.originalRecord === payload.originalMappedTx.originalRecord &&
              d.description === payload.originalMappedTx.description &&
              d.amount === payload.originalMappedTx.amount &&
              d.date === payload.originalMappedTx.date &&
              d.importStatus !== 'success'
          );
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
          setImportProgress(calculateProgress(importedCount + errorCount, transactionPayloads.length));
          setParsedData([...updatedDataForDisplay]);
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
         setError(null);


         window.dispatchEvent(new Event('storage'));
      }

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

            toast({ title: "Data Cleared", description: "All user data (accounts, categories, tags, transactions) has been removed from the database for your account." });
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


    const getDisplayableAccountName = (csvName?: string | null): string => {
        if (!csvName) return "Unknown Account";
        const previewAccount = accountPreviewData.find(ap => ap.name.toLowerCase() === csvName.toLowerCase());
        if (previewAccount) return previewAccount.name;


        const existingAccountId = finalAccountMapForImport[csvName.toLowerCase()];
        const existingAccount = accounts.find(acc => acc.id === existingAccountId);
        return existingAccount?.name || csvName;
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


        if (!grouped[accountKeyForGrouping]) {
            grouped[accountKeyForGrouping] = [];
        }
        (item as any)._accountDisplayNameForGroup = accountDisplayName;
        grouped[accountKeyForGrouping].push(item);
    });


    return Object.entries(grouped)
      .sort(([keyA], [keyB]) => {
          const nameA = (grouped[keyA][0] as any)._accountDisplayNameForGroup || keyA;
          const nameB = (grouped[keyB][0] as any)._accountDisplayNameForGroup || keyB;
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

