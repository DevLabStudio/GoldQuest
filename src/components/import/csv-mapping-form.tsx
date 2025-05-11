'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define the essential application fields the user needs to map to
const APP_FIELDS = [
    { value: 'date', label: 'Date *', required: true, description: "Transaction date (e.g., Firefly: 'date')." },
    { value: 'amount', label: 'Amount *', required: true, description: "Primary transaction value (e.g., Firefly: 'amount'). Sign (+/-) is important. For transfers, this is the value moved." },
    // amount_income and amount_expense are less common in standard Firefly CSVs where 'amount' is signed.
    // { value: 'amount_income', label: 'Income Amount', required: false, description: "Separate positive column for income." },
    // { value: 'amount_expense', label: 'Expense Amount', required: false, description: "Separate positive column for expense." },
    { value: 'description', label: 'Description', required: false, description: "Transaction details (e.g., Firefly: 'description')." },

    // Firefly III specific account fields:
    { value: 'source_name', label: 'Source Account/Name *', required: true, description: "For Withdrawals/Transfers: your asset account. For Deposits: the payer/source (e.g., Firefly: 'source_name')." },
    { value: 'destination_name', label: 'Destination Account/Name *', required: true, description: "For Deposits/Transfers: your asset account. For Withdrawals: the payee/recipient (e.g., Firefly: 'destination_name')." },
    { value: 'source_type', label: 'Source Account Type', required: false, description: "Type of source (e.g., Asset account, Revenue account from Firefly: 'source_type'). Helps identify asset accounts." },
    { value: 'destination_type', label: 'Destination Account Type', required: false, description: "Type of destination (e.g., Asset account, Expense account from Firefly: 'destination_type'). Helps identify asset accounts." },
    
    { value: 'category', label: 'Category', required: false, description: "Transaction category (e.g., Firefly: 'category')." },
    { value: 'currency_code', label: 'Currency Code *', required: true, description: "e.g., BRL, USD, EUR (e.g., Firefly: 'currency_code'). Essential for correct amounts." },
    // { value: 'foreign_currency_code', label: 'Foreign Currency Code', required: false, description: "Firefly: 'foreign_currency_code'." },
    // { value: 'foreign_amount', label: 'Foreign Amount', required: false, description: "Firefly: 'foreign_amount'." },
    { value: 'tags', label: 'Tags (comma-separated)', required: false, description: "Transaction tags (e.g., Firefly: 'tags')." },
    { value: 'notes', label: 'Notes/Memo', required: false, description: "Additional notes (e.g., Firefly: 'notes')." },
    { value: 'transaction_type', label: 'Transaction Type *', required: true, description: "Crucial for import logic. e.g., Withdrawal, Deposit, Transfer, Opening balance (e.g., Firefly: 'type')." }
] as const;


type AppFieldType = typeof APP_FIELDS[number]['value'];

export type ColumnMapping = Partial<Record<AppFieldType, string>>;

interface CsvMappingFormProps {
  csvHeaders: string[];
  initialMappings?: ColumnMapping;
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
      [appField]: csvHeader === "__IGNORE__" ? undefined : csvHeader
    }));
     setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const requiredAppFields = APP_FIELDS.filter(f => f.required);
    const missingMappings = requiredAppFields.filter(field => !mappings[field.value]);
    
    if (missingMappings.length > 0) {
        const missingFieldLabels = missingMappings.map(f => f.label.replace(' *',''));
        setError(`Please map the following required fields: ${missingFieldLabels.join(', ')}`);
        return;
    }

    // Specific Firefly III logic check
    if (!mappings.transaction_type) {
        setError("Mapping for 'Transaction Type' (e.g., Firefly 'type' column) is crucial for correct import logic. Please map this field.");
        return;
    }
     if (!mappings.source_name) {
        setError("Mapping for 'Source Account/Name' (e.g., Firefly 'source_name' column) is crucial. Please map this field.");
        return;
    }
    if (!mappings.destination_name) {
        setError("Mapping for 'Destination Account/Name' (e.g., Firefly 'destination_name' column) is crucial. Please map this field.");
        return;
    }
     if (!mappings.currency_code) {
        setError("Mapping for 'Currency Code' (e.g., Firefly 'currency_code' column) is crucial. Please map this field.");
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
            value={mappings[appField.value] || "__IGNORE__"}
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
          Fields marked with * are essential. For Firefly III CSVs, ensure 'type', 'amount', 'currency_code', 'date', 'source_name', and 'destination_name' are correctly mapped.
       </p>


      <div className="flex justify-end space-x-2 pt-4 sticky bottom-0 bg-popover pb-4 pr-2 -mb-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Apply Mapping &amp; Preview
        </Button>
      </div>
    </form>
  );
};

export default CsvMappingForm;
