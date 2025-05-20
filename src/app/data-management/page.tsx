
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Papa, { ParseResult } from 'papaparse';
import JSZip from 'jszip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { addTransaction, type Transaction, clearAllSessionTransactions, type NewTransactionData } from '@/services/transactions';
import { getAccounts, addAccount, type Account, type NewAccountData, updateAccount } from '@/services/account-sync';
import { getCategories, addCategory as addCategoryToDb, type Category, updateCategory as updateCategoryInDb, getCategoryStyle } from '@/services/categories';
import { getTags, addTag as addTagToDb, type Tag, getTagStyle } from '@/services/tags';
import { getGroups, addGroup as addGroupToDb, updateGroup as updateGroupInDb, type Group } from '@/services/groups';
import { getSubscriptions, addSubscription as addSubscriptionToDb, type Subscription } from '@/services/subscriptions';
import { getLoans, addLoan as addLoanToDb, type Loan } from '@/services/loans';
import { getCreditCards, addCreditCard as addCreditCardToDb, type CreditCard } from '@/services/credit-cards';
import { getBudgets, addBudget as addBudgetToDb, type Budget } from '@/services/budgets';
import { saveUserPreferences, type UserPreferences, getUserPreferences } from '@/lib/preferences';


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { format, parseISO, isValid, parse as parseDateFns } from 'date-fns';
import { getCurrencySymbol, supportedCurrencies, formatCurrency, convertCurrency } from '@/lib/currency';
import CsvMappingForm, { type ColumnMapping } from '@/components/import/csv-mapping-form';
import { AlertCircle, Trash2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/contexts/AuthContext';
import Link from 'next/link';
import { exportAllUserDataToZip } from '@/services/export';

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
  csvSourceType?: string | null;
  csvDestinationType?: string | null;

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
  originalImportData?: {
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
    
    const dotMatches = cleaned.match(/\./g);
    if (dotMatches && dotMatches.length > 1) {
        const lastDotIndex = cleaned.lastIndexOf('.');
        const partAfterLastDot = cleaned.substring(lastDotIndex + 1);
        if (partAfterLastDot.length < 3 || partAfterLastDot.match(/^\d+$/) ) { 
             cleaned = cleaned.substring(0, lastDotIndex).replace(/\./g, '') + '.' + partAfterLastDot;
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
            "yyyy-MM-dd'T'HH:mm:ssXXX", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss",
            'dd/MM/yyyy HH:mm:ss', 'MM/dd/yyyy HH:mm:ss', 'yyyy-MM-dd HH:mm:ss',
            'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd',
            'dd.MM.yyyy', 'MM.dd.yyyy',
            'dd-MM-yyyy', 'MM-dd-yyyy',
            'yyyy/MM/dd', 'yyyy/dd/MM',
        ];

        for (const fmt of commonFormats) {
            try {
                parsedDate = parseDateFns(dateStr, fmt, new Date());
                if (isValid(parsedDate)) return format(parsedDate, 'yyyy-MM-dd');

                const datePartOnly = dateStr.split('T')[0].split(' ')[0];
                const dateFormatOnly = fmt.split('T')[0].split(' ')[0];
                if (datePartOnly !== dateStr && dateFormatOnly !== fmt) {
                    parsedDate = parseDateFns(datePartOnly, dateFormatOnly, new Date());
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
    const match = text.match(/(?:Initial balance for |Saldo inicial para(?: d[aeo] conta)?)\s*["']?([^"':]+)(?:["']?|$)/i);
    return match ? match[1]?.trim() : undefined;
};


export default function DataManagementPage() {
  const { user, isLoadingAuth, refreshUserPreferences } = useAuthContext();
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
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  // New state for restore confirmation
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [zipFileForRestore, setZipFileForRestore] = useState<File | null>(null);


  const fetchData = useCallback(async () => {
    let isMounted = true;
    if (isMounted && !isLoading) setIsLoading(true); 

    if (typeof window === 'undefined' || !user || isLoadingAuth) {
      if(isMounted) setIsLoading(false);
      return;
    }
    setError(null);

    try {
      const [fetchedAccounts, fetchedCategories, fetchedTagsList] = await Promise.all([
        getAccounts(),
        getCategories(),
        getTags()
      ]);

      if (isMounted) {
        setAccounts(fetchedAccounts);
        setCategories(fetchedCategories);
        setTags(fetchedTagsList);
      }
    } catch (err: any) {
      console.error("Failed to fetch initial data for Data Management page:", err);
      if (isMounted) {
        setError("Could not load essential page data. Please try refreshing. Details: " + err.message);
        toast({ title: "Page Load Error", description: "Failed to load initial data (accounts, categories, or tags). " + err.message, variant: "destructive" });
      }
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
    return () => { isMounted = false; };
  }, [user, isLoadingAuth]); // Removed toast, added isLoading to prevent re-trigger if already loading

  useEffect(() => {
    fetchData();
  }, [fetchData]); // fetchData is memoized, so this runs once on mount / when user/auth status changes.

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
      setZipFileForRestore(null);
      setIsRestoreConfirmOpen(false);
    }
  };

  const processCsvData = (csvString: string, fileName: string) => {
    Papa.parse<CsvRecord>(csvString, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<CsvRecord>) => {
        if (results.errors.length > 0 && !results.data.length) {
          const criticalError = results.errors.find(e => e.code !== 'TooManyFields' && e.code !== 'TooFewFields') || results.errors[0];
          setError(`CSV Parsing Error from ${fileName}: ${criticalError.message}. Code: ${criticalError.code}. Ensure headers are correct and file encoding is UTF-8.`);
          setIsLoading(false);
          return;
        }
        if (results.errors.length > 0) {
          console.warn(`Minor CSV parsing errors encountered in ${fileName}:`, results.errors);
          toast({ title: "CSV Parsing Warning", description: `Some rows in ${fileName} might have issues: ${results.errors.map(e=>e.message).slice(0,2).join('; ')}`, variant:"default", duration: 7000});
        }

        if (!results.data || results.data.length === 0) {
          setError(`CSV file ${fileName} is empty or doesn't contain valid data rows.`);
          setIsLoading(false);
          return;
        }

        const headers = results.meta.fields;
        if (!headers || headers.length === 0) {
          setError(`Could not read CSV headers from ${fileName}. Ensure the first row contains column names.`);
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
        setIsMappingDialogOpen(true); // Show mapping dialog for generic CSV or non-GoldQuest ZIP
        setIsLoading(false);
      },
      error: (err: Error) => {
        setError(`Failed to read or parse CSV string from ${fileName}: ${err.message}.`);
        setIsLoading(false);
      }
    });
  };

  const handleParseAndMap = async () => {
    if (!file) {
      setError("Please select a CSV or ZIP file first.");
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
    setZipFileForRestore(null);
    setIsMappingDialogOpen(false); // Reset mapping dialog state

    if (file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
        try {
            const zip = await JSZip.loadAsync(file);
            const manifestFile = zip.file('goldquest_manifest.json');
            
            if (manifestFile) { // Detected a GoldQuest backup
                const manifestContent = await manifestFile.async('string');
                const manifest = JSON.parse(manifestContent);
                if (manifest.appName === "GoldQuest") {
                    setZipFileForRestore(file);
                    setIsRestoreConfirmOpen(true); // Go directly to restore confirmation
                    setIsLoading(false);
                    return; // Skip manual mapping
                }
            }
            
            // If not a GoldQuest backup or no manifest, try to find a primary CSV for manual mapping
            let primaryCsvFile: JSZip.JSZipObject | null = null;
            const commonPrimaryNames = ['transactions.csv', 'firefly_iii_export.csv', 'default.csv'];
            for (const name of commonPrimaryNames) {
                const foundFile = zip.file(name);
                if (foundFile) {
                    primaryCsvFile = foundFile;
                    break;
                }
            }
            if (!primaryCsvFile) { // Fallback to largest CSV if common names not found
                let largestSize = 0;
                zip.forEach((relativePath, zipEntry) => {
                    if (zipEntry.name.toLowerCase().endsWith('.csv') && !zipEntry.dir) {
                        const uncompressedSize = (zipEntry as any)._data?.uncompressedSize || 0;
                        if (uncompressedSize > largestSize) {
                            largestSize = uncompressedSize;
                            primaryCsvFile = zipEntry;
                        }
                    }
                });
            }

            if (primaryCsvFile) {
                toast({ title: "ZIP Detected", description: `Processing '${primaryCsvFile.name}' from the archive for manual mapping.`, duration: 4000});
                const csvString = await primaryCsvFile.async("string");
                processCsvData(csvString, primaryCsvFile.name); // This will open mapping dialog
            } else {
                setError("No suitable CSV file found within the ZIP archive to process for mapping. If this is a GoldQuest backup, it might be missing a manifest or CSV files.");
                setIsLoading(false);
            }
        } catch (zipError: any) {
            setError(`Failed to process ZIP file: ${zipError.message}`);
            setIsLoading(false);
        }
    } else if (file.name.endsWith('.csv') || file.type === 'text/csv') { // Direct CSV upload
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result && typeof event.target.result === 'string') {
                processCsvData(event.target.result, file.name); // This will open mapping dialog
            } else {
                setError("Failed to read CSV file content.");
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
            setError("Error reading CSV file.");
            setIsLoading(false);
        };
        reader.readAsText(file);
    } else {
        setError("Unsupported file type. Please upload a CSV or a ZIP file containing CSVs.");
        setIsLoading(false);
    }
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

         const { preview } = await previewAccountChanges(
             rawData,
             confirmedMappings,
             currentAccounts 
         );
         setAccountPreviewData(preview);
         console.log("Account preview generated:", preview);

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
          const sourceNameCol = confirmedMappings.source_name!;
          const destNameCol = confirmedMappings.destination_name!;
          const foreignAmountCol = confirmedMappings.foreign_amount;
          const foreignCurrencyCol = confirmedMappings.foreign_currency_code;
          const sourceTypeCol = confirmedMappings.source_type;
          const destTypeCol = confirmedMappings.destination_type;
          const initialBalanceCol = confirmedMappings.initialBalance;

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
              let amountValue = record[amountCol];
              const currencyValue = record[currencyCol];
              const foreignAmountValue = foreignAmountCol ? record[foreignAmountCol] : undefined;
              const foreignCurrencyValue = foreignCurrencyCol ? record[foreignCurrencyCol] : undefined;

              const descriptionValue = descCol ? record[descCol] || '' : '';
              const categoryValue = categoryCol ? record[categoryCol] || 'Uncategorized' : 'Uncategorized';
              const tagsValue = tagsCol ? record[tagsCol] || '' : '';
              const notesValue = notesCol ? record[notesCol] || '' : '';

              let rawSourceName = record[sourceNameCol]?.trim();
              let rawDestName = record[destNameCol]?.trim();
              let rawSourceType = sourceTypeCol ? record[sourceTypeCol]?.trim().toLowerCase() : undefined;
              let rawDestType = destTypeCol ? record[destTypeCol]?.trim().toLowerCase() : undefined;

              if (!dateValue) throw new Error(`Row ${rowNumber}: Missing mapped 'Date' data.`);
              if (amountValue === undefined || amountValue.trim() === '') throw new Error(`Row ${rowNumber}: Missing or empty 'Amount' data.`);
              if (!currencyValue || currencyValue.trim() === '') throw new Error(`Row ${rowNumber}: Missing or empty 'Currency Code' data.`);
              if (!csvType) throw new Error(`Row ${rowNumber}: Missing or empty 'Transaction Type' (Firefly 'type') data.`);

              if (csvType === 'withdrawal' || csvType === 'transfer') {
                if (!rawSourceName) throw new Error(`Row ${rowNumber}: Missing 'Source Name' for type '${csvType}'.`);
              }
              if (csvType === 'deposit' || csvType === 'transfer') {
                 if (!rawDestName) throw new Error(`Row ${rowNumber}: Missing 'Destination Name' for type '${csvType}'.`);
              }
              if (csvType === 'transfer' && rawSourceName && rawDestName && rawSourceName.toLowerCase() === rawDestName.toLowerCase()) {
                  if (rawSourceType?.includes('asset') && rawDestType?.includes('asset')) { 
                    throw new Error(`Row ${rowNumber}: Transfer source and destination asset accounts are the same ('${rawSourceName}').`);
                  }
              }

              const parsedAmount = parseAmount(amountValue);
              if (isNaN(parsedAmount)) throw new Error(`Row ${rowNumber}: Could not parse amount "${amountValue}".`);

              let tempParsedForeignAmount: number | null = null;
              if (foreignAmountValue !== undefined && foreignAmountValue.trim() !== "") {
                  const tempAmount = parseAmount(foreignAmountValue);
                  if (!Number.isNaN(tempAmount)) {
                      tempParsedForeignAmount = tempAmount;
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
                   let initialBalanceValue = initialBalanceCol ? record[initialBalanceCol] : amountValue;
                   let parsedInitialBalance = parseAmount(initialBalanceValue);

                   if(isNaN(parsedInitialBalance)) {
                        throw new Error(`Row ${rowNumber}: Could not parse initial balance for 'opening balance'. Value was: '${initialBalanceValue}'.`)
                   }
                   
                    if (rawDestType === "asset account" && rawDestName) {
                        actualAccountNameForOB = rawDestName;
                    } else if (rawSourceType === "asset account" && rawSourceName) {
                        actualAccountNameForOB = rawSourceName;
                    } else {
                        const parsedFromNameInDest = parseNameFromDescriptiveString(rawDestName);
                        const parsedFromNameInSource = parseNameFromDescriptiveString(rawSourceName);

                        if (parsedFromNameInDest) actualAccountNameForOB = parsedFromNameInDest;
                        else if (parsedFromNameInSource) actualAccountNameForOB = parsedFromNameInSource;
                        else actualAccountNameForOB = rawDestName || rawSourceName; 
                    }

                   if (!actualAccountNameForOB) {
                       throw new Error(`Row ${rowNumber}: Could not determine account name for 'opening balance'. Source: ${rawSourceName}, Dest: ${rawDestName}, SourceType: ${rawSourceType}, DestType: ${rawDestType}`);
                   }

                   return {
                       csvRawSourceName: rawSourceName ?? null,
                       csvRawDestinationName: actualAccountNameForOB ?? null,
                       csvTransactionType: csvType,
                       csvSourceType: rawSourceType,
                       csvDestinationType: rawDestType,
                       date: parsedDate,
                       amount: parsedInitialBalance,
                       currency: currencyValue.trim().toUpperCase(),
                       foreignAmount: finalParsedForeignAmount,
                       foreignCurrency: finalParsedForeignCurrency,
                       description: `Opening Balance: ${actualAccountNameForOB}`,
                       category: 'Opening Balance',
                       tags: [],
                       originalRecord: sanitizedRecord,
                       importStatus: 'skipped',
                       errorMessage: `Opening Balance for ${actualAccountNameForOB} (${formatCurrency(parsedInitialBalance, currencyValue.trim().toUpperCase(), undefined, false)}) - Will be set as initial balance during account creation/update.`,
                       appSourceAccountId: null,
                       appDestinationAccountId: null,
                       originalImportData: { foreignAmount: finalParsedForeignAmount, foreignCurrency: finalParsedForeignCurrency },
                   };
              }

              return {
                  csvRawSourceName: rawSourceName ?? null,
                  csvRawDestinationName: rawDestName ?? null,
                  csvTransactionType: csvType ?? null,
                  csvSourceType: rawSourceType,
                  csvDestinationType: rawDestType,
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
                    date: parseDate(record[confirmedMappings.date!]),
                    amount: 0,
                    currency: record[confirmedMappings.currency_code!]?.trim().toUpperCase() || 'N/A',
                    description: `Error Processing Row ${index + 2}`,
                    category: 'Uncategorized',
                    tags: [],
                    originalRecord: errorSanitizedRecord,
                    importStatus: 'error',
                    errorMessage: rowError.message || 'Failed to process row.',
                    csvRawSourceName: (confirmedMappings.source_name && record[confirmedMappings.source_name] ? record[confirmedMappings.source_name]?.trim() : undefined) ?? null,
                    csvRawDestinationName: (confirmedMappings.destination_name && record[confirmedMappings.destination_name] ? record[confirmedMappings.destination_name]?.trim() : undefined) ?? null,
                    csvTransactionType: (confirmedMappings.transaction_type && record[confirmedMappings.transaction_type] ? record[confirmedMappings.transaction_type]?.trim().toLowerCase() : undefined) ?? null,
                    csvSourceType: (confirmedMappings.source_type && record[confirmedMappings.source_type] ? record[confirmedMappings.source_type]?.trim().toLowerCase() : undefined) ?? null,
                    csvDestinationType: (confirmedMappings.destination_type && record[confirmedMappings.destination_type] ? record[confirmedMappings.destination_type]?.trim().toLowerCase() : undefined) ?? null,
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
        
        const mappedTransactions = csvData.map(record => {
            const type = record[mappings.transaction_type!]?.trim().toLowerCase();
            const sourceName = record[mappings.source_name!]?.trim();
            const destName = record[mappings.destination_name!]?.trim();
            const sourceType = record[mappings.source_type!]?.trim().toLowerCase();
            const destType = record[mappings.destination_type!]?.trim().toLowerCase();
            const currency = record[mappings.currency_code!]?.trim().toUpperCase();
            const amount = parseAmount(record[mappings.amount!]);
            const initialBalance = parseAmount(record[mappings.initialBalance!] || record[mappings.amount!]);
            const foreignCurrencyVal = record[mappings.foreign_currency_code!]?.trim().toUpperCase();

            return {
                csvTransactionType: type,
                csvRawSourceName: sourceName,
                csvRawDestinationName: destName,
                csvSourceType: sourceType,
                csvDestinationType: destType,
                currency: currency,
                foreignCurrency: foreignCurrencyVal,
                amount: type === 'opening balance' ? initialBalance : amount,
            };
        }) as Partial<MappedTransaction>[];

        const accountDetailsMap = await buildAccountUpdateMap(mappedTransactions, existingAccountsParam);

        const preview: AccountPreview[] = [];
        const processedAccountNames = new Set<string>();

        accountDetailsMap.forEach((details, normalizedName) => {
            const existingAccount = existingAccountsParam.find(acc => acc.name.toLowerCase() === normalizedName);
            let action: AccountPreview['action'] = 'no change';
            let finalBalance = details.initialBalance !== undefined ? details.initialBalance : (existingAccount?.balance ?? 0);

            if (existingAccount) {
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
        mappedCsvData: Partial<MappedTransaction>[],
        existingAccountsParam: Account[]
    ): Promise<Map<string, { name: string; currency: string; initialBalance?: number; category: 'asset' | 'crypto' }>> => {
        const accountMap = new Map<string, { name: string; currency: string; initialBalance?: number; category: 'asset' | 'crypto' }>();

        for (const item of mappedCsvData) {
            if (item.csvTransactionType === 'opening balance') {
                let accountNameForOB: string | undefined;
                const recordCurrency = item.currency;
                const recordAmount = item.amount;

                const descriptiveDestName = item.csvRawDestinationName;
                const descriptiveSourceName = item.csvRawSourceName;

                const parsedNameFromDest = parseNameFromDescriptiveString(descriptiveDestName);
                const parsedNameFromSource = parseNameFromDescriptiveString(descriptiveSourceName);
                const sourceIsDescriptive = !!parsedNameFromSource;
                const destIsDescriptive = !!parsedNameFromDest;


                if (item.csvDestinationType === "asset account" && descriptiveDestName && !destIsDescriptive ) {
                    accountNameForOB = descriptiveDestName;
                } else if (item.csvSourceType === "asset account" && descriptiveSourceName && !sourceIsDescriptive) {
                    accountNameForOB = descriptiveSourceName;
                } else if (parsedNameFromDest) {
                    accountNameForOB = parsedNameFromDest;
                } else if (parsedNameFromSource) {
                     accountNameForOB = parsedNameFromSource;
                } else {
                    accountNameForOB = descriptiveDestName || descriptiveSourceName;
                }

                if (accountNameForOB && recordCurrency && recordAmount !== undefined && !isNaN(recordAmount)) {
                    const normalizedName = accountNameForOB.toLowerCase().trim();
                    const existingDetailsInMap = accountMap.get(normalizedName);
                    let accountCategory: 'asset' | 'crypto' = 'asset';
                    
                    if (item.csvDestinationType === "asset account" && !destIsDescriptive && item.csvRawDestinationName?.toLowerCase().includes('crypto')) {
                        accountCategory = 'crypto';
                    } else if (item.csvSourceType === "asset account" && !sourceIsDescriptive && item.csvRawSourceName?.toLowerCase().includes('crypto')) {
                        accountCategory = 'crypto';
                    } else if (item.csvDestinationType?.includes('crypto') || item.csvSourceType?.includes('crypto') || accountNameForOB.toLowerCase().includes('crypto') || accountNameForOB.toLowerCase().includes('wallet')) {
                        accountCategory = 'crypto';
                    }

                    accountMap.set(normalizedName, {
                        name: accountNameForOB,
                        currency: recordCurrency,
                        initialBalance: recordAmount,
                        category: existingDetailsInMap?.category || accountCategory,
                    });
                }
            } else if (item.csvTransactionType === 'withdrawal' || item.csvTransactionType === 'deposit' || item.csvTransactionType === 'transfer') {
                const accountsToConsiderRaw: {name?: string | null, type?: string | null, currency?: string}[] = [];

                if (item.csvRawSourceName && (item.csvSourceType === 'asset account' || item.csvSourceType === 'default asset account')) {
                    accountsToConsiderRaw.push({name: item.csvRawSourceName, type: item.csvSourceType, currency: item.currency});
                }
                if (item.csvRawDestinationName && (item.csvDestinationType === 'asset account' || item.csvDestinationType === 'default asset account')) {
                    const destCurrency = (item.csvTransactionType === 'transfer' && item.foreignCurrency) 
                                          ? item.foreignCurrency 
                                          : item.currency;
                    accountsToConsiderRaw.push({name: item.csvRawDestinationName, type: item.csvDestinationType, currency: destCurrency});
                }
                
                const uniqueAccountNamesAndCurrencies = accountsToConsiderRaw.filter(
                    (value, index, self) => value.name && self.findIndex(t => t.name?.toLowerCase().trim() === value.name?.toLowerCase().trim()) === index
                );

                for (const accInfo of uniqueAccountNamesAndCurrencies) {
                     if (accInfo.name && accInfo.currency) {
                        const normalizedName = accInfo.name.toLowerCase().trim();
                        let category: 'asset' | 'crypto' = 'asset';
                        if (accInfo.name.toLowerCase().includes('crypto') || 
                            accInfo.name.toLowerCase().includes('wallet') || 
                            (accInfo.type && accInfo.type.includes('crypto')) ) {
                            category = 'crypto';
                        }

                        if (!accountMap.has(normalizedName)) {
                             const existingAppAccount = existingAccountsParam.find(a => a.name.toLowerCase() === normalizedName);
                             accountMap.set(normalizedName, {
                                name: accInfo.name,
                                currency: existingAppAccount?.currency || accInfo.currency,
                                initialBalance: existingAppAccount?.balance,
                                category: existingAppAccount?.category || category,
                            });
                        } else {
                            const currentDetails = accountMap.get(normalizedName)!;
                            if (!currentDetails.currency && accInfo.currency) currentDetails.currency = accInfo.currency; 
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
            const normalizedName = accPreview.name.toLowerCase().trim();
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
                        includeInNetWorth: true,
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
                            category: accPreview.category,
                            includeInNetWorth: existingAccountForUpdate.includeInNetWorth ?? true,
                        };
                        const savedUpdatedAccount = await updateAccount(updatedAccountData);
                        accountsProcessedCount++;
                        const idx = currentAppAccounts.findIndex(a => a.id === savedUpdatedAccount.id);
                        if (idx !== -1) currentAppAccounts[idx] = savedUpdatedAccount;
                        else currentAppAccounts.push(savedUpdatedAccount);

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
        }

        if (!isPreviewOnly && accountsProcessedCount > 0) {
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
                  await addCategoryToDb(catName); 
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
             try { setCategories(await getCategories()); } catch { console.error("Failed to refetch categories after add."); }
          }
      }

      if (tagsToAdd.size > 0) {
            let tagsAddedCount = 0;
            const addTagPromises = Array.from(tagsToAdd).map(async (tagName) => {
                try {
                    await addTagToDb(tagName); 
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
        const accountMapResult = await createOrUpdateAccountsAndGetMap(false);
        if (!accountMapResult.success) {
            setError("Error processing some accounts during import. Some accounts might not have been created/updated correctly. Review account preview and transaction statuses.");
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
         setError("Error adding new categories or tags from CSV. Some transactions might use 'Uncategorized' or miss tags. Import halted to ensure data integrity.");
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
              if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'skipped', errorMessage: 'Opening Balance (handled via account balance creation/update)' };
              continue;
          }

          const transactionCategory = currentCategoriesList.find(c => c.name.toLowerCase() === item.category.toLowerCase())?.name || 'Uncategorized';
          const transactionTags = item.tags?.map(tName => currentTagsList.find(t => t.name.toLowerCase() === tName.toLowerCase())?.name || tName).filter(Boolean) || [];

            if (item.csvTransactionType === 'transfer') {
                const csvAmount = item.amount; 
                const csvCurrency = item.currency; 
                const csvForeignAmount = item.originalImportData?.foreignAmount;
                const csvForeignCurrency = item.originalImportData?.foreignCurrency;
                
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
                
                const fromAccountDetails = latestAccountsList.find(a => a.id === fromAccountId);
                const toAccountDetails = latestAccountsList.find(a => a.id === toAccountId);
                if (!fromAccountDetails || !toAccountDetails) {
                     if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Could not find account details for transfer.` };
                    errorCount++; overallError = true; continue;
                }

                const transferDesc = item.description || `Transfer from ${fromAccountDetails.name} to ${toAccountDetails.name}`;
                
                let debitAmount = -Math.abs(csvAmount); 
                let debitCurrency = csvCurrency;       
                let creditAmount = Math.abs(csvAmount);  
                let creditCurrency = csvCurrency;     

                if (csvForeignAmount != null && csvForeignCurrency && csvForeignCurrency.trim() !== '') {
                    creditAmount = Math.abs(csvForeignAmount);
                    creditCurrency = csvForeignCurrency;
                }

                transactionPayloads.push({ 
                    accountId: fromAccountId,
                    date: item.date,
                    amount: debitAmount, 
                    transactionCurrency: debitCurrency, 
                    description: transferDesc,
                    category: 'Transfer', 
                    tags: transactionTags,
                    originalMappedTx: item,
                    originalImportData: item.originalImportData,
                });
                transactionPayloads.push({ 
                    accountId: toAccountId,
                    date: item.date,
                    amount: creditAmount, 
                    transactionCurrency: creditCurrency, 
                    description: transferDesc,
                    category: 'Transfer', 
                    tags: transactionTags,
                    originalMappedTx: item, 
                    originalImportData: item.originalImportData,
                });

            } else if (item.csvTransactionType === 'withdrawal' || item.csvTransactionType === 'deposit') {
                let accountNameForTx: string | undefined | null;
                let accountIdForTx: string | undefined;
                let payloadAmount = item.amount; 
                let payloadCurrency = item.currency;

                if (item.csvTransactionType === 'withdrawal') {
                    accountNameForTx = item.csvRawSourceName;
                    if (item.csvSourceType !== 'asset account' && item.csvSourceType !== 'default asset account') {
                         if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Withdrawal from non-asset account type '${item.csvSourceType}' for source '${accountNameForTx}'. Skipping.` };
                         errorCount++; overallError = true; continue;
                    }
                } else { 
                    accountNameForTx = item.csvRawDestinationName;
                     if (item.csvDestinationType !== 'asset account' && item.csvDestinationType !== 'default asset account') {
                         if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Deposit to non-asset account type '${item.csvDestinationType}' for destination '${accountNameForTx}'. Skipping.` };
                         errorCount++; overallError = true; continue;
                    }
                }

                if (!accountNameForTx) {
                    if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Could not determine asset account for ${item.csvTransactionType}. Source: ${item.csvRawSourceName}, Dest: ${item.csvRawDestinationName}` };
                    errorCount++; overallError = true; continue;
                }

                accountIdForTx = finalMapForTxImport[accountNameForTx.toLowerCase().trim()];
                if (!accountIdForTx || accountIdForTx.startsWith('preview_') || accountIdForTx.startsWith('error_') || accountIdForTx.startsWith('skipped_')) {
                    if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Could not find valid account ID for "${accountNameForTx}". Mapped ID: ${accountIdForTx}.` };
                    errorCount++; overallError = true; continue;
                }

                if (Number.isNaN(payloadAmount)) {
                    if(itemIndexInDisplay !== -1) updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: `Row ${rowNumber}: Invalid amount for import.` };
                    errorCount++; overallError = true; continue;
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
                updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'success', errorMessage: undefined };
              }
              importedCount++;
          } catch (err: any) {
              console.error(`Failed to import transaction for original row:`, payload.originalMappedTx.originalRecord, err);
               if(itemIndexInDisplay !== -1 && updatedDataForDisplay[itemIndexInDisplay].importStatus !== 'success') { 
                  updatedDataForDisplay[itemIndexInDisplay] = { ...updatedDataForDisplay[itemIndexInDisplay], importStatus: 'error', errorMessage: err.message || 'Unknown import error' };
               }
              errorCount++;
              overallError = true;
          }
          setImportProgress(calculateProgress(importedCount + errorCount, transactionPayloads.length )); 
          setParsedData([...updatedDataForDisplay]); 
      }

      setIsLoading(false);
      const finalMessage = `Import finished. Successfully processed transaction entries: ${importedCount}. Failed/Skipped rows (from preview): ${errorCount + parsedData.filter(d => d.importStatus === 'skipped').length}.`;
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

            toast({ title: "Data Cleared", description: "All user data (accounts, categories, tags, groups, subscriptions, transactions, loans, credit cards, and budgets) has been removed." });
            window.dispatchEvent(new Event('storage'));
        } catch (err) {
            console.error("Failed to clear data:", err);
            toast({ title: "Error", description: "Could not clear stored data.", variant: "destructive" });
        } finally {
            setIsClearing(false);
        }
    };

    const handleExportData = async () => {
        if (!user) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
        return;
        }
        setIsExporting(true);
        toast({ title: "Exporting Data", description: "Preparing your data for download. This may take a moment..." });
        try {
        await exportAllUserDataToZip(); 
        toast({ title: "Export Complete", description: "Your data backup ZIP file should be downloading now. Please check your browser's download folder." });
        } catch (error) {
        console.error("Export failed:", error);
        toast({ title: "Export Failed", description: "Could not export your data. Please try again.", variant: "destructive" });
        } finally {
        setIsExporting(false);
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

    const getDisplayableAccountName = (csvName?: string | null, csvType?: string | null): string => {
        if (!csvName) return "Unknown / External";
        const lowerCsvName = csvName.toLowerCase().trim();
        const lowerCsvType = csvType?.toLowerCase().trim();

        if (lowerCsvType && (lowerCsvType.includes('revenue account') || lowerCsvType.includes('expense account'))) {
            return `${csvName} (External)`;
        }

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
                ? `Account Balance Update: ${getDisplayableAccountName(item.csvRawDestinationName || item.csvRawSourceName, item.csvDestinationType || item.csvSourceType)}`
                : `Errors / Skipped Transactions`;
             accountKeyForGrouping = `system-${item.importStatus}-${item.errorMessage?.substring(0,20) || 'general'}`;
        } else if (item.csvTransactionType === 'transfer') {
            const sourceName = getDisplayableAccountName(item.csvRawSourceName, item.csvSourceType);
            const destName = getDisplayableAccountName(item.csvRawDestinationName, item.csvDestinationType);
            accountDisplayName = `Transfer: ${sourceName} -> ${destName}`;
            accountKeyForGrouping = `transfer-${sourceName}-${destName}`;

        } else if (item.csvTransactionType === 'withdrawal') {
            accountDisplayName = getDisplayableAccountName(item.csvRawSourceName, item.csvSourceType);
            accountKeyForGrouping = `account-${accountDisplayName}-withdrawal`;
        } else if (item.csvTransactionType === 'deposit') {
            accountDisplayName = getDisplayableAccountName(item.csvRawDestinationName, item.csvDestinationType);
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

  // Full Restore Logic
  const handleFullRestoreFromZip = async () => {
    if (!zipFileForRestore || !user) {
      toast({ title: "Error", description: "No backup file selected or user not authenticated.", variant: "destructive" });
      setIsRestoreConfirmOpen(false);
      return;
    }
    setIsLoading(true);
    setImportProgress(0);
    setError(null);
    let overallSuccess = true;

    try {
      toast({ title: "Restore Started", description: "Clearing existing data...", duration: 2000 });
      await clearAllSessionTransactions();
      toast({ title: "Restore Progress", description: "Existing data cleared. Starting import...", duration: 2000 });

      const zip = await JSZip.loadAsync(zipFileForRestore);
      let progressCounter = 0;
      const totalFilesToProcess = 10; // Approx count of CSV files

      const updateProgress = () => {
        progressCounter++;
        setImportProgress(calculateProgress(progressCounter, totalFilesToProcess));
      };
      
      const oldAccountIdToNewIdMap: Record<string, string> = {};
      const oldCategoryIdToNewIdMap: Record<string, string> = {};
      const oldGroupIdToNewIdMap: Record<string, string> = {};

      // 1. Preferences
      const prefsFile = zip.file('goldquest_preferences.csv');
      if (prefsFile) {
        const prefsCsv = await prefsFile.async('text');
        const parsedPrefs = Papa.parse<UserPreferences>(prefsCsv, { header: true, skipEmptyLines: true }).data[0];
        if (parsedPrefs) {
          await saveUserPreferences(parsedPrefs);
          await refreshUserPreferences(); // AuthContext function
          toast({ title: "Restore Progress", description: "Preferences restored."});
        }
      }
      updateProgress();

      // 2. Categories
      const categoriesFile = zip.file('goldquest_categories.csv');
      if (categoriesFile) {
        const categoriesCsv = await categoriesFile.async('text');
        const parsedCategories = Papa.parse<Category>(categoriesCsv, { header: true, skipEmptyLines: true }).data;
        for (const cat of parsedCategories) {
          if(cat.id && cat.name) { // Ensure critical fields are present
            try {
              const newCategory = await addCategoryToDb(cat.name, cat.icon);
              oldCategoryIdToNewIdMap[cat.id] = newCategory.id;
            } catch (e: any) {
              if (!e.message?.includes('already exists')) {
                 console.warn(`Skipping category restore due to error: ${e.message}`, cat);
                 overallSuccess = false;
              } else { // If it already exists, try to find and map its ID
                const existingCats = await getCategories();
                const existing = existingCats.find(ec => ec.name.toLowerCase() === cat.name.toLowerCase());
                if (existing) oldCategoryIdToNewIdMap[cat.id] = existing.id;
              }
            }
          }
        }
        toast({ title: "Restore Progress", description: "Categories restored."});
      }
      updateProgress();
      setCategories(await getCategories());


      // 3. Tags
      const tagsFile = zip.file('goldquest_tags.csv');
      if (tagsFile) {
        const tagsCsv = await tagsFile.async('text');
        const parsedTags = Papa.parse<Tag>(tagsCsv, { header: true, skipEmptyLines: true }).data;
        for (const tag of parsedTags) {
          if (tag.name) {
            try {
              await addTagToDb(tag.name);
            } catch (e: any) {
              if (!e.message?.includes('already exists')) {
                 console.warn(`Skipping tag restore due to error: ${e.message}`, tag);
                 overallSuccess = false;
              }
            }
          }
        }
        toast({ title: "Restore Progress", description: "Tags restored."});
      }
      updateProgress();
      setTags(await getTags());

      // 4. Accounts
      const accountsFile = zip.file('goldquest_accounts.csv');
      if (accountsFile) {
        const accountsCsv = await accountsFile.async('text');
        const parsedAccounts = Papa.parse<Account>(accountsCsv, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
        for (const acc of parsedAccounts) {
          if(acc.id && acc.name && acc.currency && acc.type ) { // Balance is no longer required for initial setup
            const newAccData: NewAccountData = {
                name: acc.name,
                type: acc.type,
                balance: 0, // Initialize with ZERO balance for restore
                currency: acc.currency,
                providerName: acc.providerName || 'Restored',
                category: acc.category || 'asset',
                isActive: acc.isActive !== undefined ? acc.isActive : true,
                lastActivity: acc.lastActivity || new Date().toISOString(),
                balanceDifference: acc.balanceDifference || 0,
                includeInNetWorth: acc.includeInNetWorth !== undefined ? acc.includeInNetWorth : true,
            };
            try {
              const newAccount = await addAccount(newAccData);
              oldAccountIdToNewIdMap[acc.id] = newAccount.id;
            } catch (e: any) {
              console.error(`Error restoring account ${acc.name}: ${e.message}`);
              overallSuccess = false;
            }
          }
        }
        toast({ title: "Restore Progress", description: "Accounts restored."});
      }
      updateProgress();
      setAccounts(await getAccounts());

      // 5. Groups
      const groupsFile = zip.file('goldquest_groups.csv');
      if (groupsFile) {
          const groupsCsv = await groupsFile.async('text');
          const parsedGroups = Papa.parse<{ id: string; name: string; categoryIds: string }>(groupsCsv, { header: true, skipEmptyLines: true }).data;
          for (const group of parsedGroups) {
              if (group.id && group.name) {
                  const oldCatIds = group.categoryIds ? group.categoryIds.split('|').filter(Boolean) : [];
                  const newCatIds = oldCatIds.map(oldId => oldCategoryIdToNewIdMap[oldId]).filter(Boolean);
                  try {
                      const newGroup = await addGroupToDb(group.name);
                      if (newCatIds.length > 0) {
                          await updateGroupInDb({ ...newGroup, categoryIds: newCatIds });
                      }
                      oldGroupIdToNewIdMap[group.id] = newGroup.id;
                  } catch (e: any) {
                      if (!e.message?.includes('already exists')) {
                          console.error(`Error restoring group ${group.name}: ${e.message}`);
                          overallSuccess = false;
                      } else {
                          const existingGroups = await getGroups();
                          const existing = existingGroups.find(eg => eg.name.toLowerCase() === group.name.toLowerCase());
                          if(existing) oldGroupIdToNewIdMap[group.id] = existing.id;
                      }
                  }
              }
          }
          toast({ title: "Restore Progress", description: "Groups restored." });
      }
      updateProgress();
      // setGroups(await getGroups()); // Assuming getGroups updates local state

      // 6. Transactions
      const transactionsFile = zip.file('goldquest_transactions.csv');
      if (transactionsFile) {
          const transactionsCsv = await transactionsFile.async('text');
          const parsedTransactions = Papa.parse<Transaction & { tags?: string, originalImportData?: string }>(transactionsCsv, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
          parsedTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by date to process in order

          for (const tx of parsedTransactions) {
              if (tx.id && tx.accountId && tx.date && tx.amount !== undefined && tx.transactionCurrency && tx.category) {
                  const newAccountId = oldAccountIdToNewIdMap[tx.accountId];
                  if (newAccountId) {
                      const newTxData: NewTransactionData = {
                          date: typeof tx.date === 'string' ? tx.date : formatDateFns(new Date(tx.date as any), 'yyyy-MM-dd'),
                          amount: typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount,
                          transactionCurrency: tx.transactionCurrency,
                          description: tx.description || 'Restored Transaction',
                          category: tx.category,
                          accountId: newAccountId,
                          tags: tx.tags ? (tx.tags as string).split('|').filter(Boolean) : [],
                          originalImportData: tx.originalImportData ? JSON.parse(tx.originalImportData as string) : undefined,
                      };
                      try {
                          // During restore, addTransaction will call modifyAccountBalance which will
                          // build up the balance from 0, as set during account creation in this function.
                          await addTransaction(newTxData);
                      } catch (e: any) {
                          console.error(`Error restoring transaction ${tx.description}: ${e.message}`);
                          overallSuccess = false;
                      }
                  } else {
                      console.warn(`Could not map old account ID ${tx.accountId} for transaction ${tx.description}`);
                  }
              }
          }
          toast({ title: "Restore Progress", description: "Transactions restored." });
      }
      updateProgress();

      // Placeholders for other data types (Subscriptions, Loans, CreditCards, Budgets)
      // For each, parse its CSV, remap IDs (accountId, categoryId, groupId etc.) and call its add service.
      const dataTypesToRestore = [
          { name: 'Subscriptions', file: 'goldquest_subscriptions.csv', addFn: addSubscriptionToDb, serviceName: 'subscription' },
          { name: 'Loans', file: 'goldquest_loans.csv', addFn: addLoanToDb, serviceName: 'loan' },
          { name: 'Credit Cards', file: 'goldquest_credit_cards.csv', addFn: addCreditCardToDb, serviceName: 'credit card' },
          { name: 'Budgets', file: 'goldquest_budgets.csv', addFn: addBudgetToDb, serviceName: 'budget' },
      ];

      for (const dataType of dataTypesToRestore) {
          const fileContent = zip.file(dataType.file);
          if (fileContent) {
              const csvData = await fileContent.async('text');
              const parsedItems = Papa.parse<any>(csvData, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
              for (const item of parsedItems) {
                  try {
                      let itemData = { ...item };
                      delete itemData.id; // Remove old ID
                      if (itemData.accountId) itemData.accountId = oldAccountIdToNewIdMap[itemData.accountId] || itemData.accountId;
                      if (itemData.groupId) itemData.groupId = oldGroupIdToNewIdMap[itemData.groupId] || itemData.groupId;
                      
                      if(dataType.serviceName === 'subscription' && itemData.tags && typeof itemData.tags === 'string') itemData.tags = itemData.tags.split('|').filter(Boolean);
                      if(dataType.serviceName === 'budget' && itemData.selectedIds && typeof itemData.selectedIds === 'string') {
                          const oldSelectedIds = itemData.selectedIds.split('|').filter(Boolean);
                          itemData.selectedIds = oldSelectedIds.map((oldId: string) => 
                            itemData.appliesTo === 'categories' ? oldCategoryIdToNewIdMap[oldId] : oldGroupIdToNewIdMap[oldId]
                          ).filter(Boolean);
                      }
                      // Convert date strings if necessary
                      if (itemData.startDate && typeof itemData.startDate !== 'string') itemData.startDate = formatDateFns(new Date(itemData.startDate), 'yyyy-MM-dd');
                      if (itemData.nextPaymentDate && typeof itemData.nextPaymentDate !== 'string') itemData.nextPaymentDate = formatDateFns(new Date(itemData.nextPaymentDate), 'yyyy-MM-dd');
                      if (itemData.endDate && typeof itemData.endDate !== 'string') itemData.endDate = formatDateFns(new Date(itemData.endDate), 'yyyy-MM-dd');
                      if (itemData.paymentDueDate && typeof itemData.paymentDueDate !== 'string') itemData.paymentDueDate = formatDateFns(new Date(itemData.paymentDueDate), 'yyyy-MM-dd');


                      await dataType.addFn(itemData);
                  } catch (e: any) {
                       console.error(`Error restoring ${dataType.name} item: ${e.message}`, item);
                       overallSuccess = false;
                  }
              }
              toast({ title: "Restore Progress", description: `${dataType.name} restored.` });
          }
          updateProgress();
      }


      if (overallSuccess) {
        toast({ title: "Restore Complete", description: "All data restored successfully.", duration: 5000 });
      } else {
        toast({ title: "Restore Partially Complete", description: "Some data could not be restored. Check console for errors.", variant: "destructive", duration: 10000 });
      }
      await fetchData(); // Refresh page data
      window.dispatchEvent(new Event('storage')); // Notify other components

    } catch (restoreError: any) {
      console.error("Full restore failed:", restoreError);
      setError(`Full restore failed: ${restoreError.message}`);
      toast({ title: "Restore Failed", description: restoreError.message || "An unknown error occurred during restore.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setImportProgress(100);
      setIsRestoreConfirmOpen(false);
      setZipFileForRestore(null);
    }
  };



  if (isLoadingAuth) {
      return <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 text-center"><p>Loading authentication...</p></div>;
  }
  if (!user && !isLoadingAuth) {
      return <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 text-center"><p>Please <Link href="/login" className="text-primary underline">login</Link> to manage data.</p></div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Data Management</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Step 1: Upload CSV or GoldQuest Backup ZIP File</CardTitle>
          <CardDescription>
            Select your CSV file (Firefly III export is best supported) or a GoldQuest backup ZIP file. Map columns if needed. Ensure file is UTF-8 encoded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv-file">Select File</Label>
            <Input id="csv-file" type="file" accept=".csv,text/csv,application/zip,application/x-zip-compressed" onChange={handleFileChange} disabled={isLoading && !isMappingDialogOpen}/>
          </div>

          {error && (
             <Alert variant={error.includes("Issues") || error.includes("Error") || error.includes("Failed") || error.includes("Missing") || error.includes("Critical") ? "destructive" : "default"}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{error.includes("Issues") || error.includes("Error") || error.includes("Failed") || error.includes("Missing") || error.includes("Critical") ? "Import Problem" : "Info"}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
             </Alert>
          )}

          <div className="flex flex-wrap gap-4">
             <Button onClick={handleParseAndMap} disabled={!file || (isLoading && !isMappingDialogOpen && !isRestoreConfirmOpen)}>
                {isLoading && !isMappingDialogOpen && !importProgress && !isRestoreConfirmOpen ? "Processing File..." : "Parse File & Map Columns"}
             </Button>
             <Button onClick={handleImport} disabled={(isLoading && !isMappingDialogOpen) || parsedData.length === 0 || parsedData.every(d => d.importStatus !== 'pending') || isRestoreConfirmOpen}>
               {isLoading && importProgress > 0 ? `Importing... (${importProgress}%)` : "Import Mapped Data"}
             </Button>
              <Button onClick={handleExportData} disabled={isExporting || (isLoading && !isMappingDialogOpen)}>
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Exporting..." : "Export All Data (ZIP)"}
              </Button>
               <AlertDialog>
                   <AlertDialogTrigger asChild>
                       <Button variant="destructive" disabled={(isLoading && !isMappingDialogOpen) || isClearing || isRestoreConfirmOpen}>
                           <Trash2 className="mr-2 h-4 w-4" />
                           {isClearing ? "Clearing..." : "Clear All User Data (DB)"}
                       </Button>
                   </AlertDialogTrigger>
                   <AlertDialogContent>
                       <AlertDialogHeader>
                           <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                           <AlertDialogDescription>
                               This action cannot be undone. This will permanently delete ALL your accounts, categories, tags, groups, subscriptions, transactions, loans, credit cards, and budgets from the database. This is intended for testing or resetting your data.
                           </AlertDialogDescription>
                       </AlertDialogHeader>
                       <AlertDialogFooter>
                           <AlertDialogCancel onClick={() => setIsClearing(false)} disabled={isClearing}>Cancel</AlertDialogCancel>
                           <AlertDialogAction onClick={handleClearData} disabled={isClearing} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
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
        
        <AlertDialog open={isRestoreConfirmOpen} onOpenChange={(open) => {
            if (!open) setZipFileForRestore(null); // Clear file if dialog is cancelled
            setIsRestoreConfirmOpen(open);
        }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Full Restore from Backup</AlertDialogTitle>
                    <AlertDialogDescription>
                        You've uploaded a GoldQuest backup ZIP file.
                        Restoring from this backup will <span className="font-bold text-destructive">clear all your current data</span> (accounts, transactions, categories, etc.) and replace it with the data from the backup.
                        This action cannot be undone. Are you sure you want to proceed?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => {setIsRestoreConfirmOpen(false); setZipFileForRestore(null);}} disabled={isLoading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleFullRestoreFromZip} disabled={isLoading} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        {isLoading ? "Restoring..." : "Yes, Restore from Backup"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>


       {accountPreviewData.length > 0 && !isLoading && !isRestoreConfirmOpen && (
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

      {parsedData.length > 0 && !isRestoreConfirmOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Review &amp; Import ({parsedData.filter(i => i.importStatus === 'pending').length} Pending Rows)</CardTitle>
            <CardDescription>Review transactions. Rows marked 'Error' or 'Skipped' (like Opening Balances) won't be imported as transactions. Edit fields if needed. Click "Import Mapped Data" above when ready.</CardDescription>
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
                                                {item.foreignAmount != null ? formatCurrency(item.foreignAmount, item.foreignCurrency || '', item.foreignCurrency || '', false) : '-'}</TableCell>
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
