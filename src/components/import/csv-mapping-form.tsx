'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define the essential application fields the user needs to map to
// Added more options relevant to Firefly III and common formats
const APP_FIELDS = [
    { value: 'date', label: 'Date *', required: true },
    { value: 'amount', label: 'Amount (Signed +/-) *', required: true, description: "Primary column for transaction value (positive/negative)." },
    { value: 'amount_income', label: 'Income Amount', required: false, description: "Use if income has a separate positive column." },
    { value: 'amount_expense', label: 'Expense Amount', required: false, description: "Use if expense has a separate positive column." },
    { value: 'description', label: 'Description', required: false },
    { value: 'account', label: 'Account Name *', required: true, description: "Account nickname from your CSV." },
    { value: 'source_account', label: 'Source Account (Transfer)', required: false, description: "Account name the money came FROM (for transfers)." },
    { value: 'destination_account', label: 'Destination Account (Transfer)', required: false, description: "Account name the money went TO (for transfers)." },
    { value: 'category', label: 'Category', required: false },
    { value: 'accountCurrency', label: 'Account Currency Code', required: false, description: "e.g., BRL, USD, EUR. Helps set account currency." },
    { value: 'tags', label: 'Tags (comma-separated)', required: false },
    { value: 'initialBalance', label: 'Initial Account Balance', required: false, description: "Sets the starting balance for new accounts." },
    { value: 'notes', label: 'Notes/Memo', required: false },
    // Add other potentially useful fields like 'Transaction Type', 'Opposing Account', etc. later if needed
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
    // Check for either 'amount' OR ('amount_income' AND 'amount_expense')
    const hasSignedAmount = !!mappings['amount'];
    const hasIncomeExpense = !!mappings['amount_income'] && !!mappings['amount_expense'];
    let amountRequirementMet = hasSignedAmount || hasIncomeExpense;
    if (!amountRequirementMet && mappings['amount_income'] && !mappings['amount_expense']) {
        // If only income is mapped, maybe allow it but warn? For now, require both or signed amount.
        amountRequirementMet = false; // Revert if only one is present
    }
    if (!amountRequirementMet && !mappings['amount_income'] && mappings['amount_expense']) {
        // If only expense is mapped, maybe allow it but warn? For now, require both or signed amount.
        amountRequirementMet = false; // Revert if only one is present
    }


    const requiredAppFields = APP_FIELDS.filter(f => f.required);
    const missingMappings = requiredAppFields.filter(field => !mappings[field.value]);
    const missingFieldLabels = missingMappings.map(f => f.label);

    if (!amountRequirementMet) {
         missingFieldLabels.push("Amount (Signed +/-) * OR *both* Income Amount + Expense Amount");
    }


    if (missingFieldLabels.length > 0) {
        setError(`Please map the following required fields: ${missingFieldLabels.join(', ')}`);
        return;
    }
    onSubmit(mappings);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
       {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Mapping Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

      {APP_FIELDS.map(appField => (
        <div key={appField.value} className="grid grid-cols-2 items-center gap-x-4 gap-y-1">
          <div className="flex flex-col">
             <Label htmlFor={`map-${appField.value}`}>
                {appField.label}
                {appField.required && <span className="text-destructive ml-1">*</span>}
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
          Fields marked with * are essential. For amount, map either 'Amount (Signed +/-)' **OR** map **both** 'Income Amount' and 'Expense Amount'.
       </p>
       {/* Removed repetitive description texts as they are now part of the label section */}


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

