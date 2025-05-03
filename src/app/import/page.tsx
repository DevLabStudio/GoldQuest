
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
import { addTransaction, type Transaction } from '@/services/transactions.tsx'; // Assuming addTransaction exists
import { getAccounts, type Account } from '@/services/account-sync'; // To select target account
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

// Define a flexible type for parsed CSV rows
type CsvRecord = {
  [key: string]: string | undefined;
};

// Define the essential columns we *need*
const ESSENTIAL_COLUMNS = ['Date', 'Amount', 'Description'] as const;
// Define optional columns we can try to use
const OPTIONAL_COLUMNS = ['Category'] as const; // Simplified 'Category (name)'

type MappedTransaction = Omit<Transaction, 'id' | 'accountId'> & {
  originalRecord: CsvRecord;
  importStatus: 'pending' | 'success' | 'error';
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
  const [targetAccount, setTargetAccount] = useState<string | undefined>(undefined);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const { toast } = useToast();

  // Fetch accounts on component mount
  useEffect(() => {
    const fetchAccounts = async () => {
       if (typeof window !== 'undefined') {
            try {
                const fetchedAccounts = await getAccounts();
                setAccounts(fetchedAccounts);
            } catch (err) {
                console.error("Failed to fetch accounts for import:", err);
                setError("Could not load accounts. Please add accounts before importing.");
            }
       }
    };
    fetchAccounts();
  }, []);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setError(null); // Clear previous errors
      setParsedData([]); // Clear previous parsed data
      setImportProgress(0);
    }
  };

  const handleParse = () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }
    if (!targetAccount) {
        setError("Please select a target account for the import.");
        return;
    }

    setIsLoading(true);
    setError(null);
    setParsedData([]);

    Papa.parse<CsvRecord>(file, {
      header: true, // Assumes first row is header
      skipEmptyLines: true,
      // `dynamicTyping`: false - Avoid auto-typing which can mess up amounts/dates
      // `loose`: true - Might help with rows having fewer fields than header, but let's handle manually
      complete: (results: ParseResult<CsvRecord>) => {
        console.log("Parsed CSV Result Meta:", results.meta);
        console.log("Parsed CSV Result Errors:", results.errors);
        console.log("Parsed CSV Result Data (first 5 rows):", results.data.slice(0, 5));


         // Check for critical PapaParse errors (e.g., file read)
         if (results.errors.length > 0 && !results.data.length) {
             const criticalError = results.errors[0];
             setError(`CSV Parsing Error: ${criticalError.message}. Code: ${criticalError.code}. Please ensure the file is a valid CSV and accessible.`);
             setIsLoading(false);
             return;
         }

         // Log non-critical row errors, but continue parsing
         const rowErrors = results.errors.filter(e => e.row !== undefined);
         if (rowErrors.length > 0) {
             console.warn(`PapaParse encountered ${rowErrors.length} non-critical row errors during parsing. Attempting to process valid data.`);
             // Optionally show a non-blocking warning to the user
             // setError(`Warning: Encountered ${rowErrors.length} potential issues during parsing. Review the data below carefully.`);
         }

        if (!results.data || results.data.length === 0) {
            setError("CSV file is empty or doesn't contain valid data rows.");
            setIsLoading(false);
            return;
        }

        // Validate that *essential* columns exist in the header row (results.meta.fields)
        const headers = results.meta.fields;
        if (!headers || headers.length === 0) {
             setError("Could not read CSV headers. Ensure the first row contains column names.");
             setIsLoading(false);
             return;
         }

        // Find actual header names case-insensitively
        const dateCol = findColumnName(headers, 'Date');
        const amountCol = findColumnName(headers, 'Amount');
        const descCol = findColumnName(headers, 'Description');
        const catCol = findColumnName(headers, 'Category'); // Optional

        const missingEssentialColumns = ESSENTIAL_COLUMNS.filter(colName => !findColumnName(headers, colName));

        if (missingEssentialColumns.length > 0) {
             setError(`Missing essential columns in CSV header (case-insensitive check): ${missingEssentialColumns.join(', ')}. Required: Date, Amount, Description. Found headers: ${headers.join(', ')}`);
             setIsLoading(false);
             return;
        }

        // Ensure required column names were found
         if (!dateCol || !amountCol || !descCol) {
             // This case should be covered by the previous check, but added for safety
             setError(`Could not reliably find required columns (Date, Amount, Description) in the header: ${headers.join(', ')}`);
             setIsLoading(false);
             return;
         }


        // Map data to our Transaction structure flexibly
        const mapped: MappedTransaction[] = results.data.map((record, index) => {
          try {
              // Extract data using the found column names
              const dateValue = record[dateCol];
              const amountValue = record[amountCol];
              const descriptionValue = record[descCol];
              const categoryValue = catCol ? record[catCol] : undefined;


              // Validate essential fields *per row*
              if (dateValue === undefined || dateValue === null || dateValue.trim() === '') {
                  throw new Error(`Row ${index + 2}: Missing required data ('Date').`);
              }
               if (amountValue === undefined || amountValue === null || amountValue.trim() === '') {
                  throw new Error(`Row ${index + 2}: Missing required data ('Amount').`);
              }

              const amount = parseAmount(amountValue); // Use updated robust parser
              const description = descriptionValue?.trim() || 'No Description'; // Use default if missing/empty
              let category = categoryValue?.trim() || 'Uncategorized'; // Default if missing/empty

              // --- Basic Transfer Detection Attempt (Optional & Simple) ---
              // This is a heuristic and might misclassify. A dedicated 'type' column is better.
              if (description.toLowerCase().includes('transfer') || category.toLowerCase() === 'transfer') {
                 // Basic check: if amount is positive, maybe incoming transfer, negative is outgoing
                 // This is NOT reliable without source/destination account info in the CSV.
                 // For now, we'll import transfers as regular income/expense based on amount sign.
                 // Consider skipping them or marking them for review if needed.
                 if (category.toLowerCase() === 'transfer') category = 'Uncategorized'; // Re-categorize generic 'Transfer'
                 console.log(`Row ${index + 2}: Potential transfer detected based on description/category. Importing as regular income/expense.`);
              }

              return {
                date: parseDate(dateValue),
                amount: amount, // Amount directly from CSV (can be positive/negative)
                description: description,
                category: category,
                originalRecord: record,
                importStatus: 'pending',
              };
            } catch (rowError: any) {
                // Catch errors during row mapping (like missing date/amount)
                console.error(`Error processing row ${index + 2}:`, rowError);
                 return {
                    date: parseDate(undefined), // Default date
                    amount: 0,
                    description: `Error Processing Row ${index + 2}`,
                    category: 'Uncategorized',
                    originalRecord: record,
                    importStatus: 'error',
                    errorMessage: rowError.message || 'Failed to process row.',
                 };
            }
        });

        // Filter out rows that had mapping errors if necessary, or show them as errors
        const errorMappedData = mapped.filter(item => item.importStatus === 'error');
        if (errorMappedData.length > 0) {
             setError(`Encountered errors processing ${errorMappedData.length} row(s). Please review the table below. Common issues include missing 'Date' or 'Amount' values, or invalid formats.`);
        } else if (results.errors.length > 0) {
             // If there were PapaParse errors but mapping succeeded, show a general warning
             setError(`Warning: CSV parsing encountered ${results.errors.length} issues, but data was processed. Review carefully before importing.`);
        }


        setParsedData(mapped); // Show all rows, including errors
        setIsLoading(false);
      },
      error: (err: Error, file?: File) => {
        // Catch file reading errors or other fundamental PapaParse errors
        console.error("PapaParse File Reading/Parsing Error:", err, file);
         // Provide a more informative error message
         setError(`Failed to read or parse CSV file: ${err.message}. Ensure the file is accessible, uses standard encoding (like UTF-8), and has a valid structure.`);
        setIsLoading(false);
      }
    });
  };

 const handleImport = async () => {
    if (!parsedData.length) {
      setError("No data parsed to import.");
      return;
    }
    if (!targetAccount) {
        setError("Please select a target account before importing.");
        return;
    }

    const recordsToImport = parsedData.filter(item => item.importStatus === 'pending');
    if (recordsToImport.length === 0) {
        setError("No pending records to import. Check for errors in the table below.");
        return;
    }


    setIsLoading(true);
    setImportProgress(0);
    const totalToImport = recordsToImport.length;
    let importedCount = 0;
    let errorCount = 0;

    const updatedData = [...parsedData]; // Create a mutable copy of the full list

    for (let i = 0; i < updatedData.length; i++) {
        const item = updatedData[i];

        // Skip already processed or errored items
        if (item.importStatus !== 'pending') {
            if(item.importStatus === 'error') errorCount++; // Recount errors
            continue;
        }

        // Example: Skip transfers if a dedicated mechanism isn't ready
        // (Remove this block if you want to import them as regular income/expense)
        // if (item.description.toLowerCase().includes('transfer') || item.category.toLowerCase() === 'transfer') {
        //     updatedData[i] = { ...item, importStatus: 'error', errorMessage: 'Transfer import skipped.' };
        //     errorCount++;
        //     setParsedData([...updatedData]);
        //     setImportProgress(calculateProgress(importedCount + errorCount, totalToImport));
        //     continue;
        // }


        try {
            // Prepare transaction data using the selected target account ID
            const transactionPayload: Omit<Transaction, 'id'> = {
            accountId: targetAccount, // Use the selected account
            date: item.date,
            amount: item.amount, // Use amount directly (can be +/-)
            description: item.description,
            category: item.category,
            };
            await addTransaction(transactionPayload);
            updatedData[i] = { ...item, importStatus: 'success', errorMessage: undefined }; // Clear previous errors
            importedCount++;
        } catch (err: any) {
            console.error(`Failed to import record for row ${i+2}:`, err);
            updatedData[i] = { ...item, importStatus: 'error', errorMessage: err.message || 'Unknown import error' };
            errorCount++;
        }

         // Update state incrementally to show progress visually
        setParsedData([...updatedData]);
        setImportProgress(calculateProgress(importedCount + errorCount, totalToImport));


        // Optional: Add a small delay to prevent overwhelming the system/API
        // await new Promise(resolve => setTimeout(resolve, 50));
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
      return Math.round((processed / total) * 100); // Return integer percentage
  }


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Import Data</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Import Transactions from CSV</CardTitle>
          <CardDescription>
            Import transactions from a comma-separated CSV file. Requires header row with at least <code className="bg-muted px-1 rounded">Date</code>, <code className="bg-muted px-1 rounded">Amount</code>, and <code className="bg-muted px-1 rounded">Description</code> columns (case-insensitive). Optional <code className="bg-muted px-1 rounded">Category</code> column used if present. Select a target account below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={isLoading}/>
          </div>

          {accounts.length > 0 && (
             <div className="grid w-full max-w-sm items-center gap-1.5">
                 <Label htmlFor="target-account">Target Account</Label>
                 <Select
                    value={targetAccount}
                    onValueChange={setTargetAccount}
                    disabled={isLoading || accounts.length === 0}
                 >
                    <SelectTrigger id="target-account">
                      <SelectValue placeholder="Select account to import into" />
                    </SelectTrigger>
                    <SelectContent>
                        {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                                {acc.name} ({acc.currency})
                            </SelectItem>
                        ))}
                    </SelectContent>
                 </Select>
                 <p className="text-sm text-muted-foreground">
                    All imported expenses/incomes will be added to this account.
                 </p>
             </div>
          )}
          {accounts.length === 0 && !isLoading && (
                <Alert variant="destructive">
                    <AlertTitle>No Accounts Found</AlertTitle>
                    <AlertDescription>Please add at least one account on the Accounts page before importing data.</AlertDescription>
                </Alert>
            )}

          {error && (
             <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
             </Alert>
          )}

          <div className="flex space-x-4">
             <Button onClick={handleParse} disabled={!file || !targetAccount || isLoading}>
                {isLoading && importProgress === 0 ? "Parsing..." : "Parse File"}
             </Button>
             <Button onClick={handleImport} disabled={!parsedData.length || isLoading || parsedData.every(d => d.importStatus !== 'pending')}>
               {isLoading && importProgress > 0 ? `Importing... (${importProgress}%)` : "Import Parsed Data"}
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
            <CardDescription>Review the parsed transactions before importing. Rows with errors will be skipped.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((item, index) => (
                    <TableRow key={index} className={
                        item.importStatus === 'success' ? 'bg-green-100/50 dark:bg-green-900/30' :
                        item.importStatus === 'error' ? 'bg-red-100/50 dark:bg-red-900/30' : ''
                    }>
                      <TableCell>{item.date}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className={`text-right ${item.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {item.amount.toFixed(2)} {/* Display raw amount from CSV */}
                      </TableCell>
                       <TableCell className="capitalize">{item.importStatus}</TableCell>
                       <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={item.errorMessage}>{item.errorMessage}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
