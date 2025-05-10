'use client';

import type { FC, ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { startOfMonth, endOfMonth } from 'date-fns';

interface DateRangeContextType {
  selectedDateRange: DateRange;
  setSelectedDateRange: (range: DateRange) => void;
}

const defaultInitialRange: DateRange = {
  from: startOfMonth(new Date()),
  to: endOfMonth(new Date()),
};

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export const DateRangeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedDateRange, setSelectedDateRangeState] = useState<DateRange>(defaultInitialRange);

  const setSelectedDateRange = (range: DateRange) => {
    // Ensure 'to' is not before 'from', if 'from' exists
    if (range.from && range.to && range.from > range.to) {
        setSelectedDateRangeState({ from: range.from, to: range.from });
    } else {
        setSelectedDateRangeState(range);
    }
  };


  // TODO: Consider persisting this to localStorage if needed across sessions

  return (
    <DateRangeContext.Provider value={{ selectedDateRange, setSelectedDateRange }}>
      {children}
    </DateRangeContext.Provider>
  );
};

export const useDateRange = (): DateRangeContextType => {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error('useDateRange must be used within a DateRangeProvider');
  }
  return context;
};
