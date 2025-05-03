'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define the essential application fields the user needs to map to
const APP_FIELDS = [
    { value: 'date', label: 'Date *', required: true },
    { value: 'amount', label: 'Amount *', required: true },
    { value: 'description', label: 'Description', required: false },
    { value: 'account', label: 'Account Name *', required: true },
    { value: 'category', label: 'Category', required: false },
    { value: 'accountCurrency', label: 'Account Currency', required: false },
    { value: 'tags', label: 'Tags (comma-separated)', required: false },
    { value: 'initialBalance', label: 'Initial Balance', required: false }, // Added Initial Balance
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
    const requiredAppFields = APP_FIELDS.filter(f => f.required);
    const missingMappings = requiredAppFields.filter(field => !mappings[field.value]);

    if (missingMappings.length > 0) {
        setError(`Please map the following required fields: ${missingMappings.map(f => f.label).join(', ')}`);
        return;
    }
    onSubmit(mappings);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
       {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Mapping Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

      {APP_FIELDS.map(appField => (
        <div key={appField.value} className="grid grid-cols-2 items-center gap-4">
          <Label htmlFor={`map-${appField.value}`}>
            {appField.label}
            {appField.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Select
            value={mappings[appField.value] || "__IGNORE__"} // Default to "Ignore" if not mapped
            onValueChange={(value) => handleMappingChange(appField.value, value)}
          >
            <SelectTrigger id={`map-${appField.value}`}>
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
       <p className="text-sm text-muted-foreground pt-2">Fields marked with * are essential for basic import.</p>
       <p className="text-sm text-muted-foreground">Map 'Initial Balance' if available in your CSV to set starting balances.</p>
       <p className="text-sm text-muted-foreground">Map 'Account Currency' if your CSV has it, otherwise we'll try to guess or use a default.</p>
       <p className="text-sm text-muted-foreground">Map 'Tags' to a column containing comma-separated tags.</p>


      <div className="flex justify-end space-x-2 pt-4">
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

