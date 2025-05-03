
'use client';

import { useState } from 'react';
import Papa from 'papaparse';
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

// Define the expected structure of Firefly III CSV export (default format)
// Adjust based on the actual CSV structure if needed.
interface FireflyIIIRecord {
  'Date': string; // e.g., "2023-10-26"
  'Amount': string; // e.g., "-12.34" or "500.00"
  'Description': string;
  'Source account (name)': string; // May be empty if type is deposit/withdrawal
  'Destination account (name)': string; // May be empty if type is deposit/withdrawal
  'Category (name)': string; // e.g., "Groceries"
  'Budget (name)'?: string; // Optional
  'Transaction type'?: string; // Optional, e.g., "withdrawal", "deposit", "transfer"
  // Add other relevant columns if present in your specific Firefly III export
}

type MappedTransaction = Omit<Transaction, 'id' | 'accountId'> & {
  originalRecord: FireflyIIIRecord;
  importStatus: 'pending' | 'success' | 'error';
  errorMessage?: string;
};

// Helper to guess transaction type based on Firefly data
const mapFireflyType = (record: FireflyIIIRecord): 'expense' | 'income' | 'transfer' => {
    if (record['Transaction type']?.toLowerCase() === 'transfer') {
        return 'transfer';
    }
    const amount = parseFloat(record['Amount']);
    if (amount < 0) {
        return 'expense';
    }
    if (amount > 0) {
        return 'income';
    }
    // Default or handle zero amount cases if necessary
    return 'expense'; // Or throw error?
};

// Helper to parse amount string
const parseAmount = (amountStr: string): number => {
    // Remove currency symbols, thousands separators, etc. Handle different decimal separators if needed.
    const cleaned = amountStr.replace(/[^0-9.,-]/g, '').replace(',', '.');
    return parseFloat(cleaned);
};

// Helper to parse date string (assuming YYYY-MM-DD or similar ISO-like format)
const parseDate = (dateStr: string): string => {
    try {
        // Attempt to parse common formats, default to ISO string if possible
        const parsedDate = new Date(dateString);
        if (!isNaN(parsedDate.getTime())) {
             // Firefly usually uses YYYY-MM-DD, ensure correct format for service
             return format(parsedDate, 'yyyy-MM-dd');
        }
        // Fallback or further parsing attempts for other formats (e.g., DD/MM/YYYY)
        // const parts = dateStr.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
        // if (parts) {
        //   // Assuming DD/MM/YYYY - adjust if needed
        //   const date = new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]));
        //   if (!isNaN(date.getTime())) return format(date, 'yyyy-MM-dd');
        // }
    } catch (e) {
        console.error("Error parsing date:", dateStr, e);
    }
    // Return original string or throw error if parsing fails critically
    return dateStr; // Or handle error appropriately
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

    Papa.parse<FireflyIIIRecord>(file, {
      header: true, // Assumes first row is header
      skipEmptyLines: true,
      complete: (results) => {
        console.log("Parsed CSV Data:", results.data);
        if (results.errors.length > 0) {
            console.error("CSV Parsing Errors:", results.errors);
            setError(`Error parsing CSV: ${results.errors[0].message}. Please ensure the file is a valid Firefly III export.`);
            setIsLoading(false);
            return;
        }
        if (!results.data || results.data.length === 0) {
            setError("CSV file is empty or doesn't contain valid data rows.");
            setIsLoading(false);
            return;
        }
        // Validate expected columns exist
        const requiredColumns: (keyof FireflyIIIRecord)[] = ['Date', 'Amount', 'Description', 'Category (name)'];
        const firstRow = results.data[0];
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));
        if (missingColumns.length > 0) {
             setError(`Missing required columns in CSV: ${missingColumns.join(', ')}. Please use the default Firefly III export format.`);
             setIsLoading(false);
             return;
        }


        // Map Firefly data to our Transaction structure
        const mapped: MappedTransaction[] = results.data.map(record => {
          const amount = parseAmount(record.Amount);
          const type = mapFireflyType(record);
          let description = record.Description;
          let category = record['Category (name)'];

           // Basic transfer description enrichment
          if (type === 'transfer') {
              description = `Transfer ${amount > 0 ? 'from ' + record['Source account (name)'] : 'to ' + record['Destination account (name)']}` + (record.Description ? ` (${record.Description})` : '');
              category = 'Transfer'; // Standardize transfer category
          }

          return {
            date: parseDate(record.Date),
            amount: amount, // Amount directly from CSV (can be positive/negative)
            description: description || 'No Description',
            category: category || 'Uncategorized',
            originalRecord: record,
            importStatus: 'pending',
          };
        });
        setParsedData(mapped);
        setIsLoading(false);
      },
      error: (err) => {
        console.error("PapaParse Error:", err);
        setError(`Failed to parse CSV file: ${err.message}`);
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


    setIsLoading(true);
    setImportProgress(0);
    const totalRecords = parsedData.length;
    let importedCount = 0;
    let errorCount = 0;

    const updatedData = [...parsedData]; // Create a mutable copy

    for (let i = 0; i < totalRecords; i++) {
      const item = updatedData[i];

      // Skip transfers for now if not fully implemented
      if (mapFireflyType(item.originalRecord) === 'transfer') {
          updatedData[i] = { ...item, importStatus: 'error', errorMessage: 'Transfer import not yet supported.' };
          errorCount++;
          setImportProgress(((i + 1) / totalRecords) * 100);
          // Update state incrementally to show progress visually
           setParsedData([...updatedData]);
          continue; // Skip to next item
      }


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
        updatedData[i] = { ...item, importStatus: 'success' };
        importedCount++;
      } catch (err: any) {
        console.error(`Failed to import record ${i}:`, err);
        updatedData[i] = { ...item, importStatus: 'error', errorMessage: err.message || 'Unknown error' };
        errorCount++;
      }

      setImportProgress(((i + 1) / totalRecords) * 100);
      // Update state incrementally to show progress visually
      setParsedData([...updatedData]);

      // Optional: Add a small delay to prevent overwhelming the system/API
      // await new Promise(resolve => setTimeout(resolve, 50));
    }

    setIsLoading(false);
    toast({
      title: "Import Complete",
      description: `Successfully imported ${importedCount} records. Failed: ${errorCount}.`,
      variant: errorCount > 0 ? "destructive" : "default",
      duration: 5000,
    });
  };


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Import Data</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Import Transactions from CSV</CardTitle>
          <CardDescription>
            Import transactions exported from Firefly III (default CSV format).
            Select a target account for the imported transactions. Transfers will be skipped for now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} disabled={isLoading}/>
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

          {error && (
             <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
             </Alert>
          )}

          <div className="flex space-x-4">
             <Button onClick={handleParse} disabled={!file || !targetAccount || isLoading}>
                {isLoading ? "Parsing..." : "Parse File"}
             </Button>
             <Button onClick={handleImport} disabled={!parsedData.length || isLoading || parsedData.every(d => d.importStatus !== 'pending')}>
               {isLoading ? `Importing... (${Math.round(importProgress)}%)` : "Import Parsed Data"}
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
            <CardDescription>Review the parsed transactions before importing.</CardDescription>
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
                       <TableCell className="text-xs text-muted-foreground">{item.errorMessage}</TableCell>
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
