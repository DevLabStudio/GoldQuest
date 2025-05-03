
'use client';

import { useState, useEffect } from 'react'; // Import useEffect
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
import { getAccounts, addAccount, type Account, type NewAccountData } from '@/services/account-sync'; // To select target account + add account
import { getCategories, addCategory, type Category } from '@/services/categories.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { getCurrencySymbol } from '@/lib/currency'; // Import currency symbol getter

// Define a flexible type for parsed CSV rows
type CsvRecord = {
  [key: string]: string | undefined;
};

// Define the essential columns we *need* for basic import
// Adjust these based on the most common CSV formats you expect
const ESSENTIAL_TRANSACTION_COLUMNS = ['Date', 'Amount', 'Description'] as const;
// Define columns needed to identify/create accounts
const ACCOUNT_COLUMNS = ['Account'] as const; // Assuming a single 'Account' column for account name
// Define optional columns we can try to use
const OPTIONAL_COLUMNS = ['Category', 'Currency'] as const; // Currency for account, Category for transaction

type MappedTransaction = Omit<Transaction, 'id'> & {
  originalRecord: CsvRecord;
  importStatus: 'pending' | 'success' | 'error' | 'skipped'; // Add skipped status
  errorMessage?: string;
};

// Helper to find a column name case-insensitively
const findColumnName = (headers: string[], targetName: string): string | undefined => {
    return headers.find(header => header.trim().toLowerCase() === targetName.toLowerCase());
};


// Helper to parse amount string - more robust
const parseAmount = (amountStr: string | undefined): number => {
    if (typeof amountStr !== 'string' || amountStr.trim() === '') return 0;

    // Remove currency symbols and whitespace
    let cleaned = amountStr.replace(/[^\d.,-]/g, '').trim();

    const lastCommaIndex = cleaned.lastIndexOf(',');
    const lastPeriodIndex = cleaned.lastIndexOf('.');

    // Determine if comma or period is the likely decimal separator
    if (lastCommaIndex > lastPeriodIndex) {
        // Comma is likely the decimal separator (e.g., 1.234,56)
        // Remove periods (thousands separators), replace comma with period
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (lastPeriodIndex > lastCommaIndex) {
        // Period is likely the decimal separator (e.g., 1,234.56)
        // Remove commas (thousands separators)
        cleaned = cleaned.replace(/,/g, '');
    } else {
        // No separator or only one type exists, assume period is decimal if present
        cleaned = cleaned.replace(/,/g, ''); // Remove commas just in case
    }


    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed; // Return 0 if parsing fails
};


// Helper to parse date string - more robust
const parseDate = (dateStr: string | undefined): string => {
    if (!dateStr) return format(new Date(), 'yyyy-MM-dd'); // Default to today if missing
    try {
        // Try direct parsing first (handles ISO YYYY-MM-DD well)
        let parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
             return format(parsedDate, 'yyyy-MM-dd');
        }

        // Attempt common formats like DD/MM/YYYY or MM/DD/YYYY
        const parts = dateStr.split(/[\/\-\.]/); // Split by common separators
        if (parts.length === 3) {
            const [p1, p2, p3] = parts.map(Number);
            // Basic heuristics (can be improved with a library like date-fns/parse)
            // Try DD/MM/YYYY (common in Brazil/Europe)
             if (p1 > 0 && p1 <= 31 && p2 > 0 && p2 <= 12 && p3 >= 1900 && p3 < 2100) {
                 parsedDate = new Date(p3, p2 - 1, p1); // Month is 0-indexed
                 if (!isNaN(parsedDate.getTime())) return format(parsedDate, 'yyyy-MM-dd');
            }
             // Try MM/DD/YYYY (common in US)
            if (p1 > 0 && p1 <= 12 && p2 > 0 && p2 <= 31 && p3 >= 1900 && p3 < 2100) {
                 parsedDate = new Date(p3, p1 - 1, p2); // Month is 0-indexed
                 if (!isNaN(parsedDate.getTime())) return format(parsedDate, 'yyyy-MM-dd');
            }
        }


    } catch (e) {
        console.error("Error parsing date:", dateStr, e);
    }
    // Return a default if parsing fails critically
    console.warn(`Could not parse date "${dateStr}", defaulting to today.`);
    return format(new Date(), 'yyyy-MM-dd');
};



export default function ImportDataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<MappedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Target account selection removed, will auto-create/find accounts
  // const [targetAccount, setTargetAccount] = useState<string | undefined>(undefined);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]); // State for existing categories
  const [accountNameIdMap, setAccountNameIdMap] = useState<{ [key: string]: string }>({}); // Map CSV account name -> app account ID
  const { toast } = useToast();

  // Fetch accounts and categories on component mount
  useEffect(() => {
    const fetchData = async () => {
       if (typeof window !== 'undefined') {
            setIsLoading(true); // Start loading
            setError(null);
            try {
                const fetchedAccounts = await getAccounts();
                setAccounts(fetchedAccounts);
                const fetchedCategories = await getCategories(); // Fetch categories
                setCategories(fetchedCategories); // Store categories

                // Initialize account map with existing accounts
                const initialMap: { [key: string]: string } = {};
                 fetchedAccounts.forEach(acc => {
                    initialMap[acc.name.toLowerCase()] = acc.id; // Use lowercase for case-insensitive lookup later
                 });
                 setAccountNameIdMap(initialMap);

            } catch (err) {
                console.error("Failed to fetch initial data for import:", err);
                setError("Could not load accounts or categories. Please check console and try again.");
                 toast({
                    title: "Initialization Error",
                    description: "Failed to load accounts or categories.",
                    variant: "destructive",
                 });
            } finally {
                setIsLoading(false); // Stop loading
            }
       }
    };
    fetchData();
  }, [toast]); // Add toast to dependency array


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setError(null); // Clear previous errors
      setParsedData([]); // Clear previous parsed data
      setImportProgress(0);
    }
  };

   // Function to create missing accounts found in the CSV
   const createMissingAccounts = async (csvData: CsvRecord[], headers: string[]): Promise<boolean> => {
       const accountNameCol = findColumnName(headers, 'Account');
       const currencyCol = findColumnName(headers, 'Currency'); // Optional currency column

       if (!accountNameCol) {
           setError("CSV header is missing the required 'Account' column (case-insensitive). Cannot automatically create accounts.");
           return false; // Indicate failure
       }

       const uniqueAccountDetails = new Map<string, { name: string; currency: string }>();
       csvData.forEach(record => {
           const name = record[accountNameCol]?.trim();
           if (name) {
               const normalizedName = name.toLowerCase();
               if (!uniqueAccountDetails.has(normalizedName)) {
                   // Try to get currency from CSV, default to BRL
                   const currency = record[currencyCol]?.trim().toUpperCase() || 'BRL';
                    uniqueAccountDetails.set(normalizedName, { name: name, currency: currency });
               }
           }
       });

       let accountsCreatedCount = 0;
       const creationPromises = Array.from(uniqueAccountDetails.values()).map(async (accDetails) => {
           const normalizedName = accDetails.name.toLowerCase();
           if (!accountNameIdMap[normalizedName]) { // Check if account ID isn't already mapped
                try {
                    console.log(`Account "${accDetails.name}" not found, attempting to create...`);
                    // Make assumptions for type and category for now
                    const newAccountData: NewAccountData = {
                        name: accDetails.name,
                        type: 'checking', // Default type
                        balance: 0, // Initial balance set to 0, transactions will adjust it
                        currency: accDetails.currency, // Use currency from CSV or default
                        providerName: 'Imported', // Default provider name
                        category: 'asset', // Default category
                    };
                    const createdAccount = await addAccount(newAccountData);
                     // Update the map immediately after creation
                     setAccountNameIdMap(prevMap => ({
                        ...prevMap,
                        [normalizedName]: createdAccount.id
                     }));
                     accountsCreatedCount++;
                     console.log(`Successfully created account: ${createdAccount.name} (ID: ${createdAccount.id})`);
                } catch (err: any) {
                    console.error(`Failed to create account "${accDetails.name}":`, err);
                     toast({
                         title: "Account Creation Error",
                         description: `Could not create account "${accDetails.name}". Transactions for this account may be skipped or fail. Error: ${err.message}`,
                         variant: "destructive",
                         duration: 7000,
                     });
                }
           }
       });

       await Promise.all(creationPromises);

       if (accountsCreatedCount > 0) {
           toast({
               title: "Accounts Created",
               description: `Created ${accountsCreatedCount} new accounts found in the file.`,
           });
            // Refetch accounts state locally AFTER creation is done
             try {
                const updatedAccounts = await getAccounts();
                setAccounts(updatedAccounts); // Update local accounts state
             } catch { /* ignore error, already handled */ }
       }
       return true; // Indicate success or partial success
   };


  const handleParse = () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }
    // Target account selection removed
    // if (!targetAccount) {
    //     setError("Please select a target account for the import.");
    //     return;
    // }

    setIsLoading(true);
    setError(null);
    setParsedData([]);

    Papa.parse<CsvRecord>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: ParseResult<CsvRecord>) => { // Make complete async
        console.log("Parsed CSV Result Meta:", results.meta);
        console.log("Parsed CSV Result Errors:", results.errors);
        console.log("Parsed CSV Result Data (first 5 rows):", results.data.slice(0, 5));


         if (results.errors.length > 0 && !results.data.length) {
             const criticalError = results.errors[0];
             setError(`CSV Parsing Error: ${criticalError.message}. Code: ${criticalError.code}. Please ensure the file is a valid CSV and accessible.`);
             setIsLoading(false);
             return;
         }

         const rowErrors = results.errors.filter(e => e.row !== undefined);
         if (rowErrors.length > 0) {
             console.warn(`PapaParse encountered ${rowErrors.length} non-critical row errors during parsing. Attempting to process valid data.`);
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

        // Step 1: Create any missing accounts BEFORE mapping transactions
        const accountCreationSuccess = await createMissingAccounts(results.data, headers);
        if (!accountCreationSuccess) {
             // Error already set by createMissingAccounts
             setIsLoading(false);
             return;
         }


        // Find essential transaction columns
        const dateCol = findColumnName(headers, 'Date');
        const amountCol = findColumnName(headers, 'Amount');
        const descCol = findColumnName(headers, 'Description');
        // Find account column (required for linking)
        const accountCol = findColumnName(headers, 'Account');
        // Find optional columns
        const catCol = findColumnName(headers, 'Category');
        const currencyCol = findColumnName(headers, 'Currency'); // We use this primarily for account creation


        const missingEssential = ESSENTIAL_TRANSACTION_COLUMNS.filter(colName => !findColumnName(headers, colName));
         const missingAccountCol = ACCOUNT_COLUMNS.filter(colName => !findColumnName(headers, colName));

        if (missingEssential.length > 0 || missingAccountCol.length > 0) {
              const missing = [...missingEssential, ...missingAccountCol];
             setError(`Missing essential columns in CSV header (case-insensitive check): ${missing.join(', ')}. Required: Date, Amount, Description, Account. Found headers: ${headers.join(', ')}`);
             setIsLoading(false);
             return;
        }

        // Ensure required column names were found after checks
         if (!dateCol || !amountCol || !descCol || !accountCol) {
             setError(`Could not reliably find required columns (Date, Amount, Description, Account) in the header: ${headers.join(', ')}`);
             setIsLoading(false);
             return;
         }


        // Step 2: Map transaction data, linking to account IDs
        const mapped: MappedTransaction[] = results.data.map((record, index) => {
          try {
              const dateValue = record[dateCol];
              const amountValue = record[amountCol];
              const descriptionValue = record[descCol];
              const categoryValue = catCol ? record[catCol] : undefined;
              const accountNameValue = record[accountCol];


              if (dateValue === undefined || dateValue === null || dateValue.trim() === '') {
                  throw new Error(`Row ${index + 2}: Missing required data ('Date').`);
              }
               if (amountValue === undefined || amountValue === null || amountValue.trim() === '') {
                  throw new Error(`Row ${index + 2}: Missing required data ('Amount').`);
              }
               if (accountNameValue === undefined || accountNameValue === null || accountNameValue.trim() === '') {
                  throw new Error(`Row ${index + 2}: Missing required data ('Account').`);
              }


              const amount = parseAmount(amountValue);
              const description = descriptionValue?.trim() || 'No Description';
              let category = categoryValue?.trim() || 'Uncategorized';
              const accountName = accountNameValue.trim();
              const normalizedAccountName = accountName.toLowerCase();

              // Find the corresponding app account ID using the map
              const accountId = accountNameIdMap[normalizedAccountName];

              if (!accountId) {
                 // This should ideally not happen if createMissingAccounts worked, but handle defensively
                 console.warn(`Row ${index + 2}: Could not find or create account ID for "${accountName}". Skipping transaction.`);
                  return {
                     accountId: 'unknown', // Placeholder
                     date: parseDate(dateValue),
                     amount: amount,
                     description: description,
                     category: category,
                     originalRecord: record,
                     importStatus: 'skipped', // Mark as skipped
                     errorMessage: `Account "${accountName}" not found or could not be created.`,
                 };
              }

               // --- Basic Transfer Detection Attempt (Removed for simplicity, focus on direct import first) ---


              return {
                accountId: accountId, // Link to the correct account ID
                date: parseDate(dateValue),
                amount: amount,
                description: description,
                category: category,
                originalRecord: record,
                importStatus: 'pending',
              };
            } catch (rowError: any) {
                console.error(`Error processing row ${index + 2}:`, rowError);
                 return {
                    accountId: 'error', // Placeholder
                    date: parseDate(undefined),
                    amount: 0,
                    description: `Error Processing Row ${index + 2}`,
                    category: 'Uncategorized',
                    originalRecord: record,
                    importStatus: 'error',
                    errorMessage: rowError.message || 'Failed to process row.',
                 };
            }
        });

        const errorMappedData = mapped.filter(item => item.importStatus === 'error');
        const skippedMappedData = mapped.filter(item => item.importStatus === 'skipped');

        if (errorMappedData.length > 0 || skippedMappedData.length > 0) {
             const errorMsg = errorMappedData.length > 0 ? `${errorMappedData.length} row(s) had processing errors.` : '';
             const skippedMsg = skippedMappedData.length > 0 ? `${skippedMappedData.length} row(s) were skipped (e.g., account not found).` : '';
             setError(`Import Issues: ${errorMsg} ${skippedMsg} Please review the table below. Common issues include missing required data.`);
        } else if (results.errors.length > 0) {
             setError(`Warning: CSV parsing encountered ${results.errors.length} issues, but data was processed. Review carefully before importing.`);
        }


        setParsedData(mapped);
        setIsLoading(false);
      },
      error: (err: Error, file?: File) => {
        console.error("PapaParse File Reading/Parsing Error:", err, file);
         setError(`Failed to read or parse CSV file: ${err.message}. Ensure the file is accessible, uses standard encoding (like UTF-8), and has a valid structure.`);
        setIsLoading(false);
      }
    });
  };

 // Function to add new categories found in the CSV (remains largely the same)
 const addMissingCategories = async (transactions: MappedTransaction[]): Promise<void> => {
    const existingCategoryNames = new Set(categories.map(cat => cat.name.toLowerCase()));
    const categoriesToAdd = new Set<string>();

    transactions.forEach(tx => {
        // Process only pending transactions
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
                console.log(`Successfully added category: ${newCat.name} (ID: ${newCat.id})`);
                 setCategories(prev => [...prev, newCat]);
                 existingCategoryNames.add(newCat.name.toLowerCase());
            } catch (err: any) {
                console.error(`Failed to add category "${catName}":`, err);
                 toast({
                    title: "Category Add Error",
                    description: `Could not add category "${catName}". Transactions using it might fail. Error: ${err.message}`,
                    variant: "destructive",
                 });
            }
        });
        await Promise.all(addPromises);
         toast({
            title: "Categories Added",
            description: `Added ${categoriesToAdd.size} new categories found in the file.`,
         });
    }
 };


 const handleImport = async () => {
    // Target account check removed
    // if (!targetAccount) {
    //     setError("Please select a target account before importing.");
    //     return;
    // }

    const recordsToImport = parsedData.filter(item => item.importStatus === 'pending');
    if (recordsToImport.length === 0) {
        const hasErrorsOrSkipped = parsedData.some(d => d.importStatus === 'error' || d.importStatus === 'skipped');
        if(hasErrorsOrSkipped) {
             setError("No pending records to import. Check for errors or skipped items in the table below.");
        } else {
            setError("No data parsed or pending to import.");
        }
        return;
    }


    setIsLoading(true);
    setImportProgress(0);

    // Step 1: Add missing categories
    try {
       await addMissingCategories(recordsToImport);
        // Refetch categories after adding
        const updatedCategories = await getCategories();
        setCategories(updatedCategories);
    } catch (catErr) {
       console.error("Error during category creation phase:", catErr);
       // Decide if this should halt the import. For now, proceed with warnings.
    }

    // Step 2: Import transactions
    const totalToImport = recordsToImport.length;
    let importedCount = 0;
    let errorCount = 0;

    const updatedData = [...parsedData]; // Create a mutable copy

    for (let i = 0; i < updatedData.length; i++) {
        const item = updatedData[i];

        // Skip non-pending items
        if (item.importStatus !== 'pending') {
            if(item.importStatus === 'error' || item.importStatus === 'skipped') errorCount++;
            continue;
        }

        try {
             // Find category ID (case-insensitive) using the *updated* categories state
             const categoryName = item.category?.trim() || 'Uncategorized';
             const foundCategory = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
             const finalCategoryName = foundCategory ? foundCategory.name : 'Uncategorized';

            // Prepare transaction data - accountId is already set from parsing step
            const transactionPayload: Omit<Transaction, 'id'> = {
                accountId: item.accountId, // Use the linked account ID
                date: item.date,
                amount: item.amount,
                description: item.description,
                category: finalCategoryName,
            };
            await addTransaction(transactionPayload);
            updatedData[i] = { ...item, importStatus: 'success', errorMessage: undefined }; // Mark as success
            importedCount++;
        } catch (err: any) {
            console.error(`Failed to import record for row ${i+2}:`, err);
            updatedData[i] = { ...item, importStatus: 'error', errorMessage: err.message || 'Unknown import error' }; // Mark as error
            errorCount++;
        }

         // Update state incrementally
        setParsedData([...updatedData]);
        setImportProgress(calculateProgress(importedCount + errorCount, totalToImport));

    }

    setIsLoading(false);
    toast({
      title: "Import Complete",
      description: `Successfully imported ${importedCount} records. Failed or skipped: ${errorCount}.`,
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

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Import Transactions from CSV</CardTitle>
          <CardDescription>
            Import transactions from a comma-separated CSV file. Requires header row with at least <code className="bg-muted px-1 rounded">Date</code>, <code className="bg-muted px-1 rounded">Amount</code>, <code className="bg-muted px-1 rounded">Description</code>, and <code className="bg-muted px-1 rounded">Account</code> columns (case-insensitive). Optional <code className="bg-muted px-1 rounded">Category</code> and <code className="bg-muted px-1 rounded">Currency</code> (for new accounts) columns used if present. Accounts and categories found in the file will be created automatically if they don't exist.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={isLoading}/>
          </div>

          {/* Target Account Selector Removed */}
          {/* {accounts.length > 0 && ( ... )} */}
          {/* {accounts.length === 0 && !isLoading && ( ... )} */}

          {error && (
             <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
             </Alert>
          )}

          <div className="flex space-x-4">
              {/* Disable Parse if no file or loading */}
             <Button onClick={handleParse} disabled={!file || isLoading}>
                {isLoading && parsedData.length === 0 ? "Parsing..." : "Parse File & Create Accounts"}
             </Button>
              {/* Disable Import if no pending data or loading */}
             <Button onClick={handleImport} disabled={isLoading || parsedData.length === 0 || parsedData.every(d => d.importStatus !== 'pending')}>
               {isLoading && importProgress > 0 ? `Importing... (${importProgress}%)` : "Import Transactions"}
             </Button>
          </div>

           {isLoading && importProgress > 0 && (
               <Progress value={importProgress} className="w-full mt-4" />
           )}
        </CardContent>
      </Card>

      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Parsed Transactions ({parsedData.length})</CardTitle>
            <CardDescription>Review the parsed transactions before importing. Rows with errors or skipped rows (e.g., account issues) will not be imported.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead> {/* Show the linked account name */}
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((item, index) => {
                      // Find account name from the now-updated accounts state using item.accountId
                      const account = accounts.find(acc => acc.id === item.accountId);
                      const accountName = account?.name || item.originalRecord[findColumnName(Object.keys(item.originalRecord), 'Account') || ''] || 'Unknown'; // Show original name if lookup fails
                      const currencySymbol = account ? getCurrencySymbol(account.currency) : ''; // Get symbol from found account

                      return (
                          <TableRow key={index} className={
                              item.importStatus === 'success' ? 'bg-green-100/50 dark:bg-green-900/30' :
                              item.importStatus === 'error' ? 'bg-red-100/50 dark:bg-red-900/30' :
                              item.importStatus === 'skipped' ? 'bg-yellow-100/50 dark:bg-yellow-900/30' : ''
                          }>
                            <TableCell>{item.date}</TableCell>
                            <TableCell>{accountName}</TableCell> {/* Display account name */}
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell className={`text-right ${item.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {/* Display raw amount with currency symbol if available */}
                                {currencySymbol}{item.amount.toFixed(2)}
                            </TableCell>
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
