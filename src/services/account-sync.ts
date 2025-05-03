
import { format } from 'date-fns'; // Import date-fns for formatting

/**
 * Represents a financial account.
 */
export interface Account {
  /**
   * The ID of the account.
   */
  id: string;
   /**
   * The name/nickname of the account given by the user.
   */
  name: string;
  /**
   * The type of the account (e.g., checking, savings, credit card). Often used as 'Role'.
   */
  type: string;
  /**
   * The current balance of the account.
   */
  balance: number;
  /**
   * The currency code for the account's balance (e.g., 'BRL', 'USD', 'EUR').
   */
  currency: string;
  /**
   * The name of the bank, institution, exchange, or wallet provider.
   */
  providerName?: string; // Renamed from bankName for generality
   /**
   * Placeholder: Indicates if the account is currently active.
   */
  isActive?: boolean;
  /**
   * Placeholder: The date of the last recorded activity for the account.
   */
  lastActivity?: string; // Store as ISO string or timestamp, format on display
  /**
   * Placeholder: The difference in balance since a certain point (e.g., last statement).
   */
  balanceDifference?: number;
  /**
   * Category of the account (e.g., traditional asset or crypto).
   */
  category: 'asset' | 'crypto';
}

/** Data needed to create an account, excluding the system-generated ID. */
export type NewAccountData = Omit<Account, 'id'>;


/**
 * Asynchronously retrieves a list of financial accounts.
 * Simulates fetching manually added accounts. In a real app, this would fetch from a database.
 *
 * @returns A promise that resolves to an array of Account objects.
 */
export async function getAccounts(): Promise<Account[]> {
   console.log("Simulating fetching accounts...");
   await new Promise(resolve => setTimeout(resolve, 500));

   const storedAccounts = localStorage.getItem('userAccounts');
   let accounts: Account[];

   if (storedAccounts) {
     try {
       // Parse and ensure placeholder fields exist
       const parsedAccounts = JSON.parse(storedAccounts) as Partial<Account>[];
        accounts = parsedAccounts.map(acc => ({
            ...getDefaultAccountValues(acc.category || 'asset'), // Apply defaults first based on category
            ...acc, // Override with stored values
        })) as Account[]; // Assert type after mapping
     } catch (e) {
       console.error("Failed to parse stored accounts, using default.", e);
       accounts = getDefaultAccounts();
       localStorage.setItem('userAccounts', JSON.stringify(accounts));
     }
   } else {
     accounts = getDefaultAccounts();
     localStorage.setItem('userAccounts', JSON.stringify(accounts));
   }

   return accounts;
}

// Helper function to provide default values for potentially missing fields
function getDefaultAccountValues(category: 'asset' | 'crypto'): Partial<Account> {
    return {
        isActive: true, // Assume active by default
        lastActivity: new Date().toISOString(), // Default to now
        balanceDifference: 0, // Default to zero difference
        category: category, // Ensure category is set
    };
}


function getDefaultAccounts(): Account[] {
  // Return an empty array or minimal default accounts
  return [
     // Example - can be removed
    /*
     {
        id: 'manual-123',
        name: 'Nubank',
        type: 'Default asset account', // Role
        balance: 2025.46,
        currency: 'BRL',
        providerName: '16981076797', // Account number/provider
        isActive: true,
        lastActivity: new Date(2025, 3, 30).toISOString(), // April 30th, 2025
        balanceDifference: 2025.46,
        category: 'asset',
      },
      */
  ];
}


/**
 * Simulates adding a new account to localStorage.
 * Adds default values for placeholder fields.
 * @param accountData - The data for the new account (without ID). Requires category.
 * @returns A promise resolving to the newly created account with an ID.
 */
export async function addAccount(accountData: NewAccountData): Promise<Account> {
    console.log("Simulating adding account:", accountData);
    await new Promise(resolve => setTimeout(resolve, 300));

    const newAccount: Account = {
        ...getDefaultAccountValues(accountData.category), // Add default placeholders based on category
        ...accountData, // User provided data overrides defaults
        id: `manual-${Math.random().toString(36).substring(2, 9)}`,
    };

    const currentAccounts = await getAccounts();
    const updatedAccounts = [...currentAccounts, newAccount];
    localStorage.setItem('userAccounts', JSON.stringify(updatedAccounts));

    console.log("Account added (simulated):", newAccount);
    return newAccount;
}

/**
 * Simulates updating an existing account in localStorage.
 * Ensures placeholder fields are preserved or updated.
 * @param updatedAccount - The account object with updated details. Must include the correct ID and category.
 * @returns A promise resolving to the updated account.
 */
export async function updateAccount(updatedAccount: Account): Promise<Account> {
    console.log("Simulating updating account:", updatedAccount.id);
    await new Promise(resolve => setTimeout(resolve, 300));

    const currentAccounts = await getAccounts();
    const accountIndex = currentAccounts.findIndex(acc => acc.id === updatedAccount.id);

    if (accountIndex === -1) {
        throw new Error(`Account with ID ${updatedAccount.id} not found.`);
    }

    // Ensure default values are present if not provided in update
    const accountWithDefaults: Account = {
        ...getDefaultAccountValues(updatedAccount.category), // Use category from updated account
        ...currentAccounts[accountIndex], // Get existing values including placeholders
        ...updatedAccount, // Apply updates
    };

    const updatedAccounts = [...currentAccounts];
    updatedAccounts[accountIndex] = accountWithDefaults;

    localStorage.setItem('userAccounts', JSON.stringify(updatedAccounts));

    console.log("Account updated (simulated):", accountWithDefaults);
    return accountWithDefaults;
}


/**
 * Simulates deleting an account by ID from localStorage.
 * @param accountId - The ID of the account to delete.
 * @returns A promise resolving when the deletion is complete.
 */
export async function deleteAccount(accountId: string): Promise<void> {
    console.log("Simulating deleting account:", accountId);
    await new Promise(resolve => setTimeout(resolve, 300));

    const currentAccounts = await getAccounts();
    const updatedAccounts = currentAccounts.filter(acc => acc.id !== accountId);
    localStorage.setItem('userAccounts', JSON.stringify(updatedAccounts));

    console.log("Account deleted (simulated):", accountId);
    return;
}
