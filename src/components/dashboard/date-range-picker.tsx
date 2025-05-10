
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
  isSameDay,
  addDays,
} from 'date-fns';
import type { DateRange } from 'react-day-picker';

interface Preset {
  label: string;
  value: string;
  getRange: () => DateRange;
}

const today = new Date();

const presets: Preset[] = [
  {
    label: 'Today',
    value: 'today',
    getRange: () => ({ from: today, to: today }),
  },
  {
    label: 'Yesterday',
    value: 'yesterday',
    getRange: () => ({ from: subDays(today, 1), to: subDays(today, 1) }),
  },
  {
    label: 'Last 7 Days',
    value: 'last7days',
    getRange: () => ({ from: subDays(today, 6), to: today }),
  },
  {
    label: 'Last 30 Days',
    value: 'last30days',
    getRange: () => ({ from: subDays(today, 29), to: today }),
  },
  {
    label: 'This Month',
    value: 'thisMonth',
    getRange: () => ({ from: startOfMonth(today), to: endOfMonth(today) }),
  },
  {
    label: 'Last Month',
    value: 'lastMonth',
    getRange: () => ({
      from: startOfMonth(subMonths(today, 1)),
      to: endOfMonth(subMonths(today, 1)),
    }),
  },
  {
    label: 'This Year',
    value: 'thisYear',
    getRange: () => ({ from: startOfYear(today), to: endOfYear(today) }),
  },
  {
    label: 'Last Year',
    value: 'lastYear',
    getRange: () => ({
      from: startOfYear(subYears(today, 1)),
      to: endOfYear(subYears(today, 1)),
    }),
  },
  {
    label: 'All Time',
    value: 'allTime',
    getRange: () => ({ from: undefined, to: undefined }), // Or a very old date to today
  },
];

interface DateRangePickerProps {
  initialRange?: DateRange;
  onRangeChange: (range: DateRange) => void;
  className?: string;
}

const DateRangePicker: FC<DateRangePickerProps> = ({
  initialRange,
  onRangeChange,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(
    initialRange || presets.find(p => p.value === 'thisMonth')?.getRange()
  );
  const [displayLabel, setDisplayLabel] = useState<string>('This Month');

  useEffect(() => {
    if (initialRange) {
      setSelectedRange(initialRange);
      updateDisplayLabel(initialRange);
    }
  }, [initialRange]);

  const updateDisplayLabel = (range: DateRange | undefined) => {
    if (!range || (!range.from && !range.to)) {
      setDisplayLabel('All Time');
      return;
    }

    const matchingPreset = presets.find(p => {
        const presetRange = p.getRange();
        if (!presetRange.from && !range.from && !presetRange.to && !range.to) return p.value === 'allTime'; // All time match
        if (!presetRange.from || !range.from || !presetRange.to || !range.to) return false; // Avoid errors if one is undefined and other is not (unless both allTime)
        return isSameDay(presetRange.from, range.from) && isSameDay(presetRange.to, range.to);
    });

    if (matchingPreset) {
      setDisplayLabel(matchingPreset.label);
    } else if (range.from && range.to) {
      if (isSameDay(range.from, range.to)) {
        setDisplayLabel(format(range.from, 'MMM d, yyyy'));
      } else {
        setDisplayLabel(
          `${format(range.from, 'MMM d, yyyy')} - ${format(range.to, 'MMM d, yyyy')}`
        );
      }
    } else if (range.from) {
      setDisplayLabel(`From ${format(range.from, 'MMM d, yyyy')}`);
    } else if (range.to) {
      setDisplayLabel(`To ${format(range.to, 'MMM d, yyyy')}`);
    } else {
      setDisplayLabel('Select date range');
    }
  };

  const handlePresetSelect = (presetValue: string) => {
    const preset = presets.find((p) => p.value === presetValue);
    if (preset) {
      const newRange = preset.getRange();
      setSelectedRange(newRange);
      // Apply immediately for presets, or wait for "Apply" button for custom?
      // For now, let's apply immediately
      onRangeChange(newRange);
      updateDisplayLabel(newRange);
      if (preset.value !== 'custom') { // Close if not custom
        setIsOpen(false);
      }
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setSelectedRange(range);
    if (range?.from && !range.to) { // If only 'from' is selected, set 'to' to the same day to make it a single day range
        setSelectedRange({ from: range.from, to: range.from });
    }
  };

  const handleApplyCustomRange = () => {
    if (selectedRange) {
      let finalRange = selectedRange;
      // If only 'from' is selected in custom mode, make 'to' same as 'from'
      if (selectedRange.from && !selectedRange.to) {
        finalRange = { from: selectedRange.from, to: selectedRange.from };
        setSelectedRange(finalRange);
      } else if (!selectedRange.from && selectedRange.to) {
        // This case should ideally not happen if calendar enforces from before to
        finalRange = { from: selectedRange.to, to: selectedRange.to };
        setSelectedRange(finalRange);
      }

      onRangeChange(finalRange);
      updateDisplayLabel(finalRange);
    }
    setIsOpen(false);
  };


  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          id="date-range-picker"
          variant={'outline'}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selectedRange && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span>{displayLabel}</span>
          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 flex" align="start">
        <div className="flex-none w-48 border-r border-border p-2">
          <ul className="space-y-1">
            {presets.map((preset) => (
              <li key={preset.value}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start text-sm h-8',
                    displayLabel === preset.label && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => handlePresetSelect(preset.value)}
                >
                  {preset.label}
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-2">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={selectedRange?.from || new Date()}
            selected={selectedRange}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            disabled={(date) => date > new Date() || date < new Date('2000-01-01')}
          />
          <div className="flex justify-end gap-2 p-2 border-t border-border mt-2">
             <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
             <Button onClick={handleApplyCustomRange}>Apply</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateRangePicker;
