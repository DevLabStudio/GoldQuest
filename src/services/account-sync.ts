/**
 * Represents a financial account.
 */
export interface Account {
  /**
   * The ID of the account.
   */
  id: string;
  /**
   * The name of the account.
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
}

/**
 * Asynchronously retrieves a list of financial accounts.
 *
 * @returns A promise that resolves to an array of Account objects.
 */
export async function getAccounts(): Promise<Account[]> {
  // TODO: Implement this by calling an API.

  return [
    {
      id: '123',
      name: 'Checking Account',
      type: 'checking',
      balance: 1000,
    },
    {
      id: '456',
      name: 'Savings Account',
      type: 'savings',
      balance: 5000,
    },
  ];
}
