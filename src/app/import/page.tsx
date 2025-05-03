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
import { addTransaction, type Transaction } from '@/services/transactions.tsx';
import { getAccounts, addAccount, type Account, type NewAccountData } from '@/services/account-sync';
import { getCategories, addCategory, type Category } from '@/services/categories.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"; // Import Dialog
import { format } from 'date-fns';
import { getCurrencySymbol } from '@/lib/currency';
import CsvMappingForm, { type ColumnMapping } from '@/components/import/csv-mapping-form'; // Import the new mapping form component

// Define a flexible type for parsed CSV rows
type CsvRecord = {
  [key: string]: string | undefined;
};

// Define the essential *application* fields we need mapped
const APP_FIELDS = ['date', 'amount', 'description', 'account', 'category'] as const;
type AppField = typeof APP_FIELDS[number];

type MappedTransaction = Omit<Transaction, 'id'> & {
  originalRecord: CsvRecord;
  importStatus: 'pending' | 'success' | 'error' | 'skipped';
  errorMessage?: string;
};

// Helper to find a column name case-insensitively (remains useful)
const findColumnName = (headers: string[], targetName: string): string | undefined => {
    return headers.find(header => header?.trim().toLowerCase() === targetName.toLowerCase());
};

// Helper to parse amount string - more robust
const parseAmount = (amountStr: string | undefined): number => {
    if (typeof amountStr !== 'string' || amountStr.trim() === '') return 0;
    let cleaned = amountStr.replace(/[^\d.,-]/g, '').trim();
    const lastCommaIndex = cleaned.lastIndexOf(',');
    const lastPeriodIndex = cleaned.lastIndexOf('.');
    if (lastCommaIndex > lastPeriodIndex) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (lastPeriodIndex > lastCommaIndex) {
        cleaned = cleaned.replace(/,/g, '');
    } else {
        cleaned = cleaned.replace(/,/g, '');
    }
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
};

// Helper to parse date string - more robust
const parseDate = (dateStr: string | undefined): string => {
    if (!dateStr) return format(new Date(), 'yyyy-MM-dd');
    try {
        let parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
             return format(parsedDate, 'yyyy-MM-dd');
        }
        const parts = dateStr.split(/[\/\-\.]/);
        if (parts.length === 3) {
            const [p1, p2, p3] = parts.map(Number);
             // Try DD/MM/YYYY
             if (p1 > 0 && p1 <= 31 && p2 > 0 && p2 <= 12 && p3 >= 1900 && p3 < 2100) {
                 parsedDate = new Date(p3, p2 - 1, p1);
                 if (!isNaN(parsedDate.getTime())) return format(parsedDate, 'yyyy-MM-dd');
            }
             // Try MM/DD/YYYY
            if (p1 > 0 && p1 <= 12 && p2 > 0 && p2 <= 31 && p3 >= 1900 && p3 < 2100) {
                 parsedDate = new Date(p3, p1 - 1, p2);
                 if (!isNaN(parsedDate.getTime())) return format(parsedDate, 'yyyy-MM-dd');
            }
        }
    } catch (e) {
        console.error("Error parsing date:", dateStr, e);
    }
    console.warn(`Could not parse date "${dateStr}", defaulting to today.`);
    return format(new Date(), 'yyyy-MM-dd');
};

export default function ImportDataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]); // Store detected CSV headers
  const [rawData, setRawData] = useState<CsvRecord[]>([]); // Store raw parsed data
  const [parsedData, setParsedData] = useState<MappedTransaction[]>([]); // Store processed data for preview/import
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountNameIdMap, setAccountNameIdMap] = useState<{ [key: string]: string }>({});
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false); // Control mapping dialog
  const [columnMappings, setColumnMappings] = useState<ColumnMapping>({}); // Store user mappings
  const { toast } = useToast();

  // Fetch accounts and categories on mount (remains the same)
  useEffect(() => {
    const fetchData = async () => {
       if (typeof window !== 'undefined') {
            setIsLoading(true);
            setError(null);
            try {
                const fetchedAccounts = await getAccounts();
                setAccounts(fetchedAccounts);
                const fetchedCategories = await getCategories();
                setCategories(fetchedCategories);
                const initialMap: { [key: string]: string } = {};
                 fetchedAccounts.forEach(acc => {
                    initialMap[acc.name.toLowerCase()] = acc.id;
                 });
                 setAccountNameIdMap(initialMap);
            } catch (err) {
                console.error("Failed to fetch initial data for import:", err);
                setError("Could not load accounts or categories.");
                 toast({ title: "Initialization Error", description: "Failed to load data.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
       }
    };
    fetchData();
  }, [toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setError(null);
      setParsedData([]);
      setRawData([]); // Clear raw data
      setCsvHeaders([]); // Clear headers
      setImportProgress(0);
      setColumnMappings({}); // Reset mappings
    }
  };

  // Updated: Parse CSV and show mapping dialog
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
             setError(`CSV Parsing Error: ${criticalError.message}. Code: ${criticalError.code}.`);
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

         // Store headers and raw data
         setCsvHeaders(headers.filter(h => h != null) as string[]); // Filter out null/undefined headers
         setRawData(results.data);

         // Pre-fill mappings based on common names (case-insensitive)
         const initialMappings: ColumnMapping = {};
         initialMappings.date = findColumnName(headers, 'Date');
         initialMappings.amount = findColumnName(headers, 'Amount');
         initialMappings.description = findColumnName(headers, 'Description');
         initialMappings.account = findColumnName(headers, 'Account') || findColumnName(headers, 'Account Name') || findColumnName(headers, 'Source Account'); // Try common variations
         initialMappings.category = findColumnName(headers, 'Category');
         setColumnMappings(initialMappings);


         setIsMappingDialogOpen(true); // Open the mapping dialog
         setIsLoading(false);
      },
      error: (err: Error) => {
         setError(`Failed to read or parse CSV file: ${err.message}.`);
        setIsLoading(false);
      }
    });
  };

   // Function to process data *after* mapping is confirmed
   const processAndMapData = async (confirmedMappings: ColumnMapping) => {
        setIsLoading(true);
        setError(null);
        setParsedData([]);

        // --- 1. Validate Mappings ---
        const essentialAppFields: AppField[] = ['date', 'amount', 'account']; // Description is optional now
        const missingMappings = essentialAppFields.filter(field => !confirmedMappings[field]);
        if (missingMappings.length > 0) {
            setError(`Missing required column mappings: ${missingMappings.join(', ')}. Please map these fields.`);
            setIsLoading(false);
            return;
        }

        // Get mapped column names
        const dateCol = confirmedMappings.date!;
        const amountCol = confirmedMappings.amount!;
        const descCol = confirmedMappings.description; // Optional
        const accountCol = confirmedMappings.account!;
        const catCol = confirmedMappings.category; // Optional
        const currencyCol = confirmedMappings.currency; // Optional for account creation

        // --- 2. Create Missing Accounts (using mapped account column) ---
        const accountCreationSuccess = await createMissingAccounts(rawData, accountCol, currencyCol);
        if (!accountCreationSuccess) {
             // Error likely set within createMissingAccounts
             setIsLoading(false);
             return;
         }

        // --- 3. Map Transaction Data using Mappings ---
        const mapped: MappedTransaction[] = rawData.map((record, index) => {
          try {
              const dateValue = record[dateCol];
              const amountValue = record[amountCol];
              const descriptionValue = descCol ? record[descCol] : undefined; // Use mapped optional column
              const categoryValue = catCol ? record[catCol] : undefined; // Use mapped optional column
              const accountNameValue = record[accountCol];

              if (!dateValue) throw new Error(`Row ${index + 2}: Missing mapped 'Date' data.`);
              if (amountValue === undefined || amountValue === null) throw new Error(`Row ${index + 2}: Missing mapped 'Amount' data.`);
              if (!accountNameValue) throw new Error(`Row ${index + 2}: Missing mapped 'Account' data.`);

              const amount = parseAmount(amountValue);
              // Use description or default if column not mapped or empty
              const description = descriptionValue?.trim() || 'Imported Transaction';
              // Use category or default if column not mapped or empty
              let category = categoryValue?.trim() || 'Uncategorized';
              const accountName = accountNameValue.trim();
              const normalizedAccountName = accountName.toLowerCase();

              const accountId = accountNameIdMap[normalizedAccountName];

              if (!accountId) {
                 console.warn(`Row ${index + 2}: Could not find account ID for "${accountName}" after creation attempt. Skipping.`);
                  return {
                     accountId: 'unknown',
                     date: parseDate(dateValue),
                     amount: amount,
                     description: description,
                     category: category,
                     originalRecord: record,
                     importStatus: 'skipped',
                     errorMessage: `Account "${accountName}" not found or could not be created.`,
                 };
              }

              return {
                accountId: accountId,
                date: parseDate(dateValue),
                amount: amount,
                description: description,
                category: category,
                originalRecord: record,
                importStatus: 'pending',
              };
            } catch (rowError: any) {
                console.error(`Error processing row ${index + 2} with mappings:`, rowError);
                 return {
                    accountId: 'error',
                    date: parseDate(undefined),
                    amount: 0,
                    description: `Error Mapping Row ${index + 2}`,
                    category: 'Uncategorized',
                    originalRecord: record,
                    importStatus: 'error',
                    errorMessage: rowError.message || 'Failed to process row with mappings.',
                 };
            }
        });

        // --- 4. Handle Errors & Update State ---
        const errorMappedData = mapped.filter(item => item.importStatus === 'error');
        const skippedMappedData = mapped.filter(item => item.importStatus === 'skipped');
        if (errorMappedData.length > 0 || skippedMappedData.length > 0) {
             const errorMsg = errorMappedData.length > 0 ? `${errorMappedData.length} row(s) had processing errors.` : '';
             const skippedMsg = skippedMappedData.length > 0 ? `${skippedMappedData.length} row(s) were skipped.` : '';
             setError(`Import Issues: ${errorMsg} ${skippedMsg} Review the table. Common issues: missing mapped data, account errors.`);
        }

        setParsedData(mapped);
        setIsLoading(false);
        setIsMappingDialogOpen(false); // Close mapping dialog
        toast({ title: "Mapping Applied", description: "Review the transactions below before importing." });
   }


   // Function to create missing accounts found in the CSV (uses mapped columns)
   const createMissingAccounts = async (
       csvData: CsvRecord[],
       accountNameCol: string, // Mapped account column name
       currencyCol?: string    // Mapped optional currency column name
   ): Promise<boolean> => {
       const uniqueAccountDetails = new Map<string, { name: string; currency: string }>();
       csvData.forEach(record => {
           const name = record[accountNameCol]?.trim();
           if (name) {
               const normalizedName = name.toLowerCase();
               if (!uniqueAccountDetails.has(normalizedName)) {
                   // Use mapped currency column or default
                   const currency = (currencyCol && record[currencyCol]?.trim().toUpperCase()) || 'BRL';
                   // Basic validation for currency code length
                   const validCurrency = currency.length === 3 ? currency : 'BRL';
                    uniqueAccountDetails.set(normalizedName, { name: name, currency: validCurrency });
               }
           }
       });

       let accountsCreatedCount = 0;
       const creationPromises = Array.from(uniqueAccountDetails.values()).map(async (accDetails) => {
           const normalizedName = accDetails.name.toLowerCase();
           if (!accountNameIdMap[normalizedName]) {
                try {
                    console.log(`Account "${accDetails.name}" not found, attempting to create...`);
                    const newAccountData: NewAccountData = {
                        name: accDetails.name,
                        type: 'checking', // Default type
                        balance: 0,
                        currency: accDetails.currency,
                        providerName: 'Imported',
                        category: 'asset', // Default category (could refine if CSV has category info)
                    };
                    const createdAccount = await addAccount(newAccountData);
                     setAccountNameIdMap(prevMap => ({ ...prevMap, [normalizedName]: createdAccount.id }));
                     accountsCreatedCount++;
                     console.log(`Successfully created account: ${createdAccount.name} (ID: ${createdAccount.id})`);
                } catch (err: any) {
                    console.error(`Failed to create account "${accDetails.name}":`, err);
                     toast({ title: "Account Creation Error", description: `Could not create account "${accDetails.name}". Transactions may be skipped. Error: ${err.message}`, variant: "destructive", duration: 7000 });
                }
           }
       });

       await Promise.all(creationPromises);

       if (accountsCreatedCount > 0) {
           toast({ title: "Accounts Created", description: `Created ${accountsCreatedCount} new accounts.` });
           try {
              const updatedAccounts = await getAccounts();
              setAccounts(updatedAccounts);
           } catch { /* ignore refetch error */ }
       }
       return true; // Indicate completion
   };

   // Function to add missing categories (remains largely the same)
   const addMissingCategories = async (transactions: MappedTransaction[]): Promise<void> => {
      const existingCategoryNames = new Set(categories.map(cat => cat.name.toLowerCase()));
      const categoriesToAdd = new Set<string>();

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
          const addPromises = Array.from(categoriesToAdd).map(async (catName) => {
              try {
                  const newCat = await addCategory(catName);
                  console.log(`Successfully added category: ${newCat.name}`);
                  setCategories(prev => [...prev, newCat]);
                  existingCategoryNames.add(newCat.name.toLowerCase());
              } catch (err: any) {
                  console.error(`Failed to add category "${catName}":`, err);
                  toast({ title: "Category Add Error", description: `Could not add category "${catName}". Error: ${err.message}`, variant: "destructive" });
              }
          });
          await Promise.all(addPromises);
          toast({ title: "Categories Added", description: `Added ${categoriesToAdd.size} new categories.` });
      }
   };


   // handleImport remains mostly the same, but operates on `parsedData` which is now populated *after* mapping
   const handleImport = async () => {
      const recordsToImport = parsedData.filter(item => item.importStatus === 'pending');
      if (recordsToImport.length === 0) {
          setError(parsedData.some(d => d.importStatus === 'error' || d.importStatus === 'skipped') ? "No pending records. Check errors/skipped." : "No data parsed or pending.");
          return;
      }

      setIsLoading(true);
      setImportProgress(0);

      // Step 1: Add missing categories (based on mapped data)
      try {
         await addMissingCategories(recordsToImport);
          const updatedCategories = await getCategories(); // Refetch categories after potential adds
          setCategories(updatedCategories);
      } catch (catErr) {
         console.error("Error during category creation phase:", catErr);
      }

      // Step 2: Import transactions
      const totalToImport = recordsToImport.length;
      let importedCount = 0;
      let errorCount = 0;
      const updatedData = [...parsedData];

      for (let i = 0; i < updatedData.length; i++) {
          const item = updatedData[i];
          if (item.importStatus !== 'pending') {
              if(item.importStatus !== 'success') errorCount++;
              continue;
          }

          try {
               // Find category ID case-insensitively using *updated* categories state
               const categoryName = item.category?.trim() || 'Uncategorized';
               // Use find on the potentially updated categories list
               const foundCategory = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
               const finalCategoryName = foundCategory ? foundCategory.name : 'Uncategorized';

              const transactionPayload: Omit<Transaction, 'id'> = {
                  accountId: item.accountId,
                  date: item.date,
                  amount: item.amount,
                  description: item.description,
                  category: finalCategoryName, // Use found/defaulted name
              };
              await addTransaction(transactionPayload);
              updatedData[i] = { ...item, importStatus: 'success', errorMessage: undefined };
              importedCount++;
          } catch (err: any) {
              console.error(`Failed to import record for original row index ${i}:`, err);
              updatedData[i] = { ...item, importStatus: 'error', errorMessage: err.message || 'Unknown import error' };
              errorCount++;
          }
          setParsedData([...updatedData]);
          setImportProgress(calculateProgress(importedCount + errorCount, totalToImport));
      }

      setIsLoading(false);
      toast({
        title: "Import Complete",
        description: `Imported: ${importedCount}. Failed/Skipped: ${errorCount}.`,
        variant: errorCount > 0 ? "destructive" : "default",
        duration: 5000,
      });
    };

  // Helper to calculate progress percentage
  const calculateProgress = (processed: number, total: number): number => {
      if (total === 0) return 0;
      return Math.round((processed / total) * 100);
  }


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Import Data</h1>

      {/* Step 1: File Selection */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Step 1: Upload CSV File</CardTitle>
          <CardDescription>
            Select the CSV file containing your transactions. Ensure it has a header row.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={isLoading}/>
          </div>

          {error && (
             <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
             </Alert>
          )}

          <div className="flex space-x-4">
              {/* Button now triggers parsing AND mapping dialog */}
             <Button onClick={handleParseAndMap} disabled={!file || isLoading}>
                {isLoading ? "Parsing..." : "Parse & Map Columns"}
             </Button>
              {/* Import button is disabled until data is parsed AND mapped */}
             <Button onClick={handleImport} disabled={isLoading || parsedData.length === 0 || parsedData.every(d => d.importStatus !== 'pending')}>
               {isLoading && importProgress > 0 ? `Importing... (${importProgress}%)` : "Import Transactions"}
             </Button>
          </div>

           {isLoading && importProgress > 0 && (
               <Progress value={importProgress} className="w-full mt-4" />
           )}
        </CardContent>
      </Card>

        {/* Step 2: Column Mapping (Dialog) */}
        <Dialog open={isMappingDialogOpen} onOpenChange={setIsMappingDialogOpen}>
            <DialogContent className="sm:max-w-lg"> {/* Wider dialog */}
                <DialogHeader>
                    <DialogTitle>Step 2: Map CSV Columns</DialogTitle>
                    <DialogDescription>
                        Match the columns from your CSV file (left) to the required application fields (right).
                        Essential fields are Date, Amount, and Account.
                    </DialogDescription>
                </DialogHeader>
                <CsvMappingForm
                    csvHeaders={csvHeaders}
                    initialMappings={columnMappings} // Pass initial guesses
                    onSubmit={processAndMapData} // Function to call when mapping is confirmed
                    onCancel={() => setIsMappingDialogOpen(false)}
                />
                 {/* Footer removed as actions are in CsvMappingForm */}
            </DialogContent>
        </Dialog>


      {/* Step 3: Preview & Import (Table) */}
      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Review & Import ({parsedData.length} Transactions)</CardTitle>
            <CardDescription>Review the mapped transactions. Rows with errors or skipped rows will not be imported. Click "Import Transactions" above when ready.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Show headers based on successful mapping */}
                    {columnMappings.date && <TableHead>Date</TableHead>}
                    {columnMappings.account && <TableHead>Account</TableHead>}
                    {columnMappings.description && <TableHead>Description</TableHead>}
                    {columnMappings.category && <TableHead>Category</TableHead>}
                    {columnMappings.amount && <TableHead className="text-right">Amount</TableHead>}
                     <TableHead>Status</TableHead>
                     <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((item, index) => {
                      const account = accounts.find(acc => acc.id === item.accountId);
                      const accountName = account?.name || item.originalRecord[columnMappings.account || ''] || 'Unknown';
                      const currencySymbol = account ? getCurrencySymbol(account.currency) : '';

                      return (
                          <TableRow key={index} className={
                              item.importStatus === 'success' ? 'bg-green-100/50 dark:bg-green-900/30' :
                              item.importStatus === 'error' ? 'bg-red-100/50 dark:bg-red-900/30' :
                              item.importStatus === 'skipped' ? 'bg-yellow-100/50 dark:bg-yellow-900/30' : ''
                          }>
                            {columnMappings.date && <TableCell>{item.date}</TableCell>}
                            {columnMappings.account && <TableCell>{accountName}</TableCell>}
                            {columnMappings.description && <TableCell>{item.description}</TableCell>}
                            {columnMappings.category && <TableCell>{item.category}</TableCell>}
                            {columnMappings.amount && (
                                <TableCell className={`text-right ${item.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {currencySymbol}{item.amount.toFixed(2)}
                                </TableCell>
                            )}
                            <TableCell className="capitalize">{item.importStatus}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={item.errorMessage}>{item.errorMessage}</TableCell>
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