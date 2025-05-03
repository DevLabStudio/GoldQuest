
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
   * The type of the account (e.g., checking, savings, credit card).
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
   * The name of the bank associated with the account. Optional for flexibility.
   */
  bankName?: string;
}


/**
 * Asynchronously retrieves a list of financial accounts.
 * Simulates fetching manually added accounts. In a real app, this would fetch from a database.
 *
 * @returns A promise that resolves to an array of Account objects.
 */
export async function getAccounts(): Promise<Account[]> {
  // Simulate fetching from storage (e.g., localStorage or a database)
  // For now, return a static example list.
   console.log("Simulating fetching accounts...");
   // Introduce a small delay to simulate network latency
   await new Promise(resolve => setTimeout(resolve, 500));

   // Retrieve existing accounts from localStorage or default to mock data
   const storedAccounts = localStorage.getItem('userAccounts');
   let accounts: Account[];

   if (storedAccounts) {
     try {
       accounts = JSON.parse(storedAccounts);
     } catch (e) {
       console.error("Failed to parse stored accounts, using default.", e);
       accounts = getDefaultAccounts();
     }
   } else {
     accounts = getDefaultAccounts();
     localStorage.setItem('userAccounts', JSON.stringify(accounts)); // Store default if nothing exists
   }

   return accounts;
}

function getDefaultAccounts(): Account[] {
  return [
    {
      id: 'manual-123',
      name: 'My Main Checking',
      type: 'checking',
      balance: 1572.50,
      currency: 'BRL', // Add currency
      bankName: 'Itaú Unibanco',
    },
    {
      id: 'manual-456',
      name: 'Emergency Fund',
      type: 'savings',
      balance: 8350.00,
      currency: 'BRL', // Add currency
      bankName: 'Nubank',
    },
     {
      id: 'manual-789',
      name: 'Travel Card USD',
      type: 'credit card',
      balance: -450.80, // Negative balance for credit card
      currency: 'USD', // Add currency
      bankName: 'Revolut (Europe/Global)',
    },
  ];
}


// Add functions to simulate adding/deleting accounts using localStorage

/**
 * Simulates adding a new account to localStorage.
 * @param accountData - The data for the new account (without ID).
 * @returns A promise resolving to the newly created account with an ID.
 */
export async function addAccount(accountData: Omit<Account, 'id'>): Promise<Account> {
    console.log("Simulating adding account:", accountData);
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate latency

    const newAccount: Account = {
        ...accountData,
        id: `manual-${Math.random().toString(36).substring(2, 9)}`, // Generate a mock ID
    };

    const currentAccounts = await getAccounts();
    const updatedAccounts = [...currentAccounts, newAccount];
    localStorage.setItem('userAccounts', JSON.stringify(updatedAccounts));

    console.log("Account added (simulated):", newAccount);
    return newAccount;
}

/**
 * Simulates deleting an account by ID from localStorage.
 * @param accountId - The ID of the account to delete.
 * @returns A promise resolving when the deletion is complete.
 */
export async function deleteAccount(accountId: string): Promise<void> {
    console.log("Simulating deleting account:", accountId);
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate latency

    const currentAccounts = await getAccounts();
    const updatedAccounts = currentAccounts.filter(acc => acc.id !== accountId);
    localStorage.setItem('userAccounts', JSON.stringify(updatedAccounts));

    console.log("Account deleted (simulated):", accountId);
    return;
}
