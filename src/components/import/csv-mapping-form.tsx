
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define the essential application fields the user needs to map to
const APP_FIELDS = [
    { value: 'date', label: 'Date *', required: true, description: "Transaction date." },
    { value: 'amount', label: 'Amount (Signed +/-) *', required: true, description: "Primary column for transaction value (e.g., Firefly: 'Amount'). Used if Income/Expense Amount not mapped." },
    { value: 'amount_income', label: 'Income Amount', required: false, description: "Use if income has a separate positive column (e.g., Firefly: 'Amount income')." },
    { value: 'amount_expense', label: 'Expense Amount', required: false, description: "Use if expense has a separate positive column (e.g., Firefly: 'Amount expense')." },
    { value: 'description', label: 'Description', required: false, description: "Transaction details (e.g., Firefly: 'Description'). If blank, 'Payee / Counterparty Name' may be used." },
    { value: 'account', label: 'Account Name *', required: true, description: "Primary account for the transaction (e.g., Firefly: 'Asset account (name)')." },
    { value: 'source_account', label: 'Source Account (Transfer)', required: false, description: "For transfers, the account money came FROM (e.g., Firefly: 'Source account (name)'). Crucial if 'Transaction Type' indicates a transfer." },
    { value: 'destination_account', label: 'Destination Account (Transfer)', required: false, description: "For transfers, the account money went TO (e.g., Firefly: 'Destination account (name)'). Crucial if 'Transaction Type' indicates a transfer." },
    { value: 'destination_name', label: 'Payee / Counterparty Name', required: false, description: "Name of the payee or other party (e.g., Firefly: 'Destination name'). Can be used as description." },
    { value: 'category', label: 'Category', required: false, description: "Transaction category (e.g., Firefly: 'Category')." },
    { value: 'accountCurrency', label: 'Account Currency Code', required: false, description: "e.g., BRL, USD, EUR. Helps set account currency (e.g., Firefly: 'Currency code', 'Source currency', 'Destination currency')." },
    { value: 'tags', label: 'Tags (comma-separated)', required: false, description: "Transaction tags (e.g., Firefly: 'Tags')." },
    { value: 'initialBalance', label: 'Initial Account Balance', required: false, description: "Sets starting balance for new accounts (e.g., Firefly: 'Initial balance', usually not on transaction rows unless it's an opening balance type)." },
    { value: 'notes', label: 'Notes/Memo', required: false, description: "Additional notes (e.g., Firefly: 'Notes')." },
    { value: 'transaction_type', label: 'Transaction Type', required: false, description: "e.g., Deposit, Withdrawal, Transfer, Opening Balance (e.g., Firefly: 'Type'). Helps interpret amounts and identify transfers/opening balances." }
] as const;


type AppFieldType = typeof APP_FIELDS[number]['value'];

// Allow mapping app field -> CSV header name, or potentially multiple headers for tags
export type ColumnMapping = Partial<Record<AppFieldType, string>>;

interface CsvMappingFormProps {
  csvHeaders: string[];
  initialMappings?: ColumnMapping; // Optional pre-filled mappings
  onSubmit: (mappings: ColumnMapping) => void;
  onCancel: () => void;
}

const CsvMappingForm: React.FC<CsvMappingFormProps> = ({
    csvHeaders,
    initialMappings = {},
    onSubmit,
    onCancel
}) => {
  const [mappings, setMappings] = useState<ColumnMapping>(initialMappings);
  const [error, setError] = useState<string | null>(null);

  const handleMappingChange = (appField: AppFieldType, csvHeader: string) => {
    setMappings(prev => ({
      ...prev,
      [appField]: csvHeader === "__IGNORE__" ? undefined : csvHeader // Store undefined if ignored
    }));
     setError(null); // Clear error on change
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields are mapped
    const hasSignedAmount = !!mappings['amount'];
    const hasIncomeExpense = !!mappings['amount_income'] && !!mappings['amount_expense'];
    let amountRequirementMet = hasSignedAmount || hasIncomeExpense;
    if (!amountRequirementMet && mappings['amount_income'] && !mappings['amount_expense']) {
        amountRequirementMet = false; 
    }
    if (!amountRequirementMet && !mappings['amount_income'] && mappings['amount_expense']) {
        amountRequirementMet = false; 
    }


    const requiredAppFields = APP_FIELDS.filter(f => f.required);
    const missingMappings = requiredAppFields.filter(field => !mappings[field.value]);
    let missingFieldLabels = missingMappings.map(f => f.label.replace(' *',''));

    if (!amountRequirementMet) {
         missingFieldLabels.push("Amount (Signed +/-) OR both Income Amount + Expense Amount");
    }

     const hasPrimaryAccount = !!mappings['account'];
     // For transfers, if type is transfer, then source AND destination are effectively required by the processing logic.
     // The form here just checks for 'Account Name' as a general requirement.
     // More specific validation (e.g. if type='transfer', then source/dest must be mapped) happens in processAndMapData
     if (!hasPrimaryAccount) {
         missingFieldLabels.push("Account Name");
     }


    if (missingFieldLabels.length > 0) {
        setError(`Please map the following required fields: ${missingFieldLabels.join(', ')}`);
        return;
    }
    onSubmit(mappings);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
       {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Mapping Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

      {APP_FIELDS.map(appField => (
        <div key={appField.value} className="grid grid-cols-2 items-start gap-x-4 gap-y-1">
          <div className="flex flex-col">
             <Label htmlFor={`map-${appField.value}`}>
                {appField.label}
             </Label>
              {appField.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{appField.description}</p>
              )}
          </div>
          <Select
            value={mappings[appField.value] || "__IGNORE__"} // Default to "Ignore" if not mapped
            onValueChange={(value) => handleMappingChange(appField.value, value)}
          >
            <SelectTrigger id={`map-${appField.value}`} className="text-xs">
              <SelectValue placeholder="Select CSV Column..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__IGNORE__" className="text-muted-foreground">
                -- Ignore this field --
              </SelectItem>
              {csvHeaders.map(header => (
                <SelectItem key={header} value={header}>
                  {header}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
       <p className="text-xs text-muted-foreground pt-2">
          Fields marked with * are essential. Map 'Account Name'. Map 'Amount (Signed +/-)' or both 'Income Amount' and 'Expense Amount'. For transfers identified by 'Transaction Type', ensure 'Source Account' and 'Destination Account' are also mapped.
       </p>


      <div className="flex justify-end space-x-2 pt-4 sticky bottom-0 bg-popover pb-4 pr-2 -mb-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Apply Mapping & Preview
        </Button>
      </div>
    </form>
  );
};

export default CsvMappingForm;

